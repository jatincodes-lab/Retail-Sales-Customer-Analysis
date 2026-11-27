import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar          from './components/Sidebar';
import Login            from './pages/Login';
import AdminDashboard   from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import Products         from './pages/Products';
import Categories       from './pages/Categories';
import Suppliers        from './pages/Suppliers';
import Sales            from './pages/Sales';
import NewSale          from './pages/NewSale';
import Customers        from './pages/Customers';
import Employees        from './pages/Employees';
import SalaryManagement from './pages/SalaryManagement';
import AssignDuties     from './pages/AssignDuties';

const PAGE_TITLES = {
  '/':           { admin:'Overview', manager:'My dashboard', cashier:'New sale' },
  '/products':   'Products',
  '/categories': 'Categories',
  '/suppliers':  'Suppliers',
  '/customers':  'Customers',
  '/sales':      'Sales History',
  '/new-sale':   'New Sale',
  '/employees':  'Employees',
  '/salary':     'Salary Management',
  '/duties':     'Assign Duties',
};

// Redirects unauthorized users instead of blank page
function RequireRole({ allowed, children }) {
  const { user } = useAuth();
  if (!allowed.includes(user?.role)) {
    if (user?.role === 'cashier') return <Navigate to="/new-sale" replace />;
    if (user?.role === 'manager') return <Navigate to="/" replace />;
    return <Navigate to="/" replace />;
  }
  return children;
}

const ROLE_STYLE = {
  admin:   { bg:'#eff6ff', color:'#2563eb' },
  manager: { bg:'#f0fdf4', color:'#16a34a' },
  cashier: { bg:'#fff7ed', color:'#ea580c' },
};

function Layout() {
  const { isLoggedIn, isReady, user } = useAuth();
  const location = useLocation();
  if (!isReady) return <div role="status" style={{ padding: 24 }}>Restoring session…</div>;
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  const titleEntry = PAGE_TITLES[location.pathname];
  const title = typeof titleEntry === 'object'
    ? (titleEntry[user?.role] || 'RetailMS')
    : (titleEntry || 'RetailMS');

  const rs = ROLE_STYLE[user?.role] || {};
  const userInitial = user?.username?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div className="topbar-crumbs"><span>RetailMS</span><span className="crumb-separator">/</span><strong>{title}</strong></div>
          <div className="topbar-meta">
            <span className="topbar-store" aria-label="Current store">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18l-2-6H5l-2 6Zm2 0v10h14V10M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></svg>
              Main store
            </span>
            <span className="topbar-user-avatar" title={user?.username} aria-label={`Signed in as ${user?.username}`} style={{ background:rs.bg, color:rs.color }}>{userInitial}</span>
          </div>
        </div>

        <Routes>
          {/* Home — role based */}
          <Route path="/" element={
            user?.role === 'admin'   ? <AdminDashboard /> :
            user?.role === 'manager' ? <ManagerDashboard /> :
            <Navigate to="/new-sale" replace />
          } />

          {/* Admin + Manager — inventory */}
          <Route path="/products"   element={<RequireRole allowed={['admin','manager']}><Products /></RequireRole>} />
          <Route path="/categories" element={<RequireRole allowed={['admin','manager']}><Categories /></RequireRole>} />
          <Route path="/suppliers"  element={<RequireRole allowed={['admin','manager']}><Suppliers /></RequireRole>} />

          {/* Admin + Manager — HR */}
          <Route path="/employees"  element={<RequireRole allowed={['admin','manager']}><Employees /></RequireRole>} />

          {/* Admin only */}
          <Route path="/customers"  element={<RequireRole allowed={['admin']}><Customers /></RequireRole>} />
          <Route path="/salary"     element={<RequireRole allowed={['admin']}><SalaryManagement /></RequireRole>} />

          {/* Manager only */}
          <Route path="/duties"     element={<RequireRole allowed={['manager']}><AssignDuties /></RequireRole>} />

          {/* Everyone — sales */}
          <Route path="/sales"      element={<Sales />} />

          {/* Everyone — new sale */}
          <Route path="/new-sale"   element={<RequireRole allowed={['admin','cashier','manager']}><NewSale /></RequireRole>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*"     element={<Layout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
