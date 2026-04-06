# Account movements & member ledger (Mugimenduak)

Movement-based ledger alongside monthly `credits` for SEPA. Positive `amount` increases member debt; negative decreases it. Balance = `SUM(amount)`.

## F1 – Bank transfer validation

**As a** treasurer/admin **I want** to record and validate incoming transfers **so that** member balances reflect payments.

### Acceptance criteria

- Treasurer/admin can create a pending bank transfer (user, amount > 0, transfer date, optional reference/notes).
- On validate: insert `account_movement` type `bank_transfer` with negative amount; link to `bank_transfers.movementId`; notify member (eu/es).
- On reject: status `rejected` + reason; notify member.
- If society `allowPositiveBalance` is false, validation/refund that would make `SUM(amount) < 0` is rejected with 400.

## F2 – Refunds

**As a** treasurer/admin **I want** to issue refunds **so that** billing errors and reimbursements are recorded.

### Acceptance criteria

- POST refund with user, amount, description; inserts type `refund` (negative amount); notifies member; same prepaid guard.

## F3 – Admin movements (`/mugimenduak`)

**As a** treasurer/admin **I want** to list all movements with filters **so that** I can audit accounts.

### Acceptance criteria

- Filters: user, month (YYYY-MM from `createdAt`), type; pagination; running balance column; tenant-scoped.

## F4 – Member movements (`/nire-mugimenduak`)

**As a** member **I want** my movement history **so that** I understand my balance.

### Acceptance criteria

- List own movements; month/type filters; current balance summary.

## F5 – SEPA collection in ledger

**When** credits are marked `paid` via batch status **then** a `sepa_collection` movement (negative, amount = credit total) is recorded per credit; idempotent (no duplicate for same credit).

## F6 – SEPA bounce

**As a** treasurer/admin **I want** to record a failed direct debit **so that** the member is charged again.

### Acceptance criteria

- Credit must be `paid`; insert `sepa_bounce` positive movement = collected amount; set credit back to `pending`; clear/stale markers as needed; notify member.

## F7 – Subscription fees

**When** monthly debt calculation runs **then** subscription charge is added to `credits.totalAmount` / `subscriptionAmount` and a `subscription` movement is posted once per member per month (idempotent key).

## F8 – Notifications

Server notifications (eu/es/en) for: transfer validated/rejected, refund issued, SEPA bounce, reservation financial charge, subscription charge.

## Society setting

- `allowPositiveBalance` (default true): when false, balance may not go below zero (no prepaid credit).

## Future improvements (out of scope)

- Period closing / locked months
- Proof-of-transfer file uploads
- PDF/CSV account statements
- Two-step refund approval for large amounts

## Month filtering

No `month` column on movements; filter with `to_char(created_at, 'YYYY-MM')`. Cron posts subscription with `createdAt` at end of billed month.
