<?php

// 1. Force dynamic storage paths to use Vercel's writable /tmp directory
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

// 2. Set environment overrides dynamically before booting Laravel
$_ENV['APP_STORAGE'] = $tmpStorage;
$_ENV['VIEW_COMPILED_PATH'] = $tmpStorage . '/framework/views';
putenv("APP_STORAGE={$tmpStorage}");
putenv("VIEW_COMPILED_PATH={$tmpStorage}/framework/views");

// 3. Require the standard Laravel entry point
require __DIR__ . '/../public/index.php';
