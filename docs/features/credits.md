# User Stories: Credits (Zorrak) & SEPA

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#5-credits--zorrak--sepa-creditsmd)

## Data model & automation (cross-cutting)

Monthly **`credits`** rows are stored per member and society (`consumptionAmount`, `reservationAmount`, `totalAmount`, `status`, `paidAmount`, etc.). **`DebtCalculationService`** (cron in `server/cron-jobs.ts` and triggers after relevant consumption/reservation flows) aggregates consumptions and reservations into those rows **per society** (`societyId` from JWT on real-time triggers; scheduled job processes **all** `isActive` societies). Society **`sepaMode`** (`monthly` | `bimonthly` | `quarterly` | `on_demand` | `disabled`) controls **SEPA export** period validation and UI (and disables export when **`disabled`**). **Subscription fees** are still written to **`credits`** and posted as **`subscription`** rows on **`account_movements`** (member balance) for every mode, so societies without SEPA can charge periodic fees from the ledger. When **`sepaMode` is `disabled`**, both **Nire zorrak** and admin **Zorrak /zorrak** (monthly credit grid) are turned off in the SPA (nav + redirect); members go to **Nire mugimenduak**, admins to **Mugimenduak /mugimenduak**, and the dashboard balance card uses the ledger (see [account-movements.md](./account-movements.md)).

---

## Epic: Credit Management

### Story 1: View Pending Credits (Bazkidea)

**As a** Bazkidea  
**I want to** view my accumulated debt  
**So that** I can track my financial obligations

**Acceptance Criteria:**

- ✅ Display current pending (and related) credit rows for the logged-in member
- ✅ Breakdown by month where data exists (consumption vs reservation components when present)
- Historical / paid rows depend on API filters and UI presentation
- Export of a formal statement: not implemented as a dedicated feature
- When **`sepaMode === disabled`**: sidebar entry for **`/nire-zorrak`** is hidden; visiting the URL **redirects** to **`/nire-mugimenduak`**; `GET /api/credits/member/current` remains available for integrations
- **Shipped**: `MyDebtsPage` at `/nire-zorrak`, `GET /api/credits/member/current`

---

### Story 2: Monthly Credit Summary (Diruzaina / admin)

**As a** Diruzaina or Administratzailea  
**I want to** see society-wide credit rows by period  
**So that** I can prepare billing information

**Acceptance Criteria:**

- ✅ Filter/list credits by month (and society, via authenticated user’s tenant)
- ✅ List members with amounts for the selected period (via credits API)
- Totals for the period are derivable from listed rows
- ❌ Export credit list to Google Sheets — **not implemented** (no Sheets export)
- 🟡 Mark credits as paid / batch update — **partial** (`PUT /api/credits/batch-status`)
- When **`sepaMode === disabled`**: admin sidebar entry for **`/zorrak`** is hidden; visiting the URL **redirects** to **`/mugimenduak`**; `GET /api/credits` and batch/bounce APIs remain for tooling/consistency
- **Shipped UI**: `CreditsPage` at `/zorrak` (route currently **administratzailea** in the SPA; API also allows treasurer — align product/access if needed)

---

### Story 3: Credit Reset After Payment

**As a** Diruzaina  
**I want to** reset or reconcile credits after bank payment  
**So that** accounts reflect current status

**Acceptance Criteria:**

- 🟡 Batch status updates (e.g. mark as paid) — **implemented at API level**; **admin grid UI** on **`/zorrak`** only when **`sepaMode` is not `disabled`**
- ❌ Granular per-line reset UI, rich audit trail, and member notifications — **not implemented**

---

## Epic: SEPA Export

### Story 4: Generate SEPA List

**As a** Diruzaina  
**I want to** produce debit collection data for the bank  
**So that** I can create payment files

**Acceptance Criteria:**

- ✅ Select billing period: one month, bimonthly pair, calendar quarter, or arbitrary range (`on_demand`), aligned with society **`sepaMode`**
- ✅ Include members with pending credits and required debtor fields (API joins `users` for IBAN, etc.); multi-month periods aggregate amounts per member
- ✅ Build SEPA XML (pain.008-style) in the browser from export rows; creditor fields from **`societies`** with fallback to demo defaults
- ❌ Export to Google Sheets — **not implemented** (XML download path instead)
- **Shipped**: `SepaExportPage` at `/sepa`, `GET /api/credits/sepa-export` with `month=`, `months=`, or `from=` / `to=`; tenant-scoped via JWT **`societyId`**

---

### Story 5: SEPA Data Validation

**As a** Diruzaina  
**I want to** validate SEPA data before export  
**So that** bank payments are processed correctly

**Acceptance Criteria:**

- ❌ IBAN format validation, creditor consistency checks, dedicated error UI — **not implemented**

---

### Story 6: Society Information Management (creditor / SEPA metadata)

**As an** Administratzailea (or treasurer, subject to API alignment)  
**I want to** manage society bank and creditor identifiers  
**So that** transfers identify the correct creditor

**Acceptance Criteria:**

- ✅ Society **`iban`**, **`creditorId`**, and **`sepaMode`** (and related contact fields) exist in DB and are editable via **`/elkartea`** (`GET /api/societies/user`, `PUT /api/societies/:id`)
- ✅ `SepaExportPage` builds creditor block from society row when possible; warns if IBAN/creditor id missing
- **`sepaMode = disabled`**: SEPA sidebar link hidden; export API returns **403**; `/sepa` shows empty state with link to **`/elkartea`**; member **`/nire-zorrak`** and admin **`/zorrak`** nav hidden with redirects to **`/nire-mugimenduak`** and **`/mugimenduak`** respectively; dashboard “debt” card shows **ledger balance** (`GET /api/account-movements/me`) instead of pending credits sum

---

### Story 11: Per-society SEPA billing cadence

**As an** Administratzailea or Diruzaina  
**I want to** configure how often we run SEPA collections for our society  
**So that** billing matches our bank and internal process (monthly, bimonthly, quarterly, on-demand, or no SEPA)

**Acceptance Criteria:**

- ✅ **`societies.sepaMode`** stored and editable on **`/elkartea`** and optional on backoffice society create
- ✅ Export UI and API enforce period shape for the active mode (`on_demand` allows any contiguous range)
- ✅ E2E: `sepa-billing-frequency.feature`

---

## Epic: Payment Tracking

### Story 7: Payment Status Tracking

**As a** Diruzaina  
**I want to** track payment status for each billing cycle  
**So that** I can monitor collection progress

**Acceptance Criteria:**

- 🟡 Basic `status` / `paidAmount` on `credits` — present
- ❌ Bank file submission state, returns, rejections, exception workflows — **not implemented**

---

### Story 8: Credit Notifications

**As a** Bazkidea  
**I want to** receive notifications about my credit status  
**So that** I stay informed about my financial obligations

**Acceptance Criteria:**

- ❌ Dedicated credit notification product — **not implemented** (general notifications exist separately; see `communication.md`)

---

## Epic: Financial Reporting

### Story 9: Financial Dashboard

**As a** Diruzaina or Administratzailea  
**I want to** view financial highlights  
**So that** I can understand the society's financial health

**Acceptance Criteria:**

- 🟡 Dashboard cards use **real** data for the logged-in user (and role-dependent stats): pending credits when SEPA is active; **member ledger balance** when **`sepaMode === disabled`**
- ❌ Full KPI suite and historical charts as originally specified — **not implemented**

---

### Story 10: Export Financial Reports

**As a** Diruzaina  
**I want to** export comprehensive financial reports  
**So that** I can provide transparency to the society

**Acceptance Criteria:**

- ❌ Monthly statements, YTD packs, dedicated export history — **not implemented**

---

## Technical notes (engineering)

- Harden multi-tenant queries on credit list/sum/export routes with explicit `societyId` filters where not already enforced (`sepa-export` is tenant-scoped).
- `SepaDirectDebitGenerator` uses **`/api/societies/user`** creditor fields with fallback defaults; full IBAN validation remains future work (Story 5).
