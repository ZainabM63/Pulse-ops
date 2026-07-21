<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Service extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'team_id', 'name', 'slug', 'description', 'status', 'severity_level', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
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
