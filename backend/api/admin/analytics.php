<?php
// backend/api/admin/analytics.php
// Admin-only analytics — supports week and month range modes.
//
// GET /api/admin/analytics?mode=week|month&date=YYYY-MM-DD
//   mode=week  : Monday–Sunday of the week containing `date`
//   mode=month : 1st–last day of the month containing `date`
//   date       : reference date (default: today)
//
// Returns:
//   mode, period_label, start_date, end_date,
//   total_revenue, order_count,
//   chart_data  — one entry per day in range (zeros if no orders)
//   top_products — top 10 by qty sold in the period

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

requireRole('admin');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Parse + validate params ───────────────────────────────────────────────────

$mode    = in_array($_GET['mode'] ?? 'week', ['week', 'month'], true)
             ? ($_GET['mode'] ?? 'week')
             : 'week';

$rawDate = $_GET['date'] ?? date('Y-m-d');
$ref     = DateTime::createFromFormat('Y-m-d', $rawDate);
if ($ref === false || $ref->format('Y-m-d') !== $rawDate) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid date format. Use YYYY-MM-DD']);
    exit;
}

// ── Compute date range ────────────────────────────────────────────────────────

if ($mode === 'week') {
    // Monday of the ISO week
    $dow   = (int)$ref->format('N'); // 1=Mon … 7=Sun
    $start = (clone $ref)->modify('-' . ($dow - 1) . ' days');
    $end   = (clone $start)->modify('+6 days');
} else {
    // First and last day of the month
    $start = DateTime::createFromFormat('Y-m-d', $ref->format('Y-m-01'));
    $end   = DateTime::createFromFormat('Y-m-d', $ref->format('Y-m-t'));
}

$startStr = $start->format('Y-m-d');
$endStr   = $end->format('Y-m-d');

// Human-readable period label
$fmt  = 'M j, Y';
$periodLabel = $start->format($fmt) . ' – ' . $end->format($fmt);

$db = getDB();

// ── Per-day data (for chart) ──────────────────────────────────────────────────

$dayStmt = $db->prepare(
    "SELECT
         DATE(created_at)                            AS day,
         COALESCE(SUM(CASE WHEN status='paid' THEN total_amount ELSE 0 END), 0) AS revenue,
         COUNT(*)                                    AS order_count
     FROM orders
    WHERE DATE(created_at) BETWEEN ? AND ?
    GROUP BY DATE(created_at)"
);
$dayStmt->execute([$startStr, $endStr]);
$dayRows = $dayStmt->fetchAll();

// Index by date string for O(1) lookup
$dayMap = [];
foreach ($dayRows as $row) {
    $dayMap[$row['day']] = [
        'revenue'     => (float)$row['revenue'],
        'order_count' => (int)$row['order_count'],
    ];
}

// Build a complete array with zeros for every day in range
$chartData   = [];
$totalRev    = 0.0;
$totalOrders = 0;
$cursor      = clone $start;

while ($cursor <= $end) {
    $key = $cursor->format('Y-m-d');

    // Day label: week → "Mon", month → "1"
    $label = $mode === 'week'
        ? $cursor->format('D')       // Mon, Tue …
        : $cursor->format('j');      // 1, 2 … 31

    $rev   = $dayMap[$key]['revenue']     ?? 0.0;
    $cnt   = $dayMap[$key]['order_count'] ?? 0;

    $chartData[]  = ['date' => $key, 'label' => $label, 'revenue' => $rev, 'order_count' => $cnt];
    $totalRev    += $rev;
    $totalOrders += $cnt;

    $cursor->modify('+1 day');
}

// ── Top-selling products for the period ──────────────────────────────────────

$topStmt = $db->prepare(
    "SELECT
         p.id                                 AS product_id,
         p.name,
         p.variety,
         SUM(oi.quantity)                     AS total_sold,
         SUM(oi.quantity * oi.unit_price)     AS revenue
     FROM order_items oi
     JOIN orders   o ON o.id  = oi.order_id
     JOIN products p ON p.id  = oi.product_id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
    GROUP BY p.id, p.name, p.variety
    ORDER BY total_sold DESC
    LIMIT 10"
);
$topStmt->execute([$startStr, $endStr]);
$topProducts = $topStmt->fetchAll();

foreach ($topProducts as &$row) {
    $row['product_id'] = (int)$row['product_id'];
    $row['total_sold'] = (int)$row['total_sold'];
    $row['revenue']    = (float)$row['revenue'];
}

echo json_encode([
    'mode'         => $mode,
    'period_label' => $periodLabel,
    'start_date'   => $startStr,
    'end_date'     => $endStr,
    'total_revenue'=> $totalRev,
    'order_count'  => $totalOrders,
    'chart_data'   => $chartData,
    'top_products' => $topProducts,
]);
