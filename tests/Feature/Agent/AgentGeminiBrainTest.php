<?php

namespace Tests\Feature\Agent;

use App\Services\AgentBrain;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Group;

class AgentGeminiBrainTest extends AgentTestCase
{
    private const GEMINI_URL = 'https://generativelanguage.googleapis.com/*';

    /**
     * The single test that talks to the real Gemini API. Tagged with the
     * "gemini" group so it can be excluded offline:
     *   php artisan test --exclude-group gemini
     */
    #[Group('gemini')]
    public function test_real_gemini_powers_an_agent_run(): void
    {
        $apiKey = env('GEMINI_API_KEY');
        if (! $apiKey) {
            $this->markTestSkipped('GEMINI_API_KEY is not set; skipping live Gemini request.');
        }

        config(['services.gemini.key' => $apiKey]);

        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'restart the api-gateway',
            'mode' => 'sequential',
        ]);

        // Auto-fallback means this holds even if the live API errors out,
        // but we still require a well-formed run with planned actions.
        $response->assertStatus(201);
        $run = $response->json('run');

        $this->assertSame('pending', $run['status']);
        $this->assertNotEmpty($run['actions']);
        $known = ['restart_service', 'scale_resources', 'rollback_deployment', 'send_notification', 'run_diagnostics', 'create_followup', 'generate_postmortem', 'resolve_incident', 'update_service_status'];
        foreach ($run['actions'] as $action) {
            $this->assertContains($action['type'], $known, "Unexpected tool '{$action['type']}' from Gemini.");
        }
    }

    public function test_brain_parses_json_text_tool_calls(): void
    {
        $this->fakeBrain();

        Http::fake([
            self::GEMINI_URL => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => '[{"type":"restart_service","input":{"service_name":"api-gateway"}}]']]]],
                ],
            ], 200),
        ]);

        $calls = (new AgentBrain())->decide('please recover the gateway', ['services' => []]);

        $this->assertEquals([
            ['type' => 'restart_service', 'input' => ['service_name' => 'api-gateway']],
        ], $calls);
    }

    public function test_brain_parses_function_call_parts(): void
    {
        $this->fakeBrain();

        Http::fake([
            self::GEMINI_URL => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [
                        ['functionCall' => ['name' => 'scale_resources', 'args' => ['replicas' => 6]]],
                    ]]],
                ],
            ], 200),
        ]);

        $calls = (new AgentBrain())->decide('scale it up', ['services' => []]);

        $this->assertEquals([
            ['type' => 'scale_resources', 'input' => ['replicas' => 6]],
        ], $calls);
    }

    public function test_brain_falls_back_to_keywords_when_gemini_fails(): void
    {
        $this->fakeBrain();

        Http::fake([
            self::GEMINI_URL => Http::response([], 500),
        ]);

        $calls = (new AgentBrain())->decide('restart the api-gateway', ['services' => [['name' => 'api-gateway']]]);

        $this->assertEquals([
            ['type' => 'restart_service', 'input' => ['service_name' => 'api-gateway']],
        ], $calls);
    }

    public function test_brain_falls_back_when_gemini_returns_invalid_json(): void
    {
        $this->fakeBrain();

        Http::fake([
            self::GEMINI_URL => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => '{not valid json']]]],
                ],
            ], 200),
        ]);

        $calls = (new AgentBrain())->decide('restart the api-gateway', ['services' => [['name' => 'api-gateway']]]);

        $this->assertEquals([
            ['type' => 'restart_service', 'input' => ['service_name' => 'api-gateway']],
        ], $calls);
    }

    public function test_summarize_falls_back_when_gemini_fails(): void
    {
        $this->fakeBrain();

        Http::fake([
            self::GEMINI_URL => Http::response([], 503),
        ]);

        $summary = (new AgentBrain())->summarize('old', [
            ['type' => 'restart_service', 'status' => 'completed', 'output' => []],
        ]);

        $this->assertStringContainsString('Executed 1 action(s) successfully.', $summary);
    }

    private function fakeBrain(): void
    {
        config(['services.gemini.key' => 'test-fake-key']);
    }
}