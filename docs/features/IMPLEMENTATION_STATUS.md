# Implementation Status – Elkartearen App User Stories

Status legend:

- ✅ Implemented (real feature: UI + some logic/persistence)
- 🟡 UI Only / Mock (front-end prototype, mock data, no real backend)
- 🟡 Partial (shipped with known gaps vs story text)
- ❌ Not Implemented

> **Scope note:** Authentication, users, reservations, consumptions, products, categories, credits/debts, notes (oharrak), notifications, society fields (including SEPA-related columns and **`payment_methods`** for transfer prepayment + cash placeholders), tables, subscription types, and backoffice society management are backed by Express + Drizzle + PostgreSQL. SEPA XML generation still uses hardcoded creditor defaults in the client generator (see `credits.md`).
>
> **Local DB:** `pnpm db:reset` runs [`script/reset.ts`](../script/reset.ts) (drops all `public` tables, then `db:push`). `pnpm db:seed` runs [`script/seed.ts`](../script/seed.ts) (ordered demo seeds in one process).
>
> **Tests:** Three tiers — **unit** (`pnpm test`), **integration** (`pnpm test:integration`, Cucumber + Supertest on the real Express app + DB), **E2E** (`pnpm test:e2e`, Cucumber + Playwright). Story ↔ test mapping: [`TEST_COVERAGE.md`](./TEST_COVERAGE.md).
>
> **List pagination (high-volume tables):** Shared UI pattern **`usePagination`** + **`PaginationControls`** with server **`page`/`limit`** (default 25, max 100). Responses use **`{ data, total, ... }`** (admin account movements keep **`movements` + `total`**). Covered: reservations (member/society/admin), notifications, stock movements, stock receipts, stock takes (**draft take always merged into the current page** when it would otherwise be missing), consumptions list + **my consumptions** (includes `sumTotalAmount` / `pendingCount` for stats), treasurer **credits** grid (**`sumPending`/`sumPaid`** for summary cards; batch select-all is **per page**), treasurer **bank transfers** (**pending** list only), **my movements** + **admin movements** (period stats use full filtered totals), **society accounting** derived movements tab (**`/api/society-accounting/derived-movements`**: `movements` + `total`, running balance over full **`from`/`to`** range).

---

## 1. Authentication (`authentication.md`)

1. **User Login** – Login form & auth context
   - **Status**: ✅ Implemented (real `POST /api/login` + bcrypt/legacy passwords; society alphabetic id; optional **Host-bound login** when `TENANT_APEX_DOMAIN` is set — see [`subdomain-tenancy.md`](./subdomain-tenancy.md); access + refresh httpOnly cookies; Bearer token in localStorage; integration + E2E tested — see `TEST_COVERAGE.md`)
2. **Role-Based Access Control** – menus & route protection
   - **Status**: ✅ Implemented (**`accessRole`** + **`membershipType`**, shared **`Permission`** checks on API + client; see [`rbac.md`](./rbac.md); E2E: `e2e/features/role-based-menu.feature` for sidebar + direct URL denial; API 403 matrix: `integration/features/rbac.feature`; **HTTP 403** from the API is shown with the same **`AccessDenied`** pattern as route-gated pages via `AccessDeniedOrError` + status-prefixed fetch errors)
3. **View Personal Profile** – self profile view
   - **Status**: ✅ Implemented (`/profila`, JWT-backed user payload + profile API)
4. **Update Password** – change password flow
   - **Status**: ✅ Implemented (`POST /api/change-password` + UI; server path may need hardening for production)
5. **Password reset (forgot password)** – email link + new password for society members
   - **Status**: ✅ Implemented (`POST /api/public/forgot-password`, `POST /api/public/reset-password`, `user_password_resets`, mail helper, `/pasahitza-ahaztu` + `/pasahitza-berrezarri`, integration `password-reset.feature` — see [`authentication.md`](./authentication.md) Story 8)

---

## 2. User Management (`user-management.md`)

1. **List users** – table with search/filter
   - **Status**: ✅ Implemented (UsersPage + `GET /api/users`, society-scoped list; **`accountBalance`** from ledger sums per row; **IBAN column hidden** when `sepaMode === disabled`; **`Permission.USERS_LIST`** — admin, treasurer, cellarman; Users page UI **`Permission.USERS_MANAGE`**)
2. **Create a new member** – add bazkide with contact/bank details
   - **Status**: ✅ Implemented (`POST /api/users` with **`accessRole`**, **`membershipType`**, phone, IBAN, linked member, subscription type; default password `demo`)
3. **Create a companion linked to a member** – add laguna linked to bazkide
   - **Status**: ✅ Implemented (create dialog sets `membershipType: companion` + optional `linkedMemberId` / name)
4. **Edit user details** – update contact/role information
   - **Status**: ✅ Implemented (`PUT /api/users/:id`; **`accessRole`** + **`membershipType`**; subscription type; linked member read-only in UI)
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

1. **Create Reservation** – date/time, meal type, table, guests, optional add-on services, server-computed cost
   - **Status**: ✅ Implemented (`POST /api/reservations` with **`selectedServiceIds`**; **`totalAmount`** + **`selectedServices`** snapshots computed server-side; **`useKitchen`** derived from **kitchen** service; **`type`** must match **`societies.reservation_meal_types`**; **exclusive vs partial table** rules; **`GET /api/tables/available`**; **map** link when **`mapImageUrl`** set; **prepayment ledger floor** — see §5b.10 / `prepayment-ledger-floor.md`)
2. **View My Reservations** – list & filters
   - **Status**: ✅ Implemented (`/nire-erreserbak`, `GET /api/reservations/user`)
3. **Society reservation list** – upcoming/filter for all members
   - **Status**: ✅ Implemented — **no dedicated `/erreserbak` page**; society-wide bookings visible on **`/egutegia`** (month + agenda) and dashboard snippet; **`GET /api/reservations`** still supports `upcoming=true` / `forCalendar=true` for clients
4. **Manage All Reservations (Admin UI)** – global management
   - **Status**: 🟡 Partial (`/admin-erreserbak`: list/cancel/detail; no in-place edit; administratzailea-only UI; API treats diruzaina as admin for some list queries)
5. **Resource configuration (tables)** – capacity & availability metadata
   - **Status**: ✅ Implemented (`/mahaiak`, `tables` CRUD, tenant-scoped; **`allowsPartialReservation`** for shared-capacity tables)
6. **Per-society reservation pricing** – guest base rate + add-on services (kitchen, cleaning, heating, custom)
   - **Status**: ✅ Implemented (`societies.reservationFixedFee` + **`reservationPricePerMember`** on **`/erreserba-ezarpenak`**; **`reservation_services`** + APIs; built-in **kitchen** (default-on) / **cleaning** / **heating** (“Berogailua”) per society)
7. **Cost calculation** – base + selected services (fixed and/or per guest)
   - **Status**: ✅ Implemented (server **`totalAmount`** on **`POST /api/reservations`**; **`selectedServices`** snapshots; detail UIs use snapshots)
8. **Cost integration with credits (Zorrak)** – monthly debt rows
   - **Status**: ✅ Implemented (`DebtCalculationService` / cron aggregates reservations whose **`startDate` has passed** (in-month) + consumptions into `credits`; ledger **`reservation`** charge deferred until after **`startDate`**, not at booking)
9. **Society calendar (Egutegia)** – closures, parties, assemblies; optional hard blocks on reservations
   - **Status**: ✅ Implemented ([`society-calendar.md`](./society-calendar.md): `/egutegia`; `society_events` table; `GET/POST/PUT/DELETE /api/society-events`; **`Permission.CALENDAR_MANAGE`** for mutations — admin + diruzaina; **`POST /api/reservations`** overlap checks with localized **409**; member calendar month reservations via **`GET /api/reservations?forCalendar=true&month=YYYY-MM`** max **`limit` 500**; warnings in **`ReservationDialog`**)
10. **Configurable reservation meal types** – per-society ids + EU/ES labels

- **Status**: ✅ Implemented (`societies.reservation_meal_types`; editor on **`/erreserba-ezarpenak`**; reservation UIs read from **`GET /api/societies/user`**; integration: **`@reservation-meal-types-restricted`** on **`reservations.feature`**, meal types PUT on **`societies.feature`**)

11. **Reservation add-on services** – configurable services, checkboxes at booking, price snapshots

- **Status**: ✅ Implemented (`reservation_services`, **`selectedServices`** on **`reservations`**; **`/api/reservation-services`**; seed **`script/seed-reservation-services.ts`** in **`pnpm db:seed`** pipeline)

---

## 4. Consumptions (Kontsumoak) (`consumptions.md`)

1. **Register bar consumption (session flow)** – create session, add lines, close
   - **Status**: ✅ Implemented (`POST /api/consumptions`, `POST .../items`, `POST .../close`; stock decrement on items; **prepayment ledger floor** on create/items — see §5b.10 / `prepayment-ledger-floor.md`; **`/kontsumoak`** POS product cards show optional thumbnails from `products.imageUrl` / `_thumb.webp`, uniform card height with placeholder when no image)
2. **View consumption history (member)** – personal list
   - **Status**: ✅ Implemented (`/nire-konsumoak`, `GET /api/consumptions/user` paginated; aggregates for stat cards)
3. **Manage all consumptions (staff)** – society list/detail
   - **Status**: ✅ Implemented (`/kontsumoak-zerrenda`, `GET /api/consumptions` with role-based scope + pagination + `search`)
4. **Close consumption session**
   - **Status**: ✅ Implemented
5. **Product categories (admin)** – bilingual labels, reorder, soft delete
   - **Status**: ✅ Implemented (`/kategoriak`, `GET/POST/PUT/DELETE /api/categories`; filters on POS)
6. **Consumption categories as analytics**
   - **Status**: ❌ Not Implemented (no reporting dashboards)
7. **Inventory update from consumptions** – stock + movements
   - **Status**: ✅ Implemented (`stock_movements` with type consumption; **portion** and **recipe** lines decrement parent/ingredient stock via `postConsumptionStockDecrements`; fractional quantities supported; stock can go negative)
8. **Consumption analytics**
   - **Status**: ❌ Not Implemented
9. **Cash settlement (pending reservations / subscription) on POS** — when society cash methods enabled
   - **Status**: ✅ Implemented (`GET /api/me/pending-cash-items`, `POST /api/me/cash-settlements`, `ConsumptionsPage` pending category + cart; reservations: **`reservation`** + **`cash_payment`** double entry; cron aligns **`credits`**; E2E `consumption-cash-pending.feature`; `seedCashPosFixtures` + demo reservation)

---

## 5. Credits / Zorrak & SEPA (`credits.md`)

1. **View pending credits (member)** – personal debt view
   - **Status**: ✅ Implemented (`/nire-zorrak`, `GET /api/credits/member/current`; sidebar entry **omitted** and route **redirects to `/nire-mugimenduak`** when `sepaMode === disabled`)
2. **Monthly credit summary (treasurer/admin)** – per-month overview
   - **Status**: ✅ Implemented (`/zorrak`, `GET /api/credits` paginated + `search` + summary **`sumPending`/`sumPaid`**; sidebar **omitted** and route **redirects to `/mugimenduak`** when `sepaMode === disabled`; tighten `societyId` filters in API for multi-tenant hardening)
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
    - **Status**: 🟡 Partial (**CSV** member account statement + treasurer member-balance snapshot via ledger APIs / movements pages; **no** PDF, **no** YTD bundle export)

---

## 5b. Account movements / ledger (`account-movements.md`)

**Implementation note:** Ledger writes are centralized in [`server/lib/ledger/ledger-service.ts`](../../server/lib/ledger/ledger-service.ts) (Drizzle transactions for multi-step flows), with pure helpers in [`server/lib/ledger/ledger-rules.ts`](../../server/lib/ledger/ledger-rules.ts). **Vitest** unit tests: `pnpm test:unit`. **SEPA bounce** rows use `account_movements.reference_type = "sepa_bounce"` (and `reference_id = credit.id`) so idempotency matches API checks.

1. **Member movement list & balance** – `/nire-mugimenduak`, `GET /api/account-movements/me`
   - **Status**: ✅ Implemented (+ pagination; **`total`/`sumAmount`** for period stat cards; balance status; E2E: ledger smoke via `bank-transfers.feature` / `refunds.feature` on `/nire-mugimenduak`)
2. **Treasurer movement audit** – `/mugimenduak`, `GET /api/account-movements` (filters, running balance via SQL window; response includes `sumAmount`, `selectedMemberBalance` when a member filter is set)
   - **Status**: ✅ Implemented (+ **pagination** in UI; top stat cards: filtered count, filtered sum, member saldo when filtered)
3. **Prepayment proposals** (UI: «Aurreordainketak» / Anticipos; impl. `bank_transfers`, `bank_transfer` ledger type) – `/transferentziak`, `POST/GET /api/bank-transfers` (**paginated** `{ data, total }`; UI requests **`status=pending`**), validate/reject + ledger + notifications; members propose from **`/nire-mugimenduak`** via `POST` + `GET /api/bank-transfers/me?status=pending` (table only when pending; validated lines on ledger — see `account-movements.md` F1 / F4); **gated when `bank_transfer_prepayment` is absent from society `payment_methods`** (sidebar, pages, APIs `403`)
   - **Status**: ✅ Implemented (+ E2E: `bank-transfers.feature`, `society-payment-methods.feature` for prepayment gating)
4. **Refunds** – dialog on **`/transferentziak`** (treasurer prepayments page); `POST /api/account-movements/refund`; **`/itzulketak`** redirects to **`/transferentziak`**
   - **Status**: ✅ Implemented (+ E2E: `refunds.feature`)
5. **SEPA collection on ledger** – `sepa_collection` movement (**positive** `amount` in member-balance convention) when marking credits paid (`PUT /api/credits/batch-status`)
   - **Status**: ✅ Implemented
6. **SEPA bounce** – `POST /api/account-movements/sepa-bounce`, **`/zorrak` action column when `sepaMode` is not `disabled`** (+ E2E: `sepa-bounce.feature`); bounce posts **negative** `amount` to reverse collection
   - **Status**: ✅ Implemented
7. **Consumption / reservation lines on ledger** – movements on item add; reservation ledger charge after **`startDate`** (cron); cash settlement double entry; cancellation/deletion adjustments (`reservation_cancel` / `reservation_cash_cancel` when applicable)
   - **Status**: ✅ Implemented
8. **Subscription fees on ledger** – `DebtCalculationService` posts `subscription` movement + `credits.subscription_amount` for all societies (including **`sepaMode` = `disabled`**); `disabled` affects SEPA export only
   - **Status**: ✅ Implemented (multi-tenant cron + per-society real-time triggers; see `server/cron-jobs.ts`)
9. **Prepayment minimum ledger balance** – optional `prepaymentMinLedgerBalance` on `societies` when `bank_transfer_prepayment` is enabled; `GET /api/me/prepayment-ledger-status`; server enforcement on reservation create + consumption create/items; `notifyFinancialEvent` when a debit crosses from at/above floor to below; member `PrepaymentLedgerBanner` + treasurer field on **`/elkartea`**
   - **Status**: ✅ Implemented (see `prepayment-ledger-floor.md`; E2E: `prepayment-ledger-floor.feature`, scripts `db:seed:prepayment-floor-e2e` / `db:undo:prepayment-floor-e2e`)
10. **Period account statement & balances (CSV)** — `GET /api/account-movements/me/statement`, `GET /api/account-movements/statement`, `GET /api/account-movements/society-statement` (treasurer, all members in range), `GET /api/account-movements/balances`; opening/closing balance + period movements + per-type summary; society-wide flat extract without running balance; **`/nire-mugimenduak`** and **`/mugimenduak`** download buttons (treasurer dialog: whole-society or single-member statement); helpers in `server/lib/account-movements.ts` (`getMemberBalanceBeforeMonth`, `getMemberBalanceThroughMonth`, `getAllMemberBalances`); `computeRunningBalancesWithInitial` in `ledger-rules.ts`
    - **Status**: ✅ Implemented (see `account-movements.md` F10; PDF not in scope)
11. **Future (spec only):** period closing, transfer attachments, PDF statements, two-step refund approval — see `account-movements.md`
12. **Society accounting (Kontabilitatea)** — [`society-transactions.md`](./society-transactions.md)
    - **Status**: ✅ Implemented — standalone page **`/kontabilitatea`**: **`society_ledger`** posted cashbook (mirrored member-ledger income/expense + manual lines + adjustments); `GET /api/society-accounting/summary` and **`/derived-movements`** (paginated **`page`/`limit`**, response **`movements` + `total`**, running balance via full-range window then **`LIMIT`/`OFFSET`**) read only from that table; manual CRUD via **`/api/society-transactions`** with fixed **`category`** keys (**`shared/society-categories.ts`**, migration **`0010_category_enum.sql`**); **`Permission.SOCIETY_TRANSACTIONS_MANAGE`**; **`server/lib/society-ledger.ts`** as write gateway from app code; **`0009_society_ledger.sql`** + **`0010_category_enum.sql`**; E2E: `society-accounting.feature`

---

## 6. Communication – Oharrak & Jakinarazpenak (`communication.md`)

> **Shipped scope:** Oharrak are **DB-backed notes** (`notes` / `note_messages`, `/api/notes`, `/oharrak`). **Jakinarazpenak** (`/jakinarazpenak`, `/api/notifications`) are separate.

### Notes (Oharrak)

1. **Create notes** – multilingual title/body (eu/es)
   - **Status**: ✅ Implemented (`notes` + `note_messages`, `POST /api/notes`, admin UI `/oharrak`)
2. **View notes** – read society notices
   - **Status**: ✅ Implemented (dashboard `RecentNotes`, **active-notes read-only** `/oharrak` for any authenticated member; admin keeps full management UI)
3. **Note management** – edit/delete
   - **Status**: 🟡 Partial (CRUD; no archive/expiry/analytics as in original epic)

### Notifications (Jakinarazpenak)

4. **In-app notifications** – list/read DB notifications
   - **Status**: ✅ Implemented (`/jakinarazpenak` in main sidebar for all members, `notifications` + `notification_messages`; bell deep-links note pushes to the inbox unless the user can manage notes)

### Email & preferences

5. **Email notifications & per-user communication preferences**
   - **Status**: ✅ Implemented — `users.notify_email` (default on), `users.communication_language` (eu/es/en), `PUT /api/users/:id/profile` + `/profila`; `server/lib/mail` (nodemailer, `sendRawEmail`, `queueUserNotificationEmail` after notification inserts); env `EMAIL_ENABLED`, `SMTP_*`, `MAIL_FROM` (see `.env.example`, installation guide)

### Templates, analytics (backlog)

6. **Notification templates, communication analytics & history (legacy epic)**
   - **Status**: ❌ Not Implemented

---

## 7. Inventory Management (Produktuak) (`inventory.md`)

1. **Add / update / view products**
   - **Status**: ✅ Implemented (`/produktuak`, `/api/products` CRUD; cellarman-gated UI; **`products.stock_mode`** `auto` / `manual` / `none`; **`products.purpose`** `sale` / `internal` / `both`; **bulk ↔ portion** link (`parent_product_id`, `parent_units_per_sale`); **composite recipes** (`product_recipe_lines`, `GET/PUT /api/products/:id/recipe`); list includes **`recipeLineCount`**; **predefined catalog product images** (picker on create + edit; `POST`/`PUT` `imageUrl` for allowlisted `/catalog/products/*`); POS uses **`GET /api/products?forPos=true`** — see `inventory.md` taxonomy epic)
2. **Product categories**
   - **Status**: ✅ Implemented (see Consumptions §5; `/kategoriak`)
3. **Stock management & movements**
   - **Status**: 🟡 Partial (`GET /api/stock-movements`, `POST /api/products/:id/adjust`, UI **`/stock-aldaketak`** with filters + **pagination**; consumption creates **consumption** movements for **`stock_mode = auto`** (line SKU or cascaded parent/ingredients); **`stock_movements.quantity`** as text (fractional deltas); **purchase** / **adjustment** from receipts & stock takes; receipts **reject** portion/composite lines — see `inventory.md`)
4. **Low stock awareness**
   - **Status**: ✅ Implemented (`minStock` + **`ProductsPage`** emphasis; **`products.low_stock_notified`** + `refreshLowStockNotificationForProduct` after stock/threshold-related changes; in-app `notifyFinancialEvent` to admin/cellarman; **`GET /api/products/low-stock-summary`**; dashboard widget for **`products.manage`**)
5. **Supply receipts (hornidurak)**
   - **Status**: 🟡 Partial (`POST` / `GET /api/stock-receipts` with optional **`month`**, **`supplier`**, **`reference`** query filters + **`GET /api/stock-receipts/:id`**, UI **`/hornidurak`** with list filters + per-receipt detail modal (all lines); **no** supplier entity / POs — see `inventory.md`)
6. **Physical stock take (inbentarioa)**
   - **Status**: ✅ Implemented (`stock_takes` / `stock_take_lines`, **`/inbentarioa`**, finalize → `stock_movements` **adjustment** for counted lines only; **portion and composite SKUs excluded** from new takes; decimal counted quantities; partial inventory / no need to count every SKU — see `inventory.md` stock-take story)
7. **Inventory analytics & optimization**
   - **Status**: ❌ Not Implemented
8. **Demo seed (inventory taxonomy examples)**
   - **Status**: ✅ Implemented (`script/seed-inventory-taxonomy.ts` via `seed-products.ts`; bulk oil, draft beer sizes, txakoli glass, gintonic, kalimotxo, menu bundle, internal cleaning SKU; category **Garbiketak**)

---

## 8. Society Management (Elkartea) (`society-management.md`)

1. **Society information & SEPA-related fields**
   - **Status**: 🟡 Partial (`/elkartea`, `GET /api/societies/user`, `PUT /api/societies/:id` — **administratzailea** + **diruzaina** own-tenant; society **`shortDescription`** + **`acronym`** (1–3 letters; auto-derived from name in the browser until manually edited; sidebar header shows acronym in the circle and description under the name); **`reservation_meal_types`** (meal slot ids + EU/ES labels for reservations); **`payment_methods`** on societies: SEPA checkbox + cadence, bank prepayment + cash placeholders; **optional `prepaymentMinLedgerBalance`** (prepayment-only UI) for max-debt / minimum-balance enforcement on ledger debits; prepayment gates transfers UI/API; cash methods stored only; E2E: `society-payment-methods.feature` for cash flag persistence)
2. **Society logo, reservation map, user avatars, product images**
   - **Status**: ✅ Implemented — DB: `societies.logoUrl`, `societies.mapImageUrl`, `users.avatarUrl`, `products.imageUrl` (tenant upload: bare `.webp` name; **or** static path `/catalog/products/*.png` from `client/public/catalog/products/`); disk: `UPLOADS_DIR` (default `./uploads`), WebP + `_thumb` via **sharp**; **`POST /api/images/upload`** + **`DELETE /api/images/:entity/:entityId`** (society-logo / society-map / user-avatar / product-image); **`GET /api/images/:societyId/:file`** via `express.static`; **`POST /api/products`** optional `imageUrl` (catalog only); **`PUT /api/products/:id`** optional `imageUrl` (catalog or upload filename, clears old upload files when replaced); UI: predefined **catalog image picker** + upload on **`/produktuak`** (create + edit), treasurer/admin uploads on **`/elkartea`** (incl. society map), member avatar on **`/profila`**, logo in sidebar; shared allowlist: **`shared/product-catalog-images.ts`**; demo: **`script/seed-products.ts`** (catalog images on several SKUs) + **`script/seed-images.ts`** + optional **`script/seed-assets/images/`**
3. **Tables (resource config for reservations)**
   - **Status**: ✅ Implemented (`/mahaiak` — see Reservations)
4. **Subscription types**
   - **Status**: ✅ Implemented (`/subscriptions`, `subscription_types` table)
5. **Rules, policies, role transfers, operating hours, compliance, backup UX**
   - **Status**: ❌ Not Implemented
6. **Admin go-live setup checklist**
   - **Status**: ✅ Implemented (`GET /api/societies/setup-checklist` — **admin** only; collapsible **`SocietySetupGuide`** banner under the main header with EU/ES copy, deep links to **`/elkartea`**, **`/kategoriak`**, **`/produktuak`**, **`/mahaiak`**, **`/erabiltzaileak`**; items derived from tenant data — contact, SEPA readiness, active categories/products, tables with capacities, ≥2 active users, subdomain when `TENANT_APEX_DOMAIN` is set; optional dismiss when all done — `integration/features/society-setup-checklist.feature`)

---

## 9. Internationalization (Euskara/Castellano) (`internationalization.md`)

1. **Primary language (Euskara)**
   - **Status**: ✅ Implemented (`client/src/lib/i18n.ts`, default eu)
2. **Secondary language (Castellano)**
   - **Status**: ✅ Implemented (toggle, `localStorage`; some hardcoded strings remain in components)
3. **Language preference beyond SPA keys**
   - **Status**: 🟡 Partial (no profile-synced locale; server i18n middleware influences API messages; DB-backed bilingual content for categories/notes)
4. **Locale-aware date and time display**
   - **Status**: ✅ Implemented (`client/src/lib/date-locale.ts`: app language maps to `eu-ES` / `es-ES` for `Intl` formatting + shared `date-fns` locales; `useFormattedDates()` in components)
5. **Workflows, analytics, QA tooling (stories 3–8, 11–12)**
   - **Status**: ❌ Not Implemented

---

## 10. User profile (`user-profile.md`)

Documented alongside auth; shipped as `/profila` with profile edit + password change + **communication preferences** (email notifications on/off, communication language for emails) — see Authentication §3–4 and `user-profile.md`.

---

## 11. Platform backoffice (not in legacy story index)

- **Superadmin login, society list, superadmin users** (`/elkarteapp/kudeaketa/*`): Implemented (separate cookie; `superadmins` table)
- **SMTP validation (superadmin)** — `GET /api/backoffice/email/status` (env flags, no secrets), `POST /api/backoffice/email/test` (verify + test send), UI `/elkarteapp/kudeaketa/email`: ✅ Implemented
- **Per-society tenant subdomain** (`societies.subdomain`, `PATCH /api/backoffice/societies/:id`, check-subdomain endpoint, backoffice UI): ✅ Implemented — see [`subdomain-tenancy.md`](./subdomain-tenancy.md)

## 12. Public marketing landing (not in legacy story index)

- **Bilingual landing page** (`/` when logged out, alias `/hasiera`): ✅ Implemented (`client/src/landing/`: copy + `useLandingI18n` in `i18n.ts`, locale in `localStorage` key **`landing:locale`** — independent of app `client/src/lib/i18n.ts` / **`language`**; **member login** at `/sartu` when multitenancy is **off**; unauthenticated deep links redirect to `/sartu` in that mode; **on a configured tenant subdomain**, landing is skipped and `/` + `/hasiera` redirect to `/sartu`; **when `TENANT_APEX_DOMAIN` is set**, apex/`www` is marketing-only: primary CTA **create society**, secondary **access** at **`/elkartea-sartu`** (URL help + **`POST /api/public/society-access-urls`**), **`/sartu`** redirects there, **`POST /api/login`** from apex returns **403** — see [`subdomain-tenancy.md`](./subdomain-tenancy.md))
- **Public self-serve society signup** (`/sortu-elkartea`, email verification `/egiaztatu-posta`, `POST /api/public/society-signup`, `GET /api/public/check-subdomain`, `GET /api/public/verify-email`): ✅ Implemented — see [`public-society-signup.md`](./public-society-signup.md). Provisioning includes default catalog + table bootstrap (shared with **`POST /api/backoffice/societies`** via `server/lib/society-provision.ts`). After schema upgrade, run **`pnpm db:backfill:email-verified`** (or **`pnpm db:seed`**) so existing demo users keep login.

---

## Notes for Future Work

- Harden multi-tenant queries (e.g. credits list/export, product mutations) with explicit `societyId` WHERE clauses where missing.
- Align treasurer vs administratzailea access for society `PUT`, Zorrak UI, and `/elkartea`.
- Replace or wire SEPA XML creditor metadata to `societies` fields.
- Keeping this file in sync with `docs/features/*.md` remains the shipped-truth tracker for product and engineering.
