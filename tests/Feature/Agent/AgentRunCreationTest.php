<?php

namespace Tests\Feature\Agent;

use App\Models\IncidentActivity;

class AgentRunCreationTest extends AgentTestCase
{
    public function test_store_sequential_run_stays_pending_until_approved(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'restart the api-gateway',
            'mode' => 'sequential',
        ]);

        $response->assertStatus(201);
        $run = $response->json('run');

        $this->assertSame('pending', $run['status']);
        $this->assertSame('sequential', $run['mode']);
        $this->assertSame($incident->id, $run['incident_id']);
        $this->assertCount(1, $run['actions']);

        $action = $run['actions'][0];
        $this->assertSame('restart_service', $action['type']);
        $this->assertSame('pending', $action['status']);

        // Sequential mode must NOT have touched the domain yet.
        $this->assertDatabaseHas('services', ['id' => $service->id, 'status' => 'degraded']);
    }

    public function test_store_defaults_to_sequential_mode(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $incident = $this->makeIncident($company, [], null, $user);

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'diagnose everything',
        ]);

        $response->assertStatus(201);
        $this->assertSame('sequential', $response->json('run.mode'));
    }

    public function test_store_autonomous_run_executes_all_actions_immediately(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => self::ALL_TOOLS_MESSAGE,
            'mode' => 'autonomous',
        ]);

        $response->assertStatus(201);
        $run = $response->json('run');

        $this->assertSame('completed', $run['status']);
        $this->assertSame('autonomous', $run['mode']);
        $this->assertNotNull($run['metadata']['summary'] ?? null);
        $this->assertStringContainsString('Executed 9 action(s) successfully', $run['metadata']['summary']);

        $statuses = collect($run['actions'])->pluck('status');
        $this->assertCount(9, $statuses);
        $this->assertTrue($statuses->every(fn ($status) => $status === 'completed'));

        // Side effects were applied to the domain in the very same request.
        $this->assertDatabaseHas('services', ['id' => $service->id, 'status' => 'operational']);
        $this->assertDatabaseHas('incidents', ['id' => $incident->id, 'status' => 'resolved']);
        $this->assertDatabaseHas('incident_activities', [
            'incident_id' => $incident->id,
            'type' => 'agent_action',
        ]);
    }

    public function test_autonomous_run_with_failing_action_marks_run_failed(): void
    {
        $company = $this->makeCompany();
        $this->actingAsUser($this->makeUser($company));

        // resolve_incident with no incident bound -> executor RuntimeException.
        $response = $this->postJson('/api/v1/agent/runs', [
            'message' => 'resolve the incident',
            'mode' => 'autonomous',
        ]);

        $response->assertStatus(201);
        $run = $response->json('run');

        $this->assertSame('failed', $run['status']);
        $action = $run['actions'][0];
        $this->assertSame('resolve_incident', $action['type']);
        $this->assertSame('failed', $action['status']);
        $this->assertStringContainsString('No incident associated', $action['error']);
    }

    public function test_store_validates_message_is_required(): void
    {
        $company = $this->makeCompany();
        $this->actingAsUser($this->makeUser($company));

        $this->postJson('/api/v1/agent/runs', ['message' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message');
    }

    public function test_store_validates_mode_is_allowed(): void
    {
        $company = $this->makeCompany();
        $this->actingAsUser($this->makeUser($company));

        $this->postJson('/api/v1/agent/runs', ['message' => 'diagnose', 'mode' => 'frantic'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('mode');
    }

    public function test_store_validates_incident_exists(): void
    {
        $company = $this->makeCompany();
        $this->actingAsUser($this->makeUser($company));

        $this->postJson('/api/v1/agent/runs', ['message' => 'diagnose', 'incident_id' => 999999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('incident_id');
    }

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/v1/agent/runs', ['message' => 'diagnose'])
            ->assertUnauthorized();
    }

    public function test_message_is_truncated_to_100_chars_for_run_title(): void
    {
        $company = $this->makeCompany();
        $this->actingAsUser($this->makeUser($company));

        $long = str_repeat('diagnose ', 30);
        $response = $this->postJson('/api/v1/agent/runs', ['message' => $long]);

        $response->assertStatus(201);
        $this->assertSame(100, mb_strlen($response->json('run.title')));
        $this->assertDatabaseHas('agent_actions', [
            'agent_run_id' => $response->json('run.id'),
            'type' => 'run_diagnostics',
            'status' => 'pending',
        ]);
    }

    public function test_agent_actions_log_activity_on_the_incident(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);

        $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'scale the api-gateway to handle load',
            'mode' => 'autonomous',
        ])->assertStatus(201);

        $this->assertDatabaseHas('incident_activities', [
            'incident_id' => $incident->id,
            'type' => 'agent_action',
        ]);

        $this->assertDatabaseHas(IncidentActivity::class, []); // table-level sanity via model
    }
}