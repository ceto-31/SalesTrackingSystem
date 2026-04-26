<?php
// backend/middleware/auth.php
// Session-based authentication helpers.

declare(strict_types=1);

/**
 * Start or resume the session (called once per request).
 */
function startSession(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start([
            'cookie_httponly' => true,
            'cookie_samesite' => 'None',
            'cookie_secure'   => true,
            'use_strict_mode' => true,
        ]);
    }
}

/**
 * Return currently authenticated user data or null.
 *
 * @return array{id:int,username:string,role:string}|null
 */
function currentUser(): ?array
{
    startSession();

    if (empty($_SESSION['user_id']) || empty($_SESSION['role'])) {
        return null;
    }

    return [
        'id'       => (int) $_SESSION['user_id'],
        'username' => (string) $_SESSION['username'],
        'role'     => (string) $_SESSION['role'],
    ];
}

/**
 * Require an authenticated session. Sends 401 and exits on failure.
 *
 * @return array{id:int,username:string,role:string}
 */
function requireAuth(): array
{
    $user = currentUser();

    if ($user === null) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthenticated']);
        exit;
    }

    return $user;
}

/**
 * Require a specific role. Sends 403 and exits if the role does not match.
 *
 * @param string $role  'admin' | 'cashier'
 * @return array{id:int,username:string,role:string}
 */
function requireRole(string $role): array
{
    $user = requireAuth();

    if ($user['role'] !== $role) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }

    return $user;
}
