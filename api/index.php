<?php

// 1. Create temporary storage directories for Vercel read-only environment
$storageFolders = [
    '/tmp/storage/app',
    '/tmp/storage/framework/cache',
    '/tmp/storage/framework/sessions',
    '/tmp/storage/framework/views',
    '/tmp/storage/logs',
];

foreach ($storageFolders as $folder) {
    if (!is_dir($folder)) {
        mkdir($folder, 0755, true);
    }
}

// 2. Forward execution to Laravel's public/index.php entrypoint
require __DIR__ . '/../public/index.php';
