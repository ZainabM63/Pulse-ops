<?php

function rrmdir($dir) {
    if (!is_dir($dir)) return;
    $objects = scandir($dir);
    foreach ($objects as $object) {
        if ($object === '.' || $object === '..') continue;
        $path = $dir . '/' . $object;
        is_dir($path) ? rrmdir($path) : unlink($path);
    }
    rmdir($dir);
}

$tmpStorage = '/tmp/storage';
$storageFolders = [
    "$tmpStorage/app/public",
    "$tmpStorage/app/private",
    "$tmpStorage/framework/cache/data",
    "$tmpStorage/framework/cache/lock",
    "$tmpStorage/framework/sessions",
    "$tmpStorage/framework/views",
    "$tmpStorage/logs",
];
foreach ($storageFolders as $folder) {
    if (!is_dir($folder)) {
        mkdir($folder, 0755, true);
    }
}

$storageLink = __DIR__ . '/../storage';
if (is_link($storageLink)) {
    // already symlinked
} elseif (is_dir($storageLink)) {
    rrmdir($storageLink);
    symlink($tmpStorage, $storageLink);
} else {
    symlink($tmpStorage, $storageLink);
}

require __DIR__ . '/../public/index.php';
