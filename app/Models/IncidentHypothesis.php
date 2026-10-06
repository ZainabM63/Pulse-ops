<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncidentHypothesis extends Model
{
    use HasFactory;

    protected $fillable = [
        'incident_id',
        'company_id',
        'user_id',
        'title',
        'confidence',
        'status',
        'evidence',
        'owner',
    ];

    protected $casts = [
        'confidence' => 'integer',
        'evidence' => 'array',
    ];

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
