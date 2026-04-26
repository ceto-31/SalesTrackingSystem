<?php
/**
 * One-time order_items.is_cancelled column migration.
 *
 * Adds is_cancelled TINYINT(1) NOT NULL DEFAULT 0 to order_items.
 *
 * Usage:
 *   GET https://<railway-host>/setup/migrate-cancel-items.php?token=<SETUP_TOKEN>
 *
 * Idempotent — checks information_schema before adding.
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

    $exists = (int) $pdo->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME   = 'order_items'
            AND COLUMN_NAME  = 'is_cancelled'"
    )->fetchColumn();

    if ($exists === 0) {
        $pdo->exec(
            "ALTER TABLE order_items
             ADD COLUMN is_cancelled TINYINT(1) NOT NULL DEFAULT 0"
        );
        $message = 'order_items.is_cancelled column added';
    } else {
        $message = 'order_items.is_cancelled already exists (no-op)';
    }

    $row = $pdo->query("SHOW COLUMNS FROM order_items LIKE 'is_cancelled'")->fetch();

    echo json_encode([
        'ok'      => true,
        'message' => $message,
        'column'  => $row,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
