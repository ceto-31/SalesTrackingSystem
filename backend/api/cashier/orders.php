<?php
// backend/api/cashier/orders.php
// Cashier-only order management.
//
// GET    /api/cashier/orders       — list this cashier's own orders
// POST   /api/cashier/orders       — create order { customer_name, status, items: [{product_id, quantity}] }
// PUT    /api/cashier/orders?id=N  — toggle status { status: 'paid'|'unpaid' }

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$cashier = requireRole('cashier');

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET ───────────────────────────────────────────────────────────────────────

if ($method === 'GET') {
    $stmt = $db->prepare(
        "SELECT
             o.id, o.customer_name, o.total_amount, o.status, o.created_at,
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
         JOIN order_items oi ON oi.order_id  = o.id
         JOIN products    p  ON p.id         = oi.product_id
        WHERE o.cashier_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC"
    );
    $stmt->execute([$cashier['id']]);

    $orders = $stmt->fetchAll();
    // Decode the JSON_ARRAYAGG string into a real array
    foreach ($orders as &$order) {
        $order['items']        = json_decode($order['items'], true);
        $order['total_amount'] = (float)$order['total_amount'];
    }

    echo json_encode($orders);
    exit;
}

// ── POST (create order) ───────────────────────────────────────────────────────

if ($method === 'POST') {
    $body         = json_decode(file_get_contents('php://input'), true) ?? [];
    $customerName = trim((string)($body['customer_name'] ?? ''));
    $status       = $body['status'] ?? 'unpaid';
    $items        = $body['items']  ?? [];

    if ($customerName === '') {
        http_response_code(400);
        echo json_encode(['error' => 'customer_name is required']);
        exit;
    }

    if (!in_array($status, ['paid', 'unpaid'], true)) {
        http_response_code(422);
        echo json_encode(['error' => 'status must be paid or unpaid']);
        exit;
    }

    if (empty($items) || !is_array($items)) {
        http_response_code(400);
        echo json_encode(['error' => 'items array is required and cannot be empty']);
        exit;
    }

    // Fetch and validate all products in one query
    $productIds = array_unique(array_column($items, 'product_id'));
    $placeholders = implode(',', array_fill(0, count($productIds), '?'));
    $pstmt = $db->prepare("SELECT id, price FROM products WHERE id IN ($placeholders)");
    $pstmt->execute($productIds);
    $priceMap = [];
    foreach ($pstmt->fetchAll() as $row) {
        $priceMap[(int)$row['id']] = (float)$row['price'];
    }

    // Compute total and validate
    $total = 0.0;
    $validatedItems = [];

    foreach ($items as $item) {
        $pid = (int)($item['product_id'] ?? 0);
        $qty = (int)($item['quantity']   ?? 0);

        if ($pid <= 0 || $qty <= 0) {
            http_response_code(422);
            echo json_encode(['error' => 'Each item needs a valid product_id and quantity > 0']);
            exit;
        }

        if (!isset($priceMap[$pid])) {
            http_response_code(422);
            echo json_encode(['error' => "Product ID $pid not found"]);
            exit;
        }

        $unitPrice = $priceMap[$pid];
        $total += $unitPrice * $qty;
        $validatedItems[] = ['product_id' => $pid, 'quantity' => $qty, 'unit_price' => $unitPrice];
    }

    // Insert order + items in a transaction
    $db->beginTransaction();
    try {
        $orderStmt = $db->prepare(
            'INSERT INTO orders (cashier_id, customer_name, total_amount, status) VALUES (?, ?, ?, ?)'
        );
        $orderStmt->execute([$cashier['id'], $customerName, $total, $status]);
        $orderId = (int)$db->lastInsertId();

        $itemStmt = $db->prepare(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
        );
        foreach ($validatedItems as $vi) {
            $itemStmt->execute([$orderId, $vi['product_id'], $vi['quantity'], $vi['unit_price']]);
        }

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create order']);
        exit;
    }

    http_response_code(201);
    echo json_encode(['id' => $orderId, 'total_amount' => $total, 'status' => $status]);
    exit;
}

// ── PUT (update status) ───────────────────────────────────────────────────────

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit;
    }

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $status = $body['status'] ?? '';

    if (!in_array($status, ['paid', 'unpaid'], true)) {
        http_response_code(422);
        echo json_encode(['error' => 'status must be paid or unpaid']);
        exit;
    }

    // Cashiers may only update their own orders
    $check = $db->prepare('SELECT id FROM orders WHERE id = ? AND cashier_id = ?');
    $check->execute([$id, $cashier['id']]);
    if ($check->fetch() === false) {
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
