# Account movements & member ledger (Mugimenduak)

Movement-based ledger alongside monthly `credits` for SEPA. Each row’s **`amount`** is the change in **member account balance** (`SUM(amount)` per member in a society).

## Server implementation boundary

- **Ledger orchestration:** [`server/lib/ledger/ledger-service.ts`](../../server/lib/ledger/ledger-service.ts) — transactional posting (prepayment validate + movement, cash double-leg, SEPA collections with credit update, subscription/reservation idempotent charges, cancellation reversals, etc.).
- **Pure rules:** [`server/lib/ledger/ledger-rules.ts`](../../server/lib/ledger/ledger-rules.ts) — amount formatting, running balance for member lists, prepayment floor math (also reused from `prepayment-ledger-floor.ts`).
- **DB helpers:** [`server/lib/account-movements.ts`](../../server/lib/account-movements.ts) — balance query, insert, idempotency `movementExistsForReference` (accepts a transaction client for read-your-writes inside `db.transaction`).
- **Tests:** `pnpm test:unit` (Vitest).

**SEPA bounce idempotency:** Bounce movements store **`reference_type` = `sepa_bounce`** and **`reference_id` = credit id** (distinct from `sepa_collection`, which uses `reference_type` = `credit` on the same id).

## Sign convention (member balance)

- **Negative `amount`**: balance goes down — consumption, reservation charge, subscription charge, SEPA bounce (re-charge after failed collection).
- **Positive `amount`**: balance goes up — validated **prepayment** (`bank_transfer` movement type), SEPA collection when marking a credit paid, **cash settlement at the bar** (`cash_payment`, e.g. `reservation_cash` / `subscription_cash` reference types), refund, positive **adjustment** when cancelling/deleting a reservation that had a ledger charge (`reservation_cancel`, reverses the reservation debit).
- **Negative `amount` on `adjustment`**: e.g. `reservation_cash_cancel` — reverses a prior **cash** settlement leg when a reservation is cancelled after being paid in cash at the bar (pairs with the earlier positive `cash_payment`).
- **`SUM(amount)`** = **member balance**: negative ⇒ owes the society; positive ⇒ prepaid/credit (saldo a favor). There is **no** society flag that blocks positive balance; treasurer/admin discretion applies when validating prepayment proposals or issuing refunds.

`bank_transfers` (implementation table name for prepayment proposals), `credits.*`, etc. keep their own “absolute money” semantics; only **`account_movements.amount`** uses this signed balance convention.

## F1 – Prepayment proposals (treasurer validation)

**As a** treasurer/admin **I want** to record and validate member **prepayments** (transfer, Bizum, or whatever the society uses off-app) **so that** member balances reflect payments.

### Acceptance criteria

- Treasurer/admin can create a pending prepayment row (user, amount > 0, payment date, optional reference/notes) via `bank_transfers` / `POST /api/bank-transfers`.
- A **member** can submit a **proposal** (`POST /api/bank-transfers/me`, pending row); **`userId` is taken from the session**, not the request body.
- On validate: insert `account_movement` type `bank_transfer` with **positive** amount equal to the prepayment; link to `bank_transfers.movementId`; notify member (eu/es/en).
- On reject: status `rejected` + reason; notify member.

## F2 – Refunds

**As a** treasurer/admin **I want** to issue refunds **so that** billing errors and reimbursements are recorded.

### Acceptance criteria

- UI: treasurer **`/transferentziak`** page — “issue refund” opens a dialog (same flow as before); bookmark **`/itzulketak`** redirects to **`/transferentziak`**.
- POST refund with user, amount, description; inserts type `refund` with **positive** amount; notifies member.

## F3 – Admin movements (`/mugimenduak`)

**As a** treasurer/admin **I want** to list all movements with filters **so that** I can audit accounts.

### Acceptance criteria

- Filters: user, month (YYYY-MM from `createdAt`), type; pagination; running balance column; tenant-scoped.
- When **`sepaMode` is `disabled`**, this page is also the destination for direct navigation to **`/zorrak`** (admin monthly credits UI is not shown).

## F4 – Member movements (`/nire-mugimenduak`)

**As a** member **I want** my movement history **so that** I understand my balance.

### Acceptance criteria

- List own movements; month/type filters; current balance summary (member balance).
- Submit **prepayment** proposals from this page (`POST /api/bank-transfers/me`). **UI:** only **pending** proposals are listed (`GET /api/bank-transfers/me?status=pending`); once validated, they appear as ledger lines with movement type **`bank_transfer`** (rejected proposals are not on the ledger and are not shown in the pending table).
- When society **`sepaMode` is `disabled`**, this page is the primary member money view: **`/nire-zorrak`** redirects here and the dashboard card shows this same balance (see `credits.md` Story 1 / Story 6).

## F5 – SEPA collection in ledger

**When** credits are marked `paid` via batch status **then** a `sepa_collection` movement (**positive** amount = credit total) is recorded per credit; idempotent via `referenceType` / `referenceId` on the credit (no duplicate for same credit).

## F6 – SEPA bounce

**As a** treasurer/admin **I want** to record a failed direct debit **so that** the member is charged again.

### Acceptance criteria

- Credit must be `paid`; insert `sepa_bounce` **negative** movement for the collected amount (reverses the collection in balance terms); set credit back to `pending`; notify member.
- Idempotent: at most one bounce per credit (`reference_type` **`sepa_bounce`**, `reference_id` = credit id).

## F7 – Subscription fees

**When** monthly debt calculation runs **then** subscription charge is added to `credits.totalAmount` / `subscriptionAmount`. A `subscription` ledger movement (**negative** amount) is posted once per member per month when `subscriptionCharge > 0` (idempotent key). This applies to **all** `sepaMode` values, including **`disabled`**: the fee hits **member balance** (saldoa); **`sepaMode: disabled`** only turns off in-app SEPA XML export, not ledger subscription charges.

## F7b – Reservation charges (after table use)

**When** a member creates a reservation **no** immediate ledger line is posted. **`DebtCalculationService`** (`server/cron-jobs.ts`) posts a **`reservation`** movement (**negative** amount, idempotent per reservation id) once **`startDate` has passed** (in the calculated month), the reservation is not `cancelled`, and no charge row exists yet. This matches SEPA `credits.reservationAmount`, which only sums reservations whose **`startDate` is in the month and not in the future** (relative to the run time) and excludes rows already settled via **`reservation_cash`** for SEPA totals.

**Cash at the bar** (`POST /api/me/cash-settlements`): for a reservation, the API posts **double entry** when needed — a **`reservation`** debit (if not already present) plus a **`cash_payment`** credit with `reservation_cash` — net balance change zero, full audit trail. The deferred cron step then skips that reservation because the **`reservation`** reference already exists.

**Cancellation / delete**: if a **`reservation`** charge exists, a compensating **`adjustment`** with `reservation_cancel` is posted (positive amount). If a **`reservation_cash`** row exists, a **`reservation_cash_cancel`** **adjustment** (negative amount) reverses the cash leg.

## F8 – Notifications

Server notifications (eu/es/en) for: prepayment validated/rejected, refund issued, SEPA bounce, reservation financial charge, subscription charge, **prepayment ledger floor crossed** (debit moves balance from at/above configured floor to below).

## F9 – Prepayment minimum ledger balance

When the society enables **`bank_transfer_prepayment`** and sets **`prepaymentMinLedgerBalance`**, **reservation** create and **consumption** debits are checked **at request time** against the projected balance (the reservation check uses the booked amount even though the ledger charge is deferred until after `startDate`). Requests that would leave the member balance **below** the floor are rejected (`403`, code `prepayment_ledger_floor`). Members see status via **`GET /api/me/prepayment-ledger-status`** and an in-app banner when below the floor. See [prepayment-ledger-floor.md](./prepayment-ledger-floor.md).

## Society setting

- `sepaMode`: when `disabled`, SEPA export and related UI/API are off; **`subscription` ledger movements and subscription charge notifications still run** when debt calculation posts a subscription fee (see `credits.md`). Monthly **credits** list UIs (**`/nire-zorrak`**, **`/zorrak`**) are not shown; use member **`/nire-mugimenduak`** and treasurer **`/mugimenduak`** for balances and audit.

## Data migration

Flipping from a legacy debt-oriented convention to member balance is done with:

`UPDATE account_movements SET amount = (-1) * amount::numeric`

(see `migrations/0001_flip_account_movement_amounts.sql`). Run **with** the code that writes the new sign convention in the same release window.

## Future improvements (out of scope)

- Period closing / locked months
- Proof-of-payment file uploads
- PDF/CSV account statements
- Two-step refund approval for large amounts

## Month filtering

No `month` column on movements; filter with `to_char(created_at, 'YYYY-MM')`. Cron posts subscription with `createdAt` at end of billed month. Reservation charges use `createdAt` at end of the reservation’s **`startDate`** (local calendar day).
