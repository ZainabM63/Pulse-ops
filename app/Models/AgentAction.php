<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentAction extends Model
{
    protected $fillable = ['agent_run_id', 'type', 'label', 'status', 'input', 'output', 'error', 'executed_at'];

    protected function casts(): array
    {
        return [
            'input' => 'array',
            'output' => 'array',
            'executed_at' => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(AgentRun::class, 'agent_run_id');
    }
}
