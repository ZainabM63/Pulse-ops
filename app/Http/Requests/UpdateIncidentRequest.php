<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'severity' => ['sometimes', 'string', 'in:critical,major,minor,info'],
            'status' => ['sometimes', 'string', 'in:investigating,identified,monitoring,resolved,postmortem'],
            'assignee_id' => ['nullable', 'exists:users,id'],
            'team_id' => ['nullable', 'exists:teams,id'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['exists:services,id'],
            'comment' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
