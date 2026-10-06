<?php

namespace Tests\Unit;

use App\Services\MockAgentBrain;
use PHPUnit\Framework\TestCase;

class MockAgentBrainTest extends TestCase
{
    private MockAgentBrain $brain;

    protected function setUp(): void
    {
        parent::setUp();
        $this->brain = new MockAgentBrain();
    }

    private function context(array $services = []): array
    {
        return ['services' => $services];
    }

    public function test_unknown_message_defaults_to_diagnostics(): void
    {
        $calls = $this->brain->decide('please help me', []);

        $this->assertEquals([['type' => 'run_diagnostics', 'input' => []]], $calls);
    }

    public function test_restart_keyword_produces_restart_service(): void
    {
        $ctx = $this->context([['name' => 'api-gateway']]);
        $calls = $this->brain->decide('please restart the service', $ctx);

        $this->assertEquals([['type' => 'restart_service', 'input' => ['service_name' => 'api-gateway']]], $calls);
    }

    public function test_scale_keyword_produces_scale_resources(): void
    {
        $ctx = $this->context([['name' => 'payment-processor']]);
        $calls = $this->brain->decide('scale up capacity', $ctx);

        $this->assertEquals([
            ['type' => 'scale_resources', 'input' => ['service_name' => 'payment-processor', 'replicas' => 6]],
        ], $calls);
    }

    public function test_rollback_keyword_produces_rollback_deployment(): void
    {
        $ctx = $this->context([['name' => 'auth-service']]);
        $calls = $this->brain->decide('rollback the deployment', $ctx);

        $this->assertEquals([
            ['type' => 'rollback_deployment', 'input' => ['service_name' => 'auth-service', 'version' => 'previous']],
        ], $calls);
    }

    public function test_notify_keyword_produces_send_notification(): void
    {
        $calls = $this->brain->decide('notify the on-call via slack', []);

        $this->assertEquals([
            ['type' => 'send_notification', 'input' => ['message' => 'Incident update: notify the on-call via slack']],
        ], $calls);
    }

    public function test_diagnostics_keyword_produces_run_diagnostics(): void
    {
        $calls = $this->brain->decide('run diagnostics and check health', []);

        $this->assertEquals([['type' => 'run_diagnostics', 'input' => []]], $calls);
    }

    public function test_followup_keyword_produces_create_followup(): void
    {
        $calls = $this->brain->decide('create a follow-up to track', []);

        $this->assertEquals([
            ['type' => 'create_followup', 'input' => ['title' => 'Follow-up: create a follow-up to track', 'severity' => 'minor']],
        ], $calls);
    }

    public function test_postmortem_keyword_produces_generate_postmortem(): void
    {
        $calls = $this->brain->decide('write a postmortem report', []);

        $this->assertEquals([['type' => 'generate_postmortem', 'input' => []]], $calls);
    }

    public function test_resolve_keyword_produces_resolve_incident(): void
    {
        $calls = $this->brain->decide('resolve the incident now', []);

        $this->assertEquals([['type' => 'resolve_incident', 'input' => []]], $calls);
    }

    public function test_update_keyword_produces_update_service_status_when_services_present(): void
    {
        $ctx = $this->context([['name' => 'api-gateway']]);
        $calls = $this->brain->decide('update services', $ctx);

        $this->assertEquals([
            ['type' => 'update_service_status', 'input' => ['service_name' => 'api-gateway', 'status' => 'operational']],
        ], $calls);
    }

    public function test_update_keyword_without_services_falls_back_to_diagnostics(): void
    {
        $calls = $this->brain->decide('update services', []);

        $this->assertEquals([['type' => 'run_diagnostics', 'input' => []]], $calls);
    }

    public function test_compound_message_triggers_all_nine_tools(): void
    {
        $ctx = $this->context([['name' => 'api-gateway']]);
        $calls = $this->brain->decide(
            'restart scale rollback notify diagnose follow postmortem resolve update status',
            $ctx
        );

        $types = array_map(fn ($c) => $c['type'], $calls);

        $this->assertEquals([
            'restart_service',
            'scale_resources',
            'rollback_deployment',
            'send_notification',
            'run_diagnostics',
            'create_followup',
            'generate_postmortem',
            'resolve_incident',
            'update_service_status',
        ], $types);
    }

    public function test_duplicate_keywords_are_deduplicated(): void
    {
        $ctx = $this->context([['name' => 'api-gateway']]);
        $calls = $this->brain->decide('restart restart the api-gateway', $ctx);

        $this->assertCount(1, $calls);
        $this->assertEquals('restart_service', $calls[0]['type']);
    }

    public function test_unknown_service_name_falls_back_to_unknown(): void
    {
        $calls = $this->brain->decide('restart the thing', []);

        $this->assertEquals('unknown', $calls[0]['input']['service_name']);
    }

    public function test_summarize_counts_completed_actions(): void
    {
        $summary = $this->brain->summarize('old message', [
            ['type' => 'restart_service', 'status' => 'completed', 'output' => []],
            ['type' => 'run_diagnostics', 'status' => 'completed', 'output' => []],
        ]);

        $this->assertStringContainsString('Executed 2 action(s) successfully.', $summary);
        $this->assertStringContainsString('Monitor the incident', $summary);
    }

    public function test_summarize_reports_failed_actions(): void
    {
        $summary = $this->brain->summarize('old message', [
            ['type' => 'restart_service', 'status' => 'completed', 'output' => []],
            ['type' => 'resolve_incident', 'status' => 'failed', 'error' => 'No incident'],
        ]);

        $this->assertStringContainsString('Executed 1 action(s) successfully.', $summary);
        $this->assertStringContainsString('1 action(s) failed.', $summary);
    }
}