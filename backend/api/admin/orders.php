<?php
// backend/api/admin/orders.php
// Admin-only order viewer + status transitions for kitchen workflow.
//
// GET  /api/admin/orders?status=preparing|completed|cancelled
//   "cancelled" virtual status = order with all items fully cancelled.
// PUT  /api/admin/orders?id=N                  body: { status: 'completed' }
// PUT  /api/admin/orders?id=N&item_id=M        body: { delta: 1 | -1 }
//   delta = +1 cancels one unit, -1 restores one unit.

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
    if (!in_array($status, ['preparing', 'completed', 'cancelled'], true)) {
        http_response_code(422);
        echo json_encode(['error' => 'invalid status']);
        exit;
    }

    // "cancelled" tab = order whose every line is fully cancelled.
    // For preparing/completed, exclude fully-cancelled orders so they appear
    // only in the Cancelled tab.
    if ($status === 'cancelled') {
        $where  = '1=1';
        $having = 'SUM(oi.quantity - oi.cancelled_quantity) = 0';
        $params = [];
    } else {
        $where  = 'o.status = ?';
        $having = 'SUM(oi.quantity - oi.cancelled_quantity) > 0';
        $params = [$status];
    }

    // Preparing tab is FIFO (oldest first) so older pending orders aren't
    // buried by incoming ones. Other tabs stay newest-first.
    $orderDirection = ($status === 'preparing') ? 'ASC' : 'DESC';

    $sql = "SELECT
                o.id, o.customer_name, o.total_amount, o.amount_paid, o.status, o.order_type, o.notes, o.created_at,
                u.username AS cashier_name,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'item_id',            oi.id,
                        'product_id',         oi.product_id,
                        'name',               p.name,
                        'variety',            p.variety,
                        'quantity',           oi.quantity,
                        'cancelled_quantity', oi.cancelled_quantity,
                        'unit_price',         oi.unit_price
                    )
                ) AS items
            FROM orders o
            JOIN users        u  ON u.id  = o.cashier_id
            JOIN order_items  oi ON oi.order_id = o.id
            JOIN products     p  ON p.id  = oi.product_id
           WHERE $where
           GROUP BY o.id
          HAVING $having
           ORDER BY o.created_at $orderDirection";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    $orders = $stmt->fetchAll();
    foreach ($orders as &$order) {
        $items = json_decode($order['items'], true) ?: [];
        $effectiveTotal = 0.0;
        foreach ($items as &$it) {
            $it['quantity']           = (int)$it['quantity'];
            $it['cancelled_quantity'] = (int)($it['cancelled_quantity'] ?? 0);
            $it['unit_price']         = (float)$it['unit_price'];
            $active = max(0, $it['quantity'] - $it['cancelled_quantity']);
            $effectiveTotal += $it['unit_price'] * $active;
        }
        unset($it);
        $order['items']        = $items;
        $order['total_amount'] = $effectiveTotal;
        $order['amount_paid']  = isset($order['amount_paid']) && $order['amount_paid'] !== null
            ? (float)$order['amount_paid']
            : null;
    }

    echo json_encode($orders);
    exit;
}

// ── PUT ─────────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit;
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    // Variant: cancel/restore one unit of a line item.
    // PUT ?id=N&item_id=M  body: { delta: 1 | -1 }
    $itemId = (int)($_GET['item_id'] ?? 0);
    if ($itemId > 0) {
        $delta = (int)($body['delta'] ?? 0);
        if ($delta !== 1 && $delta !== -1) {
            http_response_code(422);
            echo json_encode(['error' => 'delta must be 1 or -1']);
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
        if ($row['status'] !== 'preparing') {
            http_response_code(409);
            echo json_encode(['error' => 'Items can only be cancelled while order is preparing']);
            exit;
        }

        $itemStmt = $db->prepare(
            'SELECT quantity, cancelled_quantity FROM order_items WHERE id = ? AND order_id = ?'
        );
        $itemStmt->execute([$itemId, $id]);
        $item = $itemStmt->fetch();
        if ($item === false) {
            http_response_code(404);
            echo json_encode(['error' => 'Item not found in this order']);
            exit;
        }

        $current = (int)$item['cancelled_quantity'];
        $max     = (int)$item['quantity'];
        $next    = $current + $delta;

        if ($next < 0 || $next > $max) {
            http_response_code(409);
            echo json_encode([
                'error' => $delta > 0
                    ? 'No more units to cancel on this line.'
                    : 'No cancelled units to restore on this line.',
            ]);
            exit;
        }

        $db->prepare(
            'UPDATE order_items SET cancelled_quantity = ? WHERE id = ?'
        )->execute([$next, $itemId]);

        echo json_encode([
            'id'                 => $id,
            'item_id'            => $itemId,
            'cancelled_quantity' => $next,
            'quantity'           => $max,
        ]);
        exit;
    }

    // Variant: restore the entire order (un-cancel all items).
    // PUT ?id=N  body: { action: 'restore_all' }
    $action = $body['action'] ?? '';
    if ($action === 'restore_all') {
        $check = $db->prepare('SELECT status FROM orders WHERE id = ?');
        $check->execute([$id]);
        $row = $check->fetch();
        if ($row === false) {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found']);
            exit;
        }
        // Reset all line cancellations and put the order back into Preparing.
        $db->prepare('UPDATE order_items SET cancelled_quantity = 0 WHERE order_id = ?')->execute([$id]);
        $db->prepare("UPDATE orders SET status = 'preparing' WHERE id = ?")->execute([$id]);
        echo json_encode(['id' => $id, 'restored' => true, 'status' => 'preparing']);
        exit;
    }

    // Variant: change order status (preparing <-> completed)
    $status = $body['status'] ?? '';

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
