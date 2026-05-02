<?php
// backend/setup/migrate-hardening.php
// One-shot hardening migration:
//   1. Add orders.daily_seq column (per-day sequence # set at INSERT time).
//   2. Backfill daily_seq for existing rows.
//   3. Add helpful indexes that the original schema didn't include.
//
// GET /setup/migrate-hardening.php?token=YOUR_SETUP_TOKEN

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
    $db = getDB();
    $log = [];

    // 1. Add daily_seq column if missing
    $col = $db->query("SHOW COLUMNS FROM orders LIKE 'daily_seq'")->fetch();
    if ($col === false) {
        $db->exec("ALTER TABLE orders ADD COLUMN daily_seq INT UNSIGNED NOT NULL DEFAULT 0 AFTER amount_paid");
        $log[] = 'Added orders.daily_seq';
    } else {
        $log[] = 'orders.daily_seq already exists';
    }

    // 2. Backfill daily_seq for existing rows. Each calendar day numbered from 1
    //    in id order.
    $db->exec("SET @seq := 0, @day := ''");
    $db->exec("
        UPDATE orders o
        JOIN (
            SELECT id,
                   @seq := IF(@day = DATE(created_at), @seq + 1, 1) AS seq,
                   @day := DATE(created_at)
            FROM orders
            ORDER BY DATE(created_at), id
        ) s ON s.id = o.id
        SET o.daily_seq = s.seq
        WHERE o.daily_seq = 0
    ");
    $log[] = 'Backfilled daily_seq';

    // 3. Add indexes (idempotent — wrap each in try/catch).
    $indexes = [
        ['orders',      'idx_orders_cashier_id',  'cashier_id'],
        ['orders',      'idx_orders_created_at',  'created_at'],
        ['orders',      'idx_orders_status',      'status'],
        ['order_items', 'idx_items_order_id',     'order_id'],
        ['order_items', 'idx_items_product_id',   'product_id'],
    ];
    foreach ($indexes as [$table, $name, $col]) {
        $exists = $db->prepare(
            "SELECT 1 FROM information_schema.statistics
              WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?"
        );
        $exists->execute([$table, $name]);
        if ($exists->fetch() === false) {
            $db->exec("ALTER TABLE `$table` ADD INDEX `$name` (`$col`)");
            $log[] = "Created $table.$name";
        } else {
            $log[] = "$table.$name already exists";
        }
    }

    echo json_encode(['ok' => true, 'log' => $log]);
} catch (Exception $e) {
    error_log('migrate-hardening: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Migration failed']);
}
