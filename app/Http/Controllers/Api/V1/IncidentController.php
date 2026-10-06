<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\ChatMessageBroadcast;
use App\Events\IncidentUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIncidentRequest;
use App\Http\Requests\UpdateIncidentRequest;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use App\Models\IncidentActivity;
use App\Services\IncidentNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class IncidentController extends Controller
{
    public function __construct(private IncidentNotifier $notifier) {}
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Incident::with(['reporter', 'assignee', 'team', 'services'])
            ->latest();

        if ($request->filled('severity')) {
            $query->where('severity', $request->severity);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('assignee_id')) {
            $query->where('assignee_id', $request->assignee_id);
        }

        if ($request->boolean('unassigned')) {
            $query->whereNull('assignee_id');
        }

        $incidents = $query->paginate($request->integer('per_page', 25));

        return IncidentResource::collection($incidents);
    }

    public function show(Incident $incident): IncidentResource
    {
        $incident->load(['reporter', 'assignee', 'team', 'services', 'activities.user']);

        return new IncidentResource($incident);
    }

    public function store(StoreIncidentRequest $request): JsonResponse
    {
        $incident = Incident::create([
            'company_id' => $request->user()->company_id,
            'title' => $request->title,
            'description' => $request->description,
            'severity' => $request->severity,
            'reporter_id' => $request->user()->id,
            'assignee_id' => $request->assignee_id,
            'team_id' => $request->team_id,
        ]);

        if ($request->filled('service_ids')) {
            $incident->services()->sync($request->service_ids);
        }

        IncidentActivity::create([
            'incident_id' => $incident->id,
            'user_id' => $request->user()->id,
            'type' => 'comment',
            'body' => 'Incident declared.',
        ]);

        $this->notifier->notify($incident, [
            'type' => 'comment',
            'body' => 'Incident declared.',
        ], $request->user()->id);

        return response()->json([
            'message' => 'Incident created',
            'incident' => new IncidentResource($incident->load(['reporter', 'services'])),
        ], 201);
    }

    public function update(UpdateIncidentRequest $request, Incident $incident): JsonResponse
    {
        $old = $incident->only(['severity', 'status', 'assignee_id']);

        $incident->update($request->validated());

        if ($request->filled('service_ids')) {
            $incident->services()->sync($request->service_ids);
        }

        if ($request->filled('status') && $request->status !== $old['status']) {
            IncidentActivity::create([
                'incident_id' => $incident->id,
                'user_id' => $request->user()->id,
                'type' => 'status_change',
                'body' => ucfirst($request->status),
                'metadata' => ['old' => $old['status'], 'new' => $request->status],
            ]);

            $this->notifier->notify($incident, [
                'type' => 'status_change',
                'body' => 'Status changed to '.ucfirst($request->status),
                'data' => ['old' => $old['status'], 'new' => $request->status],
            ], $request->user()->id);

            if ($request->status === 'resolved') {
                $incident->update(['resolved_at' => now()]);
            }
        }

        if ($request->filled('severity') && $request->severity !== $old['severity']) {
            IncidentActivity::create([
                'incident_id' => $incident->id,
                'user_id' => $request->user()->id,
                'type' => 'severity_change',
                'body' => "Severity changed to {$request->severity}",
                'metadata' => ['old' => $old['severity'], 'new' => $request->severity],
            ]);

            $this->notifier->notify($incident, [
                'type' => 'severity_change',
                'body' => "Severity changed to {$request->severity}",
                'data' => ['old' => $old['severity'], 'new' => $request->severity],
            ], $request->user()->id);
        }

        if ($request->filled('assignee_id') && $request->assignee_id !== $old['assignee_id']) {
            $assigneeName = \App\Models\User::find($request->assignee_id)?->name ?? 'Unassigned';
            IncidentActivity::create([
                'incident_id' => $incident->id,
                'user_id' => $request->user()->id,
                'type' => 'assignment',
                'body' => "Assigned to {$assigneeName}",
                'metadata' => ['old' => $old['assignee_id'], 'new' => $request->assignee_id],
            ]);

            $this->notifier->notify($incident, [
                'type' => 'assignment',
                'body' => "Assigned to {$assigneeName}",
                'data' => ['old' => $old['assignee_id'], 'new' => $request->assignee_id],
            ], $request->user()->id);
        }

        if ($request->filled('comment')) {
            IncidentActivity::create([
                'incident_id' => $incident->id,
                'user_id' => $request->user()->id,
                'type' => 'comment',
                'body' => $request->comment,
            ]);

            $this->notifier->notify($incident, [
                'type' => 'comment',
                'body' => $request->comment,
            ], $request->user()->id);
        }

        IncidentUpdated::dispatch($incident);

        return response()->json([
            'message' => 'Incident updated',
            'incident' => new IncidentResource($incident->fresh()->load(['reporter', 'assignee', 'services'])),
        ]);
    }

    public function destroy(Incident $incident): JsonResponse
    {
        $incident->delete();

        return response()->json(['message' => 'Incident deleted']);
    }

    public function chat(Request $request, Incident $incident): JsonResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'metadata' => ['nullable', 'array'],
        ]);

        $activity = IncidentActivity::create([
            'incident_id' => $incident->id,
            'user_id' => $request->user()->id,
            'type' => 'chat',
            'body' => $validated['body'],
            'metadata' => $validated['metadata'] ?? null,
        ]);

        ChatMessageBroadcast::dispatch($activity);

        $isVoice = isset($validated['metadata']['audio_base64']);
        $this->notifier->notify($incident, [
            'type' => $isVoice ? 'voice_note' : 'chat',
            'body' => $isVoice ? 'Sent a voice note' : $validated['body'],
            'data' => ['activity_id' => $activity->id],
        ], $request->user()->id);

        return response()->json([
            'message' => new \App\Http\Resources\IncidentActivityResource($activity->load('user')),
        ], 201);
    }

    public function getChat(Incident $incident, Request $request): JsonResponse
    {
        $afterId = $request->integer('after_id', 0);

        $query = IncidentActivity::with('user')
            ->where('incident_id', $incident->id)
            ->whereIn('type', [
                'chat', 'comment', 'status_change', 'severity_change', 'assignment',
                'zoom_bridge', 'slack_alert', 'postmortem_export', 'agent_action', 'command',
            ]);

        if ($afterId > 0) {
            $query->where('id', '>', $afterId);
        }

        $activities = $query->orderBy('id', 'asc')
            ->limit(100)
            ->get();

        return response()->json(['data' => $activities]);
    }

    public function logActivity(Request $request, Incident $incident): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'string', 'max:50'],
            'body' => ['required', 'string', 'max:5000'],
            'metadata' => ['nullable', 'array'],
        ]);

        $activity = IncidentActivity::create([
            'incident_id' => $incident->id,
            'user_id' => $request->user()->id,
            'type' => $validated['type'],
            'body' => $validated['body'],
            'metadata' => $validated['metadata'] ?? null,
        ]);

        ChatMessageBroadcast::dispatch($activity);

        $this->notifier->notify($incident, [
            'type' => $validated['type'],
            'body' => $validated['body'],
            'data' => $validated['metadata'] ?? null,
        ], $request->user()->id);

        return response()->json([
            'message' => new \App\Http\Resources\IncidentActivityResource($activity->load('user')),
        ], 201);
    }
}
