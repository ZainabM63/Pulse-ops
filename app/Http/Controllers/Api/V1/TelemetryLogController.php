<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\TelemetryLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelemetryLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = TelemetryLog::where('company_id', $user->company_id);

        if ($request->has('incident_id')) {
            $query->where('incident_id', $request->query('incident_id'));
        }

        if ($request->has('level')) {
            $query->where('level', $request->query('level'));
        }

        $logs = $query->orderBy('logged_at', 'desc')
            ->limit($request->query('limit', 50))
            ->get()
            ->reverse()
            ->values();

        // Seed initial telemetry if empty for company
        if ($logs->isEmpty()) {
            $initialLogs = [
                ['level' => 'error', 'message' => 'Datadog Alert -> 504 Gateway Timeout on auth-node-01', 'source' => 'datadog'],
                ['level' => 'warn', 'message' => 'Health check failed: payment-processor-03 (latency > 5000ms)', 'source' => 'system'],
                ['level' => 'info', 'message' => 'Auto-scaling: api-gateway cluster scaling to 8 replicas', 'source' => 'k8s'],
                ['level' => 'error', 'message' => 'PagerDuty escalation: P0 incident assigned to primary on-call SRE', 'source' => 'pagerduty'],
                ['level' => 'info', 'message' => 'Runbook triggered: graceful degradation for auth-service', 'source' => 'runbook'],
                ['level' => 'warn', 'message' => 'Circuit breaker OPEN: notification-service (error rate > 50%)', 'source' => 'circuit_breaker'],
                ['level' => 'info', 'message' => 'Slack webhook delivered: #incidents war room channel created', 'source' => 'slack'],
            ];

            foreach ($initialLogs as $logData) {
                TelemetryLog::create([
                    'company_id' => $user->company_id,
                    'incident_id' => $request->query('incident_id'),
                    'level' => $logData['level'],
                    'message' => $logData['message'],
                    'source' => $logData['source'],
                    'logged_at' => now(),
                ]);
            }

            $logs = TelemetryLog::where('company_id', $user->company_id)
                ->orderBy('logged_at', 'desc')
                ->limit(50)
                ->get()
                ->reverse()
                ->values();
        }

        return response()->json(['data' => $logs]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'incident_id' => 'nullable|exists:incidents,id',
            'service_id' => 'nullable|exists:services,id',
            'level' => 'required|in:info,warn,error,cmd',
            'message' => 'required|string',
            'source' => 'nullable|string|max:100',
        ]);

        $user = $request->user();

        $log = TelemetryLog::create([
            'company_id' => $user->company_id,
            'incident_id' => $validated['incident_id'] ?? null,
            'service_id' => $validated['service_id'] ?? null,
            'level' => $validated['level'],
            'message' => $validated['message'],
            'source' => $validated['source'] ?? 'user',
            'logged_at' => now(),
        ]);

        return response()->json(['data' => $log], 201);
    }
}
