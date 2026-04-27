<?php
// backend/api/shared/top-products.php
// Read-only top-selling product IDs for the last N days.
// Available to any authenticated user (cashier or admin) so the cashier
// product grid can surface popular items in the first row.
//
// GET /api/shared/top-products            — last 30 days, top 10
// GET /api/shared/top-products?days=7     — last 7 days

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

$days = (int)($_GET['days'] ?? 30);
if ($days < 1 || $days > 365) {
    $days = 30;
}

$limit = (int)($_GET['limit'] ?? 10);
if ($limit < 1 || $limit > 50) {
    $limit = 10;
}

$db = getDB();

$sql = "SELECT
            oi.product_id,
            SUM(oi.quantity - oi.cancelled_quantity) AS total_sold
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= (NOW() - INTERVAL ? DAY)
          AND o.status IN ('preparing', 'completed', 'paid')
        GROUP BY oi.product_id
        HAVING total_sold > 0
        ORDER BY total_sold DESC
        LIMIT $limit";

$stmt = $db->prepare($sql);
$stmt->execute([$days]);

$rows = $stmt->fetchAll();
foreach ($rows as &$r) {
    $r['product_id'] = (int)$r['product_id'];
    $r['total_sold'] = (int)$r['total_sold'];
}

echo json_encode($rows);
