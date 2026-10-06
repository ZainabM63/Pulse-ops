<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\IncidentHypothesis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IncidentHypothesisController extends Controller
{
    public function index(Request $request, Incident $incident): JsonResponse
    {
        $hypotheses = $incident->hypotheses()
            ->with('user:id,name')
            ->orderBy('confidence', 'desc')
            ->get();

        return response()->json(['data' => $hypotheses]);
    }

    public function store(Request $request, Incident $incident): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'confidence' => 'nullable|integer|min:0|max:100',
            'status' => 'nullable|in:investigating,hypothesis,ruled_out,confirmed',
            'evidence' => 'nullable|array',
            'owner' => 'nullable|string|max:255',
        ]);

        $user = $request->user();

        $hypothesis = $incident->hypotheses()->create([
            'company_id' => $incident->company_id,
            'user_id' => $user->id,
            'title' => $validated['title'],
            'confidence' => $validated['confidence'] ?? 50,
            'status' => $validated['status'] ?? 'hypothesis',
            'evidence' => $validated['evidence'] ?? [],
            'owner' => $validated['owner'] ?? $user->name,
        ]);

        return response()->json(['data' => $hypothesis->load('user:id,name')], 201);
    }

    public function update(Request $request, Incident $incident, IncidentHypothesis $hypothesis): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'confidence' => 'sometimes|integer|min:0|max:100',
            'status' => 'sometimes|in:investigating,hypothesis,ruled_out,confirmed',
            'evidence' => 'sometimes|array',
            'owner' => 'sometimes|string|max:255',
        ]);

        $hypothesis->update($validated);

        return response()->json(['data' => $hypothesis->fresh('user:id,name')]);
    }

    public function destroy(Incident $incident, IncidentHypothesis $hypothesis): JsonResponse
    {
        $hypothesis->delete();

        return response()->json(['message' => 'Hypothesis deleted successfully']);
    }
}
