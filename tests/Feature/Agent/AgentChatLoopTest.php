<?php

namespace Tests\Feature\Agent;

use App\Http\Controllers\Api\V1\AgentController;
use App\Models\IncidentActivity;
use App\Models\IncidentHypothesis;
use App\Models\TelemetryLog;
use App\Services\AgentBrain;

/**
 * Deterministic stand-in for the real Gemini brain. Returns the scripted
 * batch of tool calls for each decide() invocation and records every prompt
 * and incident context it was given so the loop behaviour can be asserted.
 */
class AgentChatLoopTestBrain extends AgentBrain
{
    public int $decideCalls = 0;
    public array $contexts = [];
    public array $messages = [];

    public function __construct(private array $script)
    {
    }

    public function decide(string $userMessage, array $incidentContext): array
    {
        $this->decideCalls++;
        $this->contexts[] = $incidentContext;
        $this->messages[] = $userMessage;

        $index = min($this->decideCalls, count($this->script)) - 1;

        return $this->script[$index];
    }

    public function summarize(string $userMessage, array $toolResults): string
    {
        return 'All done.';
    }
}

class AgentChatLoopTest extends AgentTestCase
{
    private function installBrain(AgentChatLoopTestBrain $brain): AgentChatLoopTestBrain
    {
        $this->app->instance(AgentController::class, new AgentController($brain));

        return $brain;
    }

    public function test_gemini_loops_from_diagnose_to_remediation_to_resolution(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);

        $brain = $this->installBrain(new AgentChatLoopTestBrain([
            [
                ['type' => 'run_diagnostics', 'input' => []],
                ['type' => 'send_notification', 'input' => ['message' => 'Checking the gateway']],
            ],
            [
                ['type' => 'resolve_incident', 'input' => []],
            ],
            [],
        ]));

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'handle the gateway incident',
            'mode' => 'autonomous',
        ]);

        $response->assertStatus(201);
        $run = $response->json('run');

        $this->assertSame('completed', $run['status']);
        $this->assertCount(3, $run['actions']);

        $types = collect($run['actions'])->pluck('type');
        $this->assertContains('run_diagnostics', $types);
        $this->assertContains('send_notification', $types);
        $this->assertContains('resolve_incident', $types);

        // Side effects landed, including actions decided in later rounds.
        $this->assertDatabaseHas('incidents', ['id' => $incident->id, 'status' => 'resolved']);

        // Store() + two continuation rounds, then the model said "done".
        $this->assertSame(3, $brain->decideCalls);

        // First prompt is the raw user request; later prompts are continue
        // messages that feed prior results back to the model.
        $this->assertSame('handle the gateway incident', $brain->messages[0]);
        $this->assertStringContainsString('Actions already executed', $brain->messages[1]);
        $this->assertStringContainsString('run_diagnostics: OK', $brain->messages[1]);
        $this->assertStringContainsString('send_notification: OK', $brain->messages[1]);
    }

    public function test_loop_stops_when_model_returns_no_more_actions(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company, ['name' => 'api-gateway']);
        $incident = $this->makeIncident($company, [], $service, $user);

        $brain = $this->installBrain(new AgentChatLoopTestBrain([
            [['type' => 'restart_service', 'input' => ['service_name' => 'api-gateway']]],
            [],
        ]));

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'recover the api-gateway',
            'mode' => 'autonomous',
        ]);

        $response->assertStatus(201);
        $run = $response->json('run');

        $this->assertSame('completed', $run['status']);
        $this->assertCount(1, $run['actions']);
        $this->assertSame('restart_service', $run['actions'][0]['type']);
        $this->assertSame(2, $brain->decideCalls);
    }

    public function test_loop_does_not_run_for_the_deterministic_keyword_brain(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company, ['name' => 'api-gateway']);
        $incident = $this->makeIncident($company, [], $service, $user);

        // No gemini key, no injected brain -> MockAgentBrain is active.
        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'restart the api-gateway',
            'mode' => 'autonomous',
        ]);

        $response->assertStatus(201);
        $run = $response->json('run');

        // Exactly the single keyword batch; nothing re-decided or duplicated.
        $this->assertCount(1, $run['actions']);
        $this->assertSame('restart_service', $run['actions'][0]['type']);
    }

    public function test_gemini_receives_rich_context_with_telemetry_hypotheses_and_activity(): void
    {
        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company, ['name' => 'api-gateway', 'status' => 'degraded']);
        $incident = $this->makeIncident($company, [], $service, $user);

        TelemetryLog::create([
            'company_id' => $company->id,
            'incident_id' => $incident->id,
            'service_id' => $service->id,
            'level' => 'error',
            'message' => 'error rate spiking to 45%',
            'source' => 'api-gateway',
            'logged_at' => now(),
        ]);

        IncidentHypothesis::create([
            'incident_id' => $incident->id,
            'company_id' => $company->id,
            'user_id' => $user->id,
            'title' => 'Recent deploy introduced bad config',
            'confidence' => 80,
            'status' => 'hypothesis',
        ]);

        IncidentActivity::create([
            'incident_id' => $incident->id,
            'user_id' => $user->id,
            'type' => 'comment',
            'body' => 'Escalated to SRE on-call',
        ]);

        $brain = $this->installBrain(new AgentChatLoopTestBrain([[]]));

        $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'what is happening?',
            'mode' => 'autonomous',
        ])->assertStatus(201);

        $context = $brain->contexts[0] ?? [];

        $this->assertSame($incident->id, $context['id']);
        $this->assertSame('degraded', $context['services'][0]['status'] ?? null);
        $this->assertSame('api-gateway', $context['services'][0]['name'] ?? null);
        $this->assertSame('warning', $context['services'][0]['severity_level'] ?? null);

        $this->assertSame('error', $context['telemetry'][0]['level'] ?? null);
        $this->assertSame('error rate spiking to 45%', $context['telemetry'][0]['message'] ?? null);

        $this->assertSame('Recent deploy introduced bad config', $context['hypotheses'][0]['title'] ?? null);
        $this->assertSame(80, $context['hypotheses'][0]['confidence'] ?? null);

        $this->assertNotEmpty($context['recent_activities']);
        $this->assertArrayHasKey('assignee', $context);
        $this->assertArrayHasKey('team', $context);
        $this->assertArrayHasKey('acknowledged', $context);
    }
}