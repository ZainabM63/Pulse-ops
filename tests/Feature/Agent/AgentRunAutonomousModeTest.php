<?php

namespace Tests\Feature\Agent;

use App\Models\Incident;

class AgentRunAutonomousModeTest extends AgentTestCase
{
    public function test_autonomous_mode_requires_no_manual_execute_step(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $incident = $this->makeIncident($company, [], null, $user);

        // Sequential runs are "pending" after creation; autonomous must be done.
        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'resolve the incident',
            'mode' => 'autonomous',
        ]);

        $response->assertStatus(201);
        $run = $response->json('run');

        $this->assertSame('completed', $run['status']);
        $this->assertDatabaseHas('incidents', ['id' => $incident->id, 'status' => 'resolved']);
        $this->assertNotNull($incident->fresh()->resolved_at);
    }

    public function test_autonomous_run_with_all_tools_completes_in_single_request(): void
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
        $this->assertNotNull($run['metadata']['summary'] ?? null);

        $types = collect($run['actions'])->pluck('type');
        $this->assertCount(9, $types);
        $this->assertContains('create_followup', $types);
        $this->assertContains('generate_postmortem', $types);
        $this->assertContains('update_service_status', $types);

        // A follow-up incident was spawned and linked to the same services.
        $followups = Incident::where('company_id', $company->id)->where('id', '!=', $incident->id)->get();
        $this->assertCount(1, $followups);
        $this->assertSame('investigating', $followups->first()->status);
        $this->assertSame($service->id, $followups->first()->services()->first()->id);
    }

    public function test_execute_after_autonomous_completion_is_rejected(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));

        $create = $this->postJson('/api/v1/agent/runs', [
            'message' => 'diagnose everything',
            'mode' => 'autonomous',
        ])->assertStatus(201);

        $runId = $create->json('run.id');
        $this->assertSame('completed', $create->json('run.status'));

        $this->postJson("/api/v1/agent/runs/{$runId}/execute")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Run is not in an executable state');
    }

    public function test_cancel_after_autonomous_completion_is_rejected(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));

        $create = $this->postJson('/api/v1/agent/runs', [
            'message' => 'diagnose everything',
            'mode' => 'autonomous',
        ])->assertStatus(201);

        $runId = $create->json('run.id');

        $this->postJson("/api/v1/agent/runs/{$runId}/cancel")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Run is already finished');
    }

    public function test_autonomous_failure_due_to_missing_incident_sets_run_failed(): void
    {
        $company = $this->makeCompany();
        $this->actingAsUser($this->makeUser($company));

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

    public function test_sequential_run_is_not_auto_executed(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $incident = $this->makeIncident($company, [], null, $user);

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'resolve the incident',
            'mode' => 'sequential',
        ]);

        $response->assertStatus(201);
        $this->assertSame('pending', $response->json('run.status'));
        $this->assertDatabaseHas('incidents', ['id' => $incident->id, 'status' => 'investigating']);
    }
}