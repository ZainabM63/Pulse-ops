<?php

namespace Tests\Feature\Agent;

use App\Models\AgentAction;
use App\Models\AgentRun;

class AgentRunSequentialModeTest extends AgentTestCase
{
    public function test_full_sequential_lifecycle_executes_all_nine_tools_on_demand(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);

        $create = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => self::ALL_TOOLS_MESSAGE,
            'mode' => 'sequential',
        ])->assertStatus(201);

        $runId = $create->json('run.id');
        $this->assertSame('pending', $create->json('run.status'));
        $this->assertCount(9, $create->json('run.actions'));

        $this->assertDatabaseHas('services', ['id' => $service->id, 'status' => 'degraded']);
        $this->assertDatabaseHas('incidents', ['id' => $incident->id, 'status' => 'investigating']);

        // Now the operator approves / runs it.
        $execute = $this->postJson("/api/v1/agent/runs/{$runId}/execute")->assertOk();
$run = $execute->json('run');

        $this->assertSame('completed', $run['status']);
        $this->assertNotNull($run['metadata']['summary'] ?? null);
        $this->assertSame($execute->json('summary'), $run['metadata']['summary']);

        $statuses = collect($run['actions'])->pluck('status');
        $this->assertCount(9, $statuses);
        $this->assertTrue($statuses->every(fn ($status) => $status === 'completed'));

        // Domain side effects applied.
        $this->assertDatabaseHas('services', ['id' => $service->id, 'status' => 'operational']);
        $this->assertDatabaseHas('incidents', ['id' => $incident->id, 'status' => 'resolved']);
        $this->assertNotNull($incident->fresh()->resolved_at);
    }

    public function test_execute_again_on_completed_run_is_rejected(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $incident = $this->makeIncident($company, [], null, $user);
        $run = $this->makeRun($company, $user, ['status' => 'completed'], $incident);
        $this->makeAction($run, 'run_diagnostics', [], 'completed');

        $this->postJson("/api/v1/agent/runs/{$run->id}/execute")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Run is not in an executable state');
    }

    public function test_execute_on_cancelled_run_is_rejected(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $run = $this->makeRun($company, $user, ['status' => 'cancelled']);

        $this->postJson("/api/v1/agent/runs/{$run->id}/execute")
            ->assertStatus(422);
    }

    public function test_cancel_pending_run_marks_actions_skipped(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $run = $this->makeRun($company, $user);
        $this->makeAction($run, 'restart_service', ['service_name' => 'api-gateway']);
        $this->makeAction($run, 'run_diagnostics');

        $this->postJson("/api/v1/agent/runs/{$run->id}/cancel")
            ->assertOk()
            ->assertJsonPath('message', 'Agent run cancelled')
            ->assertJsonPath('run.status', 'cancelled');

        $this->assertDatabaseHas('agent_actions', ['agent_run_id' => $run->id, 'status' => 'skipped']);
        $this->assertSame(2, $run->actions()->where('status', 'skipped')->count());
    }

    public function test_cancel_finished_run_is_rejected(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $run = $this->makeRun($company, $user, ['status' => 'completed']);

        $this->postJson("/api/v1/agent/runs/{$run->id}/cancel")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Run is already finished');
    }

    public function test_chat_appends_new_actions_and_resets_status(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $incident = $this->makeIncident($company, [], null, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $this->makeAction($run, 'restart_service', ['service_name' => 'api-gateway']);
        $this->assertSame(1, $run->actions()->count());

        $chat = $this->postJson("/api/v1/agent/runs/{$run->id}/chat", [
            'message' => 'investigate further',
        ])->assertOk();

        $this->assertSame('pending', $chat->json('run.status'));
        $actions = $chat->json('run.actions');
        $this->assertCount(2, $actions);
        $this->assertSame('run_diagnostics', $actions[1]['type']);

        // The newly added action is executable.
        $execute = $this->postJson("/api/v1/agent/runs/{$run->id}/execute")->assertOk();
        $this->assertSame('completed', $execute->json('run.status'));
    }

    public function test_chat_on_completed_run_is_rejected(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $run = $this->makeRun($company, $user, ['status' => 'completed']);

        $this->postJson("/api/v1/agent/runs/{$run->id}/chat", ['message' => 'hello'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Cannot chat on a completed run');
    }

    public function test_chat_validates_message(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $run = $this->makeRun($company, $user);

        $this->postJson("/api/v1/agent/runs/{$run->id}/chat", ['message' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message');
    }

    public function test_sequential_run_can_be_viewed_between_steps(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $incident = $this->makeIncident($company, [], null, $user);
        $run = $this->makeRun($company, $user, [], $incident);
        $this->makeAction($run, 'restart_service', ['service_name' => 'api-gateway']);

        $this->getJson("/api/v1/agent/runs/{$run->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $run->id)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.mode', 'sequential');
    }

    public function test_actions_persist_completed_output(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);

        $create = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'restart the api-gateway',
            'mode' => 'sequential',
        ]);

        $runId = $create->json('run.id');
        $this->postJson("/api/v1/agent/runs/{$runId}/execute")->assertOk();

        $this->assertDatabaseHas(AgentRun::class, ['id' => $runId, 'status' => 'completed']);
        $this->assertDatabaseHas(AgentAction::class, [
            'agent_run_id' => $runId,
            'type' => 'restart_service',
            'status' => 'completed',
        ]);

        $action = AgentAction::where('agent_run_id', $runId)->where('type', 'restart_service')->first();
        $this->assertSame('restarted', $action->output['status']);
        $this->assertSame('degraded', $action->output['previous_status']);
        $this->assertNotNull($action->executed_at);
    }
}