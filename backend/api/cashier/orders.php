<?php
// backend/api/cashier/orders.php
// Cashier-only order management.
//
// GET    /api/cashier/orders       — list this cashier's own orders
// POST   /api/cashier/orders       — create order
// PUT    /api/cashier/orders?id=N  — pay, partial pay, or edit

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../lib/order_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$cashier = requireRole('cashier');

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

/** Enrich a raw order row with computed payment fields. */
function enrichOrder(array $order, array $items): array
{
    $effectiveTotal = orderEffectiveTotalFromItems($items);
    $paidTotal      = orderPaidTotalFromItems($items);
    $remaining      = max(0, $effectiveTotal - $paidTotal);
    $totalActiveQty = 0;
    foreach ($items as $it) {
        $totalActiveQty += orderItemActiveQty($it);
    }

    $order['items']            = $items;
    $order['total_amount']     = $effectiveTotal;
    $order['paid_total']       = $paidTotal;
    $order['remaining_total']  = $remaining;
    $order['payment_status']   = $totalActiveQty === 0 ? 'cancelled' : orderPaymentStatusFromItems($items);
    $order['amount_paid']      = isset($order['amount_paid']) && $order['amount_paid'] !== null
        ? (float)$order['amount_paid']
        : null;
    $order['daily_seq']        = (int)($order['daily_seq'] ?? 0);
    if ($totalActiveQty === 0) {
        $order['status'] = 'cancelled';
    }
    return $order;
}

/** Load one order owned by cashier; null if missing. */
function loadCashierOrder(PDO $db, int $orderId, int $cashierId): ?array
{
    $stmt = $db->prepare(
        'SELECT id, daily_seq, customer_name, total_amount, amount_paid, status,
                order_type, notes, payment_note, created_at
         FROM orders
         WHERE id = ? AND cashier_id = ?'
    );
    $stmt->execute([$orderId, $cashierId]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

/** Mark all active units paid (used after full payment). */
function markAllItemsPaid(PDO $db, int $orderId): void
{
    $db->prepare(
        'UPDATE order_items
         SET paid_quantity = GREATEST(quantity - cancelled_quantity, 0)
         WHERE order_id = ?'
    )->execute([$orderId]);
}

// ── GET ───────────────────────────────────────────────────────────────────────

if ($method === 'GET') {
    $stmt = $db->prepare(
        "SELECT
             o.id, o.daily_seq, o.customer_name, o.total_amount, o.amount_paid,
             o.status, o.order_type, o.notes, o.payment_note, o.created_at,
             JSON_ARRAYAGG(
                 JSON_OBJECT(
                     'item_id',            oi.id,
                     'product_id',         oi.product_id,
                     'name',               p.name,
                     'variety',            p.variety,
                     'quantity',           oi.quantity,
                     'cancelled_quantity', oi.cancelled_quantity,
                     'paid_quantity',      COALESCE(oi.paid_quantity, 0),
                     'unit_price',         oi.unit_price
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
    $out    = [];
    foreach ($orders as $order) {
        $items = json_decode($order['items'], true) ?: [];
        foreach ($items as &$it) {
            $it = normalizeOrderItemRow($it);
        }
        unset($it);
        unset($order['items']);
        $out[] = enrichOrder($order, $items);
    }

    echo json_encode($out);
    exit;
}

// ── POST (create order) ───────────────────────────────────────────────────────

if ($method === 'POST') {
    $body         = json_decode(file_get_contents('php://input'), true) ?? [];
    $customerName = trim((string)($body['customer_name'] ?? ''));
    $status       = $body['status']     ?? 'preparing';
    $orderType    = $body['order_type'] ?? 'dine_in';
    $notes        = trim((string)($body['notes'] ?? ''));
    if (mb_strlen($notes) > 255) {
        $notes = mb_substr($notes, 0, 255);
    }
    if ($notes === '') {
        $notes = null;
    }
    $items        = $body['items']      ?? [];
    $amountPaidRaw = $body['amount_paid'] ?? null;
    $amountPaid    = ($amountPaidRaw === null || $amountPaidRaw === '') ? null : (float)$amountPaidRaw;

    if ($customerName === '') {
        http_response_code(400);
        echo json_encode(['error' => 'customer_name is required']);
        exit;
    }

    if (!in_array($status, ['paid', 'unpaid', 'preparing', 'completed'], true)) {
        http_response_code(422);
        echo json_encode(['error' => 'invalid status']);
        exit;
    }

    if (!in_array($orderType, ['dine_in', 'takeout'], true)) {
        http_response_code(422);
        echo json_encode(['error' => 'invalid order_type']);
        exit;
    }

    if (empty($items) || !is_array($items)) {
        http_response_code(400);
        echo json_encode(['error' => 'items array is required and cannot be empty']);
        exit;
    }

    $productIds = array_unique(array_column($items, 'product_id'));
    $placeholders = implode(',', array_fill(0, count($productIds), '?'));
    $pstmt = $db->prepare("SELECT id, price FROM products WHERE id IN ($placeholders)");
    $pstmt->execute($productIds);
    $priceMap = [];
    foreach ($pstmt->fetchAll() as $row) {
        $priceMap[(int)$row['id']] = (float)$row['price'];
    }

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

    $db->beginTransaction();
    try {
        if ($amountPaid !== null && $amountPaid < $total) {
            $db->rollBack();
            http_response_code(422);
            echo json_encode(['error' => 'amount_paid must be >= total']);
            exit;
        }

        $orderStmt = $db->prepare(
            'INSERT INTO orders (cashier_id, customer_name, total_amount, amount_paid, daily_seq, status, order_type, notes)
             VALUES (?, ?, ?, ?,
                     COALESCE((SELECT s.next FROM (SELECT MAX(daily_seq) + 1 AS next FROM orders WHERE DATE(created_at) = CURDATE()) AS s), 1),
                     ?, ?, ?)'
        );
        $orderStmt->execute([$cashier['id'], $customerName, $total, $amountPaid, $status, $orderType, $notes]);
        $orderId = (int)$db->lastInsertId();

        $itemStmt = $db->prepare(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price, paid_quantity)
             VALUES (?, ?, ?, ?, ?)'
        );
        $paidQty = $amountPaid !== null ? null : 0;
        foreach ($validatedItems as $vi) {
            $pq = $paidQty === null ? $vi['quantity'] : 0;
            $itemStmt->execute([$orderId, $vi['product_id'], $vi['quantity'], $vi['unit_price'], $pq]);
        }

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create order']);
        exit;
    }

    $namePlaceholders = implode(',', array_fill(0, count($productIds), '?'));
    $nstmt = $db->prepare("SELECT id, name, variety FROM products WHERE id IN ($namePlaceholders)");
    $nstmt->execute($productIds);
    $nameMap = [];
    foreach ($nstmt->fetchAll() as $row) {
        $nameMap[(int)$row['id']] = ['name' => $row['name'], 'variety' => $row['variety']];
    }
    $responseItems = [];
    foreach ($validatedItems as $vi) {
        $responseItems[] = [
            'product_id' => $vi['product_id'],
            'name'       => $nameMap[$vi['product_id']]['name']    ?? '',
            'variety'    => $nameMap[$vi['product_id']]['variety'] ?? '',
            'quantity'   => $vi['quantity'],
            'unit_price' => $vi['unit_price'],
        ];
    }

    http_response_code(201);
    echo json_encode([
        'id'            => $orderId,
        'customer_name' => $customerName,
        'cashier_name'  => $cashier['username'],
        'total_amount'  => $total,
        'amount_paid'   => $amountPaid,
        'status'        => $status,
        'order_type'    => $orderType,
        'notes'         => $notes,
        'created_at'    => date('c'),
        'items'         => $responseItems,
    ]);
    exit;
}

// ── PUT ───────────────────────────────────────────────────────────────────────

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit;
    }

    $body  = json_decode(file_get_contents('php://input'), true) ?? [];
    $order = loadCashierOrder($db, $id, (int)$cashier['id']);
    if ($order === null) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found']);
        exit;
    }

    $action = $body['action'] ?? '';

    // ── Edit order (preparing only) ───────────────────────────────────────────
    if ($action === 'edit') {
        if ($order['status'] !== 'preparing') {
            http_response_code(409);
            echo json_encode(['error' => 'Only preparing orders can be edited']);
            exit;
        }

        $items = fetchOrderItems($db, $id);
        if (orderPaymentStatusFromItems($items) === 'paid') {
            http_response_code(409);
            echo json_encode(['error' => 'Fully paid orders cannot be edited']);
            exit;
        }

        $customerName = array_key_exists('customer_name', $body)
            ? trim((string)$body['customer_name'])
            : $order['customer_name'];
        $notes = array_key_exists('notes', $body)
            ? trim((string)$body['notes'])
            : (string)($order['notes'] ?? '');
        $orderType = $body['order_type'] ?? $order['order_type'];

        if ($customerName === '') {
            http_response_code(400);
            echo json_encode(['error' => 'customer_name is required']);
            exit;
        }
        if (mb_strlen($notes) > 255) {
            $notes = mb_substr($notes, 0, 255);
        }
        if ($notes === '') {
            $notes = null;
        }
        if (!in_array($orderType, ['dine_in', 'takeout'], true)) {
            http_response_code(422);
            echo json_encode(['error' => 'invalid order_type']);
            exit;
        }

        $itemUpdates = $body['items'] ?? [];
        $newItems    = $body['add_items'] ?? [];
        $removeIds   = $body['remove_item_ids'] ?? [];

        if (!is_array($itemUpdates)) {
            $itemUpdates = [];
        }
        if (!is_array($newItems)) {
            $newItems = [];
        }
        if (!is_array($removeIds)) {
            $removeIds = [];
        }

        $itemMap = [];
        foreach ($items as $it) {
            $itemMap[(int)$it['item_id']] = $it;
        }

        $db->beginTransaction();
        try {
            // Remove lines (only unpaid units).
            foreach ($removeIds as $rid) {
                $rid = (int)$rid;
                if (!isset($itemMap[$rid])) {
                    continue;
                }
                $it = $itemMap[$rid];
                if ((int)$it['paid_quantity'] > 0) {
                    throw new RuntimeException('Cannot remove items that have been paid');
                }
                $db->prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?')->execute([$rid, $id]);
                unset($itemMap[$rid]);
            }

            // Update quantities on existing lines.
            foreach ($itemUpdates as $upd) {
                $itemId = (int)($upd['item_id'] ?? 0);
                $newQty = (int)($upd['quantity'] ?? 0);
                if ($itemId <= 0 || !isset($itemMap[$itemId])) {
                    throw new RuntimeException("Item $itemId not found in this order");
                }
                $it       = $itemMap[$itemId];
                $paid     = (int)$it['paid_quantity'];
                $cancelled = (int)$it['cancelled_quantity'];
                $minQty   = $paid + $cancelled;
                if ($newQty < $minQty) {
                    throw new RuntimeException(
                        "Cannot set quantity below paid/cancelled units for {$it['name']}"
                    );
                }
                if ($newQty <= 0) {
                    throw new RuntimeException('Quantity must be at least 1');
                }
                $db->prepare('UPDATE order_items SET quantity = ? WHERE id = ? AND order_id = ?')
                   ->execute([$newQty, $itemId, $id]);
            }

            // Add new products.
            if (!empty($newItems)) {
                $productIds = array_unique(array_column($newItems, 'product_id'));
                $placeholders = implode(',', array_fill(0, count($productIds), '?'));
                $pstmt = $db->prepare("SELECT id, price FROM products WHERE id IN ($placeholders)");
                $pstmt->execute($productIds);
                $priceMap = [];
                foreach ($pstmt->fetchAll() as $row) {
                    $priceMap[(int)$row['id']] = (float)$row['price'];
                }

                $insert = $db->prepare(
                    'INSERT INTO order_items (order_id, product_id, quantity, unit_price, paid_quantity)
                     VALUES (?, ?, ?, ?, 0)'
                );
                foreach ($newItems as $ni) {
                    $pid = (int)($ni['product_id'] ?? 0);
                    $qty = (int)($ni['quantity'] ?? 0);
                    if ($pid <= 0 || $qty <= 0) {
                        throw new RuntimeException('Each new item needs product_id and quantity > 0');
                    }
                    if (!isset($priceMap[$pid])) {
                        throw new RuntimeException("Product ID $pid not found");
                    }
                    $insert->execute([$id, $pid, $qty, $priceMap[$pid]]);
                }
            }

            $db->prepare(
                'UPDATE orders SET customer_name = ?, notes = ?, order_type = ? WHERE id = ?'
            )->execute([$customerName, $notes, $orderType, $id]);

            syncOrderTotalAmount($db, $id);

            $updatedItems = fetchOrderItems($db, $id);
            if (orderEffectiveTotalFromItems($updatedItems) <= 0) {
                throw new RuntimeException('Order must have at least one active item');
            }

            $db->commit();
        } catch (RuntimeException $e) {
            $db->rollBack();
            http_response_code(422);
            echo json_encode(['error' => $e->getMessage()]);
            exit;
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update order']);
            exit;
        }

        $fresh = loadCashierOrder($db, $id, (int)$cashier['id']);
        $freshItems = fetchOrderItems($db, $id);
        echo json_encode(enrichOrder($fresh, $freshItems));
        exit;
    }

    // ── Partial payment for selected items ────────────────────────────────────
    if ($action === 'pay_items') {
        $payLines = $body['items'] ?? [];
        if (!is_array($payLines) || empty($payLines)) {
            http_response_code(400);
            echo json_encode(['error' => 'items array is required']);
            exit;
        }

        $amountTendered = (float)($body['amount_tendered'] ?? 0);
        $paymentNote    = trim((string)($body['payment_note'] ?? ''));

        $items   = fetchOrderItems($db, $id);
        $itemMap = [];
        foreach ($items as $it) {
            $itemMap[(int)$it['item_id']] = $it;
        }

        $selectedTotal = 0.0;
        $validatedPay  = [];

        foreach ($payLines as $pl) {
            $itemId = (int)($pl['item_id'] ?? 0);
            $qty    = (int)($pl['quantity'] ?? 0);
            if ($itemId <= 0 || $qty <= 0 || !isset($itemMap[$itemId])) {
                http_response_code(422);
                echo json_encode(['error' => 'Each pay item needs valid item_id and quantity > 0']);
                exit;
            }
            $it      = $itemMap[$itemId];
            $unpaid  = orderItemUnpaidQty($it);
            if ($qty > $unpaid) {
                http_response_code(422);
                echo json_encode(['error' => "Cannot pay more than unpaid quantity for {$it['name']}"]);
                exit;
            }
            $lineDue = $qty * (float)$it['unit_price'];
            $selectedTotal += $lineDue;
            $validatedPay[] = ['item_id' => $itemId, 'quantity' => $qty, 'line_due' => $lineDue];
        }

        if ($selectedTotal <= 0) {
            http_response_code(422);
            echo json_encode(['error' => 'Nothing to pay for selected items']);
            exit;
        }
        if ($amountTendered < $selectedTotal) {
            http_response_code(422);
            echo json_encode(['error' => 'amount_tendered must be >= selected total']);
            exit;
        }

        $db->beginTransaction();
        try {
            $upd = $db->prepare(
                'UPDATE order_items SET paid_quantity = paid_quantity + ? WHERE id = ? AND order_id = ?'
            );
            foreach ($validatedPay as $vp) {
                $upd->execute([$vp['quantity'], $vp['item_id'], $id]);
            }

            $freshItems = fetchOrderItems($db, $id);
            $fullyPaid  = isOrderFullyPaidFromItems($freshItems);
            $newNote    = appendPaymentNote($order['payment_note'] ?? null, $paymentNote);

            if ($fullyPaid) {
                $db->prepare(
                    'UPDATE orders SET amount_paid = ?, payment_note = ? WHERE id = ?'
                )->execute([$amountTendered, $newNote !== '' ? $newNote : null, $id]);
            } else {
                $db->prepare(
                    'UPDATE orders SET payment_note = ? WHERE id = ?'
                )->execute([$newNote !== '' ? $newNote : null, $id]);
            }

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Failed to record payment']);
            exit;
        }

        $fresh = loadCashierOrder($db, $id, (int)$cashier['id']);
        echo json_encode([
            'id'              => $id,
            'selected_total'  => $selectedTotal,
            'amount_tendered' => $amountTendered,
            'fully_paid'      => $fullyPaid,
            'order'           => enrichOrder($fresh, $freshItems),
        ]);
        exit;
    }

    // ── Full payment (legacy + remaining balance) ─────────────────────────────
    if (array_key_exists('amount_paid', $body)) {
        $amountPaid = (float)$body['amount_paid'];
        $paymentNote = trim((string)($body['payment_note'] ?? ''));

        $items     = fetchOrderItems($db, $id);
        $remaining = max(0, orderEffectiveTotalFromItems($items) - orderPaidTotalFromItems($items));

        if ($remaining <= 0 && isOrderFullyPaidFromItems($items)) {
            http_response_code(422);
            echo json_encode(['error' => 'Order is already fully paid']);
            exit;
        }

        $due = $remaining > 0 ? $remaining : orderEffectiveTotalFromItems($items);
        if ($due <= 0) {
            http_response_code(422);
            echo json_encode(['error' => 'Order has no billable items']);
            exit;
        }
        if ($amountPaid < $due) {
            http_response_code(422);
            echo json_encode(['error' => 'amount_paid must be >= remaining balance']);
            exit;
        }

        $newNote = appendPaymentNote($order['payment_note'] ?? null, $paymentNote);

        $db->beginTransaction();
        try {
            markAllItemsPaid($db, $id);
            $db->prepare('UPDATE orders SET amount_paid = ?, payment_note = ? WHERE id = ?')
               ->execute([$amountPaid, $newNote !== '' ? $newNote : null, $id]);
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Failed to mark as paid']);
            exit;
        }

        echo json_encode([
            'id'            => $id,
            'amount_paid'   => $amountPaid,
            'total_amount'  => orderEffectiveTotal($db, $id),
            'remaining_total' => 0,
        ]);
        exit;
    }

    http_response_code(422);
    echo json_encode(['error' => 'Unsupported update — use action edit, pay_items, or amount_paid']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
