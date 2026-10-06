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
            'uptime' => $this->uptime,
            'latency_ms' => $this->latency_ms,
            'error_rate' => $this->error_rate,
            'slo_budget' => $this->slo_budget,
            'tier' => $this->tier,
            'circuit_breaker_state' => $this->circuit_breaker_state,
            'team' => new TeamResource($this->whenLoaded('team')),
            'created_at' => $this->created_at,
        ];
    }
}
