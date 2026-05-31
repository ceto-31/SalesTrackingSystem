<?php
// backend/lib/order_filters.php
// Shared SQL fragments for order payment / revenue queries.
//
// Payment is tracked per line (paid_quantity) and order amount_paid when fully settled.
// Kitchen workflow uses status (preparing/completed).
// Revenue counts orders fully paid OR marked completed by the kitchen.

declare(strict_types=1);

/** Active line-item quantity (excludes cancelled units). */
const ORDER_ITEM_ACTIVE_QTY = 'GREATEST(oi.quantity - oi.cancelled_quantity, 0)';

/** All active units on the order are paid. */
const ORDER_FULLY_PAID_SQL = 'NOT EXISTS (
    SELECT 1 FROM order_items oi_fp
    WHERE oi_fp.order_id = o.id
      AND GREATEST(oi_fp.quantity - oi_fp.cancelled_quantity, 0) > COALESCE(oi_fp.paid_quantity, 0)
) AND EXISTS (
    SELECT 1 FROM order_items oi_fp2
    WHERE oi_fp2.order_id = o.id
      AND GREATEST(oi_fp2.quantity - oi_fp2.cancelled_quantity, 0) > 0
)';

/** Orders that contribute to revenue / analytics totals. */
const ORDER_REVENUE_SQL = '(o.status = \'completed\' OR (' . ORDER_FULLY_PAID_SQL . ' AND o.amount_paid IS NOT NULL))';

/** Orders eligible for top-product popularity (paid, completed, or still in kitchen). */
const ORDER_TOP_PRODUCTS_SQL = '((' . ORDER_FULLY_PAID_SQL . ' AND o.amount_paid IS NOT NULL) OR o.status IN (\'preparing\', \'completed\'))';
