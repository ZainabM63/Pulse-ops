<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Incident extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'title', 'description', 'severity', 'status', 'reporter_id', 'assignee_id', 'team_id', 'acknowledged_at', 'resolved_at'];

    protected function casts(): array
    {
        return [
            'acknowledged_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class, 'incident_services')->withTimestamps();
    }

    public function activities(): HasMany
    {
        return $this->hasMany(IncidentActivity::class);
    }
}
