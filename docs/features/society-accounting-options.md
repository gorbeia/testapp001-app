# Society-wide accounting: options and decision

This document records how we could extend Elkartetippia from the **member sub-ledger** (`account_movements`, per `userId`) to **society-level financial visibility** (all money in and out, not only member charges and payments). It is the product-facing summary of the options analysis; implementation detail may evolve.

---

## Why this matters

Today the app gives each member a ledger and the treasurer **CSV exports** of member movements. There is **no first-class place** in the app for society-level income and expenses, bank balances, or supplier payments as a financial picture. Purchase costs live in **stock receipts** for inventory but do not post to a society cashbook. Treasurers still rely on **external tools** (spreadsheet, Contasol, gestoria) for the rest.

The question is how far we go inside the app: a simple cashbook, reconciliation against the bank, or full double-entry accounting.

---

## Option A: Simple income/expense tracker (“Sarrera eta Gastuak”)

**Idea:** One society-scoped ledger of **categorized inflows and outflows**, with period totals and a readable **annual summary** for the general assembly—not formal debit/credit accounting.

**Rough shape:**

- **Categories** per society (income vs expense, bilingual names, optional system categories for auto-posted flows).
- **Transactions** (date, amount, category, description, optional link to existing domain rows such as member movements or stock receipts).
- **Optional** bank accounts (names, IBAN, initial balance) and assigning transactions to an account.

**Auto-posting (bridge from today’s flows):** when prepayment is validated, SEPA batch is marked paid, cash is settled, a refund is issued, or a stock receipt is recorded, the app can **insert matching society transactions** so treasurers do not re-type everything.

**API/UI:** CRUD for categories and transactions, filters, a **summary** endpoint/view by period and category, treasurer-facing page (e.g. under something like `/kontabilitatea` or `/sarrera-gastuak`).

**Trade-offs:**

- **Pros:** Matches how many small societies actually work; additive and low risk for the existing member ledger; auto-posting cuts duplicate entry.
- **Cons:** Not auditor-grade; bank reconciliation stays basic (manual vs statement).

**Order of magnitude:** on the order of **~2 weeks** of focused work (schema, hooks into ledger flows, API, UI, i18n).

---

## Option B: Option A plus reconciliation

**Idea:** Everything in A, plus **imported bank statement lines** and a **reconciliation** flow: match app transactions to real bank movements, flag unmatched lines, optional society balance dashboard.

**Extra:** `bank_statement_lines`, match status, import batches, reconciled flags on transactions, matching UI (including heuristics by amount/date).

**Trade-offs:**

- **Pros:** Stronger confidence that nothing is missing vs the bank; surfaces discrepancies.
- **Cons:** Heavier UX; CSV/OFX formats differ by bank (Kutxabank, BBVA, etc.).

**Order of magnitude:** roughly **Option A plus ~2 weeks**.

---

## Option C: Full double-entry general ledger

**Idea:** Chart of accounts, **journal entries** (balanced debit/credit lines), fiscal periods, trial balance, income statement, balance sheet, general ledger per account.

**Extra:** Every existing financial flow needs **posting templates** (multi-line journals). The member ledger can remain as today with the GL as a parallel, authoritative accounting view.

**Trade-offs:**

- **Pros:** Correct for accountants and auditors; solid for compliance-heavy futures.
- **Cons:** High complexity; many volunteer treasurers will not want debit/credit concepts; often overlaps with what a **gestoria** already does for formal accounts.

**Order of magnitude:** on the order of **~5–6 weeks** (and ongoing maintenance).

---

## Decision (current)

**We proceed with Option A first.**

Rationale in short:

- It gives treasurers **one place** for society money in/out, combining **automation from member flows** with **manual lines** for the rest, and supports the **assembly-ready summary** without forcing accounting training on volunteers.
- **Option B** is valuable and can be **phased in later** if treasurers need statement matching.
- **Option C** is reserved unless there is a **specific compliance or auditor requirement** to own full books inside the app.

**Suggested phasing (non-binding):**

1. **Phase 1:** Option A—income/expense tracker with auto-posting from existing member-related flows.
2. **Phase 2:** Optional bank accounts and running balances (already sketched as optional in A).
3. **Phase 3:** Bank import and reconciliation (Option B additions)—if demand is clear.

---

## Related docs

- Member ledger behaviour and APIs: [`account-movements.md`](./account-movements.md), [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) §5b.
