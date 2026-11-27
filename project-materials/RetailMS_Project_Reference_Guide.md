# Retail Management System
## Presentation and project guide

**A plain-language guide for the project team, classmates, and faculty**  
University of Central Punjab · BSCS · Spring 2026  
Muhammad Umer Iqbal · Arslan Aman · Database Systems · Instructor: Muneeb Ali Muzaffar

> This guide describes the local academic project in the repository. It is written so a person who does not build software can understand what the system does. It does not claim the app is live at a real store.

## Start here: the one-minute explanation

Retail Management System (RetailMS) is a small store’s shared digital notebook. It keeps products, stock, sales, customers, suppliers, and staff records together. When the cashier completes a sale, the system saves the bill and lowers the stock count. Managers can then see what is running low and review the day’s activity.

**The idea in one line:** one sale updates the store’s connected records, so staff can make the next decision with a clearer picture.

## Why make it?

A store has many simple facts to keep straight: how many items are left, what has sold, who bought it, which supplier provides it, and what the store spent. When those facts are kept in separate notebooks or files, staff have to copy details and can miss changes. RetailMS gives those everyday records one connected home.

## What can each person do?

| Person | In simple terms |
|---|---|
| Cashier | Build a customer’s cart, complete a sale, and look up sales history. |
| Manager | Check stock, restock products, review staff, and assign duties. |
| Admin | See the wider store picture, manage customer settings, and handle salary records. |

The app shows role-aware pages. A person signs in, and their role determines which screens and actions are available.

## The store’s everyday journey

### 1. A product arrives

The product is tied to a category and a supplier. The stock count is increased through a restock action, and the purchase is recorded.

### 2. A customer checks out

The cashier adds products to a cart and may choose a registered customer. The system works out the total and any eligible discount. On a successful checkout it saves the sale and lowers stock in one operation.

### 3. The store reviews the day

The sale appears in sales history and contributes to summaries. Managers can spot low-stock items, while admins can look at revenue, costs, gross profit, budget, and customer spend.

## An example: what happens to one bill?

Using two products in the sample catalogue:

| Item | Price |
|---|---:|
| Basmati rice, 5 kg | PKR 800 |
| Milk, 1 L | PKR 180 |
| **Subtotal** | **PKR 980** |
| Registered-customer discount (5%, assuming no item discount) | − PKR 49 |
| **Customer pays** | **PKR 931** |

The total is an illustration using seeded sample prices and the seeded 5% setting. A product-specific discount can change the actual amount. After checkout, the system records the bill, preserves details about the sold products, and reduces the two stock quantities.

## What the main screens are for

| Screen or area | What it helps with |
|---|---|
| Admin dashboard | A quick view of sales, revenue, profit, budget, customers, and products. |
| Manager dashboard | A quick view of low-stock items and staff duties. |
| Products | Product details, price, supplier, current stock, and restocking. |
| New Sale | A cart for checkout with customer and discount handling. |
| Sales | Past bills and daily sales summaries. |
| Customers | Customer list and purchase history. |
| Suppliers | Supplier records and purchase history. |
| Employees and duties | Staff records, shifts, and assigned work. |
| Salary management | Monthly salary payments and deductions. |

## How the technology works, without the jargon

Think of a restaurant:

1. **The webpage is the counter.** It is where a person signs in and chooses what to do.
2. **The API is the staff member taking the request.** It checks who is signed in, validates the request, and applies the store rules.
3. **The database is the organized stockroom ledger.** It stores the records and links the bill, product, customer, and stock together.

The webpage does not directly edit the database. It asks the API, and the API communicates with PostgreSQL.

## Technology used

| Technology | Plain-language job |
|---|---|
| React 18 | Builds the pages and interactive screens. |
| React Router 6 | Moves between screens and protects role-specific pages. |
| Axios | Sends requests from the webpage to the API. |
| Node.js | Runs the server-side JavaScript. |
| Express 4 | Organizes the API routes and request handling. |
| PostgreSQL | Stores the connected store records and checks their relationships. |
| `pg` / node-postgres | Lets the server talk to PostgreSQL. |
| JSON Web Token (JWT) | Carries a signed sign-in token with protected requests. |
| `bcryptjs` | Checks passwords stored as hashes rather than plain text. |
| `dotenv` | Loads local settings from an environment file. |

## A quick look at the records

The database stores separate kinds of records, then links them:

- A **product** belongs to a category and has a supplier.
- A product has one **inventory** record for the current quantity.
- A **sale** has one or more sale items; each sale item points to a product.
- A sale can point to a **customer**, or remain a guest sale.
- **Employees** can receive duty assignments and salary records.
- Supplier purchases and store budget entries help describe stock buying and store funds.

Keeping these pieces separate avoids typing a supplier address on every product or repeating a customer’s name on every sale line. Database links and rules help prevent invalid references and values.

## How RetailMS avoids common mistakes

**One checkout, one result.** The bill, its items, and its stock changes are saved together. If the checkout fails, those changes are rolled back together.

**A retry should not make a second bill.** For important actions such as checkout and restocking, the browser sends a request key. When the same action is retried after a connection problem, the server can return the saved result instead of applying it twice.

**Old sales keep their context.** Each sale line saves the product name and cost from the time of sale. Changing today’s product record does not rewrite that line’s past details.

**Numbers have guardrails.** Database checks reject values such as negative stock, invalid discounts, or a zero item quantity.

**Sign-in has guardrails.** Passwords are hashed. Repeated attempts to sign in with a username are limited to ten in a fifteen-minute window.

## The numbers on a report

- **Revenue:** money recorded from sales.
- **Cost:** the saved cost basis of the items sold.
- **Gross profit:** revenue minus item cost. This does not subtract every business expense.
- **Low stock:** a product’s quantity is at or below its reorder level.
- **Budget balance:** the sum of recorded deposits, purchases, and adjustments.

Historic cost caution: when the sale-snapshot update is first applied, older sale costs are estimated from the product’s current cost. The database marks those lines as estimates, so old gross-profit totals should be introduced with that note.

## Technology and project structure

```text
retail-system/
  schema.sql                  Main tables and starter records
  sql_budget_profit.sql       Budget, purchasing, staff, and profit additions
  sql_sale_snapshots.sql      Saved sale details and request-protection tables
  retail-backend/             Node.js + Express API
    routes/                   Sales, products, customers, staff, reports, and more
  retail-frontend/            React web app
    src/pages/                Dashboards and store screens
```

## Running it for a classroom demo

### What you need

- Node.js 20 or later.
- PostgreSQL 16 or later.
- A local PostgreSQL user and an empty database for the project.

### 1. Set up the database

Run from the `retail-system` folder. Use your own local database password in place of the example.

```powershell
psql -d postgres -c "CREATE ROLE retail_app LOGIN PASSWORD 'choose-a-database-password';"
createdb -O retail_app retail_db
psql -U retail_app -v ON_ERROR_STOP=1 -d retail_db -f schema.sql
psql -U retail_app -v ON_ERROR_STOP=1 -d retail_db -f sql_budget_profit.sql
psql -U retail_app -v ON_ERROR_STOP=1 -d retail_db -f sql_sale_snapshots.sql
```

### 2. Start the backend

```powershell
cd retail-backend
Copy-Item .env.example .env
# Add DATABASE_URL and a random JWT_SECRET with at least 32 characters to .env
npm.cmd ci
npm.cmd run create-user
npm.cmd start
```

Set `APP_USERNAME`, `APP_ROLE`, and `APP_PASSWORD` in the same PowerShell window before `npm.cmd run create-user`. Use a private demo password; do not put credentials on a slide or in a public repository.

### 3. Start the website

```powershell
cd retail-frontend
npm.cmd ci
npm.cmd start
```

The website opens at `http://localhost:3000`; the backend defaults to port 5001. The backend health page is `/api/health` and checks that PostgreSQL can be reached.

### If the demo stops working

- **Login fails:** confirm an application account exists and check `APP_USERNAME` / `APP_ROLE` used when creating it.
- **Database error:** start PostgreSQL, check the connection details in `retail-backend/.env`, and open `/api/health`.
- **Website cannot reach API:** start the backend first and confirm it is listening on port 5001.
- **Missing table or view:** rerun the three SQL scripts in the order shown using a clean class demo database.

## A five-minute presentation plan

| Time | Say or show |
|---:|---|
| 0:00–0:40 | Explain the store problem: sales, stock, people, and money must stay in sync. |
| 0:40–1:20 | Show the three roles and what each person does. |
| 1:20–2:00 | Show the low-stock list and restock one item. |
| 2:00–3:10 | Make a sample registered-customer sale and explain the discount. |
| 3:10–4:00 | Open the saved sale and show stock changed. |
| 4:00–4:40 | End on the dashboards and explain revenue, cost, gross profit, and low stock. |
| 4:40–5:00 | Give the key takeaway and invite questions. |

### A simple opening script

“A retail store handles a lot of small but connected facts: what came in, what was sold, what is left, and who did the work. Our project puts those records together. I’ll show how one sale updates the bill, the stock count, and the store’s view of the day.”

### A simple closing script

“The key idea is that a bill should not stand alone. When the sale, stock, and reporting records stay connected, the store can see what happened and decide what to do next. Thank you—what questions do you have?”

## FAQ: questions anyone may ask

**1. What is this project?**  
A website for managing common jobs in a small retail store.

**2. Who would use it?**  
A cashier, a store manager, and an admin. Each has a different set of screens.

**3. What happens when an item sells?**  
The sale is saved and the stock count goes down.

**4. What if the sale fails halfway through?**  
The critical sale changes are rolled back together so the system does not keep only part of a bill.

**5. Can someone buy without joining the customer list?**  
Yes. The sale can be recorded as a guest sale.

**6. How does the store notice a nearly empty shelf?**  
Each product can have a reorder level. The low-stock view lists items at or below that level.

**7. Can registered customers get a discount?**  
Yes. The sample setting is 5%; the admin can change the registered-customer discount. Product discounts can also affect checkout.

**8. Does the report show exact profit?**  
It shows gross profit based on the sale price and recorded item costs. Some old costs may be estimates, and gross profit is not the same as net profit after all expenses.

**9. Is this a real store’s live system?**  
No production deployment is claimed here. It is an academic project prepared to run locally.

**10. What is the most useful part for a store manager?**  
The linked sale and stock records, plus a quick view of low stock and store activity.

## FAQ: faculty and project questions, in plain language

**11. Why use a database instead of one spreadsheet?**  
The records relate to each other. A database can check those links, stop invalid values, and update a sale in one transaction.

**12. Why PostgreSQL?**  
It is a relational database with strong data checks, transaction support, reusable reports, and SQL routines—all useful for a database course project.

**13. What does “normalized” mean here?**  
It means a fact is stored in the right place once. Supplier details live with the supplier, rather than being copied onto every product row.

**14. What is a foreign key?**  
A rule that says a linked record must exist—for example, a product’s category must already be in the category list.

**15. What is a transaction?**  
A group of database changes treated as one job: all succeed, or none are kept. RetailMS uses this for checkout.

**16. What is a view?**  
A saved query that presents useful information from several tables, like the low-stock list or daily sales.

**17. What does the API do?**  
It is the middle layer. It receives a request from the website, checks it, applies rules, and talks to the database.

**18. How are passwords handled?**  
The app stores a one-way bcrypt hash, rather than the readable password. The server checks a login against that hash.

**19. What does a sign-in token do?**  
The JWT is a signed pass the app sends with protected requests. The server verifies it and checks whether the account is still active.

**20. Why use a request key for a sale?**  
If the connection drops and the browser retries, the key lets the server recognize the same action and avoid charging stock twice.

**21. Why save product details on the sale line?**  
It preserves the product name and cost as they were when the sale happened, even if the current product record changes later.

**22. Why might past cost figures be estimates?**  
For old sales, the database update uses the product’s current cost because the original cost may not have been saved. Those lines are marked as estimates.

**23. How does the app stop a second salary payment for the same month?**  
A database uniqueness rule allows only one positive payment per employee and month.

**24. How do you reduce SQL injection risk?**  
The API sends user values separately from the SQL command, so the database treats them as values rather than instructions.

**25. What does the project test?**  
The backend repository includes Node tests and PostgreSQL integration tests. The integration tests need a disposable database. Do not say they passed unless your team runs them and confirms the result.

**26. What should be added before a real store depends on it?**  
Deployment checks, secure secret management, monitoring, backups that have been tested, and a retained audit history should be addressed first.

**27. What would be a good next feature?**  
Barcode input or receipt printing would make checkout more convenient. Reliable backups and an audit trail would strengthen daily operations.

**28. What is the main database lesson?**  
Related records need to change together. A sale, its items, and its stock effect should tell one consistent story.

## Small glossary

| Word | Meaning |
|---|---|
| API | A doorway the website uses to request work from the server. |
| Database | The organized place where the application keeps records. |
| Foreign key | A link that requires a referenced record to exist. |
| Inventory | The current quantity the store has on hand. |
| JWT | A signed sign-in token sent with protected requests. |
| Low-stock level | The point at which a product should be considered for restocking. |
| Normalization | Storing each kind of fact in the right place to reduce repetition. |
| PostgreSQL | The database software used by this project. |
| Transaction | A group of changes saved together or rolled back together. |
| View | A saved database query that presents a useful summary. |
| Gross profit | Sales revenue minus the recorded cost of the goods sold. |

## What the current project does not claim

This is a local academic application. The repository does not establish a live retail deployment, backups and restore drills, an external payment provider, receipt printer support, barcode scanning, or a completed production security review. Be direct if asked: explain what is implemented, what is a planned improvement, and what you personally demonstrated.

## Source files for follow-up questions

- `README.md` — project summary and setup.
- `schema.sql` — main records, links, constraints, and starter data.
- `sql_budget_profit.sql` — budget, supplier purchases, employee and salary records.
- `sql_sale_snapshots.sql` — preserved sale details and request-protection tables.
- `retail-backend/routes/sales.js` — checkout rules and transaction.
- `retail-backend/routes/auth.js` — sign-in checks.
- `retail-frontend/src/App.js` — pages and route guards.
