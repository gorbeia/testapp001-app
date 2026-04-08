# User Stories: Society Calendar (Egutegia)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) (§3 Reservations — story **9. Society calendar**).

## Epic: Society-wide calendar

### Story 1: View calendar with events and reservations

**As a** member  
**I want to** see society calendar events and reservations in a month view  
**So that** I can plan around closures, parties, and existing bookings

**Acceptance criteria:**

- Month grid at `/egutegia` with indicators for days that have society events and/or reservations
- Tap/click a day opens a panel listing society events (title, type, time range, blocking flags) and reservations that day
- Data: `GET /api/society-events?month=YYYY-MM`, `GET /api/reservations?month=YYYY-MM&forCalendar=true` (society-scoped; includes past dates in the month for all authenticated members)

---

### Story 2: Define society events (admin / treasurer)

**As an** administratzailea or diruzaina  
**I want to** create and edit calendar entries  
**So that** the society can record closures, parties, assemblies, maintenance, etc.

**Acceptance criteria:**

- `Permission.CALENDAR_MANAGE` required for `POST`, `PUT`, `DELETE` on `/api/society-events`
- Fields: title, type (`closure` | `party` | `assembly` | `maintenance` | `other`), full-day vs time range, optional notes
- Blocking options: `blocksAllReservations`, `blocksKitchen`, `blockedTableIds` (table UUIDs in tenant)
- Full-day rows normalized server-side to local start/end of day for start/end dates

---

### Story 3: Hard block reservations when calendar says so

**As a** system  
**I want to** reject reservation creation when it conflicts with a blocking calendar event  
**So that** resource rules are enforced consistently

**Acceptance criteria:**

- On `POST /api/reservations`, if reservation `startDate` falls within a society event interval:
  - `blocksAllReservations` → **409** with localized message
  - `blocksKitchen` and reservation `useKitchen` → **409**
  - `blockedTableIds` contains the table id for the reservation’s table name → **409**
- Assembly / informational events: leave all blocking flags false → reservations allowed
- `ReservationDialog` prefetches `GET /api/society-events?from=&to=` for the selected day and shows warnings (server remains authoritative)

---

## Related routes

| Path | Purpose |
|------|---------|
| `/egutegia` | Calendar page |
| `GET /api/society-events` | List events (`month=YYYY-MM` or `from` + `to` ISO) |
| `GET /api/society-events/:id` | Detail |
| `POST /api/society-events` | Create (`CALENDAR_MANAGE`) |
| `PUT /api/society-events/:id` | Update (`CALENDAR_MANAGE`) |
| `DELETE /api/society-events/:id` | Delete (`CALENDAR_MANAGE`) |
| `GET /api/reservations?forCalendar=true&month=YYYY-MM` | Month reservations for calendar (max `limit` 500) |
