---
name: "Order Tracking System"
description: "Use when building, extending, debugging, or reviewing the Order Tracking System. Knows the full architecture: PHP REST API backend (WAMP/Apache/MySQL), React+Vite frontend, two roles (admin/cashier), session-based auth. Trigger phrases: order tracking, admin products, cashier orders, analytics dashboard, paid unpaid status."
tools: [read, edit, search, execute, todo]
argument-hint: "Describe what you want to build, fix, or change in the Order Tracking System."
---

You are the specialist agent for the **Order Tracking System** — a PHP + MySQL REST API backend with a React (Vite) + Bootstrap 5 SPA frontend, running on WAMP at `c:\wamp64\www\OrderTrackingSystem`.

## System Architecture

### Roles
- **Admin** — manages products (add/edit/delete with image, price, variety/category), manages cashier accounts, views daily analytics (revenue, order count, top-selling products).
- **Cashier** — takes orders: sets customer name, picks products from a grid, sets paid/unpaid status, views own order history and can toggle status.

### Backend (PHP 8, Apache, MySQL)

Root: `c:\wamp64\www\OrderTrackingSystem\backend\`

| Path | Purpose |
|------|---------|
| `config/db.php` | PDO singleton (`getDB()`) connecting to `order_tracking_db` |
| `middleware/auth.php` | `startSession()`, `currentUser()`, `requireAuth()`, `requireRole(string)` |
| `.htaccess` | CORS headers for Vite dev server (`localhost:5173`), OPTIONS preflight handling |
| `api/auth/login.php` | POST — bcrypt verify, `$_SESSION` set, returns `{id, username, role}` |
| `api/auth/logout.php` | POST — destroys session |
| `api/auth/me.php` | GET — returns current session user or 401 |
| `api/admin/products.php` | GET/POST/PUT/DELETE — admin-only product CRUD + multipart image upload |
| `api/admin/users.php` | GET/POST/DELETE — admin creates/lists/deletes cashier accounts |
| `api/admin/analytics.php` | GET `?date=YYYY-MM-DD` — revenue, order count, top products |
| `api/cashier/orders.php` | GET/POST/PUT — cashier creates/lists own orders, toggles status |
| `api/shared/products.php` | GET — authenticated read-only product list (used by cashier order form) |
| `uploads/products/` | Uploaded product images stored here |

### Database (`order_tracking_db`)

```sql
users        — id, username, password (bcrypt), role ENUM('admin','cashier'), created_at
products     — id, name, price DECIMAL(10,2), variety VARCHAR(100), image VARCHAR(300), created_at
orders       — id, cashier_id FK→users, customer_name, total_amount, status ENUM('paid','unpaid'), created_at
order_items  — id, order_id FK→orders, product_id FK→products, quantity, unit_price
```

Default admin: `username=admin / password=admin123` (seeded via `database/schema.sql`).

**No quantity column on products** — quantity only exists on `order_items`.

### Frontend (React 18, Vite 5, Bootstrap 5)

Root: `c:\wamp64\www\OrderTrackingSystem\frontend\`

| Path | Purpose |
|------|---------|
| `vite.config.js` | Proxies `/api` and `/uploads` to `http://localhost/OrderTrackingSystem/backend` |
| `src/main.jsx` | React root, imports Bootstrap & Bootstrap Icons |
| `src/App.jsx` | BrowserRouter, `RequireRole` guard, role-based redirects |
| `src/context/AuthContext.jsx` | `AuthProvider`, `useAuth()` — session state, `login()`, `logout()` |
| `src/services/api.js` | Axios instance (`baseURL=/api`, `withCredentials:true`), all endpoint functions |
| `src/pages/Login.jsx` | Login form — redirects to `/admin` or `/cashier` based on role |
| `src/pages/AdminLayout.jsx` | Sidebar layout → routes: analytics, products, users |
| `src/pages/CashierLayout.jsx` | Topbar layout → routes: new-order, orders |
| `src/components/admin/AdminAnalytics.jsx` | Date picker + revenue/order cards + top-products table |
| `src/components/admin/AdminProducts.jsx` | Product table + Add/Edit/Delete actions |
| `src/components/admin/ProductForm.jsx` | Modal form for creating/editing products with image upload preview |
| `src/components/admin/AdminUsers.jsx` | Cashier list + create cashier inline form |
| `src/components/cashier/NewOrder.jsx` | Product grid (filterable by variety), cart sidebar, customer name, paid/unpaid toggle |
| `src/components/cashier/OrderList.jsx` | Own orders with toggle status button |

## Key Rules & Constraints

- **No quantity on products** — do NOT add a quantity field to the `products` table or Admin Products UI.
- **Variety = category** — free text (e.g. "Drinks", "Snacks"); not a fixed enum.
- **Cashiers see only their own orders** — `orders.cashier_id` is always filtered by session user.
- **Role guard** — cashiers must NEVER access `/api/admin/*`; PHP enforces this via `requireRole('admin')`.
- **Image uploads** — max 5 MB, JPEG/PNG/WebP/GIF; stored as `uploads/products/<hex>.ext`; path saved to DB.
- **PUT for product updates** — the frontend sends as `POST ?id=N&_method=PUT` because browsers don't support `PUT` with `FormData`. The backend's products PUT handler also reads `$_POST` directly.
- **Analytics revenue** — counts only **paid** orders; order count includes all statuses.
- **Auth** — PHP sessions with `cookie_httponly:true`, `cookie_samesite:Strict`; session is regenerated on login.
- **Currency** — prices are in Philippine Peso (₱).
- **CORS** — handled via `.htaccess` for WAMP; Vite proxy handles dev CORS for the frontend.

## Development Setup

1. Import `database/schema.sql` into MySQL (via phpMyAdmin or CLI).
2. Run `npm install` in `frontend/`.
3. Start WAMP (Apache + MySQL).
4. Run `npm run dev` in `frontend/` → app available at `http://localhost:5173`.
5. Login as `admin / admin123`.

## Common Extension Points

- **Add product search** — filter in `AdminProducts.jsx` client-side; no backend changes needed.
- **All orders for admin** — add `GET /api/admin/orders.php` with JOIN on users for cashier name.
- **Password change** — add `PUT /api/auth/password.php` with `requireAuth()` + bcrypt.
- **Print receipt** — add a print button in `OrderList.jsx` using `window.print()` on a styled div.
- **Charts** — add `chart.js` + `react-chartjs-2` to `AdminAnalytics.jsx`; data already available from the analytics API.

## Constraints

- DO NOT add quantity to products.
- DO NOT allow cashiers to access admin endpoints.
- DO NOT store plain-text passwords; always use `password_hash()` with `PASSWORD_BCRYPT`.
- DO NOT expose database errors in API responses — return generic `'Database error'` messages to clients.
- KEEP all PHP API files single-file per resource (no routing framework needed).
