# Society accounting (Kontabilitatea)

Treasurer-facing **income vs expenses** view on standalone **`/kontabilitatea`** («Kontabilitatea»). Member-level movements stay on **`/mugimenduak`** («Mugimendu guztiak»).

## Behavior

### Society posted ledger (`society_ledger`)

All society cashbook lines (member-ledger mirror + manual entries + manual adjustments) live in **`society_ledger`**. Society balance for the treasurer view is **`sum(amount)`** per society (positive = money in, negative = out). Derived member-ledger events are **mirrored** into this table when `account_movements` rows are posted (prepayment, SEPA collection, cash payment, refund, SEPA bounce). Internal member-only movements (consumption, reservation charge, etc.) **do not** post here.

Manual supplier/misc lines are **`manual_income` / `manual_expense`** rows. Editing an entry may post a **`manual_adjustment`** delta; deleting posts a reversal and marks the original **`voided`**.

| Source   | Ledger `type`                                   | Convention in `society_ledger` |
| -------- | ----------------------------------------------- | ------------------------------ |
| Income   | `prepayment`, `sepa_collection`, `cash_payment` | Positive `amount`              |
| Expenses | `refund`, `sepa_bounce`                         | Negative `amount`              |

Month bucket for summary/movements: **`booking_date`** as `YYYY-MM` (derived lines use the movement booking date; manual lines use the treasurer-chosen date).

### Manual entries

- Storage: **`society_ledger`** only; manual lines use column **`category`** (text key, nullable on mirrored rows). Allowed keys are the fixed set in **`shared/society-categories.ts`** (`suppliers`, `services`, `maintenance`, `other_expense`, `events`, `other_income`). Labels are translated in the client via **`client/src/lib/i18n.ts`** (`catSuppliers`, …).
- **Manage** permission: `SOCIETY_TRANSACTIONS_MANAGE` (treasurer + admin). View summary and lists: `MOVEMENTS_VIEW`.

### API

- `GET /api/society-accounting/summary?from=YYYY-MM&to=YYYY-MM` — JSON summary from **`society_ledger`** only (derived types, manual by **`category`** key, optional **`adjustmentIncome` / `adjustmentExpense`** from **`manual_adjustment`**).
- `GET /api/society-accounting/derived-movements?from=YYYY-MM&to=YYYY-MM&page=&limit=` — ordered lines from **`society_ledger`** with running **`societyBalance`** (computed over the full **`from`–`to`** range, then paginated); response **`movements`**, **`total`**, **`page`**, **`limit`**; **`source`**: `ledger` | `manual` | `adjustment`; joins **`account_movements` + `users`** for derived lines; **`category`** / **`categoryType`** on manual and adjustment rows when set.
- `GET|POST|PUT|DELETE /api/society-transactions` — manual list/CRUD backed by **`society_ledger`** (URL unchanged). Body uses **`category`** (enum key), not UUIDs. List query filters: **`category`**, **`type`** (`income` | `expense`), month/range, pagination.

### UI

- [client/src/pages/SocietyAccountingPage.tsx](../../client/src/pages/SocietyAccountingPage.tsx) — route **`/kontabilitatea`**; wraps `SocietyAccountingTab`.
- [client/src/pages/AccountMovementsPage.tsx](../../client/src/pages/AccountMovementsPage.tsx) — treasurer member movements only.
- [client/src/components/SocietyAccountingTab.tsx](../../client/src/components/SocietyAccountingTab.tsx) — period; tabs: **summary** (stat cards, summary table, CSV) and **movements** (ledger + manual + adjustments, society running balance, add/edit/delete manual lines).

### Migrations

- **`0009_society_ledger.sql`** — introduces **`society_ledger`** (historical; may reference legacy category table in older DBs).
- **`0010_category_enum.sql`** — replaces per-society category table with fixed keys on **`society_ledger.category`**.

## User stories

**As a** treasurer **I want** a summary of society income and expenses **so that** I can prepare annual accounts.

- **Acceptance:** Summary shows derived lines by type plus manual categories; period range; CSV download.

**As a** treasurer **I want** to record supplier and other expenses **so that** they appear alongside money from members.

- **Acceptance:** Manual expense/income CRUD with categories; entries listed for the selected period.

## Future (not in scope)

- Stock receipt auto-post to a category (see plan phase 1.5).
- Bank reconciliation / statement import.
