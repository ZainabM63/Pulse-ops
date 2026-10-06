<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AgentRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'incident_id' => $this->incident_id,
            'user' => new UserResource($this->whenLoaded('user')),
            'title' => $this->title,
            'status' => $this->status,
            'mode' => $this->mode,
            'metadata' => $this->metadata,
            'actions' => AgentActionResource::collection($this->whenLoaded('actions')),
            'incident' => new IncidentResource($this->whenLoaded('incident')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
