<?php
/**
 * One-time order_items.cancelled_quantity column migration.
 *
 * Adds cancelled_quantity (per-line partial cancellation count) to order_items
 * and back-fills it from the older is_cancelled flag if present.
 *
 * Effective sold quantity for any line = (quantity - cancelled_quantity).
 *
 * Usage:
 *   GET https://<railway-host>/setup/migrate-cancel-quantity.php?token=<SETUP_TOKEN>
 *
 * Idempotent.
 */

declare(strict_types=1);

header('Content-Type: application/json');

$expected = getenv('SETUP_TOKEN') ?: ($_ENV['SETUP_TOKEN'] ?? '');
$provided = $_GET['token'] ?? '';

if ($expected === '' || !hash_equals($expected, (string)$provided)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden']);
    exit;
}

require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDB();

    $hasCancelledQty = (int) $pdo->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME   = 'order_items'
            AND COLUMN_NAME  = 'cancelled_quantity'"
    )->fetchColumn();

    $hasIsCancelled = (int) $pdo->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME   = 'order_items'
            AND COLUMN_NAME  = 'is_cancelled'"
    )->fetchColumn();

    $actions = [];

    if ($hasCancelledQty === 0) {
        $pdo->exec(
            "ALTER TABLE order_items
             ADD COLUMN cancelled_quantity INT UNSIGNED NOT NULL DEFAULT 0"
        );
        $actions[] = 'added cancelled_quantity column';
    } else {
        $actions[] = 'cancelled_quantity already exists';
    }

    if ($hasIsCancelled === 1) {
        $n = $pdo->exec(
            "UPDATE order_items
                SET cancelled_quantity = quantity
              WHERE is_cancelled = 1
                AND cancelled_quantity = 0"
        );
        $actions[] = "back-filled $n rows from is_cancelled";
    }

    $row = $pdo->query("SHOW COLUMNS FROM order_items LIKE 'cancelled_quantity'")->fetch();

    echo json_encode([
        'ok'      => true,
        'actions' => $actions,
        'column'  => $row,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
