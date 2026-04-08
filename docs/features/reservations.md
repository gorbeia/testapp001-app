# User Stories: Reservations (Erreserbak)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#3-reservations-erreserbak-reservationsmd)

## Epic: Table and Equipment Reservations

### Story 1: Create Reservation

**As a** Bazkidea or Laguna  
**I want to** reserve a table (and optional kitchen use) for an event  
**So that** I can organize activities and ensure availability

**Acceptance Criteria:**

- **Society-wide bookings** visible on **`/egutegia`** (month grid + agenda list + create flow); see [`society-calendar.md`](./society-calendar.md)
- Button/dialog to create a new reservation
- **One table** selected from **`/api/tables/available`** (options may be disabled when guest count is outside min/max capacity)
- **Event types** stored as `type` string: `bazkaria`, `afaria`, `askaria`, `hamaiketakako` (UI labels from i18n)
- **Kitchen use** is a single boolean **`useKitchen`** (not separate equipment: griddle, ovens, etc.)
- **Guests** count (integer); **Name/title** for the reservation (`name` field)
- **Date**: single `startDate` timestamp (date picker in UI; time follows browser/local Date handling)
- **Conflict rule (server)**: same table **name**, same `startDate` (exact instant), same `type`, among non-cancelled rows — server does not implement broader overlap ranges
- **Cost (client-calculated, stored as sent):**  
  `totalAmount = guests × reservationPricePerMember + (useKitchen ? guests × kitchenPricePerMember : 0)`  
  Rates come from the **`societies`** row (`reservationPricePerMember`, `kitchenPricePerMember`), editable under `/elkartea` where API allows
- New reservations are persisted with **`status`** defaulting to **`confirmed`** via API
- Event-day consumptions are **not** part of this flow; they are normal bar consumptions later

---

### Story 2: View My Reservations

**As a** Bazkidea or Laguna  
**I want to** see my upcoming and past reservations  
**So that** I can manage my planned events

**Acceptance Criteria:**

- **Shipped**: `MyReservationsPage` at `/nire-erreserbak`, backed by `GET /api/reservations/user`
- Table/list with filters (status, type, month search pattern per implementation)
- Detail view with cost breakdown (UI recomputes breakdown from society rates for display; may differ if rates changed after booking)
- Creator can cancel upcoming **pending/confirmed** reservations per UI rules; cancellation uses `PUT /api/reservations/:id` with cancellation fields
- ❌ Export personal reservation list — **not verified / not a first-class feature** in PRD scope (refine if E2E/product requires it)

---

### Story 3: Reservation “calendar”

**As a** Bazkidea or Laguna  
**I want to** see a calendar of all reservations  
**So that** I can plan around existing bookings

**Status:**

- **Shipped:** society calendar at **`/egutegia`** — month grid with **society events** + **reservations** (see [`society-calendar.md`](./society-calendar.md)); data via **`GET /api/society-events?month=`** and **`GET /api/reservations?forCalendar=true&month=`**
---

## Epic: Reservation Management (Administratzailea)

### Story 4: Manage All Reservations

**As an** Administratzailea (UI); Diruzaina (partial API behaviour)  
**I want to** view and manage society reservations  
**So that** I can coordinate resources and resolve conflicts

**Acceptance Criteria:**

- **Shipped (partial UI)**: `AdminReservationsPage` at **`/admin-erreserbak`** — society list, filters, detail, cancel (with reason when cancelling another user’s booking)
- **SPA access**: page is **`administratzailea` only**; `GET /api/reservations` elsewhere may treat **diruzaina** like admin for query scoping — product may want to align UI + API
- ❌ Edit-in-place (change date, table, guests without cancel/recreate) — **not implemented**
- ❌ Dedicated conflict-resolution workspace beyond create-time duplicate check — **not implemented**

---

### Story 5: Resource Configuration

**As an** Administratzailea  
**I want to** configure tables and pricing inputs  
**So that** the reservation system reflects capacity

**Acceptance Criteria:**

- **Tables**: **`/mahaiak`** — CRUD for table **name**, **minCapacity**, **maxCapacity**, **isActive** (`/api/tables`, admin middleware). **Note:** `tables` are **not** `societyId`-scoped in schema today — multi-tenant hardening may be required
- **Pricing**: per-guest and per-guest-kitchen **decimals on `societies`**, edited via **`/elkartea`**
- ❌ Separate inventory for “ovens / grills” etc. — **not implemented** (only `useKitchen` flag)
- ❌ Time-slot rules engine — **not implemented**

---

## Epic: Reservation Costs

### Story 6: Cost Calculation

**As a** Bazkidea or Laguna  
**I want to** see the costs associated with my reservation  
**So that** I can understand the financial commitment

**Acceptance Criteria:**

- Live total in create dialog from formula in Story 1
- Breakdown in detail UI uses same guest × rate model
- ❌ Server-side recomputation / validation of `totalAmount` on `POST` — **not implemented** (client-sent value is stored)
- ❌ Receipt generation — **not implemented**

---

### Story 7: Cost Integration with Credits

**As a** system  
**I want to** include reservation amounts in monthly member debt  
**So that** accounting stays aligned with bookings

**Acceptance Criteria:**

- **Shipped:** monthly **`credits.reservationAmount`** (and totals) are populated by **`DebtCalculationService`** from `reservations.totalAmount` for rows whose **`startDate` falls in that month and is not in the future** (relative to calculation time), **not** `cancelled`, and without a **`reservation_cash`** settlement (excluded from SEPA-facing totals) — see `server/cron-jobs.ts`.
- **Shipped:** the member ledger posts a **`reservation`** movement (**negative** amount) only **after** that date has passed (same cron pass), idempotent per reservation id; **no** charge at **`POST /api/reservations`**.
- **Shipped:** cancel/delete posts **`reservation_cancel`** (**adjustment**, positive) only if a **`reservation`** charge exists; if the reservation was paid in cash at the bar, **`reservation_cash_cancel`** (**adjustment**, negative) reverses the cash leg — see [account-movements.md](./account-movements.md) F7b.

---

## Related routes (reference)

| Path                | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `/egutegia`         | Society calendar + reservations + create      |
| `/nire-erreserbak`  | Own reservations                             |
| `/admin-erreserbak` | Admin management UI                          |
| `/mahaiak`          | Tables CRUD                                  |
| `/elkartea`         | Society fields including reservation pricing |
