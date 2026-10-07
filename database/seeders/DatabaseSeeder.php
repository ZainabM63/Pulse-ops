<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Incident;
use App\Models\IncidentActivity;
use App\Models\Service;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $company = Company::firstOrCreate(
            ['slug' => 'acme-corp'],
            ['name' => 'Acme Corp Engineering', 'settings' => ['timezone' => 'UTC', 'slack_webhook' => null]]
        );

        $platformTeam = Team::firstOrCreate(
            ['company_id' => $company->id, 'slug' => 'platform'],
            ['name' => 'Platform']
        );
        $sreTeam = Team::firstOrCreate(
            ['company_id' => $company->id, 'slug' => 'sre'],
            ['name' => 'SRE']
        );

        $commander = User::firstOrCreate(
            ['email' => 'sarah@acme.com'],
            ['name' => 'Sarah Chen', 'password' => Hash::make('password'), 'company_id' => $company->id, 'team_id' => $sreTeam->id, 'role' => 'admin']
        );

        $sreLead = User::firstOrCreate(
            ['email' => 'marcus@acme.com'],
            ['name' => 'Marcus Rivera', 'password' => Hash::make('password'), 'company_id' => $company->id, 'team_id' => $sreTeam->id, 'role' => 'manager']
        );

        $devops = User::firstOrCreate(
            ['email' => 'aisha@acme.com'],
            ['name' => 'Aisha Patel', 'password' => Hash::make('password'), 'company_id' => $company->id, 'team_id' => $platformTeam->id, 'role' => 'member']
        );

        User::firstOrCreate(
            ['email' => 'agent@pulseops.local'],
            ['name' => 'PulseOps Agent', 'password' => Hash::make('agent'), 'company_id' => $company->id, 'team_id' => $sreTeam->id, 'role' => 'member']
        );

        User::firstOrCreate(
            ['email' => 'alex@acme.com'],
            ['name' => 'Alex Romero', 'password' => Hash::make('password'), 'company_id' => $company->id, 'team_id' => $sreTeam->id, 'role' => 'member']
        );

        User::firstOrCreate(
            ['email' => 'priya@acme.com'],
            ['name' => 'Priya Nair', 'password' => Hash::make('password'), 'company_id' => $company->id, 'team_id' => $sreTeam->id, 'role' => 'member']
        );

        User::firstOrCreate(
            ['email' => 'diego@acme.com'],
            ['name' => 'Diego Santos', 'password' => Hash::make('password'), 'company_id' => $company->id, 'team_id' => $platformTeam->id, 'role' => 'member']
        );

        User::firstOrCreate(
            ['email' => 'lena@acme.com'],
            ['name' => 'Lena Fischer', 'password' => Hash::make('password'), 'company_id' => $company->id, 'team_id' => $platformTeam->id, 'role' => 'member']
        );

        $gateway = Service::firstOrCreate(
            ['company_id' => $company->id, 'slug' => 'api-gateway'],
            ['team_id' => $platformTeam->id, 'name' => 'API Gateway', 'description' => 'Primary ingress for all external API traffic', 'status' => 'degraded', 'uptime' => 94.20, 'latency_ms' => 1420, 'error_rate' => 5.80, 'slo_budget' => 23, 'tier' => 0, 'circuit_breaker_state' => 'half_open']
        );
        $auth = Service::firstOrCreate(
            ['company_id' => $company->id, 'slug' => 'auth-service'],
            ['team_id' => $platformTeam->id, 'name' => 'Auth Service', 'description' => 'OAuth2 and session management', 'status' => 'operational', 'uptime' => 99.99, 'latency_ms' => 12, 'error_rate' => 0.01, 'slo_budget' => 95, 'tier' => 0, 'circuit_breaker_state' => 'closed']
        );
        $payments = Service::firstOrCreate(
            ['company_id' => $company->id, 'slug' => 'payment-processor'],
            ['team_id' => $sreTeam->id, 'name' => 'Payment Processor', 'description' => 'Stripe integration and billing', 'status' => 'operational', 'uptime' => 98.50, 'latency_ms' => 89, 'error_rate' => 1.50, 'slo_budget' => 62, 'tier' => 0, 'circuit_breaker_state' => 'closed']
        );
        $notifications = Service::firstOrCreate(
            ['company_id' => $company->id, 'slug' => 'notification-service'],
            ['team_id' => $platformTeam->id, 'name' => 'Notification Service', 'description' => 'Email, SMS, and Slack delivery', 'status' => 'operational', 'uptime' => 99.90, 'latency_ms' => 8, 'error_rate' => 0.10, 'slo_budget' => 88, 'tier' => 1, 'circuit_breaker_state' => 'open']
        );

        $incident1 = Incident::firstOrCreate(
            ['company_id' => $company->id, 'title' => 'Elevated 5xx rates on API Gateway'],
            [
                'description' => 'Monitoring detected a spike in 502 errors originating from the gateway. Affects approximately 12% of requests since 14:32 UTC.',
                'severity' => 'critical',
                'status' => 'investigating',
                'reporter_id' => $sreLead->id,
                'assignee_id' => $commander->id,
                'team_id' => $sreTeam->id,
                'blast_radius' => 18400,
            ]
        );
        $incident1->services()->syncWithoutDetaching([$gateway->id, $auth->id]);

        IncidentActivity::firstOrCreate(
            ['incident_id' => $incident1->id, 'type' => 'comment', 'body' => 'Initial detection from Datadog alert. 502 rate climbing since 14:32 UTC.'],
            ['user_id' => $sreLead->id]
        );
        IncidentActivity::firstOrCreate(
            ['incident_id' => $incident1->id, 'type' => 'status_change', 'body' => 'Investigating'],
            ['user_id' => $commander->id, 'metadata' => ['old' => null, 'new' => 'investigating']]
        );
        IncidentActivity::firstOrCreate(
            ['incident_id' => $incident1->id, 'type' => 'assignment', 'body' => 'Assigning to SRE team for deep dive'],
            ['user_id' => $commander->id, 'metadata' => ['assignee_id' => $commander->id]]
        );

        $incident2 = Incident::firstOrCreate(
            ['company_id' => $company->id, 'title' => 'Payment webhook retries failing'],
            [
                'description' => 'Stripe webhook deliveries are timing out. Retry queue backing up.',
                'severity' => 'major',
                'status' => 'identified',
                'reporter_id' => $devops->id,
                'assignee_id' => $sreLead->id,
                'team_id' => $sreTeam->id,
                'acknowledged_at' => now()->subMinutes(15),
                'blast_radius' => 8200,
            ]
        );
        $incident2->services()->syncWithoutDetaching([$payments->id]);

        IncidentActivity::firstOrCreate(
            ['incident_id' => $incident2->id, 'type' => 'comment', 'body' => 'Stripe retry queue at 847 items. Webhook endpoint health check failing since 13:50 UTC.'],
            ['user_id' => $devops->id]
        );
        IncidentActivity::firstOrCreate(
            ['incident_id' => $incident2->id, 'type' => 'severity_change', 'body' => 'Escalated to Major'],
            ['user_id' => $sreLead->id, 'metadata' => ['old' => 'minor', 'new' => 'major']]
        );

        \App\Models\IncidentHypothesis::firstOrCreate(
            ['incident_id' => $incident1->id, 'title' => 'Connection Pool Exhaustion'],
            [
                'company_id' => $company->id,
                'user_id' => $commander->id,
                'confidence' => 78,
                'status' => 'investigating',
                'evidence' => ['DB replica lag > 30s', 'Connection pool at 100%', 'Primary DB CPU at 98%'],
                'owner' => 'Sarah Chen',
            ]
        );

        \App\Models\IncidentHypothesis::firstOrCreate(
            ['incident_id' => $incident1->id, 'title' => 'Memory Leak in Auth Service'],
            [
                'company_id' => $company->id,
                'user_id' => $sreLead->id,
                'confidence' => 45,
                'status' => 'hypothesis',
                'evidence' => ['RSS growing 2MB/min', 'GC pause time increasing'],
                'owner' => 'Marcus Rivera',
            ]
        );

        \App\Models\IncidentHypothesis::firstOrCreate(
            ['incident_id' => $incident1->id, 'title' => 'Network Partition Between AZs'],
            [
                'company_id' => $company->id,
                'user_id' => $devops->id,
                'confidence' => 12,
                'status' => 'ruled_out',
                'evidence' => ['Cross-AZ latency nominal', 'No packet loss detected'],
                'owner' => 'Aisha Patel',
            ]
        );
    }
}
