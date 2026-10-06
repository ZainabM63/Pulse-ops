<?php

use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AgentController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\IncidentController;
use App\Http\Controllers\Api\V1\IncidentHypothesisController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\TeamController;
use App\Http\Controllers\Api\V1\TelemetryLogController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/user', [AuthController::class, 'me']);

        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/read', [NotificationController::class, 'read']);

        Route::get('/dashboard', DashboardController::class);
        Route::get('/activity-log', ActivityLogController::class);

        Route::get('/telemetry', [TelemetryLogController::class, 'index']);
        Route::post('/telemetry', [TelemetryLogController::class, 'store']);

        Route::apiResource('incidents', IncidentController::class);
        Route::post('/incidents/{incident}/chat', [IncidentController::class, 'chat']);
        Route::get('/incidents/{incident}/chat', [IncidentController::class, 'getChat']);
        Route::post('/incidents/{incident}/activity', [IncidentController::class, 'logActivity']);

        Route::get('/incidents/{incident}/hypotheses', [IncidentHypothesisController::class, 'index']);
        Route::post('/incidents/{incident}/hypotheses', [IncidentHypothesisController::class, 'store']);
        Route::put('/incidents/{incident}/hypotheses/{hypothesis}', [IncidentHypothesisController::class, 'update']);
        Route::delete('/incidents/{incident}/hypotheses/{hypothesis}', [IncidentHypothesisController::class, 'destroy']);

        Route::apiResource('services', ServiceController::class);
        Route::patch('/services/{service}/circuit-breaker', [ServiceController::class, 'updateCircuitBreaker']);

        Route::get('/teams/users', [TeamController::class, 'users']);
        Route::apiResource('teams', TeamController::class)->only(['index', 'show', 'store', 'update', 'destroy']);

        Route::middleware('throttle:30,1')->group(function () {
            Route::get('/agent/health', [AgentController::class, 'health']);
            Route::get('/agent/runs', [AgentController::class, 'index']);
            Route::post('/agent/runs', [AgentController::class, 'store']);
            Route::get('/agent/runs/{run}', [AgentController::class, 'show']);
            Route::post('/agent/runs/{run}/chat', [AgentController::class, 'chat']);
            Route::post('/agent/runs/{run}/execute', [AgentController::class, 'execute']);
            Route::post('/agent/runs/{run}/cancel', [AgentController::class, 'cancel']);
        });
    });
});
