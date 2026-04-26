// src/components/admin/AdminAnalytics.jsx
// Modern analytics dashboard — Week / Month toggle, Chart.js line graph,
// KPI summary cards, and ranked top-products with progress bars.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { getAnalytics } from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

// ── constants ─────────────────────────────────────────────────────────────────

const INDIGO  = '#d6336c'                  // primary rose-pink
const INDIGO2 = 'rgba(214,51,108,0.18)'
const GREEN   = '#10b981'
const VIOLET  = '#a8326a'                  // muted pink-mauve

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7c4c']   // gold, silver, bronze

function today() { return new Date().toISOString().slice(0, 10) }

function fmt(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })
}

// ── sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '20px 24px',
      boxShadow: '0 1px 8px rgba(0,0,0,.07)',
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      height: '100%',
      minWidth: 0,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i className={`bi ${icon}`} style={{ fontSize: 22, color }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  )
}

function TopProductRow({ rank, product, maxSold }) {
  const pct     = maxSold > 0 ? Math.round((product.total_sold / maxSold) * 100) : 0
  const badgeColor = RANK_COLORS[rank - 1] ?? '#e2e8f0'
  const badgeText  = RANK_COLORS[rank - 1] ? '#fff' : '#64748b'

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        {/* rank badge */}
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: badgeColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: badgeText, flexShrink: 0,
        }}>
          {rank}
        </div>

        {/* name + variety */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {product.name}
          </div>
          <span style={{
            fontSize: 11, background: '#f1f5f9', color: '#64748b',
            padding: '1px 7px', borderRadius: 99, fontWeight: 500,
          }}>
            {product.variety}
          </span>
        </div>

        {/* qty + revenue */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INDIGO }}>{product.total_sold} <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11 }}>sold</span></div>
          <div style={{ fontSize: 12, color: '#64748b' }}>₱{fmt(product.revenue)}</div>
        </div>
      </div>

      {/* progress bar */}
      <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${INDIGO}, #f06ea1)`,
          borderRadius: 99,
          transition: 'width .6s ease',
        }} />
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [mode,    setMode]    = useState('week')
  const [refDate, setRefDate] = useState(today())
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const chartRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: res } = await getAnalytics(refDate, mode)
      setData(res)
    } catch {
      setError('Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [refDate, mode])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived values ──────────────────────────────────────────────────────────

  const avgPerOrder = data && data.order_count > 0
    ? data.total_revenue / data.order_count
    : 0

  const maxSold = data?.top_products?.[0]?.total_sold ?? 0

  // ── Chart.js config ─────────────────────────────────────────────────────────

  const chartData = data ? {
    labels: data.chart_data.map((d) => d.label),
    datasets: [{
      label: 'Revenue (₱)',
      data: data.chart_data.map((d) => d.revenue),
      borderColor: INDIGO,
      borderWidth: 2.5,
      pointBackgroundColor: INDIGO,
      pointRadius: data.chart_data.length > 20 ? 2 : 4,
      pointHoverRadius: 6,
      tension: 0.4,
      fill: true,
      backgroundColor: (ctx) => {
        const chart  = ctx.chart
        const { ctx: c2d, chartArea } = chart
        if (!chartArea) return INDIGO2
        const grad = c2d.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        grad.addColorStop(0,   'rgba(214,51,108,0.22)')
        grad.addColorStop(1,   'rgba(214,51,108,0)')
        return grad
      },
    }],
  } : null

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#94a3b8',
        bodyColor: '#f8fafc',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex
            return data?.chart_data?.[idx]?.date ?? ''
          },
          label: (item) => {
            const idx  = item.dataIndex
            const rev  = item.raw
            const cnt  = data?.chart_data?.[idx]?.order_count ?? 0
            return [`  Revenue: ₱${fmt(rev)}`, `  Orders:  ${cnt}`]
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      y: {
        grid: { color: '#f1f5f9', drawBorder: false },
        border: { display: false, dash: [4, 4] },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (v) => '₱' + Number(v).toLocaleString('en-PH'),
        },
      },
    },
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: '#0f172a' }}>
            Analytics
          </h4>
          {data && (
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 3 }}>
              {data.period_label}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Week / Month pill toggle */}
          <div style={{
            display: 'flex', background: '#f1f5f9',
            borderRadius: 10, padding: 3, gap: 2,
          }}>
            {['week', 'month'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '6px 18px', border: 'none', cursor: 'pointer',
                  borderRadius: 8, fontWeight: 600, fontSize: 13, transition: 'all .15s',
                  background: mode === m ? INDIGO : 'transparent',
                  color:      mode === m ? '#fff'  : '#64748b',
                  boxShadow:  mode === m ? '0 1px 4px rgba(214,51,108,.3)' : 'none',
                }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Date picker */}
          <input
            type="date"
            value={refDate}
            max={today()}
            onChange={(e) => setRefDate(e.target.value)}
            style={{
              padding: '7px 12px', border: '1.5px solid #e2e8f0',
              borderRadius: 9, fontSize: 13, color: '#334155',
              outline: 'none', background: '#fff', cursor: 'pointer',
            }}
          />

          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '7px 13px', border: 'none', borderRadius: 9,
              background: INDIGO, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .6 : 1, fontSize: 15,
            }}
            title="Refresh"
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin-icon' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {data && (
        <>
          {/* ── KPI cards ── */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-lg-4">
              <KpiCard
                icon="bi-currency-exchange"
                label="Total Revenue"
                value={`₱${fmt(data.total_revenue)}`}
                sub="paid orders only"
                color={GREEN}
              />
            </div>
            <div className="col-12 col-sm-6 col-lg-4">
              <KpiCard
                icon="bi-receipt"
                label="Total Orders"
                value={data.order_count}
                sub="all statuses"
                color={INDIGO}
              />
            </div>
            <div className="col-12 col-sm-12 col-lg-4">
              <KpiCard
                icon="bi-graph-up-arrow"
                label="Avg per Order"
                value={`₱${fmt(avgPerOrder)}`}
                sub="revenue ÷ orders"
                color={VIOLET}
              />
            </div>
          </div>

          {/* ── Revenue chart ── */}
          <div style={{
            background: '#fff', borderRadius: 14, padding: '22px 24px 18px',
            boxShadow: '0 1px 8px rgba(0,0,0,.07)', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Revenue Over Time</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Paid orders · {mode === 'week' ? '7 days' : `${data.chart_data.length} days`}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: INDIGO }} />
                <span style={{ fontSize: 12, color: '#64748b' }}>Revenue (₱)</span>
              </div>
            </div>
            <div style={{ height: 'clamp(180px, 32vw, 280px)' }}>
              {chartData && <Line ref={chartRef} data={chartData} options={chartOptions} />}
            </div>
          </div>

          {/* ── Top products ── */}
          <div style={{
            background: '#fff', borderRadius: 14, padding: '22px 24px',
            boxShadow: '0 1px 8px rgba(0,0,0,.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
              <i className="bi bi-trophy-fill" style={{ color: '#f59e0b', fontSize: 16 }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Top-Selling Products</span>
              <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>by quantity sold · {data.period_label}</span>
            </div>

            {data.top_products.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0', fontSize: 14 }}>
                <i className="bi bi-box" style={{ fontSize: 36, display: 'block', marginBottom: 8 }} />
                No orders in this period.
              </div>
            ) : (
              data.top_products.map((p, i) => (
                <TopProductRow key={p.product_id} rank={i + 1} product={p} maxSold={maxSold} />
              ))
            )}
          </div>
        </>
      )}

      {/* Spin animation for refresh icon */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .spin-icon { display:inline-block; animation: spin .7s linear infinite; }
      `}</style>
    </div>
  )
}
