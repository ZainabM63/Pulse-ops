<?php

namespace App\Services;

class MockAgentBrain extends AgentBrain
{
    public function __construct()
    {
    }

    public function decide(string $userMessage, array $incidentContext): array
    {
        return $this->fallbackDecide($userMessage, $incidentContext);
    }

    public function summarize(string $userMessage, array $toolResults): string
    {
        return $this->fallbackSummarize($toolResults);
    }
}
