# Implementation Status – Elkartearen App User Stories

Status legend:

- ✅ Implemented (real feature: UI + some logic/persistence)
- 🟡 UI Only / Mock (front-end prototype, mock data, no real backend)
- 🟡 Partial (shipped with known gaps vs story text)
- ❌ Not Implemented

> **Scope note:** Authentication, users, reservations, consumptions, products, categories, credits/debts, notes (oharrak), notifications, society fields (including SEPA-related columns), tables, subscription types, and backoffice society management are backed by Express + Drizzle + PostgreSQL. SEPA XML generation still uses hardcoded creditor defaults in the client generator (see `credits.md`).
>
> **Local DB:** `pnpm db:reset` runs [`script/reset.ts`](../script/reset.ts) (drops all `public` tables, then `db:push`). `pnpm db:seed` runs [`script/seed.ts`](../script/seed.ts) (ordered demo seeds in one process).

---

## 1. Authentication (`authentication.md`)

1. **User Login** – Login form & auth context
   - **Status**: ✅ Implemented (real `POST /api/login` + bcrypt/legacy passwords; society alphabetic id; access + refresh httpOnly cookies; Bearer token in localStorage; E2E tested)
2. **Role-Based Access Control** – menus & route protection
   - **Status**: ✅ Implemented (menus and most guards use **function**: administratzailea, diruzaina, sotolaria, arrunta; member type is **role** bazkidea/laguna)
3. **View Personal Profile** – self profile view
   - **Status**: ✅ Implemented (`/profila`, JWT-backed user payload + profile API)
4. **Update Password** – change password flow
   - **Status**: ✅ Implemented (`POST /api/change-password` + UI; server path may need hardening for production)

---

## 2. User Management (`user-management.md`)

1. **List users** – table with search/filter
   - **Status**: ✅ Implemented (UsersPage + `GET /api/users`, society-scoped list; **`accountBalance`** from ledger sums per row; **IBAN column hidden** when `sepaMode === disabled`; **requires** diruzaina or administratzailea; UI page is administratzailea-only)
2. **Create a new member** – add bazkide with contact/bank details
   - **Status**: 🟡 Partial (real `POST /api/users`; create dialog currently persists email/username + default password; several displayed fields not yet wired to POST — see PRD)
3. **Create a companion linked to a member** – add laguna linked to bazkide
   - **Status**: 🟡 Partial (schema + admin `PUT` support linking; create-dialog link control not wired to API)
4. **Edit user details** – update contact/role information
   - **Status**: ✅ Implemented (`PUT /api/users/:id`; subscription type; linked member read-only in UI)
5. **Delete a user** – remove users
   - **Status**: ✅ Implemented (dependency checks)
6. **Role-based access to user management** – restrict admin page access
   - **Status**: ✅ Implemented (frontend + backend)
7. **Activate / deactivate user** – `PATCH /api/users/:id/toggle-active`
   - **Status**: ✅ Implemented
8. **Subscription type assignment** – member fee type on user
   - **Status**: ✅ Implemented (edit dialog + `subscriptionTypeId`; types managed under `/subscriptions`)

---

## 3. Reservations (Erreserbak) (`reservations.md`)

1. **Create Reservation** – date/time, event type, table, guests, kitchen flag, cost
   - **Status**: ✅ Implemented (`POST /api/reservations`; types: bazkaria, afaria, askaria, hamaiketakako)
2. **View My Reservations** – list & filters
   - **Status**: ✅ Implemented (`/nire-erreserbak`, `GET /api/reservations/user`)
3. **Society reservation list** – upcoming/filter for all members
   - **Status**: ✅ Implemented (`/erreserbak`, `GET /api/reservations` with upcoming filter)
4. **Manage All Reservations (Admin UI)** – global management
   - **Status**: 🟡 Partial (`/admin-erreserbak`: list/cancel/detail; no in-place edit; administratzailea-only UI; API treats diruzaina as admin for some list queries)
5. **Resource configuration (tables)** – capacity & availability metadata
   - **Status**: ✅ Implemented (`/mahaiak`, `tables` CRUD; not tenant-scoped in schema — see tech debt)
6. **Per-society reservation pricing** – guest & kitchen rates
   - **Status**: ✅ Implemented (fields on `societies`, editable via `/elkartea` where allowed)
7. **Cost calculation** – guest × rates + optional kitchen
   - **Status**: 🟡 Partial (client-computed `totalAmount`; stored as sent; no server-side recomputation)
8. **Cost integration with credits (Zorrak)** – monthly debt rows
   - **Status**: 🟡 Partial (`DebtCalculationService` / cron aggregates reservations + consumptions into `credits`; not “charge at booking” UX)

---

## 4. Consumptions (Kontsumoak) (`consumptions.md`)

1. **Register bar consumption (session flow)** – create session, add lines, close
   - **Status**: ✅ Implemented (`POST /api/consumptions`, `POST .../items`, `POST .../close`; stock decrement on items)
2. **View consumption history (member)** – personal list
   - **Status**: ✅ Implemented (`/nire-konsumoak`, `GET /api/consumptions/user`)
3. **Manage all consumptions (staff)** – society list/detail
   - **Status**: ✅ Implemented (`/kontsumoak-zerrenda`, `GET /api/consumptions` with role-based scope)
4. **Close consumption session**
   - **Status**: ✅ Implemented
5. **Product categories (admin)** – bilingual labels, reorder, soft delete
   - **Status**: ✅ Implemented (`/kategoriak`, `GET/POST/PUT/DELETE /api/categories`; filters on POS)
6. **Consumption categories as analytics**
   - **Status**: ❌ Not Implemented (no reporting dashboards)
7. **Inventory update from consumptions** – stock + movements
   - **Status**: ✅ Implemented (`stock_movements` with type consumption; stock can go negative)
8. **Consumption analytics**
   - **Status**: ❌ Not Implemented

---

## 5. Credits / Zorrak & SEPA (`credits.md`)

1. **View pending credits (member)** – personal debt view
   - **Status**: ✅ Implemented (`/nire-zorrak`, `GET /api/credits/member/current`; sidebar entry **omitted** and route **redirects to `/nire-mugimenduak`** when `sepaMode === disabled`)
2. **Monthly credit summary (treasurer/admin)** – per-month overview
   - **Status**: ✅ Implemented (`/zorrak`, `GET /api/credits`; sidebar **omitted** and route **redirects to `/mugimenduak`** when `sepaMode === disabled`; tighten `societyId` filters in API for multi-tenant hardening)
3. **Credit reset / mark paid after payment**
   - **Status**: 🟡 Partial (`PUT /api/credits/batch-status`; admin grid + batch actions on **`/zorrak`** only when `sepaMode !== disabled`; no rich audit UI)
4. **Generate SEPA export** – debtor list + pain.008-style XML in browser
   - **Status**: ✅ Implemented (`/sepa`, `GET /api/credits/sepa-export` with `month` / `months` / `from`+`to`, validated vs **`sepaMode`**; multi-tenant filter; + E2E `sepa-billing-frequency.feature`)
5. **SEPA data validation** – IBAN/creditor checks
   - **Status**: ❌ Not Implemented
6. **Society information for SEPA + billing cadence** – creditor config in generated file; **`sepaMode`** (monthly / bimonthly / quarterly / on-demand / disabled) on **`societies`** and **`/elkartea`**
   - **Status**: ✅ Implemented (XML creditor from society with fallback; UI warning if missing; see `credits.md` Story 11)
7. **Payment status tracking** – sent/paid/return/reject workflows
   - **Status**: ❌ Not Implemented (beyond basic `status` / `paidAmount` on `credits`)
8. **Credit notifications**
   - **Status**: ❌ Not Implemented (dedicated credit alerts)
9. **Financial dashboard widgets** – debt highlights on home
   - **Status**: 🟡 Partial (pending total from credits when SEPA is active; **ledger balance** from `GET /api/account-movements/me` when `sepaMode === disabled`)
10. **Export financial reports** – statements, YTD bundles
    - **Status**: ❌ Not Implemented

---

## 5b. Account movements / ledger (`account-movements.md`)

1. **Member movement list & balance** – `/nire-mugimenduak`, `GET /api/account-movements/me`
   - **Status**: ✅ Implemented (+ top stat cards: balance status, period count/net; E2E: `account-movements.feature`)
2. **Treasurer movement audit** – `/mugimenduak`, `GET /api/account-movements` (filters, running balance via SQL window; response includes `sumAmount`, `selectedMemberBalance` when a member filter is set)
   - **Status**: ✅ Implemented (+ top stat cards: filtered count, filtered sum, member saldo when filtered)
3. **Bank transfer workflow** – `/transferentziak`, `POST/GET /api/bank-transfers`, validate/reject + ledger + notifications
   - **Status**: ✅ Implemented (+ E2E: `bank-transfers.feature`)
4. **Refunds** – dialog on **`/transferentziak`** (treasurer); `POST /api/account-movements/refund`; **`/itzulketak`** redirects to transfers
   - **Status**: ✅ Implemented (+ E2E: `refunds.feature`)
5. **SEPA collection on ledger** – `sepa_collection` movement (**positive** `amount` in member-balance convention) when marking credits paid (`PUT /api/credits/batch-status`)
   - **Status**: ✅ Implemented
6. **SEPA bounce** – `POST /api/account-movements/sepa-bounce`, **`/zorrak` action column when `sepaMode` is not `disabled`** (+ E2E: `sepa-bounce.feature`); bounce posts **negative** `amount` to reverse collection
   - **Status**: ✅ Implemented
7. **Consumption / reservation lines on ledger** – movements on item add, reservation create; cancellation/deletion adjustment
   - **Status**: ✅ Implemented
8. **Subscription fees on ledger** – `DebtCalculationService` posts `subscription` movement + `credits.subscription_amount` for all societies (including **`sepaMode` = `disabled`**); `disabled` affects SEPA export only
   - **Status**: ✅ Implemented (multi-tenant cron + per-society real-time triggers; see `server/cron-jobs.ts`)
9. **Future (spec only):** period closing, transfer attachments, PDF statements, two-step refund approval — see `account-movements.md`

---

## 6. Communication – Oharrak & Jakinarazpenak (`communication.md`)

> **Shipped scope:** Oharrak are **DB-backed notes** (`notes` / `note_messages`, `/api/notes`, `/oharrak`). **Jakinarazpenak** (`/jakinarazpenak`, `/api/notifications`) are separate.

### Notes (Oharrak)

1. **Create notes** – multilingual title/body (eu/es)
   - **Status**: ✅ Implemented (`notes` + `note_messages`, `POST /api/notes`, admin UI `/oharrak`)
2. **View notes** – read society notices
   - **Status**: ✅ Implemented (dashboard `RecentNotes` + full admin management)
3. **Note management** – edit/delete
   - **Status**: 🟡 Partial (CRUD; no archive/expiry/analytics as in original epic)

### Notifications (Jakinarazpenak)

4. **In-app notifications** – list/read DB notifications
   - **Status**: ✅ Implemented (`/jakinarazpenak`, `notifications` + `notification_messages`; can be fed from notes)

### Preferences, templates, analytics (backlog)

5. **Notification settings, templates, communication analytics & history (legacy epic)**
   - **Status**: ❌ Not Implemented

---

## 7. Inventory Management (Produktuak) (`inventory.md`)

1. **Add / update / view products**
   - **Status**: ✅ Implemented (`/produktuak`, `/api/products` CRUD; cellarman-gated UI)
2. **Product categories**
   - **Status**: ✅ Implemented (see Consumptions §5; `/kategoriak`)
3. **Stock management & movements**
   - **Status**: 🟡 Partial (consumption-driven decrement + `stock_movements` rows; direct `stock` edit via product PUT without movement; **no** movements list API/UI)
4. **Low stock awareness**
   - **Status**: 🟡 Partial (`minStock` + banner on ProductsPage; no push notifications)
5. **Purchases & suppliers**
   - **Status**: ❌ Not Implemented (supplier string on product only)
6. **Inventory analytics & optimization**
   - **Status**: ❌ Not Implemented

---

## 8. Society Management (Elkartea) (`society-management.md`)

1. **Society information & SEPA-related fields**
   - **Status**: 🟡 Partial (`/elkartea`, `GET /api/societies/user`, `PUT /api/societies/:id` — **administratzailea** + **diruzaina** own-tenant; prepaid-balance toggle shipped)
2. **Tables (resource config for reservations)**
   - **Status**: ✅ Implemented (`/mahaiak` — see Reservations)
3. **Subscription types**
   - **Status**: ✅ Implemented (`/subscriptions`, `subscription_types` table)
4. **Rules, policies, role transfers, operating hours, compliance, backup UX**
   - **Status**: ❌ Not Implemented

---

## 9. Internationalization (Euskara/Castellano) (`internationalization.md`)

1. **Primary language (Euskara)**
   - **Status**: ✅ Implemented (`client/src/lib/i18n.ts`, default eu)
2. **Secondary language (Castellano)**
   - **Status**: ✅ Implemented (toggle, `localStorage`; some hardcoded strings remain in components)
3. **Language preference beyond SPA keys**
   - **Status**: 🟡 Partial (no profile-synced locale; server i18n middleware influences API messages; DB-backed bilingual content for categories/notes)
4. **Workflows, analytics, QA tooling (stories 3–8, 11–12)**
   - **Status**: ❌ Not Implemented

---

## 10. User profile (`user-profile.md`)

Documented alongside auth; shipped as `/profila` with profile edit + password change — see Authentication §3–4 and `user-profile.md`.

---

## 11. Platform backoffice (not in legacy story index)

- **Superadmin login, society list, superadmin users** (`/elkarteapp/kudeaketa/*`): Implemented (separate cookie; `superadmins` table)

---

## Notes for Future Work

- Harden multi-tenant queries (e.g. credits list/export, product mutations) with explicit `societyId` WHERE clauses where missing.
- Align treasurer vs administratzailea access for society `PUT`, Zorrak UI, and `/elkartea`.
- Replace or wire SEPA XML creditor metadata to `societies` fields.
- Keeping this file in sync with `docs/features/*.md` remains the shipped-truth tracker for product and engineering.
