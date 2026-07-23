<?php

// 1. Hide deprecation notices so they don't corrupt headers/booting
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', '0');

$tmpStorage = '/tmp/storage';

$storageFolders = [
    $tmpStorage . '/app/public',
    $tmpStorage . '/framework/cache/data',
    $tmpStorage . '/framework/sessions',
    $tmpStorage . '/framework/views',
    $tmpStorage . '/logs',
];

foreach ($storageFolders as $folder) {
    if (!is_dir($folder)) {
        mkdir($folder, 0755, true);
    }
}

// 2. Explicitly set LOG_CHANNEL to 'stderr' everywhere
$_ENV['APP_STORAGE'] = $tmpStorage;
$_ENV['VIEW_COMPILED_PATH'] = $tmpStorage . '/framework/views';
$_ENV['LOG_CHANNEL'] = 'stderr';

$_SERVER['APP_STORAGE'] = $tmpStorage;
$_SERVER['VIEW_COMPILED_PATH'] = $tmpStorage . '/framework/views';
$_SERVER['LOG_CHANNEL'] = 'stderr';

putenv("APP_STORAGE={$tmpStorage}");
putenv("VIEW_COMPILED_PATH={$tmpStorage}/framework/views");
putenv("LOG_CHANNEL=stderr");

try {
    require __DIR__ . '/../public/index.php';
} catch (\Throwable $e) {
    header('Content-Type: application/json', true, 500);
    echo json_encode([
        'error' => 'Early Boot Failure',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_PRETTY_PRINT);
    exit;
}
