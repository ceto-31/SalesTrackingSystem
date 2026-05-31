<?php
/**
 * Add selective payment + payment notes support.
 *
 * GET /setup/migrate-partial-payment.php?token=<SETUP_TOKEN>
 *
 * - order_items.paid_quantity
 * - orders.payment_note
 * - Backfill paid_quantity for orders already marked paid
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
header('Content-Type: application/json');

$expected = getenv('SETUP_TOKEN') ?: ($_ENV['SETUP_TOKEN'] ?? '');
$provided = (string)($_GET['token'] ?? '');
if ($expected === '' || !hash_equals($expected, $provided)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Invalid or missing token']);
    exit;
}

try {
    $db  = getDB();
    $log = [];

    $col = $db->query("SHOW COLUMNS FROM order_items LIKE 'paid_quantity'")->fetch();
    if ($col === false) {
        $db->exec(
            'ALTER TABLE order_items
             ADD COLUMN paid_quantity INT UNSIGNED NOT NULL DEFAULT 0
             AFTER cancelled_quantity'
        );
        $log[] = 'Added order_items.paid_quantity';
    } else {
        $log[] = 'order_items.paid_quantity already exists';
    }

    $col = $db->query("SHOW COLUMNS FROM orders LIKE 'payment_note'")->fetch();
    if ($col === false) {
        $db->exec(
            'ALTER TABLE orders
             ADD COLUMN payment_note VARCHAR(255) NULL
             AFTER notes'
        );
        $log[] = 'Added orders.payment_note';
    } else {
        $log[] = 'orders.payment_note already exists';
    }

    // Backfill: fully paid orders → mark all active units as paid.
    $db->exec(
        'UPDATE order_items oi
         JOIN orders o ON o.id = oi.order_id
         SET oi.paid_quantity = GREATEST(oi.quantity - oi.cancelled_quantity, 0)
         WHERE o.amount_paid IS NOT NULL
           AND oi.paid_quantity = 0'
    );
    $log[] = 'Backfilled paid_quantity for previously paid orders';

    echo json_encode(['ok' => true, 'log' => $log]);
} catch (Exception $e) {
    error_log('migrate-partial-payment: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Migration failed', 'detail' => $e->getMessage()]);
}
