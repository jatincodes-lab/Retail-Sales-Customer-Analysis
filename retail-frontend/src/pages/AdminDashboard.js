import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import LoadingButton from '../components/LoadingButton';
import useActionLoading from '../hooks/useActionLoading';

const currency = value => {
  const amount = Number(value);
  return value == null || !Number.isFinite(amount)
    ? '—'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

const number = value => Number(value || 0).toLocaleString('en-IN');
const shortCurrency = value => {
  const amount = Number(value) || 0;
  return amount >= 100000 ? `₹${(amount / 100000).toFixed(amount % 100000 ? 1 : 0)}L`
    : amount >= 1000 ? `₹${Math.round(amount / 1000)}k` : `₹${amount}`;
};

const timeAgo = value => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

function SalesChart({ sales }) {
  const ordered = [...sales].sort((a, b) => new Date(a.sale_date) - new Date(b.sale_date));
  if (!ordered.length) return <div className="dashboard-empty">Sales will appear here after your first transaction.</div>;

  const width = 620;
  const height = 220;
  const left = 48;
  const right = 606;
  const top = 18;
  const bottom = 170;
  const revenue = ordered.map(sale => Number(sale.revenue) || 0);
  const profit = ordered.map(sale => Number(sale.gross_profit) || 0);
  const max = Math.max(...revenue, 1);
  const min = Math.min(0, ...profit);
  const y = value => bottom - ((value - min) / (max - min || 1)) * (bottom - top);
  const points = revenue.map((value, index) => ({
    x: ordered.length === 1 ? (left + right) / 2 : left + (index / (ordered.length - 1)) * (right - left),
    y: y(value),
  }));
  const profitPoints = profit.map((value, index) => `${points[index].x},${y(value)}`).join(' ');
  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const area = `${left},${bottom} ${line} ${right},${bottom}`;
  const labelStep = Math.max(1, Math.ceil(ordered.length / 6));
  const labels = ordered.map((_, index) => index).filter(index => index % labelStep === 0 || index === ordered.length - 1);

  return (
    <div className="sales-chart-wrap">
      <svg className="sales-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue and gross profit across the latest sales">
        <defs>
          <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#315efb" stopOpacity=".18" />
            <stop offset="100%" stopColor="#315efb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map(step => {
          const gridY = top + step * ((bottom - top) / 3);
          return <g key={step}><line x1={left} x2={right} y1={gridY} y2={gridY} className="chart-gridline" /><text x="1" y={gridY + 3} className="chart-y-label">{shortCurrency(max - step * (max / 3))}</text></g>;
        })}
        <polygon points={area} fill="url(#sales-area)" />
        {points.length > 1 && <><polyline points={line} className="chart-line chart-revenue-line" /><polyline points={profitPoints} className="chart-line chart-profit-line" /></>}
        {points.map((point, index) => (
          <circle key={`${ordered[index].sale_id}-${index}`} cx={point.x} cy={point.y} r="3" className="chart-point">
            <title>{`${new Date(ordered[index].sale_date).toLocaleDateString('en-IN')}: revenue ${currency(revenue[index])}, gross profit ${currency(profit[index])}`}</title>
          </circle>
        ))}
        {labels.map(index => (
          <text key={index} x={points[index].x} y="204" textAnchor={index === 0 ? 'start' : index === ordered.length - 1 ? 'end' : 'middle'} className="chart-label">
            {new Date(ordered[index].sale_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </text>
        ))}
      </svg>
    </div>
  );
}

function MetricIcon({ kind }) {
  const paths = {
    revenue: <><path d="M12 2v20" /><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    profit: <><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
    sales: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
    customers: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="metric-icon">{paths[kind]}</svg>;
}

export default function AdminDashboard() {
  const { run, isLoading } = useActionLoading();
  const [data, setData] = useState(null);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [depositModal, setDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({ amount: '', description: '' });
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [dashboardResult, budgetResult] = await Promise.allSettled([
      api.get('/dashboard'),
      api.get('/budget'),
    ]);
    if (dashboardResult.status === 'fulfilled') {
      setData(dashboardResult.value.data);
      setError('');
    }
    else setError(dashboardResult.reason.response?.data?.error || 'Could not load dashboard data. Check the API connection and try again.');
    if (budgetResult.status === 'fulfilled') {
      setBudget(budgetResult.value.data);
      setBudgetError('');
    } else {
      setBudget(null);
      setBudgetError('Budget details are temporarily unavailable.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addDeposit = async event => {
    event.preventDefault();
    setMessage('');
    try {
      await api.post('/budget/deposit', {
        amount: Number(depositForm.amount),
        description: depositForm.description.trim(),
      });
      setMessage('Budget updated.');
      setDepositModal(false);
      setDepositForm({ amount: '', description: '' });
      await load();
    } catch (requestError) {
      setMessage(requestError.response?.data?.error || 'Could not update the budget. Please try again.');
    }
  };

  if (loading && !data && !isLoading('dashboard-retry')) return <main className="content dashboard-content"><div className="dashboard-loading" role="status">Loading your store overview…</div></main>;
  if (error && !data) return (
    <main className="content dashboard-content">
      <div className="dashboard-error" role="alert"><div><strong>Dashboard unavailable</strong><p>{error}</p></div><LoadingButton type="button" className="button-secondary" onClick={run('dashboard-retry', load)} loading={isLoading('dashboard-retry')} loadingLabel="Loading…">Try again</LoadingButton></div>
    </main>
  );
  if (!data) return null;

  const { counts = {}, lowStock = [], catRevenue = [], topProducts = [], salesTrend = [], recentActivity = [], profit = {} } = data;
  const categories = [...catRevenue].sort((a, b) => Number(b.revenue) - Number(a.revenue)).slice(0, 5);
  const maxCategoryRevenue = Math.max(...categories.map(item => Number(item.revenue) || 0), 1);
  const balance = budget?.balance?.current_balance;

  const metrics = [
    { label: 'Revenue', value: currency(counts.total_revenue), tone: 'blue', icon: 'revenue' },
    { label: 'Gross profit', value: currency(profit?.gross_profit), tone: 'green', icon: 'profit' },
    { label: 'Orders', value: number(counts.sales), tone: 'slate', icon: 'sales' },
    { label: 'Customers', value: number(counts.customers), tone: 'olive', icon: 'customers' },
  ];

  return (
    <main className="content dashboard-content">
      <section className="dashboard-heading">
        <div>
          <p className="dashboard-kicker">STORE OVERVIEW</p>
          <h1>A clearer picture of your store.</h1>
          <p className="dashboard-subtitle">Track sales, understand performance, and stay ahead of stock.</p>
        </div>
        <div className="dashboard-actions">
          <button type="button" className="button-secondary refresh-button" onClick={() => { setMessage(''); setDepositModal(true); }}>
            Add funds
          </button>
          <Link to="/sales" className="button-primary"><span aria-hidden="true">↗</span> Sales history</Link>
        </div>
      </section>

      {message && <div className="dashboard-notice" role="status">{message}</div>}
      {budgetError && <div className="dashboard-notice dashboard-notice-muted" role="status">{budgetError}</div>}

      <section className="metric-grid" aria-label="Store performance totals">
        {metrics.map(metric => (
          <article className="metric-card" key={metric.label}>
            <div className="metric-topline"><span>{metric.label}</span><span className={`metric-icon-wrap ${metric.tone}`}><MetricIcon kind={metric.icon} /></span></div>
            <strong className="metric-value">{metric.value}</strong>
            <span className="metric-caption">All-time store total</span>
          </article>
        ))}
      </section>

      <section className="dashboard-grid dashboard-grid-primary">
        <article className="dashboard-panel sales-panel">
          <div className="panel-heading">
            <div><h2>Sales performance</h2><p>Revenue and gross profit over your latest sales</p></div>
            <span className="panel-period">Latest 12 sales</span>
          </div>
          <SalesChart sales={salesTrend} />
          <div className="chart-legend"><span className="legend-dot" />Revenue <span className="legend-dot legend-profit" />Gross profit</div>
        </article>

        <article className="dashboard-panel category-panel">
          <div className="panel-heading"><div><h2>Revenue by category</h2><p>Sales grouped by product category</p></div></div>
          {categories.length ? (
            <div className="category-list">
              {categories.map(category => {
                const amount = Number(category.revenue) || 0;
                return (
                  <div className="category-row" key={category.category_name}>
                    <span className="category-name" title={category.category_name}>{category.category_name}</span>
                    <span className="category-track"><span style={{ width: `${Math.max((amount / maxCategoryRevenue) * 100, 3)}%` }} /></span>
                    <strong>{currency(amount)}</strong>
                  </div>
                );
              })}
            </div>
          ) : <div className="dashboard-empty">Category revenue will appear after sales are recorded.</div>}
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-secondary">
        <article className="dashboard-panel products-panel">
          <div className="panel-heading"><div><h2>Top selling products</h2><p>Products with the most units sold</p></div><Link to="/products" className="panel-link">View inventory <span aria-hidden="true">→</span></Link></div>
          {topProducts.length ? (
            <div className="product-table-wrap"><table className="dashboard-table">
              <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
              <tbody>{topProducts.slice(0, 5).map((product, index) => (
                <tr key={product.product_name}>
                  <td><span className="product-rank">{String(index + 1).padStart(2, '0')}</span><span className="product-name">{product.product_name}</span></td>
                  <td>{number(product.total_sold)}</td>
                  <td className="product-revenue">{currency(product.revenue)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <div className="dashboard-empty">Your best sellers will show here after the first sale.</div>}
        </article>

        <article className="dashboard-panel pulse-panel">
          <div className="panel-heading"><div><h2>Store pulse</h2><p>Stock status and recent activity</p></div></div>
          <div className="pulse-summary">
            <Link to="/products" className={`stock-summary ${lowStock.length ? 'stock-summary-warning' : ''}`}>
              <span className="stock-indicator" aria-hidden="true" />
              <span><small>Low stock items</small><strong>{number(lowStock.length)}</strong></span>
              <span className="stock-summary-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="pulse-activity">
            <div className="activity-heading"><h3>Recent activity</h3><Link to="/sales">All sales</Link></div>
            {recentActivity.length ? (
              <ul className="activity-list">
                {recentActivity.map(activity => (
                  <li key={`${activity.activity_type}-${activity.activity_id}`}>
                    <span className={`activity-mark ${activity.activity_type === 'customer' ? 'activity-mark-customer' : ''}`} aria-hidden="true">{activity.activity_type === 'customer' ? '＋' : '₹'}</span>
                    <span className="activity-copy">
                      <strong>{activity.activity_type === 'customer' ? 'New customer added' : `Sale of ${currency(activity.amount)}`}</strong>
                      <small>{activity.activity_type === 'customer' ? `Customer ID: ${activity.activity_id}` : `${activity.customer_name || 'Guest'} · ${number(activity.total_items)} ${Number(activity.total_items) === 1 ? 'item' : 'items'}`}</small>
                    </span>
                    <time dateTime={activity.activity_date}>{timeAgo(activity.activity_date)}</time>
                  </li>
                ))}
              </ul>
            ) : <div className="dashboard-empty dashboard-empty-compact">Recent activity will appear here.</div>}
          </div>
        </article>
      </section>

      {lowStock.length > 0 && (
        <section className="dashboard-panel low-stock-panel">
          <div className="panel-heading"><div><h2>Needs attention</h2><p>{lowStock.length} product{lowStock.length === 1 ? '' : 's'} at or below reorder level</p></div><Link to="/products" className="panel-link">Manage stock <span aria-hidden="true">→</span></Link></div>
          <div className="low-stock-list">
            {lowStock.slice(0, 4).map(product => (
              <div className="low-stock-row" key={product.product_id}>
                <span className="stock-product-dot" />
                <strong>{product.product_name}</strong>
                <span>{number(product.quantity_in_stock)} in stock</span>
                <small>Reorder at {number(product.reorder_level)}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {depositModal && (
        <div className="overlay" onClick={() => { if (!isLoading('budget-deposit')) setDepositModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="deposit-title" onClick={event => event.stopPropagation()}>
            <h3 id="deposit-title">Add budget funds</h3>
            <p className="modal-sub">Current balance: {currency(balance)}</p>
            <form onSubmit={run('budget-deposit', addDeposit)}>
              <div className="form-group"><label htmlFor="deposit-amount">Amount (₹)</label><input id="deposit-amount" className="form-input" type="number" min="1" step="0.01" value={depositForm.amount} onChange={event => setDepositForm({ ...depositForm, amount: event.target.value })} required /></div>
              <div className="form-group"><label htmlFor="deposit-description">Description</label><input id="deposit-description" className="form-input" maxLength="200" placeholder="e.g. Monthly budget allocation" value={depositForm.description} onChange={event => setDepositForm({ ...depositForm, description: event.target.value })} /></div>
              {message && <p className="error-msg" role="alert">{message}</p>}
              <div className="modal-actions"><LoadingButton type="submit" className="button-primary" loading={isLoading('budget-deposit')} loadingLabel="Saving…">Add funds</LoadingButton><button type="button" className="button-secondary" disabled={isLoading('budget-deposit')} onClick={() => setDepositModal(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
