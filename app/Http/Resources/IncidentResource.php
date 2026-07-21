<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncidentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'severity' => $this->severity,
            'status' => $this->status,
            'reporter' => new UserResource($this->whenLoaded('reporter')),
            'assignee' => new UserResource($this->whenLoaded('assignee')),
            'team' => new TeamResource($this->whenLoaded('team')),
            'services' => ServiceResource::collection($this->whenLoaded('services')),
            'activities' => IncidentActivityResource::collection($this->whenLoaded('activities')),
            'acknowledged_at' => $this->acknowledged_at,
            'resolved_at' => $this->resolved_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
