// src/services/api.js
// Axios instance + all endpoint functions.

import axios from 'axios'

// Always use the relative /api path so requests go through Vercel's rewrite
// proxy (vercel.json). This keeps the session cookie first-party, which is
// required for iOS Safari and Brave to store/send PHPSESSID reliably.
// Do NOT set VITE_API_URL to the Railway URL — that would bypass the proxy
// and turn auth into a cross-site request again.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,   // send session cookie
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth ─────────────────────────────────────────────────────────────────────

export const login   = (username, password) =>
  api.post('/auth/login.php',  { username, password })

export const logout  = () =>
  api.post('/auth/logout.php')

export const getMe   = () =>
  api.get('/auth/me.php')

// ── Admin — Products ─────────────────────────────────────────────────────────

export const getAdminProducts = () =>
  api.get('/admin/products.php')

export const createProduct = (formData) =>
  api.post('/admin/products.php', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const updateProduct = (id, formData) =>
  api.post(`/admin/products.php?id=${id}&_method=PUT`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const deleteProduct = (id) =>
  api.delete(`/admin/products.php?id=${id}`)

// ── Admin — Users ─────────────────────────────────────────────────────────────

export const getCashiers    = () =>
  api.get('/admin/users.php')

export const createCashier  = (username, password) =>
  api.post('/admin/users.php', { username, password })

export const deleteCashier  = (id) =>
  api.delete(`/admin/users.php?id=${id}`)

// ── Admin — Analytics ─────────────────────────────────────────────────────────

export const getAnalytics = (date, mode = 'week') =>
  api.get('/admin/analytics.php', { params: { date, mode } })

// ── Admin — Orders ────────────────────────────────────────────────────────────

export const getAdminOrders = (status = 'preparing') =>
  api.get('/admin/orders.php', { params: { status } })

export const completeOrder = (id) =>
  api.put(`/admin/orders.php?id=${id}`, { status: 'completed' })

export const reopenOrder = (id) =>
  api.put(`/admin/orders.php?id=${id}`, { status: 'preparing' })

export const adjustOrderItemCancel = (orderId, itemId, delta) =>
  api.put(
    `/admin/orders.php?id=${orderId}&item_id=${itemId}`,
    { delta }
  )

export const restoreOrder = (id) =>
  api.put(`/admin/orders.php?id=${id}`, { action: 'restore_all' })

// ── Shared — Categories ───────────────────────────────────────────────────────

export const getCategories = () =>
  api.get('/shared/categories.php')

// ── Cashier — Orders ─────────────────────────────────────────────────────────

export const getCashierOrders = () =>
  api.get('/cashier/orders.php')

export const createOrder = (customerName, status, items, orderType = 'dine_in') =>
  api.post('/cashier/orders.php', {
    customer_name: customerName,
    status,
    order_type: orderType,
    items,
  })

export const updateOrderStatus = (id, status) =>
  api.put(`/cashier/orders.php?id=${id}`, { status })

// ── Shared — Products ────────────────────────────────────────────────────────

export const getProducts = () =>
  api.get('/shared/products.php')

export default api
