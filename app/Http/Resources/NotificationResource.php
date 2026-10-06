<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'incident_id' => $this->incident_id,
            'incident_number' => 'INC-'.str_pad((string) $this->incident_id, 4, '0', STR_PAD_LEFT),
            'type' => $this->type,
            'body' => $this->body,
            'data' => $this->data,
            'actor' => $this->actor?->name ?? 'System',
            'read_at' => $this->read_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}