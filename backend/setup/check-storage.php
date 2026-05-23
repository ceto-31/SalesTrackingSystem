<?php
/**
 * Verify Railway Storage Bucket connectivity.
 *
 * Usage:
 *   GET https://<railway-host>/setup/check-storage.php?token=<SETUP_TOKEN>
 *
 * Requires bucket credentials linked to the backend service (AWS SDK preset).
 * Delete or disable after verification.
 */

declare(strict_types=1);

header('Content-Type: application/json');

$expected = getenv('SETUP_TOKEN') ?: ($_ENV['SETUP_TOKEN'] ?? '');
$provided = $_GET['token'] ?? '';

if ($expected === '' || !hash_equals($expected, (string)$provided)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden']);
    exit;
}

require_once __DIR__ . '/../lib/ObjectStorage.php';

use App\ObjectStorage;

$storage = ObjectStorage::get();

echo json_encode([
    'ok'        => true,
    's3_enabled'=> $storage->isS3Enabled(),
    'message'   => $storage->isS3Enabled()
        ? 'Railway bucket connected — new product photos will use S3 storage.'
        : 'S3 not configured — using local disk. Link a bucket in Railway and inject AWS SDK variables.',
]);
