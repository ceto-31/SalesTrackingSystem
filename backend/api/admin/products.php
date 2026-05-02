<?php
// backend/api/admin/products.php
// Admin-only product CRUD + image upload.
//
// GET    /api/admin/products           — list all products
// POST   /api/admin/products           — create product (multipart/form-data)
// PUT    /api/admin/products?id=N      — update product (multipart/form-data)
// DELETE /api/admin/products?id=N      — delete product

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

requireRole('admin');

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── helpers ──────────────────────────────────────────────────────────────────

function handleImageUpload(): ?string
{
    if (empty($_FILES['image']['tmp_name'])) {
        return null;
    }

    $file     = $_FILES['image'];
    $maxBytes = 5 * 1024 * 1024; // 5 MB

    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        http_response_code(422);
        echo json_encode(['error' => 'Image upload failed']);
        exit;
    }

    if (!is_uploaded_file($file['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid upload']);
        exit;
    }

    if ($file['size'] > $maxBytes) {
        http_response_code(422);
        echo json_encode(['error' => 'Image must be smaller than 5 MB']);
        exit;
    }

    // Trust only what the file actually contains, never the client-provided
    // MIME type or extension.
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];

    $finfo      = finfo_open(FILEINFO_MIME_TYPE);
    $actualType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!isset($allowed[$actualType])) {
        http_response_code(422);
        echo json_encode(['error' => 'Image must be JPEG, PNG, WebP, or GIF']);
        exit;
    }

    // getimagesize returns false for non-images / corrupt files / decompression
    // bombs whose dimensions exceed PHP limits — extra defense against PHP
    // payloads with image MIME headers.
    $info = @getimagesize($file['tmp_name']);
    if ($info === false || ($info[0] ?? 0) <= 0 || ($info[1] ?? 0) <= 0) {
        http_response_code(422);
        echo json_encode(['error' => 'File is not a valid image']);
        exit;
    }

    $uploadDir = __DIR__ . '/../../uploads/products/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Always assign our own safe extension based on detected MIME — never
    // honor the client-supplied filename's extension.
    $ext      = $allowed[$actualType];
    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    $dest     = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save image']);
        exit;
    }
    @chmod($dest, 0644);

    return 'uploads/products/' . $filename;
}

function deleteImageFile(?string $path): void
{
    if ($path === null) {
        return;
    }
    $full = __DIR__ . '/../../' . $path;
    if (file_exists($full)) {
        @unlink($full);
    }
}

// ── GET ───────────────────────────────────────────────────────────────────────

if ($method === 'GET') {
    $rows = $db->query('SELECT * FROM products ORDER BY created_at DESC')->fetchAll();
    echo json_encode($rows);
    exit;
}

// ── POST (create) ─────────────────────────────────────────────────────────────

if ($method === 'POST') {
    $name    = trim((string)($_POST['name']    ?? ''));
    $price   = $_POST['price']   ?? '';
    $variety = trim((string)($_POST['variety'] ?? ''));

    if ($name === '' || $price === '' || $variety === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name, price, and variety are required']);
        exit;
    }

    if (!is_numeric($price) || (float)$price < 0) {
        http_response_code(422);
        echo json_encode(['error' => 'price must be a non-negative number']);
        exit;
    }

    $imagePath = handleImageUpload();

    $stmt = $db->prepare(
        'INSERT INTO products (name, price, variety, image) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$name, (float)$price, $variety, $imagePath]);

    $id = (int)$db->lastInsertId();
    $product = $db->prepare('SELECT * FROM products WHERE id = ?');
    $product->execute([$id]);

    http_response_code(201);
    echo json_encode($product->fetch());
    exit;
}

// ── PUT (update) ──────────────────────────────────────────────────────────────

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit;
    }

    // PUT requests from the browser come as multipart when there is a file,
    // but PHP does not populate $_POST for PUT. We use a workaround:
    // The frontend sends PUT as POST with ?_method=PUT OR we read $_POST directly
    // when the request is multipart. The frontend will send multipart via POST
    // with a hidden _method field for updates, but here we also support real PUT
    // for JSON-only updates.
    $name    = trim((string)($_POST['name']    ?? ''));
    $price   = $_POST['price']   ?? '';
    $variety = trim((string)($_POST['variety'] ?? ''));

    // Fallback: try JSON body for non-multipart PUT
    if ($name === '') {
        $body    = json_decode(file_get_contents('php://input'), true) ?? [];
        $name    = trim((string)($body['name']    ?? ''));
        $price   = $body['price']   ?? '';
        $variety = trim((string)($body['variety'] ?? ''));
    }

    if ($name === '' || $price === '' || $variety === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name, price, and variety are required']);
        exit;
    }

    if (!is_numeric($price) || (float)$price < 0) {
        http_response_code(422);
        echo json_encode(['error' => 'price must be a non-negative number']);
        exit;
    }

    // Fetch existing product to handle image replacement
    $existing = $db->prepare('SELECT * FROM products WHERE id = ?');
    $existing->execute([$id]);
    $old = $existing->fetch();

    if ($old === false) {
        http_response_code(404);
        echo json_encode(['error' => 'Product not found']);
        exit;
    }

    $newImage = handleImageUpload();
    if ($newImage !== null && $old['image'] !== null) {
        deleteImageFile($old['image']);
    }
    $imagePath = $newImage ?? $old['image'];

    $stmt = $db->prepare(
        'UPDATE products SET name = ?, price = ?, variety = ?, image = ? WHERE id = ?'
    );
    $stmt->execute([$name, (float)$price, $variety, $imagePath, $id]);

    $product = $db->prepare('SELECT * FROM products WHERE id = ?');
    $product->execute([$id]);
    echo json_encode($product->fetch());
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

    $existing = $db->prepare('SELECT image FROM products WHERE id = ?');
    $existing->execute([$id]);
    $row = $existing->fetch();

    if ($row === false) {
        http_response_code(404);
        echo json_encode(['error' => 'Product not found']);
        exit;
    }

    $db->prepare('DELETE FROM products WHERE id = ?')->execute([$id]);
    deleteImageFile($row['image']);

    echo json_encode(['message' => 'Product deleted']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
