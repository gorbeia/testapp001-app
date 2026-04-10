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
- **One table** selected from **`/api/tables/available`**; with optional query **`startDate`** + **`type`**, each row includes **`bookedSeats`** / **`seatsRemaining`** for the slot. Options may be disabled when guest count is outside **min/max capacity** or above **remaining seats** (partial tables).
- **Meal / event type** stored as `type` string; it must match an **`id`** from the society’s **`reservation_meal_types`** list (JSON on **`societies`**: `id`, `labelEu`, `labelEs`). Treasurers edit labels on **`/erreserba-ezarpenak`**; **at least one** of EU/ES is required per row. Defaults match the legacy set (`bazkaria`, `afaria`, `askaria`, `hamaiketakako`). Unknown types are rejected by **`POST /api/reservations`**. The UI shows the label for the member’s language, falling back to the other language when needed.
- **Add-on services** (cleaning, heating, kitchen use, custom): tenant-defined rows in **`reservation_services`** (`slug`, **`labelEu`**, **`labelEs`**, **`fixedPrice`**, **`pricePerMember`**, **`isActive`**, **`isDefault`**). **At least one** of EU/ES per row. Members select them with **checkboxes** in the create dialog; charge per line = **`fixedPrice + pricePerMember × guests`**. Built-in services **kitchen**, **cleaning**, and **heating** (default EU label **Berogailua** for heating) exist for every society (bootstrap / seed); **kitchen** is **`isDefault`** so it is pre-selected in the dialog. **`useKitchen`** on **`reservations`** is **derived** from whether the **kitchen** service is among selected snapshots (legacy column kept for older rows and integrations).
- **Guests** count (integer). **`name`** is optional in the API (stored empty when omitted); **lists and calendar** show **member + meal + date** (and legacy **`name`** when present).
- **Date**: single `startDate` timestamp (date picker in UI; time follows browser/local Date handling)
- **Conflict rule (server)**: same table **name**, same `startDate` (exact instant), same `type`, among non-cancelled rows. **Exclusive tables** (default): at most one such row. **Partial tables** (`tables.allowsPartialReservation`): multiple rows allowed if **sum(`guests`) ≤ `maxCapacity`**; each booking must satisfy **minCapacity** and not exceed remaining seats. No broader time-overlap rules.
- **Cost (server-computed on create):**  
  `totalAmount = reservationFixedFee + guests × reservationPricePerMember + Σ (fixedPrice + pricePerMember × guests)` for each selected service  
  Base fixed fee + per-guest rate from **`societies.reservationFixedFee`** and **`societies.reservationPricePerMember`**; service rates from **`reservation_services`**. **`POST /api/reservations`** accepts **`selectedServiceIds`**; **`selectedServices`** JSONB stores **per-line snapshots** (label + prices + **`lineTotal`**) at booking time. **`societies.kitchenPricePerMember`** is **kept in sync** when the **kitchen** service row is updated.
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
- Detail view with cost breakdown from **`selectedServices`** snapshots (legacy: **`useKitchen`** + society kitchen rate when snapshots empty)
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

- **Tables**: **`/mahaiak`** — CRUD for table **name**, **minCapacity**, **maxCapacity**, **`allowsPartialReservation`**, **isActive** (`/api/tables`, tenant-scoped by **`societyId`**). **Society map** for the reservation dialog: image on **`societies.mapImageUrl`** (**`/erreserba-ezarpenak`**); link in create dialog when set.
- **Pricing**: optional **fixed** base fee **`societies.reservationFixedFee`** and per-guest **`societies.reservationPricePerMember`** on **`/erreserba-ezarpenak`**; **add-on services** in **`reservation_services`**, managed on the same page (`GET/POST/PUT/DELETE /api/reservation-services`; create dialog uses **`GET /api/reservation-services`**)
- ❌ Separate inventory for “ovens / grills” etc. — **not implemented** (kitchen is one optional **service** among others)
- ❌ Time-slot rules engine — **not implemented**

---

## Epic: Reservation Costs

### Story 6: Cost Calculation

**As a** Bazkidea or Laguna  
**I want to** see the costs associated with my reservation  
**So that** I can understand the financial commitment

**Acceptance Criteria:**

- Live total in create dialog matches server formula (base + selected services)
- Breakdown in detail UI uses **`selectedServices`** snapshots when present
- **Server-side** `totalAmount` on **`POST /api/reservations`** — **implemented** (from **`selectedServiceIds`** + society base rate)
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

| Path                            | Purpose                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/egutegia`                     | Society calendar + reservations + create                                                       |
| `/nire-erreserbak`              | Own reservations                                                                               |
| `/admin-erreserbak`             | Admin management UI                                                                            |
| `/mahaiak`                      | Tables CRUD                                                                                    |
| `/elkartea`                     | Society contact, logo, **payment methods** / SEPA                                              |
| `/erreserba-ezarpenak`          | Reservation base pricing (fixed + per guest), map, meal types, **reservation add-on services** |
| `/api/reservation-services`     | Active add-ons for booking dialog (auth)                                                       |
| `/api/reservation-services/all` | All add-ons incl. inactive (`SOCIETY_MANAGE`)                                                  |
