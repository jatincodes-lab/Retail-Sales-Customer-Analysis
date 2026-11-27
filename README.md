# 🏪 RetailMS — Retail Management System

A full-stack web application for managing retail store operations including inventory, sales, HR, supplier management, and financial analytics. Built as a Database Systems course project.

---

## 👥 Authors

| Name | Role No. |
|---|---|
| Muhammad Umer Iqbal | L1F24BSCS0601 |
| Arslan Aman | — |

**University:** University of Central Punjab (UCP), Lahore
**Course:** Database Systems · Instructor: Muneeb Ali Muzaffar
**Program:** BSCS · Spring 2026

---

## 🚀 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Database | PostgreSQL | Relational data storage |
| DB Tool | `psql` or pgAdmin | Schema design and management |
| Backend | Node.js + Express.js | REST API (port 5001) |
| PostgreSQL Driver | node-postgres (`pg`) | Connection pool + queries |
| Auth | JWT (jsonwebtoken) | Token-based authentication |
| Frontend | React 18 | User interface |
| HTTP Client | Axios | API calls with JWT interceptor |

---

## ✨ Features

### Role-Based Access
| Feature | Admin | Manager | Cashier |
|---|---|---|---|
| Dashboard (full analytics) | ✅ | ❌ | ❌ |
| Manager Dashboard (staff + low stock) | ❌ | ✅ | ❌ |
| Products / Inventory | ✅ | ✅ | ❌ |
| New Sale | ❌ | ✅ | ✅ |
| Sales History | ✅ | ✅ | ✅ |
| Customers | ✅ | ❌ | ❌ |
| Employees | ✅ | ✅ (view) | ❌ |
| Assign Duties | ❌ | ✅ | ❌ |
| Salary Management | ✅ | ❌ | ❌ |

### Core Features
- **Inventory Management** — Add, edit, restock products with cost/selling price tracking
- **Live Stock Alerts** — Dashboard highlights products at or below reorder level
- **Sales Processing** — Cart-based POS with automatic stock deduction
- **Customer Loyalty Discount** — Registered customers get configurable % discount (editable by admin)
- **Per-Product Discounts** — Set discount for all customers or extra for registered customers
- **Store Budget** — Track deposits and spending; restock deducts from budget automatically
- **Profit Analytics** — Revenue vs cost vs gross profit from `vw_profit_summary`
- **Supplier Management** — Supplier cards with category labels and full purchase history
- **HR Management** — Add employees, assign duties by shift, pay/deduct salaries
- **Salary Guard** — Pay button disabled once an employee is paid for the current month
- **Sales by Date** — Filter sales day by day with daily summary chart
- **Customer History** — View all bills per registered customer with full item breakdown

### Database Concepts
- **Normalization** — 3NF across all tables
- **Foreign Keys** — ON DELETE CASCADE / RESTRICT / SET NULL
- **Views** — `vw_product_details`, `vw_sales_summary`, `vw_low_stock`, `vw_customer_spend`, `vw_daily_sales`, `vw_profit_summary`, `vw_budget_balance`, `vw_supplier_purchases`, `vw_employee_duties`, `vw_salary_summary`
- **PL/pgSQL Functions** — `sp_process_sale`, `sp_add_sale_item`, `sp_restock_product`, `sp_assign_duty`, `sp_pay_salary`
- **Transactions** — Atomic sale processing with rollback on failure
- **JOINs** — INNER, LEFT JOIN across multiple tables
- **Aggregates** — SUM(), COUNT(), AVG(), MAX(), GROUP BY, HAVING
- **Subqueries** — Nested SELECT for above-average customer spend
- **STRING_AGG** — Supplier category labels (PostgreSQL)

---

## 📁 Project Structure

```
retail-system/
├── schema.sql                      ← PostgreSQL base schema and sample data
├── sql_budget_profit.sql           ← PostgreSQL HR + budget + profit schema
├── sql_sale_snapshots.sql          ← Preserve item cost/name when each sale is made
├── README.md
├── retail-backend/
│   ├── server.js                   ← Express entry point (port 5001)
│   ├── .env.example                ← PostgreSQL configuration template
│   ├── config/db.js                ← PostgreSQL connection pool
│   ├── middleware/auth.js          ← JWT verification
│   └── routes/
│       ├── auth.js                 ← Login
│       ├── products.js             ← CRUD + restock + edit + discounts
│       ├── sales.js                ← Sale creation + date filter
│       ├── customers.js            ← Customers + history + discount setting
│       ├── suppliers.js            ← Suppliers + purchase history
│       ├── categories.js
│       ├── employees.js            ← HR: employees, duties, salary
│       ├── budget.js               ← Store budget + profit
│       └── dashboard.js            ← Admin + Manager dashboards
└── retail-frontend/
    └── src/
        ├── App.js                  ← Router + role guards
        ├── context/AuthContext.js
        ├── api/axios.js
        ├── components/Sidebar.js   ← Role-based navigation
        └── pages/
            ├── Login.js
            ├── AdminDashboard.js   ← Revenue, profit, budget, analytics
            ├── ManagerDashboard.js ← Staff duties + low stock
            ├── Products.js         ← Inventory + edit + restock
            ├── NewSale.js          ← POS cart with live discount
            ├── Sales.js            ← History + date filter
            ├── Customers.js        ← List + history + discount setting
            ├── Suppliers.js        ← Cards + purchase history
            ├── Categories.js
            ├── Employees.js        ← HR management
            ├── SalaryManagement.js ← Pay + deduct + monthly guard
            └── AssignDuties.js     ← Manager duty assignment
```

---

## ⚙️ Setup

### Prerequisites
- Node.js 20+ and PostgreSQL 16+

### Step 1 — Database
Create the database, then run all three scripts in order from the repository root:
The first two scripts create a fresh database and sample data. The third adds sale-time snapshots and can also upgrade an existing database.

```bash
psql -d postgres -c "CREATE ROLE retail_app LOGIN PASSWORD 'choose-a-database-password';"
createdb -O retail_app retail_db
psql -U retail_app -v ON_ERROR_STOP=1 -d retail_db -f schema.sql
psql -U retail_app -v ON_ERROR_STOP=1 -d retail_db -f sql_budget_profit.sql
psql -U retail_app -v ON_ERROR_STOP=1 -d retail_db -f sql_sale_snapshots.sql
```

For an existing database, apply `sql_sale_snapshots.sql` once after the other schema scripts and before deploying the current backend. It backfills earlier sale lines from the product's current cost and marks those values as estimates; correct them manually if the original costs are known. It also creates the persistent login throttle and idempotency tables used by the backend.

### Step 2 — Backend
```bash
cd retail-backend
Copy-Item .env.example .env
# Set DATABASE_URL, a random JWT_SECRET (at least 32 characters), and STORE_TIMEZONE (IANA name) in .env
npm.cmd ci
npm.cmd start
```

Create an application login instead of using the old hard-coded demo credentials:

```powershell
$env:APP_USERNAME = 'admin'
$env:APP_ROLE = 'admin'
# Set APP_PASSWORD to a unique password of at least 12 characters in this shell.
npm.cmd run create-user
```

The same script creates `manager` and `cashier` accounts. The `/api/health` endpoint checks database connectivity.

Sign-in limits each username to 10 attempts per 15-minute window. Sales, restocks, and salary payments require an `Idempotency-Key` header; the app supplies a key and reuses it after a network timeout. Keys expire after 90 days. Set `STORE_TIMEZONE` to the store's IANA time zone (for example, `Asia/Kolkata`) so database timestamps and date reports use the store's local day.

### Step 3 — Frontend
```bash
cd retail-frontend
npm.cmd ci
npm.cmd start
# Opens: http://localhost:3000
```

### PostgreSQL tests
Set `TEST_DATABASE_URL` to a disposable PostgreSQL database where the user can create/drop schemas, then run `npm.cmd test` from `retail-backend`. Tests create an isolated schema, apply all three SQL files, check routines and constraints, and drop that schema afterward.

---

## 📊 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/products` | No | All products (vw_product_details) |
| POST | `/api/products` | Manager+ | Add product |
| PATCH | `/api/products/:id/restock` | Manager+ | Restock via sp_restock_product |
| DELETE | `/api/products/:id` | Admin | Delete product |
| GET | `/api/sales` | Yes | Sales history (vw_sales_summary) |
| POST | `/api/sales` | Yes | Create sale with discount + stock update |
| GET | `/api/customers` | Yes | All customers |
| GET | `/api/customers/top` | Yes | Above-average spenders (subquery) |
| GET | `/api/suppliers` | Yes | Suppliers with category labels |
| GET | `/api/dashboard` | Yes | Live stats + all views |

---

## 🔗 Repository

[github.com/SMPanther/retail-system](https://github.com/SMPanther/retail-system)
