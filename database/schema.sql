-- ============================================================
-- Order Tracking System — Database Schema
-- Database: order_tracking_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS order_tracking_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE order_tracking_db;

-- ------------------------------------------------------------
-- users: admin + cashier accounts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(80)     NOT NULL UNIQUE,
  password   VARCHAR(255)    NOT NULL,          -- bcrypt hash
  role       ENUM('admin','cashier') NOT NULL DEFAULT 'cashier',
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- products: items that cashiers can add to orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id         INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150)    NOT NULL,
  price      DECIMAL(10,2)   NOT NULL,
  variety    VARCHAR(100)    NOT NULL,           -- category, e.g. Drinks / Snacks
  image      VARCHAR(300)    DEFAULT NULL,       -- relative path: uploads/products/xxx.jpg
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- orders: placed by cashiers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  cashier_id    INT UNSIGNED    NOT NULL,
  customer_name VARCHAR(150)    NOT NULL,
  total_amount  DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  status        ENUM('unpaid','paid','preparing','completed') NOT NULL DEFAULT 'unpaid',
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_cashier FOREIGN KEY (cashier_id)
    REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- order_items: line items per order
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id           INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  order_id     INT UNSIGNED    NOT NULL,
  product_id   INT UNSIGNED    NOT NULL,
  quantity     INT UNSIGNED    NOT NULL DEFAULT 1,
  unit_price   DECIMAL(10,2)   NOT NULL,
  is_cancelled TINYINT(1)      NOT NULL DEFAULT 0,
  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)
    REFERENCES orders(id)   ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Seed: default admin account
-- Username : admin
-- Password : CindySantos12  (bcrypt — CHANGE AFTER FIRST LOGIN)
-- ------------------------------------------------------------
INSERT INTO users (username, password, role)
VALUES (
  'admin',
  '$2y$12$pGgLZA3xhCnBlOvKxmdF2elGY9WWjhvQDbpZjrEyaIlRNs6mI.bh6',
  'admin'
) ON DUPLICATE KEY UPDATE id = id;
