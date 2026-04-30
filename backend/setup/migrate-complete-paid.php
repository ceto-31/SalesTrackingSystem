<?php
/**
 * One-time backfill: mark every completed order as paid (amount_paid = total_amount).
 * GET /setup/migrate-complete-paid.php?token=<SETUP_TOKEN>
 * Idempotent — only touches rows where amount_paid IS NULL.
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

    $stmt = $pdo->prepare(
        "UPDATE orders
            SET amount_paid = total_amount
          WHERE status = 'completed'
            AND amount_paid IS NULL"
    );
    $stmt->execute();
    $updated = $stmt->rowCount();

    echo json_encode([
        'ok'      => true,
        'message' => "Backfilled $updated completed order(s) as paid.",
        'updated' => $updated,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
