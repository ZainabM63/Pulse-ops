<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'name' => 'PulseOps API',
    'version' => '1.0.0',
    'status' => 'operational',
]));
