<?php

namespace Tests\Feature\Agent;

class AgentAuthorizationTest extends AgentTestCase
{
    public function test_show_rejects_another_users_run(): void
    {
        [$company, $owner] = $this->makeCompanyAndOwner();
        $other = $this->actingAsUser($this->makeUser($company));
        $run = $this->makeRun($company, $owner, ['status' => 'pending']);

        $this->getJson("/api/v1/agent/runs/{$run->id}")
            ->assertForbidden()
            ->assertJsonPath('message', 'Unauthorized access to this agent run');

        // Owner can still see it.
        $this->actingAsUser($owner);
        $this->getJson("/api/v1/agent/runs/{$run->id}")->assertOk();
    }

    public function test_execute_rejects_another_users_run(): void
    {
        [$company, $owner] = $this->makeCompanyAndOwner();
        $this->actingAsUser($this->makeUser($company));
        $run = $this->makeRun($company, $owner);

        $this->postJson("/api/v1/agent/runs/{$run->id}/execute")->assertForbidden();
    }

    public function test_chat_rejects_another_users_run(): void
    {
        [$company, $owner] = $this->makeCompanyAndOwner();
        $this->actingAsUser($this->makeUser($company));
        $run = $this->makeRun($company, $owner);

        $this->postJson("/api/v1/agent/runs/{$run->id}/chat", ['message' => 'hi'])
            ->assertForbidden();
    }

    public function test_cancel_rejects_another_users_run(): void
    {
        [$company, $owner] = $this->makeCompanyAndOwner();
        $this->actingAsUser($this->makeUser($company));
        $run = $this->makeRun($company, $owner);

        $this->postJson("/api/v1/agent/runs/{$run->id}/cancel")->assertForbidden();
    }

    public function test_index_only_returns_own_runs(): void
    {
        [$company, $owner] = $this->makeCompanyAndOwner();
        $this->makeRun($company, $owner, ['title' => 'Owner run 1']);
        $this->makeRun($company, $owner, ['title' => 'Owner run 2']);

        $other = $this->makeUser($company);
        $this->makeRun($company, $other, ['title' => 'Other run']);

        $this->actingAsUser($owner);

        $response = $this->getJson('/api/v1/agent/runs')->assertOk();
        $titles = collect($response->json('data'))->pluck('title');

        $this->assertCount(2, $titles);
        $this->assertNotContains('Other run', $titles);
    }

    public function test_index_can_filter_by_incident(): void
    {
        [$company, $owner] = $this->makeCompanyAndOwner();
        $incidentA = $this->makeIncident($company, ['title' => 'A'], null, $owner);
        $incidentB = $this->makeIncident($company, ['title' => 'B'], null, $owner);
        $this->makeRun($company, $owner, [], $incidentA);
        $this->makeRun($company, $owner, [], $incidentA);
        $this->makeRun($company, $owner, [], $incidentB);

        $this->actingAsUser($owner);

        $response = $this->getJson("/api/v1/agent/runs?incident_id={$incidentA->id}")->assertOk();

        $this->assertCount(2, $response->json('data'));
        foreach ($response->json('data') as $run) {
            $this->assertSame($incidentA->id, $run['incident_id']);
        }
    }

    public function test_index_can_filter_by_status(): void
    {
        [$company, $owner] = $this->makeCompanyAndOwner();
        $this->makeRun($company, $owner, ['title' => 'pending run']);
        $this->makeRun($company, $owner, ['title' => 'completed run', 'status' => 'completed', 'mode' => 'autonomous']);

        $this->actingAsUser($owner);

        $response = $this->getJson('/api/v1/agent/runs?status=completed')->assertOk();

        $this->assertCount(1, $response->json('data'));
        $this->assertSame('completed', $response->json('data.0.status'));
    }

    public function test_index_paginates_results(): void
    {
        [$company, $owner] = $this->makeCompanyAndOwner();
        for ($i = 0; $i < 5; $i++) {
            $this->makeRun($company, $owner, ['title' => "Run {$i}"]);
        }

        $this->actingAsUser($owner);

        $response = $this->getJson('/api/v1/agent/runs?per_page=2')->assertOk();

        $this->assertCount(2, $response->json('data'));
        $this->assertSame(5, $response->json('meta.total'));
        $this->assertSame(3, $response->json('meta.last_page'));
    }

    public function test_index_paginates_with_zero_runs(): void
    {
        $company = $this->makeCompany();
        $this->actingAsUser($this->makeUser($company));

        $this->getJson('/api/v1/agent/runs')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0);
    }

    private function makeCompanyAndOwner(): array
    {
        $company = $this->makeCompany();
        $owner = $this->makeUser($company);

        return [$company, $owner];
    }
}