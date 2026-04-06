# Prepayment minimum ledger balance (max debt)

> Implementation status: [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) (§5b.10, Reservations, Consumptions, Society)

## Sign convention

Aligned with [account-movements.md](./account-movements.md): member **balance** = `SUM(account_movements.amount)`. Negative balance means the member **owes** the society; positive means prepaid credit.

Society field **`prepaymentMinLedgerBalance`** (nullable decimal) is the **minimum allowed balance** (same numeric line):

- `NULL` → no enforcement (legacy behaviour).
- `-50` → balance must stay **≥ -50€** (at most **50€** debt).
- `0` → no debt allowed.

The setting applies only when **`bank_transfer_prepayment`** is present in **`societies.payment_methods`**. If prepayment is off, the floor is ignored (and the treasurer UI hides the field).

## User stories

### Story 1: Treasurer configures the floor

**As a** Administratzailea or Diruzaina  
**I want to** set an optional minimum ledger balance for prepayment-mode societies  
**So that** members cannot exceed an agreed maximum debt on the ledger

**Acceptance criteria:**

- `SocietyPage` (`/elkartea`) shows the field when the prepayment payment method is enabled; value is saved with **`PUT /api/societies/:id`** (`prepaymentMinLedgerBalance`).
- Clearing the field stores `NULL` (no floor).

### Story 2: Server enforces debits

**As the** system  
**I want to** reject reservation charges and bar consumption debits that would violate the floor  
**So that** policy is authoritative and not bypassed by the client

**Acceptance criteria:**

- **`POST /api/reservations`**: before insert, total charge is checked against current balance and floor; **`403`** with code **`prepayment_ledger_floor`** when blocked.
- **`POST /api/consumptions`**: blocked if the member is already below the floor (empty session / UX symmetry).
- **`POST /api/consumptions/:id/items`**: sum of new line totals checked before posting movements; same error shape when blocked.
- Paths that **increase** balance (validated prepayments, cash settlements, refunds, etc.) are **not** blocked by the floor.

### Story 3: Member is notified when crossing the floor

**As a** member  
**I want to** receive a notification when a debit pushes my balance below the configured floor  
**So that** I know I must top up

**Acceptance criteria:**

- In the same request that causes the crossing: if `balanceBefore >= floor` and `balanceAfter < floor`, send one financial notification to the debited user (eu/es server copy).

### Story 4: In-app banner and softer client blocks

**As a** member below the floor  
**I want** a visible banner and fewer dead-end actions  
**So that** I am guided to prepayments or my movements

**Acceptance criteria:**

- **`GET /api/me/prepayment-ledger-status`** returns `{ enforced, floor, balance, belowFloor }` for the session user.
- **`PrepaymentLedgerBanner`** under the app header when `belowFloor && enforced` (links to movements and prepayment flows).
- Reservations dialog and consumptions POS: optional disable / toast when blocked; API remains the source of truth.

## E2E

- Feature: `e2e/features/prepayment-ledger-floor.feature` (tag `@prepayment-ledger-floor`).
- A **Before** hook runs `pnpm db:seed:prepayment-floor-e2e` (sets demo society floor and normalizes demo bazkidea balance below it); **After** runs `pnpm db:undo:prepayment-floor-e2e` to restore neutral demo data for other scenarios.
- Requires PostgreSQL schema with **`prepayment_min_ledger_balance`** on `societies` (`pnpm db:push` or migration `0004_society_prepayment_min_ledger_balance.sql`).
