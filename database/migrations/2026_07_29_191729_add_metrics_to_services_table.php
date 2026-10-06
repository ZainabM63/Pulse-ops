<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->decimal('uptime', 5, 2)->default(100.00)->after('metadata');
            $table->unsignedInteger('latency_ms')->default(0)->after('uptime');
            $table->decimal('error_rate', 5, 2)->default(0.00)->after('latency_ms');
            $table->unsignedSmallInteger('slo_budget')->default(100)->after('error_rate');
            $table->unsignedTinyInteger('tier')->default(3)->after('slo_budget');
            $table->string('circuit_breaker_state')->default('closed')->after('tier');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn(['uptime', 'latency_ms', 'error_rate', 'slo_budget', 'tier', 'circuit_breaker_state']);
        });
    }
};
