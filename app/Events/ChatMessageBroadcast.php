<?php

namespace App\Events;

use App\Http\Resources\IncidentActivityResource;
use App\Models\IncidentActivity;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatMessageBroadcast implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public IncidentActivity $activity) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('company.'.$this->activity->incident->company_id)];
    }

    public function broadcastAs(): string
    {
        return 'chat.message';
    }

    public function broadcastWith(): array
    {
        return (new IncidentActivityResource(
            $this->activity->load('user')
        ))->resolve();
    }
}
