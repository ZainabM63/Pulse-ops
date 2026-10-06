<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AgentBrain
{
    protected string $apiKey;
    protected string $model;

    public function __construct()
    {
        $this->apiKey = config('services.gemini.key');
        $this->model = config('services.gemini.model', 'gemini-2.0-flash');
    }

    public function decide(string $userMessage, array $incidentContext): array
    {
        $systemPrompt = $this->buildSystemPrompt();
        $contextJson = json_encode($incidentContext, JSON_PRETTY_PRINT);
        $toolSchemas = $this->buildToolSchemas();

        $prompt = "{$systemPrompt}\n\nIncident Context:\n{$contextJson}\n\nUser Request: {$userMessage}\n\nRespond with a JSON array of tool calls to execute. Each object should have \"type\" (tool name) and \"input\" (parameters object). If no tools needed, return empty array.";

        try {
            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
            ])->post("https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->apiKey}", [
                'contents' => [
                    ['role' => 'user', 'parts' => [['text' => $prompt]]],
                ],
                'generationConfig' => [
                    'temperature' => 0.3,
                    'maxOutputTokens' => 1024,
                ],
                'tools' => $toolSchemas ? [['functionDeclarations' => $toolSchemas]] : null,
            ]);

            if ($response->failed()) {
                Log::error('Gemini API error', ['status' => $response->status(), 'body' => $response->body()]);
                return $this->fallbackDecide($userMessage, $incidentContext);
            }

            $body = $response->json();
            $text = $body['candidates'][0]['content']['parts'][0]['text'] ?? null;

            if ($text) {
                $parsed = json_decode($text, true);
                if (is_array($parsed)) {
                    return $parsed;
                }
            }

            $functionCalls = $body['candidates'][0]['content']['parts'] ?? [];
            $toolCalls = [];
            foreach ($functionCalls as $part) {
                if (isset($part['functionCall'])) {
                    $toolCalls[] = [
                        'type' => $part['functionCall']['name'],
                        'input' => $part['functionCall']['args'] ?? [],
                    ];
                }
            }

            if (!empty($toolCalls)) {
                return $toolCalls;
            }

            return $this->fallbackDecide($userMessage, $incidentContext);
        } catch (\Exception $e) {
            Log::error('AgentBrain error', ['message' => $e->getMessage()]);
            return $this->fallbackDecide($userMessage, $incidentContext);
        }
    }

    public function summarize(string $userMessage, array $toolResults): string
    {
        $resultsJson = json_encode($toolResults, JSON_PRETTY_PRINT);
        $prompt = "You are PulseOps Agent. The user asked: \"{$userMessage}\"\n\nYou executed these actions and got these results:\n{$resultsJson}\n\nWrite a brief, professional summary of what was done and any recommendations. Keep it under 3 sentences.";

        try {
            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
            ])->post("https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->apiKey}", [
                'contents' => [
                    ['role' => 'user', 'parts' => [['text' => $prompt]]],
                ],
                'generationConfig' => [
                    'temperature' => 0.5,
                    'maxOutputTokens' => 256,
                ],
            ]);

            if ($response->failed()) {
                return $this->fallbackSummarize($toolResults);
            }

            $body = $response->json();
            return $body['candidates'][0]['content']['parts'][0]['text'] ?? $this->fallbackSummarize($toolResults);
        } catch (\Exception $e) {
            return $this->fallbackSummarize($toolResults);
        }
    }

    protected function buildSystemPrompt(): string
    {
        return <<<'PROMPT'
You are PulseOps Agent, an SRE incident response AI assistant. You analyze incidents and decide which remediation tools to use.

Available tools:
- restart_service: Restart a degraded service (params: service_name)
- scale_resources: Scale service resources (params: service_name, replicas)
- rollback_deployment: Roll back a deployment (params: service_name, version)
- send_notification: Send Slack alert (params: message)
- run_diagnostics: Run health diagnostics (params: service_name optional)
- create_followup: Create follow-up incident (params: title, severity)
- generate_postmortem: Generate post-mortem report (no params)
- resolve_incident: Mark the incident as resolved (no params)
- update_service_status: Change service status (params: service_name, status)

Analyze the incident context carefully. Consider severity, affected services, and current status when deciding actions.
Always respond with a JSON array of tool calls, or an empty array if no actions needed.
PROMPT;
    }

    protected function buildToolSchemas(): array
    {
        return [
            [
                'name' => 'restart_service',
                'description' => 'Restart a degraded or failing service to recover from errors',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'service_name' => ['type' => 'STRING', 'description' => 'Name of the service to restart'],
                    ],
                    'required' => ['service_name'],
                ],
            ],
            [
                'name' => 'scale_resources',
                'description' => 'Scale service replicas or resources up or down',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'service_name' => ['type' => 'STRING', 'description' => 'Name of the service to scale'],
                        'replicas' => ['type' => 'INTEGER', 'description' => 'Number of replicas'],
                    ],
                    'required' => ['service_name', 'replicas'],
                ],
            ],
            [
                'name' => 'rollback_deployment',
                'description' => 'Roll back a service to a previous deployment version',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'service_name' => ['type' => 'STRING', 'description' => 'Name of the service to rollback'],
                        'version' => ['type' => 'STRING', 'description' => 'Target version to rollback to'],
                    ],
                    'required' => ['service_name', 'version'],
                ],
            ],
            [
                'name' => 'send_notification',
                'description' => 'Send a Slack notification to the team about the incident',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'message' => ['type' => 'STRING', 'description' => 'Notification message'],
                    ],
                    'required' => ['message'],
                ],
            ],
            [
                'name' => 'run_diagnostics',
                'description' => 'Run diagnostics to gather health data about services',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'service_name' => ['type' => 'STRING', 'description' => 'Optional: specific service to diagnose'],
                    ],
                ],
            ],
            [
                'name' => 'create_followup',
                'description' => 'Create a follow-up incident for tracking',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'title' => ['type' => 'STRING', 'description' => 'Title of the follow-up incident'],
                        'severity' => ['type' => 'STRING', 'description' => 'Severity: critical, major, minor, info'],
                    ],
                    'required' => ['title', 'severity'],
                ],
            ],
            [
                'name' => 'generate_postmortem',
                'description' => 'Generate a post-mortem report for the incident',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => (object) [],
                ],
            ],
            [
                'name' => 'resolve_incident',
                'description' => 'Mark the current incident as resolved and set the resolved timestamp',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => (object) [],
                ],
            ],
            [
                'name' => 'update_service_status',
                'description' => 'Update the operational status of a service',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'service_name' => ['type' => 'STRING', 'description' => 'Name of the service'],
                        'status' => ['type' => 'STRING', 'description' => 'New status: operational, degraded, partial_outage, major_outage'],
                    ],
                    'required' => ['service_name', 'status'],
                ],
            ],
        ];
    }

    protected function fallbackDecide(string $userMessage, array $incidentContext): array
    {
        $msg = strtolower($userMessage);
        $calls = [];

        if (str_contains($msg, 'restart') || str_contains($msg, 'reset')) {
            $services = $incidentContext['services'] ?? [];
            $name = $services[0]['name'] ?? 'unknown';
            $calls[] = ['type' => 'restart_service', 'input' => ['service_name' => $name]];
        }

        if (str_contains($msg, 'scale') || str_contains($msg, 'capacity')) {
            $services = $incidentContext['services'] ?? [];
            $name = $services[0]['name'] ?? 'unknown';
            $calls[] = ['type' => 'scale_resources', 'input' => ['service_name' => $name, 'replicas' => 6]];
        }

        if (str_contains($msg, 'rollback') || str_contains($msg, 'roll back')) {
            $services = $incidentContext['services'] ?? [];
            $name = $services[0]['name'] ?? 'unknown';
            $calls[] = ['type' => 'rollback_deployment', 'input' => ['service_name' => $name, 'version' => 'previous']];
        }

        if (str_contains($msg, 'notify') || str_contains($msg, 'alert') || str_contains($msg, 'slack')) {
            $calls[] = ['type' => 'send_notification', 'input' => ['message' => "Incident update: {$userMessage}"]];
        }

        if (str_contains($msg, 'diagnos') || str_contains($msg, 'check') || str_contains($msg, 'investigate') || str_contains($msg, 'health')) {
            $calls[] = ['type' => 'run_diagnostics', 'input' => []];
        }

        if (str_contains($msg, 'follow') || str_contains($msg, 'track') || str_contains($msg, 'new incident')) {
            $calls[] = ['type' => 'create_followup', 'input' => ['title' => "Follow-up: {$userMessage}", 'severity' => 'minor']];
        }

        if (str_contains($msg, 'postmortem') || str_contains($msg, 'post-mortem') || str_contains($msg, 'report')) {
            $calls[] = ['type' => 'generate_postmortem', 'input' => []];
        }

        if (str_contains($msg, 'resolve') || str_contains($msg, 'resolved')) {
            $calls[] = ['type' => 'resolve_incident', 'input' => []];
        }

        if (str_contains($msg, 'update')) {
            $services = $incidentContext['services'] ?? [];
            if (!empty($services)) {
                $calls[] = ['type' => 'update_service_status', 'input' => ['service_name' => $services[0]['name'], 'status' => 'operational']];
            }
        }

        if (empty($calls)) {
            $calls[] = ['type' => 'run_diagnostics', 'input' => []];
        }

        $seen = [];
        $calls = array_values(array_filter($calls, function ($call) use (&$seen) {
            $key = $call['type'] . ':' . json_encode($call['input']);
            if (in_array($key, $seen, true)) return false;
            $seen[] = $key;
            return true;
        }));

        return $calls;
    }

    protected function fallbackSummarize(array $toolResults): string
    {
        $completed = array_filter($toolResults, fn($r) => $r['status'] === 'completed');
        $failed = array_filter($toolResults, fn($r) => $r['status'] === 'failed');

        $summary = "Executed " . count($completed) . " action(s) successfully.";
        if (!empty($failed)) {
            $summary .= " " . count($failed) . " action(s) failed.";
        }
        $summary .= " Monitor the incident for any changes.";

        return $summary;
    }
}
