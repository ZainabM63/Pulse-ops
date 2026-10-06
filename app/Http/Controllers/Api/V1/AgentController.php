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
    protected bool $geminiLoop = false;

    public function __construct(?AgentBrain $brain = null, ?AgentActionExecutor $executor = null)
    {
        $this->brain = $brain ?: (config('services.gemini.key')
            ? new AgentBrain()
            : new MockAgentBrain());
        $this->executor = $executor ?: new AgentActionExecutor();
        // Only the real Gemini brain supports the observe → re-decide loop.
        // The keyword (mock) brain is deterministic and must keep its
        // single-round behaviour.
        $this->geminiLoop = ($this->brain instanceof AgentBrain)
            && !($this->brain instanceof MockAgentBrain);
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

        if ($validated['incident_id'] ?? null) {
            $incident = Incident::findOrFail($validated['incident_id']);
        }

        $incidentContext = $this->buildIncidentContext($incident);

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
            $results = $this->executeWithLoop($run, $validated['message'], $request->user()->id);
            $this->finalizeRun($run, $validated['message'], $results);
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

        $incidentContext = $this->buildIncidentContext($run->incident);

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
        $results = $this->executeWithLoop($run, $run->title, $request->user()->id);
        $this->finalizeRun($run, $run->title, $results);

        return response()->json([
            'run' => new \App\Http\Resources\AgentRunResource($run->fresh()->load(['user', 'actions', 'incident'])),
            'summary' => $run->metadata['summary'] ?? null,
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

    protected function executeAll(AgentRun $run, int $userId, ?\Illuminate\Support\Collection $actions = null): array
    {
        $results = [];
        $pendingActions = $actions ?? $run->actions()->where('status', 'pending')->orderBy('id')->get();

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

    /**
     * Execute the incident response with an observe → re-decide loop.
     *
     * Round 1 runs the actions already planned. When the real Gemini brain is
     * active, results are fed back and it keeps deciding the next best batch
     * until it returns an empty array, every action fails, or the round cap is
     * reached. The deterministic keyword brain keeps its single-round behaviour.
     */
    protected function executeWithLoop(AgentRun $run, string $message, int $userId, int $maxRounds = 5): array
    {
        $results = [];
        $history = [];
        $round = 0;

        while ($round < $maxRounds) {
            $round++;

            if ($round === 1) {
                // Execute whatever the initial plan already scheduled.
            } elseif ($this->geminiLoop) {
                $toolCalls = $this->brain->decide(
                    $this->buildContinueMessage($message, $history),
                    $this->buildIncidentContext($run->incident)
                );

                if (empty($toolCalls)) {
                    break;
                }

                foreach ($toolCalls as $call) {
                    AgentAction::create([
                        'agent_run_id' => $run->id,
                        'type' => $call['type'],
                        'label' => self::ACTION_LABELS[$call['type']] ?? $call['type'],
                        'status' => 'pending',
                        'input' => $call['input'] ?? null,
                    ]);
                }
            } else {
                break;
            }

            $pending = $run->actions()->where('status', 'pending')->orderBy('id')->get();
            if ($pending->isEmpty()) {
                break;
            }

            $roundResults = $this->executeAll($run, $userId, $pending);
            $results = array_merge($results, $roundResults);
            $history[] = $this->formatResults($roundResults);

            // Stop early if nothing in this round made progress.
            if (collect($roundResults)->every(fn ($r) => $r['status'] === 'failed')) {
                break;
            }

            $run->update(['status' => 'running', 'metadata' => array_merge($run->metadata ?? [], ['round' => $round])]);
        }

        return $results;
    }

    protected function finalizeRun(AgentRun $run, string $message, array $results): void
    {
        $summary = $this->brain->summarize($message, $results);

        $allActions = $run->actions()->get();
        $hasFailed = $allActions->contains('status', 'failed');
        $hasPending = $allActions->contains('status', 'pending');
        $finalStatus = $hasFailed ? 'failed' : ($hasPending ? 'running' : 'completed');

        $run->update([
            'status' => $finalStatus,
            'metadata' => array_merge($run->metadata ?? [], ['summary' => $summary]),
        ]);
    }

    /**
     * Build a rich, decision-ready snapshot of the incident: linked services
     * (with severity + team), activity timeline, hypotheses and telemetry.
     */
    protected function buildIncidentContext(?Incident $incident): array
    {
        if (!$incident) {
            return [];
        }

        $incident->load([
            'services.team',
            'activities.user',
            'hypotheses.user',
            'telemetryLogs.service',
        ]);

        return [
            'id' => $incident->id,
            'title' => $incident->title,
            'severity' => $incident->severity,
            'status' => $incident->status,
            'description' => $incident->description,
            'acknowledged' => $incident->acknowledged_at?->toISOString(),
            'services' => $incident->services->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'status' => $s->status,
                'severity_level' => $s->severity_level,
                'team' => $s->team?->name,
            ])->values()->toArray(),
            'assignee' => $incident->assignee?->name,
            'team' => $incident->team?->name,
            'recent_activities' => $incident->activities->sortByDesc('id')->take(8)->map(fn ($a) => [
                'type' => $a->type,
                'body' => $a->body,
                'user' => $a->user?->name,
            ])->values()->toArray(),
            'hypotheses' => $incident->hypotheses->sortByDesc('id')->take(5)->map(fn ($h) => [
                'title' => $h->title,
                'confidence' => $h->confidence,
                'status' => $h->status,
            ])->values()->toArray(),
            'telemetry' => $incident->telemetryLogs->sortByDesc('logged_at')->take(8)->map(fn ($t) => [
                'level' => $t->level,
                'message' => $t->message,
                'source' => $t->source,
                'service' => $t->service?->name,
                'logged_at' => $t->logged_at?->toISOString(),
            ])->values()->toArray(),
        ];
    }

    protected function buildContinueMessage(string $message, array $history): string
    {
        return "Continue the incident response already in progress. Original request: {$message}\n\n"
            ."Actions already executed:\n".implode("\n", $history)
            ."\n\nDecide the next best action(s) using the available tools. If the incident is now fully handled, "
            .'return an empty array []. Do not repeat tools that already succeeded.';
    }

    protected function formatResults(array $results): string
    {
        $lines = [];

        foreach ($results as $r) {
            if (($r['status'] ?? '') === 'completed') {
                $output = $r['output'] ?? [];
                $detail = '';
                foreach (['service', 'service_name'] as $key) {
                    if (isset($output[$key])) {
                        $detail .= " service={$output[$key]}";
                        break;
                    }
                }
                if (isset($output['replicas'])) {
                    $detail .= " replicas={$output['replicas']}";
                }
                if (isset($output['version'])) {
                    $detail .= " version={$output['version']}";
                }
                if (isset($output['message'])) {
                    $detail .= ' message='.mb_substr((string) $output['message'], 0, 140);
                }
                if (isset($output['delivered_to'])) {
                    $detail .= ' delivered_to='.implode(',', (array) $output['delivered_to']);
                }
                $lines[] = "- {$r['type']}: OK{$detail}";
            } else {
                $lines[] = "- {$r['type']}: FAILED ({$r['error']})";
            }
        }

        return mb_substr(implode("\n", $lines), 0, 2000);
    }
}
