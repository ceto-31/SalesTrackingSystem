<?php
// backend/api/auth/me.php
// GET /api/auth/me  — returns current session user or 401

declare(strict_types=1);

require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$user = requireAuth();
echo json_encode($user);
