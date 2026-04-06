# Account movements & member ledger (Mugimenduak)

Movement-based ledger alongside monthly `credits` for SEPA. Each row’s **`amount`** is the change in **member account balance** (`SUM(amount)` per member in a society).

## Sign convention (member balance)

- **Negative `amount`**: balance goes down — consumption, reservation charge, subscription charge, SEPA bounce (re-charge after failed collection).
- **Positive `amount`**: balance goes up — validated bank transfer, SEPA collection when marking a credit paid, refund, reservation cancel/delete adjustment (reversal of prior charge).
- **`SUM(amount)`** = **member balance**: negative ⇒ owes the society; positive ⇒ prepaid/credit (saldo a favor). There is **no** society flag that blocks positive balance; treasurer/admin discretion applies when validating transfers or issuing refunds.

`bank_transfers.amount`, `credits.*`, etc. keep their own “absolute money” semantics; only **`account_movements.amount`** uses this signed balance convention.

## F1 – Bank transfer validation

**As a** treasurer/admin **I want** to record and validate incoming transfers **so that** member balances reflect payments.

### Acceptance criteria

- Treasurer/admin can create a pending bank transfer (user, amount > 0, transfer date, optional reference/notes).
- On validate: insert `account_movement` type `bank_transfer` with **positive** amount equal to the transfer; link to `bank_transfers.movementId`; notify member (eu/es).
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
- When society **`sepaMode` is `disabled`**, this page is the primary member money view: **`/nire-zorrak`** redirects here and the dashboard card shows this same balance (see `credits.md` Story 1 / Story 6).

## F5 – SEPA collection in ledger

**When** credits are marked `paid` via batch status **then** a `sepa_collection` movement (**positive** amount = credit total) is recorded per credit; idempotent via `referenceType` / `referenceId` on the credit (no duplicate for same credit).

## F6 – SEPA bounce

**As a** treasurer/admin **I want** to record a failed direct debit **so that** the member is charged again.

### Acceptance criteria

- Credit must be `paid`; insert `sepa_bounce` **negative** movement for the collected amount (reverses the collection in balance terms); set credit back to `pending`; notify member.

## F7 – Subscription fees

**When** monthly debt calculation runs **then** subscription charge is added to `credits.totalAmount` / `subscriptionAmount`. A `subscription` ledger movement (**negative** amount) is posted once per member per month when `subscriptionCharge > 0` (idempotent key). This applies to **all** `sepaMode` values, including **`disabled`**: the fee hits **member balance** (saldoa); **`sepaMode: disabled`** only turns off in-app SEPA XML export, not ledger subscription charges.

## F8 – Notifications

Server notifications (eu/es/en) for: transfer validated/rejected, refund issued, SEPA bounce, reservation financial charge, subscription charge.

## Society setting

- `sepaMode`: when `disabled`, SEPA export and related UI/API are off; **`subscription` ledger movements and subscription charge notifications still run** when debt calculation posts a subscription fee (see `credits.md`). Monthly **credits** list UIs (**`/nire-zorrak`**, **`/zorrak`**) are not shown; use member **`/nire-mugimenduak`** and treasurer **`/mugimenduak`** for balances and audit.

## Data migration

Flipping from a legacy debt-oriented convention to member balance is done with:

`UPDATE account_movements SET amount = (-1) * amount::numeric`

(see `migrations/0001_flip_account_movement_amounts.sql`). Run **with** the code that writes the new sign convention in the same release window.

## Future improvements (out of scope)

- Period closing / locked months
- Proof-of-transfer file uploads
- PDF/CSV account statements
- Two-step refund approval for large amounts

## Month filtering

No `month` column on movements; filter with `to_char(created_at, 'YYYY-MM')`. Cron posts subscription with `createdAt` at end of billed month.
