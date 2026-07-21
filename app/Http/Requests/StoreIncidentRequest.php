<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'severity' => ['required', 'string', 'in:critical,major,minor,info'],
            'assignee_id' => ['nullable', 'exists:users,id'],
            'team_id' => ['nullable', 'exists:teams,id'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['exists:services,id'],
        ];
    }
}
