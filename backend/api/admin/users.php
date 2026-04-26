<?php
// backend/api/admin/users.php
// Admin-only cashier user management.
//
// GET    /api/admin/users       — list all cashier accounts
// POST   /api/admin/users       — create cashier { username, password }
// DELETE /api/admin/users?id=N  — delete cashier

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$me = requireRole('admin');

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET ───────────────────────────────────────────────────────────────────────

if ($method === 'GET') {
    $stmt = $db->query(
        "SELECT id, username, role, created_at FROM users WHERE role = 'cashier' ORDER BY created_at DESC"
    );
    echo json_encode($stmt->fetchAll());
    exit;
}

// ── POST (create cashier) ─────────────────────────────────────────────────────

if ($method === 'POST') {
    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error' => 'username and password are required']);
        exit;
    }

    if (strlen($password) < 6) {
        http_response_code(422);
        echo json_encode(['error' => 'password must be at least 6 characters']);
        exit;
    }

    // Check uniqueness
    $check = $db->prepare('SELECT id FROM users WHERE username = ?');
    $check->execute([$username]);
    if ($check->fetch() !== false) {
        http_response_code(409);
        echo json_encode(['error' => 'Username already taken']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = $db->prepare(
        "INSERT INTO users (username, password, role) VALUES (?, ?, 'cashier')"
    );
    $stmt->execute([$username, $hash]);

    $id      = (int)$db->lastInsertId();
    http_response_code(201);
    echo json_encode([
        'id'         => $id,
        'username'   => $username,
        'role'       => 'cashier',
    ]);
    exit;
}

// ── DELETE ────────────────────────────────────────────────────────────────────

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit;
    }

    // Prevent admin from deleting themselves
    if ($id === $me['id']) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete your own account']);
        exit;
    }

    $check = $db->prepare("SELECT id FROM users WHERE id = ? AND role = 'cashier'");
    $check->execute([$id]);
    if ($check->fetch() === false) {
        http_response_code(404);
        echo json_encode(['error' => 'Cashier not found']);
        exit;
    }

    $db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    echo json_encode(['message' => 'Cashier deleted']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
