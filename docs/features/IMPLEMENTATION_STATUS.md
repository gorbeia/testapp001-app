# Implementation Status – Elkartearen App User Stories

Status legend:
- ✅ Implemented (real feature: UI + some logic/persistence)
- 🟡 UI Only / Mock (front-end prototype, mock data, no real backend)
- ❌ Not Implemented

> Note: Most domain features still use frontend mock data, but **authentication login is now wired to a real API and PostgreSQL users table**, with a seed script and E2E tests. Other areas that talk about credits/reservations/etc. remain mock-only unless noted.

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
   - **Status**: ✅ Implemented (UsersPage table + filters backed by /api/users GET + seeded demo users)
2. **Create a new member** – add bazkide with contact/bank details
   - **Status**: ✅ Implemented (UsersPage + real /api/users POST + DB; create dialog wired and E2E tested)
3. **Create a companion linked to a member** – add laguna linked to bazkide
   - **Status**: ✅ Implemented (create dialog supports laguna role with linked member selection)
4. **Edit user details** – update contact/role information
   - **Status**: ✅ Implemented
5. **Delete a user** – remove users
   - **Status**:  ✅ Implemented
6. **Role-based access to user management** – restrict admin page access
   - **Status**: ✅ Implemented

---

## 3. Reservations (Erreserbak) (`reservations.md`)

1. **Create Reservation** – date/time, event type, resources, cost
   - **Status**: 🟡 UI Only / Mock
2. **View My Reservations** – list & filters
   - **Status**: 🟡 UI Only / Mock
3. **Reservation Calendar** – calendar overview
   - **Status**: ❌ Not Implemented
4. **Manage All Reservations (Admin)** – global management
   - **Status**: ❌ Not Implemented
5. **Resource Configuration** – tables, equipment, pricing
   - **Status**: ❌ Not Implemented
6. **Cost Calculation** – breakdown per resource
   - **Status**: 🟡 UI Only / Mock (static example)
7. **Cost Integration with Credits** – push to Zorrak
   - **Status**: ❌ Not Implemented

---

## 4. Consumptions (Kontsumoak) (`consumptions.md`)

1. **Register Bar Consumption** – product grid + cart
   - **Status**: 🟡 UI Only / Mock
2. **Register Event Consumption** – tied to reservation
   - **Status**: 🟡 UI Only / Mock (no real event linkage)
3. **View Consumption History** – historical list
   - **Status**: ❌ Not Implemented
4. **Manage All Consumptions (Sotolaria)** – global view
   - **Status**: ❌ Not Implemented
5. **Close Event Account** – summarize & close
   - **Status**: 🟡 UI Only / Mock (toast, no persistence)
6. **Consumption Categories** – category filters & reports
   - **Status**: 🟡 UI Only / Mock (basic category filter only)
7. **Inventory Update from Consumptions** – stock decrement
   - **Status**: ❌ Not Implemented
8. **Consumption Analytics** – trends, peaks, revenue
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
   - **Status**: 🟡 UI Only / Mock (product page over mock data)
2. **Stock Management & Movements**
   - **Status**: ❌ Not Implemented
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

- Back-end API & database models need to be implemented for all domains: users, reservations, consumptions, credits, announcements, chat, products, society, SEPA.
- Once real endpoints and tables exist, this file should be updated story by story from 🟡/❌ towards ✅.
- Keeping this file in sync with `docs/features/*.md` will provide a clear roadmap and progress tracker.

