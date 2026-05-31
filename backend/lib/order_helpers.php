<?php
// backend/lib/order_helpers.php
// Shared order line-item math for payment and totals.

declare(strict_types=1);

/** Active (billable) quantity for one line. */
function orderItemActiveQty(array $item): int
{
    $qty       = (int)($item['quantity'] ?? 0);
    $cancelled = (int)($item['cancelled_quantity'] ?? 0);
    return max(0, $qty - $cancelled);
}

/** Unpaid active quantity for one line. */
function orderItemUnpaidQty(array $item): int
{
    $paid = (int)($item['paid_quantity'] ?? 0);
    return max(0, orderItemActiveQty($item) - $paid);
}

/** Billable total from line items. */
function orderEffectiveTotalFromItems(array $items): float
{
    $total = 0.0;
    foreach ($items as $it) {
        $total += orderItemActiveQty($it) * (float)($it['unit_price'] ?? 0);
    }
    return $total;
}

/** Amount already paid via paid_quantity on lines. */
function orderPaidTotalFromItems(array $items): float
{
    $total = 0.0;
    foreach ($items as $it) {
        $paid = (int)($it['paid_quantity'] ?? 0);
        $total += $paid * (float)($it['unit_price'] ?? 0);
    }
    return $total;
}

/** True when every active unit on every line is paid. */
function isOrderFullyPaidFromItems(array $items): bool
{
    $hasActive = false;
    foreach ($items as $it) {
        $active = orderItemActiveQty($it);
        if ($active === 0) {
            continue;
        }
        $hasActive = true;
        $paid = (int)($it['paid_quantity'] ?? 0);
        if ($paid < $active) {
            return false;
        }
    }
    return $hasActive;
}

/** unpaid | partial | paid */
function orderPaymentStatusFromItems(array $items): string
{
    if (!isOrderFullyPaidFromItems($items)) {
        $paidTotal = orderPaidTotalFromItems($items);
        return $paidTotal > 0.001 ? 'partial' : 'unpaid';
    }
    return 'paid';
}

/** Normalize item fields from DB row. */
function normalizeOrderItemRow(array $it): array
{
    $it['quantity']           = (int)($it['quantity'] ?? 0);
    $it['cancelled_quantity'] = (int)($it['cancelled_quantity'] ?? 0);
    $it['paid_quantity']      = (int)($it['paid_quantity'] ?? 0);
    $it['unit_price']         = (float)($it['unit_price'] ?? 0);
    return $it;
}

/** Fetch line items for an order. */
function fetchOrderItems(PDO $db, int $orderId): array
{
    $stmt = $db->prepare(
        'SELECT oi.id AS item_id, oi.product_id, oi.quantity, oi.cancelled_quantity,
                COALESCE(oi.paid_quantity, 0) AS paid_quantity, oi.unit_price,
                p.name, p.variety
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?
         ORDER BY oi.id'
    );
    $stmt->execute([$orderId]);
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = normalizeOrderItemRow($row);
    }
    return $items;
}

/** Recompute and persist orders.total_amount from current items. */
function syncOrderTotalAmount(PDO $db, int $orderId): float
{
    $total = orderEffectiveTotal(
        $db,
        $orderId
    );
    $db->prepare('UPDATE orders SET total_amount = ? WHERE id = ?')->execute([$total, $orderId]);
    return $total;
}

/**
 * Compute billable total after item cancellations (DB query).
 * Kept for callers that don't have items in memory.
 */
function orderEffectiveTotal(PDO $db, int $orderId): float
{
    $stmt = $db->prepare(
        'SELECT COALESCE(SUM(GREATEST(oi.quantity - oi.cancelled_quantity, 0) * oi.unit_price), 0) AS total
         FROM order_items oi
         WHERE oi.order_id = ?'
    );
    $stmt->execute([$orderId]);
    return (float)($stmt->fetch()['total'] ?? 0);
}

/** Append a payment note (max 255 chars total). */
function appendPaymentNote(?string $existing, string $addition): string
{
    $addition = trim($addition);
    if ($addition === '') {
        return $existing ?? '';
    }
    $combined = $existing === null || $existing === ''
        ? $addition
        : $existing . ' | ' . $addition;
    if (mb_strlen($combined) > 255) {
        return mb_substr($combined, 0, 255);
    }
    return $combined;
}
