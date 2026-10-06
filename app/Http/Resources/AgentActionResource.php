<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AgentActionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'label' => $this->label,
            'status' => $this->status,
            'input' => $this->input,
            'output' => $this->output,
            'error' => $this->error,
            'executed_at' => $this->executed_at,
            'created_at' => $this->created_at,
        ];
    }
}
