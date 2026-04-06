# User Stories: Credits (Zorrak) & SEPA

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#5-credits--zorrak--sepa-creditsmd)

## Data model & automation (cross-cutting)

Monthly **`credits`** rows are stored per member and society (`consumptionAmount`, `reservationAmount`, `totalAmount`, `status`, `paidAmount`, etc.). **`DebtCalculationService`** (cron in `server/cron-jobs.ts` and triggers after relevant consumption/reservation flows) aggregates consumptions and reservations into those rows.

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
- **Shipped UI**: `CreditsPage` at `/zorrak` (route currently **administratzailea** in the SPA; API also allows treasurer — align product/access if needed)

---

### Story 3: Credit Reset After Payment

**As a** Diruzaina  
**I want to** reset or reconcile credits after bank payment  
**So that** accounts reflect current status

**Acceptance Criteria:**

- 🟡 Batch status updates (e.g. mark as paid) — **implemented at API level**
- ❌ Granular per-line reset UI, rich audit trail, and member notifications — **not implemented**

---

## Epic: SEPA Export

### Story 4: Generate SEPA List

**As a** Diruzaina  
**I want to** produce debit collection data for the bank  
**So that** I can create payment files

**Acceptance Criteria:**

- ✅ Select billing month (`YYYY-MM`)
- ✅ Include members with pending credits and required debtor fields (API joins `users` for IBAN, etc.)
- ✅ Build SEPA XML (pain.008-style) in the browser from export rows
- ❌ Export to Google Sheets — **not implemented** (XML download path instead)
- **Shipped**: `SepaExportPage` at `/sepa`, `GET /api/credits/sepa-export?month=YYYY-MM`

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

- 🟡 Society **`iban`** and **`creditorId`** (and related contact fields) exist in DB and are editable via **`/elkartea`** (`GET /api/societies/user`, `PUT /api/societies/:id`)
- 🟡 **Gap**: the client SEPA XML generator still uses **hardcoded default creditor** values; production should read from `societies` (or env) and match the PRD

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

- 🟡 Dashboard cards use **real** credit/debt endpoints for the logged-in user (and role-dependent stats)
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

- Harden multi-tenant queries on credit list/sum/export routes with explicit `societyId` filters where not already enforced.
- Wire `SepaDirectDebitGenerator` defaults to `societies` (and validate IBAN) to close the gap between Story 6 and Story 4.
