<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Incident;
use App\Models\IncidentActivity;
use App\Models\TelemetryLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RunbookAndSimulateTest extends TestCase
{
    use RefreshDatabase;

    protected function makeCompany(string $name = 'Pulse Test Corp'): Company
    {
        return Company::create([
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::random(6),
        ]);
    }

    protected function makeUser(Company $company, array $attrs = []): User
    {
        return User::factory()->create(array_merge([
            'company_id' => $company->id,
            'role' => 'member',
        ], $attrs));
    }

    protected function makeIncident(Company $company, User $reporter, string $status = 'investigating', string $severity = 'major'): Incident
    {
        return Incident::create([
            'company_id' => $company->id,
            'title' => 'Test incident',
            'description' => 'Test description',
            'severity' => $severity,
            'status' => $status,
            'reporter_id' => $reporter->id,
        ]);
    }

    public function test_simulate_creates_critical_incident_with_command_activity(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/incidents/simulate');

        $response->assertStatus(201);
        $this->assertDatabaseHas('incidents', [
            'company_id' => $company->id,
            'severity' => 'critical',
            'status' => 'investigating',
            'reporter_id' => $user->id,
        ]);

        $incident = Incident::where('company_id', $company->id)->latest('id')->first();
        $this->assertDatabaseHas('incident_activities', [
            'incident_id' => $incident->id,
            'user_id' => $user->id,
            'type' => 'command',
        ]);
    }

    public function test_simulate_requires_authentication(): void
    {
        $this->postJson('/api/v1/incidents/simulate')->assertStatus(401);
    }

    public function test_runbook_executes_on_active_incidents_only(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        Sanctum::actingAs($user);

        $active = $this->makeIncident($company, $user, 'investigating');
        $identified = $this->makeIncident($company, $user, 'identified');
        $resolved = $this->makeIncident($company, $user, 'resolved');

        $response = $this->postJson('/api/v1/runbooks/execute');

        $response->assertOk()
            ->assertJsonPath('incidents_affected', 2);

        $this->assertSame(2, IncidentActivity::where('type', 'command')
            ->where('body', 'like', 'Runbook executed%')
            ->whereIn('incident_id', [$active->id, $identified->id])
            ->count());

        $this->assertDatabaseMissing('incident_activities', [
            'incident_id' => $resolved->id,
            'type' => 'command',
        ]);

        $this->assertSame(2, TelemetryLog::where('company_id', $company->id)
            ->where('source', 'runbook')
            ->where('level', 'cmd')
            ->count());
    }

    public function test_runbook_affects_nothing_when_no_active_incidents(): void
    {
        $company = $this->makeCompany();
        $user = $this->makeUser($company);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/runbooks/execute');

        $response->assertOk()
            ->assertJsonPath('incidents_affected', 0);
    }

    public function test_runbook_is_scoped_to_user_company(): void
    {
        $companyA = $this->makeCompany('Company A');
        $companyB = $this->makeCompany('Company B');
        $userA = $this->makeUser($companyA);
        $userB = $this->makeUser($companyB);
        $this->makeIncident($companyB, $userB, 'investigating');

        Sanctum::actingAs($userA);

        $this->postJson('/api/v1/runbooks/execute')
            ->assertOk()
            ->assertJsonPath('incidents_affected', 0);
    }
}
