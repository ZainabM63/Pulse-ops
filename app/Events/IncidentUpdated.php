<?php

namespace App\Events;

use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class IncidentUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Incident $incident) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('company.'.$this->incident->company_id)];
    }

    public function broadcastAs(): string
    {
        return 'incident.updated';
    }

    public function broadcastWith(): array
    {
        return (new IncidentResource(
            $this->incident->fresh()->load(['reporter', 'assignee', 'team', 'services'])
        ))->resolve();
    }
}
