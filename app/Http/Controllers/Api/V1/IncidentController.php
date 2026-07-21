<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\IncidentUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIncidentRequest;
use App\Http\Requests\UpdateIncidentRequest;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use App\Models\IncidentActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class IncidentController extends Controller
{
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
        }

        if ($request->filled('comment')) {
            IncidentActivity::create([
                'incident_id' => $incident->id,
                'user_id' => $request->user()->id,
                'type' => 'comment',
                'body' => $request->comment,
            ]);
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
}
