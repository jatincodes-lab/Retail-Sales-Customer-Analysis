import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = {
  admin: [
    { section: 'Overview' },
    { path: '/', label: 'Overview', icon: 'overview' },
    { section: 'Inventory' },
    { path: '/products', label: 'Products', icon: 'products' },
    { path: '/categories', label: 'Categories', icon: 'categories' },
    { path: '/suppliers', label: 'Suppliers', icon: 'suppliers' },
    { section: 'Sales' },
    { path: '/new-sale', label: 'New sale', icon: 'sales' },
    { path: '/customers', label: 'Customers', icon: 'customers' },
    { path: '/sales', label: 'Sales history', icon: 'sales' },
    { section: 'People' },
    { path: '/employees', label: 'Employees', icon: 'employees' },
    { path: '/salary', label: 'Salary management', icon: 'salary' },
  ],
  manager: [
    { section: 'Overview' },
    { path: '/', label: 'My dashboard', icon: 'overview' },
    { section: 'Inventory' },
    { path: '/products', label: 'Products', icon: 'products' },
    { path: '/categories', label: 'Categories', icon: 'categories' },
    { path: '/suppliers', label: 'Suppliers', icon: 'suppliers' },
    { section: 'Sales' },
    { path: '/new-sale', label: 'New sale', icon: 'sales' },
    { path: '/sales', label: 'Sales history', icon: 'receipt' },
    { section: 'People' },
    { path: '/employees', label: 'Employees', icon: 'employees' },
    { path: '/duties', label: 'Assign duties', icon: 'duties' },
  ],
  cashier: [
    { section: 'Sales' },
    { path: '/new-sale', label: 'New sale', icon: 'sales' },
    { path: '/sales', label: 'Sales history', icon: 'receipt' },
  ],
};

const ICONS = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9" /></>,
  categories: <><path d="M4 5h16M4 12h10M4 19h13" /><circle cx="18" cy="12" r="2" /><circle cx="20" cy="19" r="1" /></>,
  suppliers: <><path d="M3 21V8l9-5 9 5v13M3 9h18M8 21v-7h8v7" /><path d="M7 11h.01M12 11h.01M17 11h.01" /></>,
  customers: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2" /></>,
  sales: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  employees: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  salary: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /><circle cx="16" cy="14" r="2" /></>,
  duties: <><path d="m5 12 4 4L19 6" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></>,
  store: <><path d="M3 10h18l-2-6H5l-2 6Z" /><path d="M5 10v10h14V10M9 20v-6h6v6" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
};

function NavIcon({ name }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role || 'cashier';
  const items = NAV[role] || NAV.cashier;
  const initial = user?.username?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="brand-mark"><NavIcon name="store" /></span>
        <span className="brand-copy"><strong>RetailMS</strong><small>Store workspace</small></span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {items.map((item, index) => item.section ? (
          <div className="nav-section" key={`${item.section}-${index}`}>{item.section}</div>
        ) : (
          <button
            type="button"
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            aria-label={item.label}
            aria-current={location.pathname === item.path ? 'page' : undefined}
            onClick={() => navigate(item.path)}
          >
            <NavIcon name={item.icon} /><span className="nav-label">{item.label}</span>
            {location.pathname === item.path && <span className="nav-active-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-account">
        <div className="account-avatar" aria-hidden="true">{initial}</div>
        <div className="account-copy"><strong>{user?.username || 'Account'}</strong><small>{role}</small></div>
        <button type="button" className="logout-button" onClick={() => { logout(); navigate('/login'); }} aria-label="Log out" title="Log out">↗</button>
      </div>
    </aside>
  );
}
