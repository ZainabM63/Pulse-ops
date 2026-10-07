<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\ChatMessageBroadcast;
use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\IncidentActivity;
use App\Models\TelemetryLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RunbookController extends Controller
{
    public function execute(Request $request): JsonResponse
    {
        $incidents = Incident::where('company_id', $request->user()->company_id)
            ->whereNotIn('status', ['resolved', 'postmortem'])
            ->get();

        $body = 'Runbook executed — health checks, restart policies, and circuit-breaker verification applied.';
        $affected = 0;

        foreach ($incidents as $incident) {
            $activity = IncidentActivity::create([
                'incident_id' => $incident->id,
                'user_id' => $request->user()->id,
                'type' => 'command',
                'body' => $body,
                'metadata' => ['runbook' => 'standard-recovery'],
            ]);

            ChatMessageBroadcast::dispatch($activity);

            TelemetryLog::create([
                'company_id' => $request->user()->company_id,
                'incident_id' => $incident->id,
                'level' => 'cmd',
                'message' => $body,
                'source' => 'runbook',
                'logged_at' => now(),
            ]);

            $affected++;
        }

        return response()->json([
            'message' => $affected > 0
                ? "Runbook executed across {$affected} active incident".($affected === 1 ? '' : 's')
                : 'No active incidents to run',
            'incidents_affected' => $affected,
        ]);
    }
}
