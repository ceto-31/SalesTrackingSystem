<?php
/**
 * Assign shared catalog images to products by name rules.
 *
 * GET /setup/assign-product-images.php?token=<SETUP_TOKEN>
 *
 * Catalog files (backend/catalog/):
 *   lomi.jpg    → all products whose name contains "Lomi"
 *   pancit.jpg  → all "Pancit Batil Patong" products
 *   sisilog.jpg → "Sisilog" and "Sisig Double Rice"
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

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../lib/ObjectStorage.php';

use App\ObjectStorage;

$storage = ObjectStorage::get();
$db      = getDB();
$log     = [];

$catalogFiles = ['lomi.jpg', 'pancit.jpg', 'sisilog.jpg'];
foreach ($catalogFiles as $file) {
    try {
        $storage->publishCatalogFile($file);
        $log[] = "Published catalog file: {$file}";
    } catch (Throwable $e) {
        $log[] = "Catalog {$file}: " . $e->getMessage();
    }
}

/** @return list<array{image:string, sql:string, params:array}> */
function assignmentRules(): array
{
    return [
        [
            'image'  => 'uploads/products/lomi.jpg',
            'sql'    => "UPDATE products SET image = ? WHERE LOWER(name) LIKE '%lomi%'",
            'params' => ['uploads/products/lomi.jpg'],
        ],
        [
            'image'  => 'uploads/products/pancit.jpg',
            'sql'    => "UPDATE products SET image = ? WHERE LOWER(name) LIKE '%pancit batil patong%'",
            'params' => ['uploads/products/pancit.jpg'],
        ],
        [
            'image'  => 'uploads/products/sisilog.jpg',
            'sql'    => "UPDATE products SET image = ? WHERE LOWER(TRIM(name)) IN ('sisilog', 'sisig double rice')",
            'params' => ['uploads/products/sisilog.jpg'],
        ],
    ];
}

$assigned = [];
foreach (assignmentRules() as $rule) {
    $stmt = $db->prepare($rule['sql']);
    $stmt->execute($rule['params']);
    $count = $stmt->rowCount();
    $assigned[] = [
        'image' => $rule['image'],
        'updated' => $count,
    ];
    $log[] = "{$rule['image']}: updated {$count} product(s)";
}

// Report which products received images
$report = $db->query(
    "SELECT id, name, variety, image FROM products
     WHERE image IN (
       'uploads/products/lomi.jpg',
       'uploads/products/pancit.jpg',
       'uploads/products/sisilog.jpg'
     )
     ORDER BY variety, name"
)->fetchAll();

echo json_encode([
    'ok'       => true,
    'assigned' => $assigned,
    'products' => $report,
    's3'       => $storage->isS3Enabled(),
    'log'      => $log,
]);
