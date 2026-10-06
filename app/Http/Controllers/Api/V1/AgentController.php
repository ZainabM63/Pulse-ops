<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AgentAction;
use App\Models\AgentRun;
use App\Models\Incident;
use App\Services\AgentActionExecutor;
use App\Services\AgentBrain;
use App\Services\MockAgentBrain;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AgentController extends Controller
{
    private const ACTION_LABELS = [
        'restart_service' => 'Restart Service',
        'scale_resources' => 'Scale Resources',
        'rollback_deployment' => 'Rollback Deployment',
        'send_notification' => 'Send Notification',
        'run_diagnostics' => 'Run Diagnostics',
        'create_followup' => 'Create Follow-up',
        'generate_postmortem' => 'Generate Post-Mortem',
        'resolve_incident' => 'Resolve Incident',
        'update_service_status' => 'Update Service Status',
    ];

    protected AgentBrain $brain;
    protected AgentActionExecutor $executor;

    public function __construct()
    {
        $this->brain = config('services.gemini.key')
            ? new AgentBrain()
            : new MockAgentBrain();
        $this->executor = new AgentActionExecutor();
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = AgentRun::with(['user', 'actions', 'incident'])
            ->where('user_id', $request->user()->id)
            ->latest();

        if ($request->filled('incident_id')) {
            $query->where('incident_id', $request->incident_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return \App\Http\Resources\AgentRunResource::collection(
            $query->paginate($request->integer('per_page', 25))
        );
    }

    public function show(Request $request, AgentRun $run): \App\Http\Resources\AgentRunResource
    {
        $this->authorizeRun($request, $run);
        $run->load(['user', 'actions', 'incident']);
        return new \App\Http\Resources\AgentRunResource($run);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'incident_id' => ['nullable', 'exists:incidents,id'],
            'message' => ['required', 'string', 'max:2000'],
            'mode' => ['sometimes', 'string', 'in:sequential,autonomous'],
        ]);

        $incident = null;
        $incidentContext = [];

        if ($validated['incident_id'] ?? null) {
            $incident = Incident::with(['services', 'activities', 'assignee', 'team'])
                ->findOrFail($validated['incident_id']);

            $incidentContext = [
                'id' => $incident->id,
                'title' => $incident->title,
                'severity' => $incident->severity,
                'status' => $incident->status,
                'description' => $incident->description,
                'services' => $incident->services->map(fn($s) => [
                    'id' => $s->id,
                    'name' => $s->name,
                    'status' => $s->status,
                ])->toArray(),
                'recent_activities' => $incident->activities->take(5)->map(fn($a) => [
                    'type' => $a->type,
                    'body' => $a->body,
                    'user' => $a->user?->name,
                ])->toArray(),
                'assignee' => $incident->assignee?->name,
                'team' => $incident->team?->name,
            ];
        }

        $toolCalls = $this->brain->decide($validated['message'], $incidentContext);

        $run = AgentRun::create([
            'incident_id' => $incident?->id,
            'user_id' => $request->user()->id,
            'title' => substr($validated['message'], 0, 100),
            'status' => 'pending',
            'mode' => $validated['mode'] ?? 'sequential',
        ]);

        foreach ($toolCalls as $call) {
            AgentAction::create([
                'agent_run_id' => $run->id,
                'type' => $call['type'],
                'label' => self::ACTION_LABELS[$call['type']] ?? $call['type'],
                'status' => 'pending',
                'input' => $call['input'] ?? null,
            ]);
        }

        $run->load(['user', 'actions', 'incident']);

        if (($validated['mode'] ?? 'sequential') === 'autonomous') {
            $run->update(['status' => 'running']);
            $results = $this->executeAll($run, $request->user()->id);
            $allActions = $run->actions()->get();
            $hasFailed = $allActions->contains('status', 'failed');
            $hasPending = $allActions->contains('status', 'pending');
            $finalStatus = $hasFailed ? 'failed' : ($hasPending ? 'running' : 'completed');
            $summary = $this->brain->summarize($validated['message'], $results);
            $run->update(['status' => $finalStatus, 'metadata' => array_merge($run->metadata ?? [], ['summary' => $summary])]);
        }

        return response()->json([
            'run' => new \App\Http\Resources\AgentRunResource($run->fresh()->load(['user', 'actions', 'incident'])),
        ], 201);
    }

    public function chat(Request $request, AgentRun $run): JsonResponse
    {
        $this->authorizeRun($request, $run);

        if (in_array($run->status, ['cancelled', 'completed', 'failed'])) {
            return response()->json(['message' => 'Cannot chat on a ' . $run->status . ' run'], 422);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $incident = $run->incident;
        $incidentContext = [];

        if ($incident) {
            $incident->load(['services', 'activities']);
            $incidentContext = [
                'id' => $incident->id,
                'title' => $incident->title,
                'severity' => $incident->severity,
                'status' => $incident->status,
                'services' => $incident->services->map(fn($s) => ['name' => $s->name, 'status' => $s->status])->toArray(),
            ];
        }

        $toolCalls = $this->brain->decide($validated['message'], $incidentContext);

        foreach ($toolCalls as $call) {
            AgentAction::create([
                'agent_run_id' => $run->id,
                'type' => $call['type'],
                'label' => self::ACTION_LABELS[$call['type']] ?? $call['type'],
                'status' => 'pending',
                'input' => $call['input'] ?? null,
            ]);
        }

        $run->update(['status' => 'pending']);
        $run->load(['actions', 'user', 'incident']);

        return response()->json([
            'run' => new \App\Http\Resources\AgentRunResource($run),
        ]);
    }

    public function execute(AgentRun $run, Request $request): JsonResponse
    {
        $this->authorizeRun($request, $run);

        if (!in_array($run->status, ['pending', 'running'])) {
            return response()->json(['message' => 'Run is not in an executable state'], 422);
        }

        $run->update(['status' => 'running']);
        $results = $this->executeAll($run, $request->user()->id);

        $summary = $this->brain->summarize($run->title, $results);

        $allActions = $run->actions()->get();
        $hasFailed = $allActions->contains('status', 'failed');
        $hasPending = $allActions->contains('status', 'pending');

        $finalStatus = $hasFailed ? 'failed' : ($hasPending ? 'running' : 'completed');
        $run->update(['status' => $finalStatus, 'metadata' => array_merge($run->metadata ?? [], ['summary' => $summary])]);

        return response()->json([
            'run' => new \App\Http\Resources\AgentRunResource($run->fresh()->load(['user', 'actions', 'incident'])),
            'summary' => $summary,
        ]);
    }

    public function cancel(AgentRun $run, Request $request): JsonResponse
    {
        $this->authorizeRun($request, $run);

        if (in_array($run->status, ['completed', 'cancelled'])) {
            return response()->json(['message' => 'Run is already finished'], 422);
        }

        $run->update(['status' => 'cancelled']);
        $run->actions()->where('status', 'pending')->update(['status' => 'skipped']);

        return response()->json([
            'message' => 'Agent run cancelled',
            'run' => new \App\Http\Resources\AgentRunResource($run->fresh()->load(['user', 'actions', 'incident'])),
        ]);
    }

    private function authorizeRun(Request $request, AgentRun $run): void
    {
        if ($run->user_id !== $request->user()->id) {
            throw new HttpException(403, 'Unauthorized access to this agent run');
        }
    }

    protected function executeAll(AgentRun $run, int $userId): array
    {
        $results = [];
        $pendingActions = $run->actions()->where('status', 'pending')->orderBy('id')->get();

        foreach ($pendingActions as $action) {
            try {
                $result = $this->executor->execute($action, $userId);
                $results[] = ['type' => $action->type, 'status' => 'completed', 'output' => $result];
            } catch (\Exception $e) {
                $results[] = ['type' => $action->type, 'status' => 'failed', 'error' => $e->getMessage()];
            }
        }

        return $results;
    }
}
