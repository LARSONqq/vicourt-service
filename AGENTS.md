# ViCourt Service

ViCourt Service is an internal CRM / management system for a landscaping and property maintenance team.

The application is actively developed. Before making changes, inspect the existing implementation and reuse current patterns instead of creating duplicate systems.

---

# Tech stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- Supabase
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Vercel
- GitHub

The project does NOT use a `src` directory.

Main folders include:

- app/
- components/
- services/
- types/
- lib/
- constants/

---

# Important working rules

1. Before editing, inspect the relevant existing files.

2. Prefer existing services, server actions, components, permission helpers and database RPC functions instead of duplicating logic.

3. Do not refactor unrelated code unless it is necessary for the requested task.

4. Preserve existing behavior unless the task explicitly requires changing it.

5. Keep the UI responsive for desktop and mobile.

6. Preserve Ukrainian UI terminology.

7. Do not silently rename database fields, statuses or business terminology.

8. After code changes always run:

   npm run build

9. Fix TypeScript/build errors caused by your changes before finishing.

10. At the end, provide:
   - summary of changes
   - list of changed files
   - result of npm run build
   - any SQL migration the user still needs to execute manually

---

# Security

Security is important.

Never:

- expose Supabase secret/service-role keys to client components
- move server secrets into NEXT_PUBLIC variables
- print secrets
- modify `.env.local` values
- weaken RLS just to make a feature work
- bypass existing role permissions

Server-only Supabase admin credentials must stay server-side.

The environment contains a server-side Supabase secret used for Auth admin operations.

Do not display or copy its value.

---

# Authentication and roles

Existing application roles:

## admin

Full access.

## object_manager

Access to:

- Home
- Objects
- Tasks
- Calendar
- Warehouse
- Purchases
- Equipment
- Employees
- Reports

Can manage:

- objects
- tasks
- purchases
- object-related data

Cannot perform admin-only actions unless existing permission helpers allow it.

## worker

Access to:

- Home
- Objects
- Tasks
- Calendar
- Warehouse
- Equipment

More limited permissions.

---

# Permission helpers

Reuse the existing permission system in:

lib/auth/permissions

Do not duplicate role checks manually if an appropriate permission helper already exists.

Important examples include:

- canManageObjects
- canManagePurchases
- canManageEmployees

Always inspect existing helpers before creating a new one.

---

# Supabase

The application uses RLS.

Existing private helper functions include:

- private.is_active_user()
- private.is_admin()
- private.has_role(...)

Do not remove or bypass RLS.

For database mutations that involve stock or financial logic, prefer transactional PostgreSQL RPC functions where appropriate.

---

# Objects

Objects are the central entity in ViCourt.

An object contains information such as:

- name
- customer
- phone
- address
- status
- responsible employee

Object detail pages contain sections/tabs for:

- Information
- Tasks
- Materials
- Work journal
- Expenses
- Photos

Existing object statuses include:

- Новий
- В роботі
- На постійному обслуговуванні
- Призупинено
- Завершено

A future/active requested status may also include:

- Під періодичним наглядом

When adding a new object status, check all locations that display, filter, count or style object statuses.

Do NOT confuse object status `"В роботі"` with task or equipment statuses having the same text.

---

# Object financial calculation

Object cost is calculated from:

Materials
+
Labor
+
Other expenses
=
Total object cost

## Materials

Materials assigned from the warehouse preserve their cost.

Warehouse material allocation uses existing database RPC logic.

Do not double-count warehouse purchases as object expenses.

A warehouse purchase adds material to stock.

Object material cost is counted when material is allocated to the object.

## Labor

Employees have:

- hourly_rate

Work logs also store:

- hourly_rate

The work log rate is a historical snapshot.

If an employee's current hourly rate changes, existing work logs should NOT automatically change.

Labor cost:

hours × work_log.hourly_rate

## Other expenses

Table:

public.object_expenses

Examples:

- Доставка
- Оренда техніки
- Паливо
- Послуги
- Інше

Existing expense records contain fields including:

- object_id
- expense_date
- category
- description
- amount
- note
- created_by
- created_by_name
- created_at
- updated_at

---

# Warehouse

Important tables include:

- warehouse_items
- warehouse_movements
- warehouse_purchases
- materials

Warehouse movements preserve history.

Important movement fields include:

- item_id
- object_id
- movement_type
- quantity
- note
- performed_by
- performed_by_name
- unit_price
- created_at

Do not destroy historical movement information.

---

# Warehouse costing

Warehouse stock uses weighted-average cost.

Example:

10 units at 100 UAH
+
10 units at 200 UAH

New stock:

20 units at 150 UAH average cost.

Do not replace warehouse average cost with the latest purchase price.

---

# Warehouse purchases

Existing database functions include:

- create_or_add_warehouse_purchase(...)
- complete_warehouse_purchase(...)

Completing a warehouse purchase should:

1. mark the purchase as completed
2. increase warehouse stock
3. calculate weighted-average warehouse cost
4. create a warehouse movement of type "Прихід"
5. preserve the actual purchase unit price in the movement
6. preserve the user who performed the operation

Do not create a second independent purchasing/stock system.

---

# Work journal

Work logs are connected to objects.

Existing work log data includes:

- object_id
- employee_id
- work_date
- description
- workers
- hours
- hourly_rate
- created_at

The historical hourly_rate behavior must be preserved.

A planned feature is the ability to attach a file to a work-log entry containing a detailed list of completed work.

When implementing attachments:

- inspect the existing Supabase Storage implementation first
- reuse existing storage patterns if possible
- respect RLS/security
- do not break existing work-log behavior
- support a clear way to open/download the attached document

---

# Employees

Employees are separate from authentication users.

Deleting a user account must NOT automatically mean deleting the employee record unless explicitly intended.

Employee records contain an hourly rate used for new work-log snapshots.

---

# User management

Admin user management already supports:

- roles
- employee linking
- blocking/unblocking
- deleting user accounts

Do not remove protection against deleting:

- the currently logged-in user
- the last active administrator

---

# UI conventions

Keep the existing ViCourt visual style:

- clean
- minimal
- white cards
- subtle borders
- green primary actions
- responsive layouts
- mobile cards where desktop tables are unsuitable

Avoid unnecessary redesigns unless specifically requested.

The larger Design 2.0 redesign is planned separately.

---

# Git

Do not push or commit automatically unless the user explicitly requests it.

Before suggesting a push, make sure:

npm run build

passes successfully.

Do not modify Git history or force-push.

---

# How to approach tasks

For every requested feature:

1. inspect existing implementation
2. identify all affected files
3. identify any database/RLS/storage implications
4. implement the smallest coherent change
5. preserve existing business rules
6. run npm run build
7. report what changed
8. clearly provide any SQL that must be executed manually in Supabase

If there is uncertainty about existing database schema or RPC behavior, inspect the existing project first rather than guessing.