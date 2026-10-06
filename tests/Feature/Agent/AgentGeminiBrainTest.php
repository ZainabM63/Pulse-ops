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
     *
     * Unlike the old version, this test FAILS if Gemini errors out and the
     * keyword fallback kicks in, so a green run means the real brain genuinely
     * planned the actions.
     */
    #[Group('gemini')]
    public function test_real_gemini_powers_an_agent_run(): void
    {
        $apiKey = env('GEMINI_API_KEY');
        if (! $apiKey) {
            $this->markTestSkipped('GEMINI_API_KEY is not set; skipping live Gemini request.');
        }

        config(['services.gemini.key' => $apiKey]);

        $logPath = $this->logFile();

        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company);
        $incident = $this->makeIncident($company, [], $service, $user);

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'restart the api-gateway',
            'mode' => 'sequential',
        ]);

        $this->assertNoGeminiFallbackLogged($logPath, 'during sequential run');

        $response->assertStatus(201);
        $run = $response->json('run');

        $this->assertSame('pending', $run['status']);
        $this->assertNotEmpty($run['actions']);
        $known = ['restart_service', 'scale_resources', 'rollback_deployment', 'send_notification', 'run_diagnostics', 'create_followup', 'generate_postmortem', 'resolve_incident', 'update_service_status'];
        foreach ($run['actions'] as $action) {
            $this->assertContains($action['type'], $known, "Unexpected tool '{$action['type']}' from Gemini.");
        }
    }

    /**
     * End-to-end autonomous run against the real Gemini API: the loop must
     * chain at least two distinct tools across at least two executed rounds,
     * finish the run, and never fall back to the keyword brain.
     */
    #[Group('gemini')]
    public function test_real_gemini_autonomous_loop_chains_actions(): void
    {
        $apiKey = env('GEMINI_API_KEY');
        if (! $apiKey) {
            $this->markTestSkipped('GEMINI_API_KEY is not set; skipping live Gemini request.');
        }

        config(['services.gemini.key' => $apiKey]);

        $logPath = $this->logFile();

        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company, ['name' => 'api-gateway', 'status' => 'degraded']);
        $incident = $this->makeIncident($company, [], $service, $user);

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'the api-gateway is degraded, diagnose it and apply remediations step by step',
            'mode' => 'autonomous',
        ]);

        $this->assertNoGeminiFallbackLogged($logPath, 'during autonomous run');

        $response->assertStatus(201);
        $run = $response->json('run');

        $this->assertSame('completed', $run['status']);
        $this->assertGreaterThanOrEqual(2, count($run['actions']));

        $distinctTypes = collect($run['actions'])->pluck('type')->unique()->count();
        $this->assertGreaterThanOrEqual(2, $distinctTypes, 'Expected the loop to chain multiple distinct action types.');

        // The loop must actually have re-decided (observe -> re-decide). This
        // is exactly what the deployed build was NOT doing.
        $this->assertSame(true, $run['metadata']['loop_engaged'] ?? false, 'The observe → re-decide loop never engaged.');
    }

    public function test_continuation_round_never_falls_back_to_keywords(): void
    {
        config(['services.gemini.key' => 'test-key']);

        Http::fake([
            self::GEMINI_URL => Http::response([], 500),
        ]);

        $company = $this->makeCompany();
        $user = $this->actingAsUser($this->makeUser($company));
        $service = $this->makeService($company, ['name' => 'api-gateway']);
        $incident = $this->makeIncident($company, [], $service, $user);

        $response = $this->postJson('/api/v1/agent/runs', [
            'incident_id' => $incident->id,
            'message' => 'restart the api-gateway',
            'mode' => 'autonomous',
        ]);

        $response->assertStatus(201);
        $run = $response->json('run');

        // Round 1 fell back to the keyword "restart". When the continuation
        // round hits the same API failure it must return [] (end the loop)
        // instead of spawning a cascade of diagnostics.
        $this->assertCount(1, $run['actions']);
        $this->assertSame('restart_service', $run['actions'][0]['type']);
        $this->assertSame('completed', $run['status']);
    }

    public function test_decide_returns_empty_when_fallback_disallowed(): void
    {
        $this->fakeBrain();

        Http::fake([
            self::GEMINI_URL => Http::response([], 500),
        ]);

        $calls = (new AgentBrain)->decide('restart the api-gateway', ['services' => [['name' => 'api-gateway']]], false);

        $this->assertSame([], $calls);
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

        $calls = (new AgentBrain)->decide('please recover the gateway', ['services' => []]);

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

        $calls = (new AgentBrain)->decide('scale it up', ['services' => []]);

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

        $calls = (new AgentBrain)->decide('restart the api-gateway', ['services' => [['name' => 'api-gateway']]]);

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

        $calls = (new AgentBrain)->decide('restart the api-gateway', ['services' => [['name' => 'api-gateway']]]);

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

        $summary = (new AgentBrain)->summarize('old', [
            ['type' => 'restart_service', 'status' => 'completed', 'output' => []],
        ]);

        $this->assertStringContainsString('Executed 1 action(s) successfully.', $summary);
    }

    private function fakeBrain(): void
    {
        config(['services.gemini.key' => 'test-fake-key']);
    }

    /**
     * Point the default log channel at a private temp file so a live-Gemini
     * request's logging can be inspected afterwards.
     */
    private function logFile(): string
    {
        $path = sys_get_temp_dir().DIRECTORY_SEPARATOR.'pulseops_gemini_'.uniqid().'.log';

        config(['logging.default' => 'gemini_capture']);
        config(['logging.channels.gemini_capture' => [
            'driver' => 'single',
            'path' => $path,
            'level' => 'debug',
        ]]);

        return $path;
    }

    /**
     * After a live-Gemini request, fail if ANY fallback/error was logged:
     * a green test therefore proves the real brain did the work.
     */
    private function assertNoGeminiFallbackLogged(string $path, string $context = ''): void
    {
        $contents = file_exists($path) ? (string) file_get_contents($path) : '';

        foreach (['AgentBrain fell back to keyword matching', 'AgentBrain summary fell back', 'Gemini API error', 'AgentBrain error'] as $needle) {
            $this->assertStringNotContainsString($needle, $contents, "Found log '$needle' {$context}.");
        }

        @unlink($path);
    }
}
