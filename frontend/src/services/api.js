// src/services/api.js
// Axios instance + all endpoint functions.

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
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

// ── Cashier — Orders ─────────────────────────────────────────────────────────

export const getCashierOrders = () =>
  api.get('/cashier/orders.php')

export const createOrder = (customerName, status, items) =>
  api.post('/cashier/orders.php', { customer_name: customerName, status, items })

export const updateOrderStatus = (id, status) =>
  api.put(`/cashier/orders.php?id=${id}`, { status })

// ── Shared — Products ────────────────────────────────────────────────────────

export const getProducts = () =>
  api.get('/shared/products.php')

export default api
