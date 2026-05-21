# Business Management System

Full-stack business management application with multi-branch support for sales, purchases, inventory, stock transfers, and financial tracking.

## Tech Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (default) / MySQL
- Auth: JWT + role-based access control

## Project Structure
- `frontend/` React application
- `backend/` Express API
- `.github/copilot-instructions.md` project-specific Copilot instructions

## Quick Start

### 1) Backend setup
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Backend runs on `http://localhost:5000`.

### 2) Frontend setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173` (or next available port).

## Database Setup
Create database `business_management` in PostgreSQL and run:

```bash
psql -U postgres -d business_management -f backend/database/schema.sql
```

## Initial Modules Planned
- Authentication and access control (main login + branch login)
- Branch management
- Product and multi-unit management
- Sales / sales return
- Purchase / purchase return
- Inventory and stock transfer
- Cash book, bank accounts, ledgers, expenses
- Reports (sales, purchase, P/L, receivables, payables)

## Current Implementation Status
- Module 1 (Authentication & RBAC) is initialized with database-backed users.
- Login activity tracking is added in `login_activities`.
- Reusable frontend architecture is in place (layout shell, route guards, auth context, shared UI components).
- Backend JWT auth via secure `HttpOnly` cookie and role-based guard middleware are implemented.
- User management module is available in frontend for main admin / branch admin.

## Sales Module (Implemented)

### Sales Invoices
- Sales invoice screen is available at `/sales`.
- Invoice create flow supports:
	- customer selection
	- line-item product search
	- discount, received amount, and due amount calculation
	- branch-aware posting
- Customer net ledger balance is shown beside customer selection, including **After Invoice** preview.
- Posting effects on save:
	- Inventory reduces (FIFO stock out + inventory balance update)
	- Ledger posts receivable/income entries
	- If received amount is entered, receipt entries are posted and receivable is reduced

### Sales Returns
- Sales return screen is available at `/sales-returns`.
- Return can be started directly from Sales invoice list/view (`Return` action).
- Return creation enforces quantity validation against sold and already-returned quantities.
- Customer net ledger balance is shown with **Before Return** and **After Return** preview.
- Return effects on save:
	- Inventory restores (FIFO reversal + inventory balance increase)
	- Ledger posts sales return reversal entries
	- Customer receivable/due is reduced accordingly
- Return records support View, Edit (date/reason), Print, and Delete.

### Cancellation Rules
- Invoice cancel is blocked once returns exist for that invoice.
- Invoice cancel (when allowed) reverses inventory and ledger/receipt entries and marks invoice cancelled.
- Return delete reverses the return impact (inventory + ledger + due adjustment).

### Related Frontend Routes
- `/sales` → Sales Invoices
- `/sales-returns` → Sales Returns

### Related Backend APIs
- `GET /api/sales`
- `GET /api/sales/:id`
- `POST /api/sales`
- `PATCH /api/sales/:id/cancel`
- `GET /api/sales/returns`
- `GET /api/sales/returns/:id`
- `POST /api/sales/returns`
- `PATCH /api/sales/returns/:id`
- `DELETE /api/sales/returns/:id`

### Demo Credentials (Development)
- Main Admin: `mainadmin` / `Admin@123`
- Branch Admin: `branch1admin` / `Branch@123`

### API Endpoints Ready
- `POST /api/auth/login`
- `GET /api/auth/me` (protected)
- `POST /api/auth/logout` (protected)
- `GET /api/users` (main admin + branch admin, branch scoped)
- `POST /api/users` (create user with role/access rights)
- `PUT /api/users/:id` (update user)
- `PATCH /api/users/:id/status` (activate/deactivate user)
- `GET /api/branches` (for role-aware branch selection)

## Next Development Steps
1. Implement auth and RBAC middleware.
2. Add Sequelize models and migrations.
3. Build module-wise APIs.
4. Integrate frontend dashboards and forms.
5. Add reporting and export features.
