<?php
/**
 * One-time admin seeder.
 *
 * Usage:
 *   GET https://<railway-host>/setup/seed-admin.php?token=<SETUP_TOKEN>&password=<plain>
 *
 * Requires env var SETUP_TOKEN to be set in Railway. Delete this file (or unset
 * the token) after the admin password is fixed.
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

$password = (string)($_GET['password'] ?? '');
if (strlen($password) < 4) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'password too short']);
    exit;
}

require_once __DIR__ . '/../config/db.php';

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

try {
    $stmt = $pdo->prepare(
        "INSERT INTO users (username, password, role)
         VALUES ('admin', :hash, 'admin')
         ON DUPLICATE KEY UPDATE password = :hash2"
    );
    $stmt->execute([':hash' => $hash, ':hash2' => $hash]);

    echo json_encode([
        'ok'         => true,
        'message'    => 'admin password updated',
        'hash_start' => substr($hash, 0, 7),
        'hash_len'   => strlen($hash),
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
