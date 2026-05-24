<?php
// backend/api/uploads/serve.php
// Serve product images from local disk or Railway S3 bucket.
//
// GET /uploads/products/{filename}  (via .htaccess rewrite)

declare(strict_types=1);

require_once __DIR__ . '/../../lib/ObjectStorage.php';

use App\ObjectStorage;

$file = basename((string)($_GET['file'] ?? ''));
// Hashed uploads OR catalog names like lomi.jpg, pancit.jpg
if ($file === '' || !preg_match('/^(?:[a-f0-9]{32}|[a-z][a-z0-9_-]{0,48})\.(jpg|jpeg|png|webp|gif)$/i', $file)) {
    http_response_code(400);
    exit('Invalid file');
}

$storage = ObjectStorage::get();
$dbPath  = 'uploads/products/' . $file;

if (!$storage->stream($dbPath)) {
    http_response_code(404);
    exit('Not found');
}
