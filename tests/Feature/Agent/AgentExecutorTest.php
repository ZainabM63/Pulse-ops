<?php

namespace Tests\Feature\Agent;

use App\Events\IncidentUpdated;
use App\Models\AgentAction;
use App\Models\Incident;
use App\Models\IncidentActivity;
use App\Services\AgentActionExecutor;
use Illuminate\Support\Facades\Event;

class AgentExecutorTest extends AgentTestCase
{
    private function executor(): AgentActionExecutor
    {
        return new AgentActionExecutor();
    }

    public function test_restart_service_recovers_a_degraded_service(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'restart_service', ['service_name' => 'api-gateway']);

        $output = $this->executor()->execute($action, $user->id);

        $this->assertSame('restarted', $output['status']);
        $this->assertSame('degraded', $output['previous_status']);
        $this->assertDatabaseHas('services', ['id' => $service->id, 'status' => 'operational']);
        $this->assertDatabaseHas('incident_activities', [
            'incident_id' => $incident->id,
            'type' => 'agent_action',
            'user_id' => $user->id,
        ]);
        $this->assertSame('completed', $action->fresh()->status);
        $this->assertNotNull($action->fresh()->executed_at);
    }

    public function test_scale_resources_logs_activity_and_returns_replicas(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $incident = $this->makeIncident($company, [], null, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'scale_resources', ['service_name' => 'api-gateway', 'replicas' => 6]);

        $output = $this->executor()->execute($action, $user->id);

        $this->assertSame('api-gateway', $output['service']);
        $this->assertSame(6, $output['replicas']);
        $this->assertDatabaseHas('incident_activities', [
            'incident_id' => $incident->id,
            'type' => 'agent_action',
        ]);
    }

    public function test_rollback_deployment_returns_target_version(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $incident = $this->makeIncident($company, [], null, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'rollback_deployment', ['service_name' => 'api-gateway', 'version' => 'v1.2.3']);

        $output = $this->executor()->execute($action, $user->id);

        $this->assertSame('v1.2.3', $output['version']);
        $this->assertSame('rolled_back', $output['status']);
    }

    public function test_send_notification_returns_the_sent_message(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $incident = $this->makeIncident($company, [], null, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'send_notification', ['message' => 'All hands on deck']);

        $output = $this->executor()->execute($action, $user->id);

        $this->assertSame('All hands on deck', $output['message']);
        $this->assertSame('sent', $output['status']);
    }

    public function test_run_diagnostics_reports_degraded_services(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $this->makeService($company, ['name' => 'api-gateway', 'status' => 'degraded']);
        $this->makeService($company, ['name' => 'auth-service', 'status' => 'operational']);
        $this->makeService($company, ['name' => 'payment-processor', 'status' => 'major_outage']);
        $incident = $this->makeIncident($company, [], null, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'run_diagnostics');

        $output = $this->executor()->execute($action, $user->id);

        $this->assertCount(3, $output['services']);
        $this->assertSame(2, $output['degraded_count']);
        $this->assertSame(3, $output['total']);
    }

    public function test_create_followup_spawns_a_new_linked_incident(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'create_followup', ['title' => 'Deep dive root cause', 'severity' => 'minor']);

        $output = $this->executor()->execute($action, $user->id);

        $followup = Incident::find($output['followup_id']);
        $this->assertNotNull($followup);
        $this->assertSame('Deep dive root cause', $followup->title);
        $this->assertSame('minor', $followup->severity);
        $this->assertSame('investigating', $followup->status);
        $this->assertSame($company->id, $followup->company_id);
        $this->assertSame($user->id, $followup->assignee_id);
        $this->assertTrue($followup->services()->pluck('services.id')->contains($service->id));
    }

    public function test_generate_postmortem_produces_a_full_report(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, ['title' => 'Payment outage'], $service, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'generate_postmortem');

        $output = $this->executor()->execute($action, $user->id);

        $this->assertSame('generated', $output['status']);
        $this->assertStringContainsString('# Post-Mortem Report', $output['report']);
        $this->assertStringContainsString('**Title:** Payment outage', $output['report']);
        $this->assertStringContainsString('Affected Services', $output['report']);
        $this->assertStringContainsString('- api-gateway', $output['report']);
        $this->assertStringContainsString('Activity Timeline', $output['report']);
        $this->assertStringContainsString('Generated by PulseOps Agent', $output['report']);
    }

    public function test_resolve_incident_marks_incident_resolved_and_dispatches_event(): void
    {
        Event::fake([IncidentUpdated::class]);

        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $incident = $this->makeIncident($company, [], null, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'resolve_incident');

        $output = $this->executor()->execute($action, $user->id);

        $this->assertSame('resolved', $output['new_status']);
        $this->assertSame('investigating', $output['old_status']);
        $this->assertDatabaseHas('incidents', ['id' => $incident->id, 'status' => 'resolved']);
        $this->assertNotNull($incident->fresh()->resolved_at);
        $this->assertDatabaseHas('incident_activities', [
            'incident_id' => $incident->id,
            'type' => 'status_change',
        ]);
        Event::assertDispatched(IncidentUpdated::class, fn ($event) => $event->incident->id === $incident->id);
    }

    public function test_resolve_incident_fails_without_an_incident(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $run = $this->makeRun($company, $user);
        $action = $this->makeAction($run, 'resolve_incident');

        try {
            $this->executor()->execute($action, $user->id);
            $this->fail('Expected a RuntimeException for a run without an incident.');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('No incident associated', $e->getMessage());
        }

        $this->assertSame('failed', $action->fresh()->status);
        $this->assertStringContainsString('No incident associated', $action->fresh()->error);
    }

    public function test_update_service_status_changes_service(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $service = $this->makeService($company, ['status' => 'major_outage']);
        $incident = $this->makeIncident($company, [], $service, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'update_service_status', [
            'service_name' => 'api-gateway',
            'status' => 'operational',
        ]);

        $output = $this->executor()->execute($action, $user->id);

        $this->assertSame('major_outage', $output['old_status']);
        $this->assertSame('operational', $output['new_status']);
        $this->assertDatabaseHas('services', ['id' => $service->id, 'status' => 'operational']);
    }

    public function test_unknown_action_type_fails_and_records_error(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $incident = $this->makeIncident($company, [], null, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $action = $this->makeAction($run, 'self_destruct');

        try {
            $this->executor()->execute($action, $user->id);
            $this->fail('Expected InvalidArgumentException for an unknown action type.');
        } catch (\InvalidArgumentException $e) {
            $this->assertStringContainsString('Unknown action type: self_destruct', $e->getMessage());
        }

        $this->assertSame('failed', $action->fresh()->status);
        $this->assertStringContainsString('Unknown action type', $action->fresh()->error);
    }

    public function test_activity_is_only_logged_when_an_incident_is_attached(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        $run = $this->makeRun($company, $user);
        $action = $this->makeAction($run, 'send_notification', ['message' => 'no incident here']);

        $output = $this->executor()->execute($action, $user->id);

        $this->assertSame('sent', $output['status']);
        $this->assertSame(0, IncidentActivity::count());
    }
}