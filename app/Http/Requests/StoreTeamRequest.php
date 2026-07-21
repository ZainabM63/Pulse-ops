<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class StoreTeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:teams,slug'],
            'description' => ['nullable', 'string', 'max:1000'],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (!$this->has('slug') || empty($this->slug)) {
            $this->merge(['slug' => Str::slug($this->name)]);
        }
    }
}
