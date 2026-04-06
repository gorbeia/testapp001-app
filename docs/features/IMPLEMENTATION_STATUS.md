# Implementation Status – Elkartearen App User Stories

Status legend:

- ✅ Implemented (real feature: UI + some logic/persistence)
- 🟡 UI Only / Mock (front-end prototype, mock data, no real backend)
- ❌ Not Implemented

> Note: Authentication, user management, reservations, consumptions, and products are now backed by real Express + Drizzle + PostgreSQL APIs (with seed scripts). Other areas (credits/SEPA, announcements, chat, society config) still rely on mock/front-end only behavior unless noted.

---

## 1. Authentication (`authentication.md`)

1. **User Login** – Login form & auth context
   - **Status**: ✅ Implemented (real API + DB-backed credentials, E2E tested; profile data still mocked on client)
2. **Role-Based Access Control** – role-aware menus
   - **Status**: ✅ Implemented
3. **View Personal Profile** – self profile view
   - **Status**: ✅ Implemented
4. **Update Password** – change password flow
   - **Status**: ✅ Implemented

---

## 2. User Management (`user-management.md`)

1. **List users** – table with search/filter
   - **Status**: ✅ Implemented (UsersPage table + filters backed by `GET /api/users`, society-scoped to the treasurer’s `societyId`, + seeded demo users)
2. **Create a new member** – add bazkide with contact/bank details
   - **Status**: ✅ Implemented (UsersPage + real /api/users POST + DB; create dialog wired and E2E tested)
3. **Create a companion linked to a member** – add laguna linked to bazkide
   - **Status**: ✅ Implemented (create dialog supports laguna role with linked member selection)
4. **Edit user details** – update contact/role information
   - **Status**: ✅ Implemented
5. **Delete a user** – remove users
   - **Status**: ✅ Implemented
6. **Role-based access to user management** – restrict admin page access
   - **Status**: ✅ Implemented

---

## 3. Reservations (Erreserbak) (`reservations.md`)

1. **Create Reservation** – date/time, event type, resources, cost
   - **Status**: ✅ Implemented (form posts to `/api/reservations`, stored in DB with auth)
2. **View My Reservations** – list & filters
   - **Status**: ✅ Implemented (fetches `/api/reservations`, server filters by user vs admin)
3. **Manage All Reservations (Admin)** – global management
   - **Status**: 🟡 Partial (admins can list/create/update/delete via API; UI is list/create only, no approval tools)
4. **Resource Configuration** – tables, equipment, pricing
   - **Status**: ❌ Not Implemented
5. **Cost Calculation** – breakdown per resource
   - **Status**: 🟡 Partial (simple per-guest/kitchen formula in UI; stored with reservation, no backend validation)
6. **Cost Integration with Credits** – push to Zorrak
   - **Status**: ❌ Not Implemented

---

## 4. Consumptions (Kontsumoak) (`consumptions.md`)

1. **Register Bar Consumption** – product grid + cart
   - **Status**: ✅ Implemented (real products list, creates consumptions + items + closes via API, updates stock)
2. **View Consumption History** – historical list
   - **Status**: 🟡 Partial (admin list/detail via `/kontsumoak-zerrenda`; no member self-history UI)
3. **Manage All Consumptions (Sotolaria)** – global view
   - **Status**: ✅ Implemented (admin list/detail + API auth for role-based access)
4. **Close Consumption Session** – summarize & close
   - **Status**: ✅ Implemented (consumption close endpoint persists status/closedAt)
5. **Consumption Categories** – category filters & reports
   - **Status**: 🟡 Partial (category filters on products; no analytics/reporting)
6. **Inventory Update from Consumptions** – stock decrement
   - **Status**: ✅ Implemented (consumption items decrement stock and create stock movement records)
7. **Consumption Analytics** – trends, peaks, revenue
   - **Status**: ❌ Not Implemented

---

## 5. Credits / Zorrak & SEPA (`credits.md`)

1. **View Pending Credits (Bazkidea)** – personal debt view
   - **Status**: 🟡 UI Only / Mock
2. **Monthly Credit Summary (Diruzaina)** – per-month overview
   - **Status**: 🟡 UI Only / Mock
3. **Credit Reset After Payment** – reset to zero
   - **Status**: ❌ Not Implemented
4. **Generate SEPA List** – list for SEPA export
   - **Status**: ❌ Not Implemented
5. **SEPA Data Validation** – IBAN/creditor validation
   - **Status**: ❌ Not Implemented
6. **Society Information for SEPA** – creditor config
   - **Status**: ❌ Not Implemented (only env placeholders)
7. **Payment Status Tracking** – sent/paid/rejected
   - **Status**: ❌ Not Implemented
8. **Credit Notifications** – notify members
   - **Status**: ❌ Not Implemented
9. **Financial Dashboard** – KPIs & charts
   - **Status**: 🟡 UI Only / Mock (simple cards over mocks)
10. **Export Financial Reports** – statements, YTD, etc.
    - **Status**: ❌ Not Implemented

---

## 6. Communication – Oharrak & Txata (`communication.md`)

### Announcements (Oharrak)

1. **Create Announcement** – admins post notices
   - **Status**: 🟡 UI Only / Mock
2. **View Announcements** – list & read
   - **Status**: 🟡 UI Only / Mock
3. **Announcement Management** – edit/delete/archive
   - **Status**: ❌ Not Implemented

### Chat (Txata)

4. **Send Messages** – 1:1 / group messages
   - **Status**: 🟡 UI Only / Mock (local state only)
5. **Receive Messages** – conversations
   - **Status**: 🟡 UI Only / Mock (mock history)
6. **Chat Management / Moderation** – admin tools
   - **Status**: ❌ Not Implemented

### Preferences & Analytics

7–10. Notification settings, templates, analytics, history

- **Status**: ❌ Not Implemented

---

## 7. Inventory Management (Produktuak) (`inventory.md`)

Most stories here require real products/stock tables and movement logs, which are not present yet.

1. **Add / Update / View Products**
   - **Status**: ✅ Implemented (ProductsPage backed by `/api/products` CRUD + PostgreSQL)
2. **Stock Management & Movements**
   - **Status**: 🟡 Partial (stock decremented and movements recorded on consumptions; no UI for movements, no purchase/adjust flows)
3. **Purchases & Suppliers**
   - **Status**: ❌ Not Implemented
4. **Inventory Analytics & Optimization**
   - **Status**: ❌ Not Implemented

(Exact sub-story breakdown should be refined once the ProductsPage and related backend are implemented.)

---

## 8. Society Management (Elkartea) (`society-management.md`)

All these stories depend on dedicated tables and admin UIs; currently only environment placeholders exist.

1. **Society Information & SEPA Config**
   - **Status**: ❌ Not Implemented (env template only)
2. **Rules, Policies, Role Assignment/Transfer**
   - **Status**: ❌ Not Implemented
3. **Operating Hours, Resources, Fees**
   - **Status**: ❌ Not Implemented
4. **Statistics, Compliance, Backup/Recovery**
   - **Status**: ❌ Not Implemented

---

## 9. Internationalization (Euskara/Castellano) (`internationalization.md`)

1. **Primary Language (Euskara)** – full UI in EU
   - **Status**: ✅ Implemented (frontend)
2. **Secondary Language (Castellano)** – switch + translations
   - **Status**: 🟡 Partially (mechanism implemented; content completeness may vary)
     3–12. Language preferences, translation workflows, analytics, QA
   - **Status**: ❌ Not Implemented (beyond base i18n framework)

---

## Notes for Future Work

- Back-end API & database models still needed for credits/SEPA, announcements, chat, and society configuration; existing domains (auth, users, reservations, consumptions, products) should continue to be hardened and expanded.
- Once additional endpoints and tables exist, update each story here from 🟡/❌ toward ✅.
- Keeping this file in sync with `docs/features/*.md` will provide a clear roadmap and progress tracker.
