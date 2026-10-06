<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Service extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'team_id', 'name', 'slug', 'description', 'status', 'severity_level', 'metadata', 'uptime', 'latency_ms', 'error_rate', 'slo_budget', 'tier', 'circuit_breaker_state'];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'uptime' => 'decimal:2',
            'latency_ms' => 'integer',
            'error_rate' => 'decimal:2',
            'slo_budget' => 'integer',
            'tier' => 'integer',
        ];
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function incidents(): BelongsToMany
    {
        return $this->belongsToMany(Incident::class, 'incident_services')->withTimestamps();
    }
}
