<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ServiceResource;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ServiceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Service::with('team')->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return ServiceResource::collection($query->paginate($request->integer('per_page', 25)));
    }

    public function show(Service $service): ServiceResource
    {
        return new ServiceResource($service->load('team'));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:services,slug'],
            'description' => ['nullable', 'string'],
            'team_id' => ['nullable', 'exists:teams,id'],
            'status' => ['sometimes', 'string', 'in:operational,degraded,partial_outage,major_outage'],
        ]);

        $validated['company_id'] = $request->user()->company_id;

        $service = Service::create($validated);

        return response()->json([
            'message' => 'Service created',
            'service' => new ServiceResource($service),
        ], 201);
    }

    public function update(Request $request, Service $service): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'team_id' => ['nullable', 'exists:teams,id'],
            'status' => ['sometimes', 'string', 'in:operational,degraded,partial_outage,major_outage'],
        ]);

        $service->update($validated);

        return response()->json([
            'message' => 'Service updated',
            'service' => new ServiceResource($service->fresh()->load('team')),
        ]);
    }

    public function destroy(Service $service): JsonResponse
    {
        $service->delete();

        return response()->json(['message' => 'Service deleted']);
    }
}
