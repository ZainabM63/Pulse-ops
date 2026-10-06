<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agent_run_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // restart_service, scale_resources, rollback_deployment, send_notification, run_diagnostics, create_followup, generate_postmortem, update_service_status
            $table->string('label');
            $table->string('status')->default('pending'); // pending, running, completed, failed, skipped
            $table->json('input')->nullable();
            $table->json('output')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_actions');
    }
};
