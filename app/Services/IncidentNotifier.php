<?php

namespace App\Services;

use App\Events\NotificationBroadcast;
use App\Models\Incident;
use App\Models\UserNotification;

class IncidentNotifier
{
    /**
     * Create a notification for every user involved in the incident
     * (assignee + reporter + linked team members), excluding the actor,
     * and broadcast it live to the recipient's private channel.
     *
     * @param array{type: string, body?: ?string, data?: ?array} $payload
     */
    public function notify(Incident $incident, array $payload, ?int $actorId = null): void
    {
        $recipientIds = $incident->involvedUserIds($actorId);

        foreach ($recipientIds as $userId) {
            $notification = UserNotification::create([
                'user_id' => $userId,
                'incident_id' => $incident->id,
                'actor_id' => $actorId,
                'type' => $payload['type'],
                'body' => $payload['body'] ?? null,
                'data' => $payload['data'] ?? null,
            ]);

            NotificationBroadcast::dispatch($notification);
        }
    }
}