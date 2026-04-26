<?php
// backend/api/admin/orders.php
// Admin-only order viewer + status transitions for kitchen workflow.
//
// GET  /api/admin/orders?status=preparing|completed
// PUT  /api/admin/orders?id=N    body: { status: 'completed' }   // mark done

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

requireRole('admin');

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET ─────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $status = $_GET['status'] ?? 'preparing';
    if (!in_array($status, ['unpaid', 'paid', 'preparing', 'completed'], true)) {
        http_response_code(422);
        echo json_encode(['error' => 'invalid status']);
        exit;
    }

    $stmt = $db->prepare(
        "SELECT
             o.id, o.customer_name, o.total_amount, o.status, o.created_at,
             u.username AS cashier_name,
             JSON_ARRAYAGG(
                 JSON_OBJECT(
                     'item_id',    oi.id,
                     'product_id', oi.product_id,
                     'name',       p.name,
                     'variety',    p.variety,
                     'quantity',   oi.quantity,
                     'unit_price', oi.unit_price
                 )
             ) AS items
         FROM orders o
         JOIN users        u  ON u.id  = o.cashier_id
         JOIN order_items  oi ON oi.order_id = o.id
         JOIN products     p  ON p.id  = oi.product_id
        WHERE o.status = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC"
    );
    $stmt->execute([$status]);

    $orders = $stmt->fetchAll();
    foreach ($orders as &$order) {
        $order['items']        = json_decode($order['items'], true);
        $order['total_amount'] = (float)$order['total_amount'];
    }

    echo json_encode($orders);
    exit;
}

// ── PUT (mark completed) ────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit;
    }

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $status = $body['status'] ?? '';

    // Admin can flip only between preparing/completed (re-open or finish)
    if (!in_array($status, ['preparing', 'completed'], true)) {
        http_response_code(422);
        echo json_encode(['error' => 'admin status must be preparing or completed']);
        exit;
    }

    $check = $db->prepare('SELECT status FROM orders WHERE id = ?');
    $check->execute([$id]);
    $row = $check->fetch();
    if ($row === false) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found']);
        exit;
    }

    $db->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$status, $id]);
    echo json_encode(['id' => $id, 'status' => $status]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
