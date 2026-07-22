<?php

$storageFolders = [
    '/tmp/storage/app/public',
    '/tmp/storage/framework/cache/data',
    '/tmp/storage/framework/cache/lock',
    '/tmp/storage/framework/sessions',
    '/tmp/storage/framework/views',
    '/tmp/storage/logs',
];

foreach ($storageFolders as $folder) {
    if (!is_dir($folder)) {
        mkdir($folder, 0755, true);
    }
}

$links = [
    __DIR__ . '/../storage' => '/tmp/storage',
];

foreach ($links as $link => $target) {
    if (file_exists($link)) {
        if (is_link($link)) {
            continue;
        }
        if (is_dir($link)) {
            rmdir($link);
        } else {
            unlink($link);
        }
    }
    symlink($target, $link);
}

require __DIR__ . '/../public/index.php';
