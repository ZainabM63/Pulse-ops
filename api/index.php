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

// Fix: vercel-php may not preserve original REQUEST_URI on dest rewrites
if (empty($_SERVER['REQUEST_URI']) || $_SERVER['REQUEST_URI'] === '/api/index.php') {
    $_SERVER['REQUEST_URI'] = $_SERVER['HTTP_X_ORIGINAL_URL'] ?? $_SERVER['HTTP_X_REWRITE_URL'] ?? '/';
}

require __DIR__ . '/../public/index.php';
