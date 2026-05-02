<?php
// backend/api/auth/login.php
// POST /api/auth/login   — { username, password }  → sets session

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Per-IP rate limit ────────────────────────────────────────────────────────
// Simple file-based throttle: max 5 failed attempts per IP per 15 min.
$ip      = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$ip      = trim(explode(',', $ip)[0]);
$rlDir   = __DIR__ . '/../../uploads/sessions/_rl';
if (!is_dir($rlDir)) { @mkdir($rlDir, 0775, true); }
$rlFile  = $rlDir . '/login_' . hash('sha256', $ip);
$now     = time();
$window  = 15 * 60; // 15 min
$maxFail = 5;

$state = ['count' => 0, 'first' => $now];
if (is_file($rlFile)) {
    $raw = @file_get_contents($rlFile);
    if ($raw !== false) {
        $tmp = json_decode($raw, true);
        if (is_array($tmp) && isset($tmp['count'], $tmp['first'])) {
            $state = $tmp;
        }
    }
}
if ($now - (int)$state['first'] > $window) {
    $state = ['count' => 0, 'first' => $now];
}
if ((int)$state['count'] >= $maxFail) {
    http_response_code(429);
    $retry = $window - ($now - (int)$state['first']);
    header('Retry-After: ' . max(1, $retry));
    echo json_encode(['error' => 'Too many failed attempts. Try again in a few minutes.']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);

$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Username and password are required']);
    exit;
}

try {
    $db   = getDB();
    $stmt = $db->prepare('SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user === false || !password_verify($password, $user['password'])) {
        $state['count'] = (int)$state['count'] + 1;
        @file_put_contents($rlFile, json_encode($state), LOCK_EX);
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        exit;
    }

    // success — clear throttle
    @unlink($rlFile);

    startSession();
    session_regenerate_id(true);

    $_SESSION['user_id']  = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role']     = $user['role'];

    echo json_encode([
        'id'       => $user['id'],
        'username' => $user['username'],
        'role'     => $user['role'],
    ]);
} catch (PDOException $e) {
    error_log('login: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}
