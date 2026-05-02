<?php
// backend/api/admin/purge-orders.php
// Admin-only — delete old orders to keep the DB lean.
//
// Rules (applied together, both must pass for an order to be kept):
//   1. created_at within the last `days` (default 3 days)
//   2. among the most recent `keep` orders globally (default 90)
//
// Anything older than `days` OR ranked older than the newest `keep` rows
// is hard-deleted along with its line items.
//
// DELETE /api/admin/purge-orders.php?days=3&keep=90

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

requireRole('admin');

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$days = (int)($_GET['days'] ?? 3);
$keep = (int)($_GET['keep'] ?? 90);

if ($days < 1)   { $days = 1;   }
if ($days > 365) { $days = 365; }
if ($keep < 10)  { $keep = 10;  }
if ($keep > 5000){ $keep = 5000;}

$db = getDB();

try {
    $db->beginTransaction();

    // Determine the cutoff id: the (keep)-th newest order's id. Anything with
    // id < cutoff_id is older than the most recent `keep` orders.
    $cutoffId = 0;
    $cstmt = $db->prepare('SELECT id FROM orders ORDER BY id DESC LIMIT 1 OFFSET ?');
    $cstmt->bindValue(1, $keep - 1, PDO::PARAM_INT);
    $cstmt->execute();
    $row = $cstmt->fetch();
    if ($row !== false) {
        $cutoffId = (int)$row['id'];
    }

    // Build delete predicate: too old by date OR too old by rank.
    // If we have fewer than `keep` rows, $cutoffId stays 0 and the rank
    // clause is a no-op (id < 0 matches nothing).
    $sqlSelect = "SELECT id FROM orders
                   WHERE created_at < (NOW() - INTERVAL ? DAY)
                      OR id < ?";
    $sel = $db->prepare($sqlSelect);
    $sel->bindValue(1, $days, PDO::PARAM_INT);
    $sel->bindValue(2, $cutoffId, PDO::PARAM_INT);
    $sel->execute();
    $idsToDelete = array_map('intval', array_column($sel->fetchAll(), 'id'));

    $deletedOrders = 0;
    $deletedItems  = 0;

    if (!empty($idsToDelete)) {
        $placeholders = implode(',', array_fill(0, count($idsToDelete), '?'));

        $delItems = $db->prepare("DELETE FROM order_items WHERE order_id IN ($placeholders)");
        $delItems->execute($idsToDelete);
        $deletedItems = $delItems->rowCount();

        $delOrders = $db->prepare("DELETE FROM orders WHERE id IN ($placeholders)");
        $delOrders->execute($idsToDelete);
        $deletedOrders = $delOrders->rowCount();
    }

    $db->commit();

    echo json_encode([
        'ok'              => true,
        'days'            => $days,
        'keep'            => $keep,
        'cutoff_id'       => $cutoffId,
        'deleted_orders'  => $deletedOrders,
        'deleted_items'   => $deletedItems,
    ]);
} catch (Exception $e) {
    if ($db->inTransaction()) { $db->rollBack(); }
    http_response_code(500);
    echo json_encode(['error' => 'Purge failed', 'detail' => $e->getMessage()]);
}
