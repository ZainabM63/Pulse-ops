<?php

namespace App\Providers;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Broadcast::routes([
            'middleware' => ['api', 'auth:sanctum'],
        ]);

        $this->runMigrationsOnServerless();
    }

    /**
     * On the serverless Vercel backend there is no PHP binary at build time,
     * so migrations cannot run via the build command. Run them once per cold
     * start at request time instead — `migrate --force` is idempotent, and a
     * marker keeps warm instances from re-running it.
     */
    protected function runMigrationsOnServerless(): void
    {
        if (! app()->environment('production')) {
            return;
        }

        $storageDir = env('APP_STORAGE') ?: storage_path();
        $marker = rtrim($storageDir, '/\\').'/framework/migrations-ran.marker';

        if (is_file($marker)) {
            return;
        }

        try {
            Artisan::call('migrate', ['--force' => true]);
            @touch($marker);
        } catch (\Throwable $e) {
            Log::error('Runtime migration failed', ['error' => $e->getMessage()]);
        }
    }
}
