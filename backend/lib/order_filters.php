<?php
// backend/lib/order_filters.php
// Shared SQL fragments for order payment / revenue queries.
//
// Payment is tracked via amount_paid; kitchen workflow uses status (preparing/completed).
// Revenue and analytics count orders that are paid OR marked completed by the kitchen.

declare(strict_types=1);

/** Orders that contribute to revenue / analytics totals. */
const ORDER_REVENUE_SQL = '(o.amount_paid IS NOT NULL OR o.status = \'completed\')';

/** Active line-item quantity (excludes cancelled units). */
const ORDER_ITEM_ACTIVE_QTY = 'GREATEST(oi.quantity - oi.cancelled_quantity, 0)';

/** Orders eligible for top-product popularity (paid, completed, or still in kitchen). */
const ORDER_TOP_PRODUCTS_SQL = '(o.amount_paid IS NOT NULL OR o.status IN (\'preparing\', \'completed\'))';
