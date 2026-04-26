<?php
/**
 * One-time orders.notes column migration.
 * GET /setup/migrate-order-notes.php?token=<SETUP_TOKEN>
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

    $exists = (int) $pdo->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME   = 'orders'
            AND COLUMN_NAME  = 'notes'"
    )->fetchColumn();

    if ($exists === 0) {
        $pdo->exec("ALTER TABLE orders ADD COLUMN notes VARCHAR(255) NULL");
        $message = 'orders.notes column added';
    } else {
        $message = 'orders.notes already exists (no-op)';
    }

    $row = $pdo->query("SHOW COLUMNS FROM orders LIKE 'notes'")->fetch();

    echo json_encode([
        'ok'      => true,
        'message' => $message,
        'column'  => $row,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
