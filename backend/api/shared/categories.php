<?php
// backend/api/shared/categories.php
// Returns the union of seeded categories + any categories already used by products.
// Available to any authenticated user (admin or cashier).

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

requireAuth();

const SEEDED_CATEGORIES = [
    'Silogz',
    'Platters',
    'Noodle Dishes',
    'Snacks',
    'Refreshments',
];

$db = getDB();

try {
    $rows = $db->query(
        "SELECT DISTINCT variety FROM products WHERE variety IS NOT NULL AND variety <> ''"
    )->fetchAll(PDO::FETCH_COLUMN);
} catch (Throwable $e) {
    $rows = [];
}

$all = array_values(array_unique(array_merge(SEEDED_CATEGORIES, $rows)));
sort($all, SORT_NATURAL | SORT_FLAG_CASE);

echo json_encode($all);
