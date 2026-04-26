<?php
/**
 * One-time orders.status enum migration.
 *
 * Adds 'preparing' and 'completed' to the existing ('unpaid','paid') enum.
 *
 * Usage:
 *   GET https://<railway-host>/setup/migrate-orders.php?token=<SETUP_TOKEN>
 *
 * Safe to call multiple times — the ALTER will simply be a no-op once the
 * enum already contains the new values.
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
    $pdo->exec(
        "ALTER TABLE orders
         MODIFY COLUMN status
         ENUM('unpaid','paid','preparing','completed') NOT NULL DEFAULT 'unpaid'"
    );

    $row = $pdo->query("SHOW COLUMNS FROM orders LIKE 'status'")->fetch();

    echo json_encode([
        'ok'      => true,
        'message' => 'orders.status enum updated',
        'column'  => $row,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
