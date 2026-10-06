<?php

namespace Tests\Feature\Agent;

use App\Models\AgentAction;
use App\Models\AgentRun;
use App\Models\Company;
use App\Models\Incident;
use App\Models\Service;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

abstract class AgentTestCase extends TestCase
{
    use RefreshDatabase;

    /**
     * Message that the keyword (mock) brain maps to ALL nine agent tools.
     */
    protected const ALL_TOOLS_MESSAGE = 'restart scale rollback notify diagnose follow postmortem resolve update status';

    protected function setUp(): void
    {
        parent::setUp();

        // Unless a test explicitly opts into the real Gemini API, every request
        // in this suite must use the deterministic keyword brain so assertions
        // are reproducible and no network calls are made.
        config(['services.gemini.key' => null]);

        // Agent routes are throttled to 30 req/min; a test suite would trip it.
        $this->withoutMiddleware(ThrottleRequests::class);
    }

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

    protected function makeTeam(Company $company, string $name = 'SRE'): Team
    {
        return Team::create([
            'company_id' => $company->id,
            'name' => $name,
            'slug' => Str::slug($name),
            'description' => 'Test team',
        ]);
    }

    protected function makeService(Company $company, array $attrs = []): Service
    {
        $name = $attrs['name'] ?? 'api-gateway';

        return Service::create(array_merge([
            'company_id' => $company->id,
            'name' => $name,
            'slug' => $attrs['slug'] ?? Str::slug($name),
            'status' => 'degraded',
            'severity_level' => 'warning',
        ], $attrs));
    }

    protected function makeIncident(Company $company, array $attrs = [], ?Service $service = null, ?User $user = null): Incident
    {
        $reporter = $user ?? $this->makeUser($company);

        $incident = Incident::create(array_merge([
            'company_id' => $company->id,
            'title' => 'API Gateway degraded',
            'description' => 'High error rate detected on API Gateway',
            'severity' => 'critical',
            'status' => 'investigating',
            'reporter_id' => $reporter->id,
            'assignee_id' => $reporter->id,
            'blast_radius' => 'medium',
        ], $attrs));

        if ($service) {
            $incident->services()->attach($service->id);
        }

        return $incident;
    }

    protected function actingAsUser(User $user): User
    {
        Sanctum::actingAs($user);

        return $user;
    }

    protected function makeRun(Company $company, User $user, array $attrs = [], ?Incident $incident = null): AgentRun
    {
        return AgentRun::create(array_merge([
            'user_id' => $user->id,
            'title' => 'Test agent run',
            'status' => 'pending',
            'mode' => 'sequential',
            'metadata' => [],
        ], $attrs, $incident ? ['incident_id' => $incident->id] : []));
    }

    protected function makeAction(AgentRun $run, string $type = 'run_diagnostics', array $input = [], string $status = 'pending'): AgentAction
    {
        return AgentAction::create([
            'agent_run_id' => $run->id,
            'type' => $type,
            'label' => str_replace('_', ' ', ucwords($type, '_')),
            'status' => $status,
            'input' => $input,
        ]);
    }
}