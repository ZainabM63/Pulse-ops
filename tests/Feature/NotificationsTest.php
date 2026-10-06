<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Incident;
use App\Models\Team;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\IncidentNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationsTest extends TestCase
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

    protected function makeTeam(Company $company, string $name = 'SRE'): Team
    {
        return Team::create([
            'company_id' => $company->id,
            'name' => $name,
            'slug' => Str::slug($name),
            'description' => 'Test team',
        ]);
    }

    protected function makeIncident(Company $company, User $reporter, ?Team $team = null): Incident
    {
        return Incident::create([
            'company_id' => $company->id,
            'title' => 'API Gateway degraded',
            'description' => 'High error rate detected',
            'severity' => 'critical',
            'status' => 'investigating',
            'reporter_id' => $reporter->id,
            'assignee_id' => $reporter->id,
            'team_id' => $team?->id,
            'blast_radius' => 'medium',
        ]);
    }

    public function test_involved_user_ids_includes_assignee_reporter_and_team_members(): void
    {
        $company = $this->makeCompany();
        $team = $this->makeTeam($company);
        $reporter = $this->makeUser($company, ['team_id' => $team->id]);
        $assignee = $this->makeUser($company, ['team_id' => $team->id]);
        $teammate = $this->makeUser($company, ['team_id' => $team->id]);
        $outsider = $this->makeUser($company);

        $incident = $this->makeIncident($company, $reporter, $team);
        $incident->update(['assignee_id' => $assignee->id]);

        $ids = $incident->involvedUserIds();

        sort($ids);
        $this->assertSame([$reporter->id, $assignee->id, $teammate->id], $ids);
        $this->assertNotContains($outsider->id, $ids);
    }

    public function test_involved_user_ids_excludes_actor(): void
    {
        $company = $this->makeCompany();
        $reporter = $this->makeUser($company);
        $assignee = $this->makeUser($company);
        $incident = $this->makeIncident($company, $reporter);
        $incident->update(['assignee_id' => $assignee->id]);

        $ids = $incident->involvedUserIds($assignee->id);

        $this->assertSame([$reporter->id], $ids);
    }

    public function test_notifier_creates_notification_for_each_recipient_excluding_actor(): void
    {
        $company = $this->makeCompany();
        $team = $this->makeTeam($company);
        $reporter = $this->makeUser($company, ['team_id' => $team->id]);
        $assignee = $this->makeUser($company, ['team_id' => $team->id]);
        $teammate = $this->makeUser($company, ['team_id' => $team->id]);
        $incident = $this->makeIncident($company, $reporter, $team);
        $incident->update(['assignee_id' => $assignee->id]);

        app(IncidentNotifier::class)->notify($incident, [
            'type' => 'status_change',
            'body' => 'Incident status changed to monitoring',
        ], $assignee->id);

        $this->assertDatabaseCount('user_notifications', 2);

        $rows = UserNotification::where('incident_id', $incident->id)->get();
        $recipientIds = $rows->pluck('user_id')->sort()->values()->all();
        $this->assertSame([$reporter->id, $teammate->id], $recipientIds);
        $this->assertNotContains($assignee->id, $recipientIds);
        $this->assertSame('status_change', $rows->first()->type);
        foreach ($rows as $row) {
            $this->assertSame($incident->id, $row->incident_id);
            $this->assertSame($assignee->id, $row->actor_id);
            $this->assertNull($row->read_at);
        }
    }

    public function test_index_returns_only_own_notifications_with_unread_count(): void
    {
        $company = $this->makeCompany();
        $actor = $this->makeUser($company);
        $reporter = $this->makeUser($company);
        $assignee = $this->makeUser($company);

        $incident = $this->makeIncident($company, $reporter);
        $incident->update(['assignee_id' => $assignee->id]);

        app(IncidentNotifier::class)->notify($incident, [
            'type' => 'comment',
            'body' => 'Adding a note',
        ], $actor->id);

        $other = $this->makeIncident($company, $this->makeUser($company));
        UserNotification::create([
            'user_id' => $actor->id,
            'incident_id' => $other->id,
            'actor_id' => $reporter->id,
            'type' => 'comment',
            'body' => 'Belongs to actor',
        ]);

        Sanctum::actingAs($assignee);
        $response = $this->getJson('/api/v1/notifications');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.unread_count', 1)
            ->assertJsonPath('data.0.body', 'Adding a note')
            ->assertJsonPath('data.0.incident_number', 'INC-'.str_pad((string) $incident->id, 4, '0', STR_PAD_LEFT))
            ->assertJsonPath('data.0.actor', $actor->name);
    }

    public function test_read_marks_selected_ids_for_current_user_only(): void
    {
        $company = $this->makeCompany();
        $actor = $this->makeUser($company);
        $user = $this->makeUser($company);

        $incident = $this->makeIncident($company, $user);
        $a = UserNotification::create([
            'user_id' => $user->id,
            'incident_id' => $incident->id,
            'actor_id' => $actor->id,
            'type' => 'chat',
            'body' => 'first',
        ]);
        $b = UserNotification::create([
            'user_id' => $user->id,
            'incident_id' => $incident->id,
            'actor_id' => $actor->id,
            'type' => 'chat',
            'body' => 'second',
        ]);
        // Another user's notification with the same id must not be touched.
        UserNotification::create([
            'user_id' => $actor->id,
            'incident_id' => $incident->id,
            'actor_id' => $user->id,
            'type' => 'chat',
            'body' => 'others',
        ]);

        Sanctum::actingAs($user);
        $response = $this->postJson('/api/v1/notifications/read', ['ids' => [$a->id]]);

        $response->assertOk()->assertJsonPath('unread_count', 1);
        $this->assertNotNull($a->fresh()->read_at);
        $this->assertNull($b->fresh()->read_at);
        $this->assertNull(UserNotification::where('user_id', $actor->id)->first()->read_at);
    }

    public function test_read_all_marks_every_unread_for_current_user(): void
    {
        $company = $this->makeCompany();
        $actor = $this->makeUser($company);
        $user = $this->makeUser($company);

        $incident = $this->makeIncident($company, $user);
        UserNotification::create([
            'user_id' => $user->id,
            'incident_id' => $incident->id,
            'actor_id' => $actor->id,
            'type' => 'chat',
            'body' => 'first',
        ]);
        UserNotification::create([
            'user_id' => $user->id,
            'incident_id' => $incident->id,
            'actor_id' => $actor->id,
            'type' => 'chat',
            'body' => 'second',
        ]);

        Sanctum::actingAs($user);
        $response = $this->postJson('/api/v1/notifications/read', ['all' => true]);

        $response->assertOk()->assertJsonPath('unread_count', 0);
        $this->assertSame(
            0,
            UserNotification::where('user_id', $user->id)->whereNull('read_at')->count()
        );
    }
}