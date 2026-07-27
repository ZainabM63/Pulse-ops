<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\IncidentActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $limit = min($request->integer('per_page', 30), 100);

        $activities = IncidentActivity::with(['incident', 'user'])
            ->whereHas('incident')
            ->latest()
            ->limit($limit)
            ->get()
            ->map(function ($activity) {
                $level = match ($activity->type) {
                    'status_change' => $activity->metadata['new'] === 'resolved' ? 'info' : 'warn',
                    'severity_change' => 'error',
                    'assignment' => 'info',
                    default => 'info',
                };

                $incident = $activity->incident;

                return [
                    'id' => $activity->id,
                    'timestamp' => $activity->created_at->toISOString(),
                    'level' => $level,
                    'type' => $activity->type,
                    'message' => sprintf(
                        'INC-%s | %s | %s',
                        str_pad((string) ($incident?->id ?? 0), 4, '0', STR_PAD_LEFT),
                        $activity->type === 'comment' ? 'Comment' : ucfirst(str_replace('_', ' ', $activity->type)),
                        $activity->body ?? ''
                    ),
                    'user' => $activity->user?->name,
                ];
            });

        return response()->json(['data' => $activities]);
    }
}
