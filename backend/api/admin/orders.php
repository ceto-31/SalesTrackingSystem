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
                     'item_id',      oi.id,
                     'product_id',   oi.product_id,
                     'name',         p.name,
                     'variety',      p.variety,
                     'quantity',     oi.quantity,
                     'unit_price',   oi.unit_price,
                     'is_cancelled', oi.is_cancelled
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
        $items = json_decode($order['items'], true) ?: [];
        // Normalize types + recompute live total from non-cancelled items
        $effectiveTotal = 0.0;
        foreach ($items as &$it) {
            $it['quantity']     = (int)$it['quantity'];
            $it['unit_price']   = (float)$it['unit_price'];
            $it['is_cancelled'] = (int)($it['is_cancelled'] ?? 0);
            if (!$it['is_cancelled']) {
                $effectiveTotal += $it['unit_price'] * $it['quantity'];
            }
        }
        unset($it);
        $order['items']        = $items;
        $order['total_amount'] = $effectiveTotal;
    }

    echo json_encode($orders);
    exit;
}

// ── PUT (mark completed, reopen, or toggle item cancel) ─────────────────────
if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit;
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    // Variant: cancel/uncancel a single line item.
    // PUT /api/admin/orders.php?id=N&item_id=M  body: {is_cancelled: 0|1}
    $itemId = (int)($_GET['item_id'] ?? 0);
    if ($itemId > 0) {
        if (!array_key_exists('is_cancelled', $body)) {
            http_response_code(422);
            echo json_encode(['error' => 'is_cancelled is required']);
            exit;
        }
        $flag = (int)!!$body['is_cancelled'];

        // Verify order exists and is still editable (preparing).
        $check = $db->prepare('SELECT status FROM orders WHERE id = ?');
        $check->execute([$id]);
        $row = $check->fetch();
        if ($row === false) {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found']);
            exit;
        }
        if ($row['status'] !== 'preparing') {
            http_response_code(409);
            echo json_encode(['error' => 'Items can only be cancelled while order is preparing']);
            exit;
        }

        $upd = $db->prepare(
            'UPDATE order_items SET is_cancelled = ? WHERE id = ? AND order_id = ?'
        );
        $upd->execute([$flag, $itemId, $id]);
        if ($upd->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Item not found in this order']);
            exit;
        }

        echo json_encode(['id' => $id, 'item_id' => $itemId, 'is_cancelled' => $flag]);
        exit;
    }

    // Variant: change order status (preparing <-> completed)
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
