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
        $company = Company::create([
            'name' => 'Acme Corp Engineering',
            'slug' => 'acme-corp',
            'settings' => ['timezone' => 'UTC', 'slack_webhook' => null],
        ]);

        $platformTeam = Team::create(['company_id' => $company->id, 'name' => 'Platform', 'slug' => 'platform']);
        $sreTeam = Team::create(['company_id' => $company->id, 'name' => 'SRE', 'slug' => 'sre']);

        $commander = User::create([
            'name' => 'Sarah Chen',
            'email' => 'sarah@acme.com',
            'password' => Hash::make('password'),
            'company_id' => $company->id,
            'team_id' => $sreTeam->id,
            'role' => 'admin',
        ]);

        $sreLead = User::create([
            'name' => 'Marcus Rivera',
            'email' => 'marcus@acme.com',
            'password' => Hash::make('password'),
            'company_id' => $company->id,
            'team_id' => $sreTeam->id,
            'role' => 'manager',
        ]);

        $devops = User::create([
            'name' => 'Aisha Patel',
            'email' => 'aisha@acme.com',
            'password' => Hash::make('password'),
            'company_id' => $company->id,
            'team_id' => $platformTeam->id,
            'role' => 'member',
        ]);

        $gateway = Service::create(['company_id' => $company->id, 'team_id' => $platformTeam->id, 'name' => 'API Gateway', 'slug' => 'api-gateway', 'description' => 'Primary ingress for all external API traffic', 'status' => 'degraded']);
        $auth = Service::create(['company_id' => $company->id, 'team_id' => $platformTeam->id, 'name' => 'Auth Service', 'slug' => 'auth-service', 'description' => 'OAuth2 and session management', 'status' => 'operational']);
        $payments = Service::create(['company_id' => $company->id, 'team_id' => $sreTeam->id, 'name' => 'Payment Processor', 'slug' => 'payment-processor', 'description' => 'Stripe integration and billing', 'status' => 'operational']);
        $notifications = Service::create(['company_id' => $company->id, 'team_id' => $platformTeam->id, 'name' => 'Notification Service', 'slug' => 'notification-service', 'description' => 'Email, SMS, and Slack delivery', 'status' => 'operational']);

        $incident1 = Incident::create([
            'company_id' => $company->id,
            'title' => 'Elevated 5xx rates on API Gateway',
            'description' => 'Monitoring detected a spike in 502 errors originating from the gateway. Affects approximately 12% of requests since 14:32 UTC.',
            'severity' => 'critical',
            'status' => 'investigating',
            'reporter_id' => $sreLead->id,
            'assignee_id' => $commander->id,
            'team_id' => $sreTeam->id,
        ]);
        $incident1->services()->attach([$gateway->id, $auth->id]);

        IncidentActivity::create(['incident_id' => $incident1->id, 'user_id' => $sreLead->id, 'type' => 'comment', 'body' => 'Initial detection from Datadog alert. 502 rate climbing since 14:32 UTC.']);
        IncidentActivity::create(['incident_id' => $incident1->id, 'user_id' => $commander->id, 'type' => 'status_change', 'body' => 'Investigating', 'metadata' => ['old' => null, 'new' => 'investigating']]);
        IncidentActivity::create(['incident_id' => $incident1->id, 'user_id' => $commander->id, 'type' => 'assignment', 'body' => 'Assigning to SRE team for deep dive', 'metadata' => ['assignee_id' => $commander->id]]);

        $incident2 = Incident::create([
            'company_id' => $company->id,
            'title' => 'Payment webhook retries failing',
            'description' => 'Stripe webhook deliveries are timing out. Retry queue backing up.',
            'severity' => 'major',
            'status' => 'identified',
            'reporter_id' => $devops->id,
            'assignee_id' => $sreLead->id,
            'team_id' => $sreTeam->id,
            'acknowledged_at' => now()->subMinutes(15),
        ]);
        $incident2->services()->attach([$payments->id]);

        IncidentActivity::create(['incident_id' => $incident2->id, 'user_id' => $devops->id, 'type' => 'comment', 'body' => 'Stripe retry queue at 847 items. Webhook endpoint health check failing since 13:50 UTC.']);
        IncidentActivity::create(['incident_id' => $incident2->id, 'user_id' => $sreLead->id, 'type' => 'severity_change', 'body' => 'Escalated to Major', 'metadata' => ['old' => 'minor', 'new' => 'major']]);
    }
}
