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

// Load Composer Autoloader and Bootstrap App manually to capture exact error
require __DIR__ . '/../vendor/autoload.php';

try {
    $app = require_once __DIR__ . '/../bootstrap/app.php';

    $kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);

    $request = \Illuminate\Http\Request::capture();
    $response = $kernel->handle($request);

    $response->send();
    $kernel->terminate($request, $response);

} catch (\Throwable $e) {
    header('Content-Type: application/json', true, 500);
    echo json_encode([
        'root_cause_message' => $e->getMessage(),
        'root_cause_file' => $e->getFile(),
        'root_cause_line' => $e->getLine(),
        'root_cause_class' => get_class($e),
        'trace' => explode("\n", $e->getTraceAsString()),
    ], JSON_PRETTY_PRINT);
    exit;
}
