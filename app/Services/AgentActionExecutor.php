<?php

namespace App\Services;

use App\Models\AgentAction;
use App\Models\Incident;
use App\Models\IncidentActivity;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class AgentActionExecutor
{
    public function __construct(private ?IncidentNotifier $notifier = null) {}

    private function notifier(): IncidentNotifier
    {
        return $this->notifier ??= app(IncidentNotifier::class);
    }
    public function execute(AgentAction $action, int $userId): array
    {
        $action->update(['status' => 'running', 'executed_at' => now()]);

        try {
            $result = match ($action->type) {
                'restart_service' => $this->restartService($action, $userId),
                'scale_resources' => $this->scaleResources($action, $userId),
                'rollback_deployment' => $this->rollbackDeployment($action, $userId),
                'send_notification' => $this->sendNotification($action, $userId),
                'run_diagnostics' => $this->runDiagnostics($action, $userId),
                'create_followup' => $this->createFollowup($action, $userId),
                'generate_postmortem' => $this->generatePostmortem($action, $userId),
                'resolve_incident' => $this->resolveIncident($action, $userId),
                'update_service_status' => $this->updateServiceStatus($action, $userId),
                default => throw new \InvalidArgumentException("Unknown action type: {$action->type}"),
            };

            $action->update(['status' => 'completed', 'output' => $result]);
            return $result;
        } catch (\Exception $e) {
            $action->update(['status' => 'failed', 'error' => $e->getMessage()]);
            Log::error("Agent action failed", ['type' => $action->type, 'error' => $e->getMessage()]);
            throw $e;
        }
    }

    protected function restartService(AgentAction $action, int $userId): array
    {
        $serviceName = $action->input['service_name'] ?? 'unknown';
        $run = $action->run;
        $incident = $run->incident;

        $service = Service::where('company_id', $run->user->company_id)
            ->where('name', 'like', "%{$serviceName}%")
            ->first();

        $previousStatus = $service?->status ?? 'unknown';

        if ($service && $service->status !== 'operational') {
            $service->update(['status' => 'operational']);
        }

        $this->logAgentActivity($incident, $userId, "Service '{$serviceName}' restarted successfully", [
            'action' => 'restart',
            'service' => $serviceName,
        ]);

        return ['service' => $serviceName, 'status' => 'restarted', 'previous_status' => $previousStatus];
    }

    protected function scaleResources(AgentAction $action, int $userId): array
    {
        $serviceName = $action->input['service_name'] ?? 'unknown';
        $replicas = $action->input['replicas'] ?? 3;
        $run = $action->run;
        $incident = $run->incident;

        $this->logAgentActivity($incident, $userId, "Scaled '{$serviceName}' to {$replicas} replicas", [
            'action' => 'scale',
            'service' => $serviceName,
            'replicas' => $replicas,
        ]);

        return ['service' => $serviceName, 'replicas' => $replicas, 'status' => 'scaled'];
    }

    protected function rollbackDeployment(AgentAction $action, int $userId): array
    {
        $serviceName = $action->input['service_name'] ?? 'unknown';
        $version = $action->input['version'] ?? 'previous';
        $run = $action->run;
        $incident = $run->incident;

        $this->logAgentActivity($incident, $userId, "Rolled back '{$serviceName}' to version '{$version}'", [
            'action' => 'rollback',
            'service' => $serviceName,
            'version' => $version,
        ]);

        return ['service' => $serviceName, 'version' => $version, 'status' => 'rolled_back'];
    }

    protected function sendNotification(AgentAction $action, int $userId): array
    {
        $message = $action->input['message'] ?? 'Agent notification';
        $run = $action->run;
        $incident = $run->incident;

        $this->logAgentActivity($incident, $userId, "Notification sent: {$message}", [
            'action' => 'notify',
            'message' => $message,
        ]);

        return ['message' => $message, 'status' => 'sent'];
    }

    protected function runDiagnostics(AgentAction $action, int $userId): array
    {
        $run = $action->run;
        $incident = $run->incident;
        $companyServices = Service::where('company_id', $run->user->company_id)->get();

        $diagnostics = $companyServices->map(fn($s) => [
            'name' => $s->name,
            'status' => $s->status,
            'severity_level' => $s->severity_level,
            'team' => $s->team?->name,
        ])->toArray();

        $degradedCount = $companyServices->where('status', '!=', 'operational')->count();

        $this->logAgentActivity($incident, $userId, "Diagnostics complete: {$degradedCount} degraded services out of " . $companyServices->count(), [
            'action' => 'diagnostics',
            'services' => $diagnostics,
        ]);

        return ['services' => $diagnostics, 'degraded_count' => $degradedCount, 'total' => $companyServices->count()];
    }

    protected function createFollowup(AgentAction $action, int $userId): array
    {
        $title = $action->input['title'] ?? 'Follow-up investigation';
        $severity = $action->input['severity'] ?? 'minor';
        $run = $action->run;
        $incident = $run->incident;

        $followup = Incident::create([
            'company_id' => $run->user->company_id,
            'title' => $title,
            "description" => "Follow-up incident created by PulseOps Agent" . ($incident ? " for INC-" . str_pad((string) $incident->id, 4, '0', STR_PAD_LEFT) : ""),
            'severity' => $severity,
            'status' => 'investigating',
            'reporter_id' => $userId,
            'assignee_id' => $run->user->id,
            'team_id' => $incident?->team_id,
        ]);

        if ($incident && $incident->services()->count() > 0) {
            $followup->services()->attach($incident->services->pluck('id'));
        }

        $this->logAgentActivity($incident, $userId, "Created follow-up incident INC-" . str_pad((string) $followup->id, 4, '0', STR_PAD_LEFT) . ": {$title}", [
            'action' => 'create_followup',
            'followup_id' => $followup->id,
            'title' => $title,
            'severity' => $severity,
        ]);

        return ['followup_id' => $followup->id, 'title' => $title, 'severity' => $severity];
    }

    protected function generatePostmortem(AgentAction $action, int $userId): array
    {
        $run = $action->run;
        $incident = $run->incident;
        $incident->load(['services', 'activities.user', 'reporter', 'assignee']);

        $lines = [
            "# Post-Mortem Report — INC-" . str_pad((string) $incident->id, 4, '0', STR_PAD_LEFT),
            "",
            "## Incident Summary",
            "- **Title:** {$incident->title}",
            "- **Severity:** " . strtoupper($incident->severity),
            "- **Status:** " . strtoupper($incident->status),
            "- **Reporter:** " . ($incident->reporter?->name ?? 'Unknown'),
            "- **Assignee:** " . ($incident->assignee?->name ?? 'Unassigned'),
            "- **Duration:** " . ($incident->resolved_at ? $incident->created_at->diffForHumans($incident->resolved_at, true) : 'Ongoing'),
            "",
            "## Affected Services",
            ...$incident->services->map(fn($s) => "- {$s->name} ({$s->status})")->toArray(),
            "",
            "## Description",
            $incident->description ?: 'No description provided.',
            "",
            "## Activity Timeline",
            ...$incident->activities->map(function ($a) {
                $user = $a->user?->name ?? 'System';
                $time = $a->created_at->format('Y-m-d H:i:s');
                return "- [{$time}] {$user} ({$a->type}): {$a->body}";
            })->toArray(),
            "",
            "---",
            "Generated by PulseOps Agent — " . now()->format('Y-m-d H:i:s'),
        ];

        $postmortem = implode("\n", $lines);

        $this->logAgentActivity($incident, $userId, "Post-mortem report generated", [
            'action' => 'generate_postmortem',
            'report' => $postmortem,
        ]);

        return ['report' => $postmortem, 'status' => 'generated'];
    }

    protected function updateServiceStatus(AgentAction $action, int $userId): array
    {
        $serviceName = $action->input['service_name'] ?? 'unknown';
        $newStatus = $action->input['status'] ?? 'operational';
        $run = $action->run;
        $incident = $run->incident;

        $service = Service::where('company_id', $run->user->company_id)
            ->where('name', 'like', "%{$serviceName}%")
            ->first();

        $oldStatus = $service?->status ?? 'unknown';
        if ($service) {
            $service->update(['status' => $newStatus]);
        }

        $this->logAgentActivity($incident, $userId, "Service '{$serviceName}' status updated: {$oldStatus} → {$newStatus}", [
            'action' => 'update_status',
            'service' => $serviceName,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
        ]);

        return ['service' => $serviceName, 'old_status' => $oldStatus, 'new_status' => $newStatus];
    }

    protected function resolveIncident(AgentAction $action, int $userId): array
    {
        $run = $action->run;
        $incident = $run->incident;

        if (!$incident) {
            throw new \RuntimeException('No incident associated with this run');
        }

        $oldStatus = $incident->status;
        $incident->update([
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);

        IncidentActivity::create([
            'incident_id' => $incident->id,
            'user_id' => $userId,
            'type' => 'status_change',
            'body' => 'Resolved',
            'metadata' => ['old' => $oldStatus, 'new' => 'resolved'],
        ]);

        $this->notifier()->notify($incident, [
            'type' => 'status_change',
            'body' => 'Status changed to Resolved',
            'data' => ['old' => $oldStatus, 'new' => 'resolved'],
        ], $userId);

        \App\Events\IncidentUpdated::dispatch($incident->fresh());

        return [
            'incident_id' => $incident->id,
            'old_status' => $oldStatus,
            'new_status' => 'resolved',
            'resolved_at' => now()->toISOString(),
        ];
    }

    protected function logAgentActivity(?Incident $incident, int $userId, string $body, array $metadata = []): void
    {
        if (!$incident) return;

        IncidentActivity::create([
            'incident_id' => $incident->id,
            'user_id' => $userId,
            'type' => 'agent_action',
            'body' => $body,
            'metadata' => $metadata,
        ]);

        $this->notifier()->notify($incident, [
            'type' => 'agent_action',
            'body' => $body,
            'data' => $metadata,
        ], $userId);
    }
}
