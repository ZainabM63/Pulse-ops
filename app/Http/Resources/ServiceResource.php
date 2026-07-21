<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'status' => $this->status,
            'severity_level' => $this->severity_level,
            'metadata' => $this->metadata,
            'team' => new TeamResource($this->whenLoaded('team')),
            'created_at' => $this->created_at,
        ];
    }
}
