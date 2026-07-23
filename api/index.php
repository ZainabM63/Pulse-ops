<?php

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
    // Unpack inner exception if present
    $actualError = $e->getPrevious() ?? $e;

    header('Content-Type: application/json', true, 500);
    echo json_encode([
        'error' => 'Early Boot Failure',
        'real_message' => $actualError->getMessage(),
        'real_file' => $actualError->getFile(),
        'real_line' => $actualError->getLine(),
        'trace' => explode("\n", $actualError->getTraceAsString()),
    ], JSON_PRETTY_PRINT);
    exit;
}
