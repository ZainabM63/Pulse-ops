<?php

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', '0');

$tmpStorage = '/tmp/storage';

$storageFolders = [
    $tmpStorage . '/app/public',
    $tmpStorage . '/framework/cache/data',
    $tmpStorage . '/framework/sessions',
    $tmpStorage . '/framework/views',
    $tmpStorage . '/bootstrap/cache',
    $tmpStorage . '/logs',
];

foreach ($storageFolders as $folder) {
    if (!is_dir($folder)) {
        mkdir($folder, 0755, true);
    }
}

$_ENV['APP_STORAGE'] = $tmpStorage;
$_ENV['VIEW_COMPILED_PATH'] = $tmpStorage . '/framework/views';
$_ENV['APP_SERVICES_CACHE'] = $tmpStorage . '/bootstrap/cache/services.php';
$_ENV['APP_PACKAGES_CACHE'] = $tmpStorage . '/bootstrap/cache/packages.php';
$_ENV['APP_ROUTES_CACHE'] = $tmpStorage . '/bootstrap/cache/routes-v7.php';
$_ENV['APP_CONFIG_CACHE'] = $tmpStorage . '/bootstrap/cache/config.php';
$_ENV['LOG_CHANNEL'] = 'stderr';

putenv("APP_STORAGE={$tmpStorage}");
putenv("VIEW_COMPILED_PATH={$tmpStorage}/framework/views");
putenv("APP_SERVICES_CACHE={$tmpStorage}/bootstrap/cache/services.php");
putenv("APP_PACKAGES_CACHE={$tmpStorage}/bootstrap/cache/packages.php");
putenv("LOG_CHANNEL=stderr");

// Debug: dump ALL relevant server vars
if (isset($_SERVER['REQUEST_URI']) && str_contains($_SERVER['REQUEST_URI'], 'debug-server')) {
    header('Content-Type: application/json');
    echo json_encode([
        'REQUEST_URI' => $_SERVER['REQUEST_URI'] ?? 'NOT SET',
        'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'] ?? 'NOT SET',
        'SCRIPT_FILENAME' => $_SERVER['SCRIPT_FILENAME'] ?? 'NOT SET',
        'PHP_SELF' => $_SERVER['PHP_SELF'] ?? 'NOT SET',
        'ORIG_SCRIPT_NAME' => $_SERVER['ORIG_SCRIPT_NAME'] ?? 'NOT SET',
        'PATH_INFO' => $_SERVER['PATH_INFO'] ?? 'NOT SET',
        'PATH_TRANSLATED' => $_SERVER['PATH_TRANSLATED'] ?? 'NOT SET',
        'HTTP_X_ORIGINAL_URL' => $_SERVER['HTTP_X_ORIGINAL_URL'] ?? 'NOT SET',
        'HTTP_X_REWRITE_URL' => $_SERVER['HTTP_X_REWRITE_URL'] ?? 'NOT SET',
        'REDIRECT_URL' => $_SERVER['REDIRECT_URL'] ?? 'NOT SET',
        'SERVER_NAME' => $_SERVER['SERVER_NAME'] ?? 'NOT SET',
        'SERVER_PORT' => $_SERVER['SERVER_PORT'] ?? 'NOT SET',
        'SERVER_PROTOCOL' => $_SERVER['SERVER_PROTOCOL'] ?? 'NOT SET',
        'HTTP_HOST' => $_SERVER['HTTP_HOST'] ?? 'NOT SET',
        'REQUEST_METHOD' => $_SERVER['REQUEST_METHOD'] ?? 'NOT SET',
        'QUERY_STRING' => $_SERVER['QUERY_STRING'] ?? 'NOT SET',
        'HTTPS' => $_SERVER['HTTPS'] ?? 'NOT SET',
    ]);
    exit;
}

require __DIR__ . '/../public/index.php';
