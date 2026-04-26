<?php
// backend/api/shared/products.php
// Read-only product list accessible by any authenticated user (cashier or admin).
//
// GET /api/shared/products  — returns all products

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$db   = getDB();
$rows = $db->query('SELECT * FROM products ORDER BY variety, name')->fetchAll();

// Cast price to float
foreach ($rows as &$row) {
    $row['price'] = (float)$row['price'];
}

echo json_encode($rows);
