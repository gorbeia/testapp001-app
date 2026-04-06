# User Stories: Society Management (Elkartea)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#8-society-management-elkartea-society-managementmd)

## Epic: Society Configuration

### Story 1: Society Information

**As an** Administratzailea or Diruzaina (see access alignment note below)  
**I want to** configure basic society information  
**So that** the application reflects the society's identity

**Acceptance Criteria:**

- **Shipped (partial):** `SocietyPage` at **`/elkartea`** loads **`GET /api/societies/user`** and saves **`PUT /api/societies/:id`** with name, address, phone, email, **IBAN**, **creditorId**, **`sepaMode`** (SEPA billing cadence / off via checkbox + cadence select), **`paymentMethods`** (JSON array: bank transfer prepayment, manual cash, cash change machine — cash options are configuration only for now), and **reservation pricing** fields (`reservationPricePerMember`, `kitchenPricePerMember`)
- **Route note:** SPA uses **`ProtectedRoute` “treasurer”**; `PUT` middleware may require **`administratzailea`** only — verify alignment for diruzaina-only treasurers
- ❌ Logo upload, long description, establishment date fields — **not implemented**

### Story 2: SEPA Configuration

**As an** Administratzailea  
**I want to** configure SEPA payment settings  
**So that** bank transfers can be processed correctly

**Acceptance Criteria:**

- **Shipped:** IBAN, creditor id, **`sepaMode`**, and **`paymentMethods`** on **`societies`**, editable via **`/elkartea`** (unified payment-methods card); backoffice create can set **`sepaMode`** and optional **`paymentMethods`**
- **Shipped:** When **bank transfer prepayment** is not selected, **`/transferentziak`**, treasurer bank-transfer APIs, and the transfer-proposal block on **My movements** are hidden/disabled; **SEPA / monthly debt pages** remain gated only by **`sepaMode !== disabled`**
- **Shipped:** SEPA XML uses society creditor data when present (see [credits.md](./credits.md) Story 6)
- ❌ Dedicated SEPA wizard, bank API preferences, pain.008 versioning UI — **not implemented**

### Story 3: Society Rules and Policies

**As an** Administratzailea  
**I want to** establish society rules  
**So that** all users understand the operating procedures

**Acceptance Criteria:**

- Reservation rules and limits
- Payment policies and deadlines
- User conduct guidelines
- Access control policies
- Rule versioning and history

## Epic: Administrative Functions

### Story 4: Role Assignment

**As an** Administratzailea  
**I want to** assign administrative functions to Bazkidea  
**So that** society management responsibilities are properly distributed

**Acceptance Criteria:**

- Assign Administratzailea role
- Assign Diruzaina (Tesorero) role
- Assign Sotolaria (Bodeguero) role
- Create role-specific login accounts
- Maintain role assignment history

### Story 5: Function Transfer

**As an** Administratzailea  
**I want to** transfer administrative functions between users  
**So that** leadership changes are managed smoothly

**Acceptance Criteria:**

- Process for transferring roles
- Temporary delegation capabilities
- Access revocation procedures
- Notification of role changes
- Audit trail of all transfers

### Story 6: Administrative Access

**As a** Bazkidea with administrative function  
**I want to** access my administrative dashboard  
**So that** I can perform my specific duties

**Acceptance Criteria:**

- Separate login for administrative functions
- Role-specific dashboard and tools
- Access to relevant administrative data
- Function-specific permissions
- Logout from administrative mode

## Epic: Society Operations

### Story 7: Operating Hours

**As an** Administratzailea  
**I want to** configure society operating hours  
**So that** users know when services are available

**Acceptance Criteria:**

- Set regular operating hours
- Configure special holiday hours
- Define reservation time slots
- Set maintenance periods
- Display current status to users

### Story 8: Resource Configuration

**As an** Administratzailea  
**I want to** configure physical resources  
**So that** the reservation system matches actual capacity

**Acceptance Criteria:**

- **Shipped:** reservation **tables** CRUD at **`/mahaiak`**, **`/api/tables`** — name, min/max capacity, active flag (see [reservations.md](./reservations.md) Story 5 for tenancy caveats)
- ❌ Kitchen equipment inventory, maintenance schedules, availability calendars — **not implemented** (reservations use a single **`useKitchen`** boolean + society-wide kitchen rate)

### Story 9: Fee Structure

**As a** Diruzaina or Administratzailea  
**I want to** configure fee structures  
**So that** charges are consistent and transparent

**Acceptance Criteria:**

- **Shipped:** per-guest reservation rate + per-guest kitchen rate on **`societies`**, edited via **`/elkartea`**
- **Shipped:** **subscription types** — fee plans with amount/period at **`/subscriptions`** (`subscription_types` table); assign **`subscriptionTypeId`** on users (see [user-management.md](./user-management.md))
- ❌ Event-type-specific prices, special pricing rules engine — **not implemented** (event `type` is stored but not priced differently in code)

## Epic: Reporting and Compliance

### Story 10: Society Statistics

**As an** Administratzailea  
**I want to** view society statistics  
**So that** I can understand membership and usage trends

**Acceptance Criteria:**

- Member count and demographics
- Usage statistics by category
- Revenue and expense summaries
- Growth trends over time
- Comparative period analysis

### Story 11: Compliance Management

**As an** Administratzailea  
**I want to** ensure regulatory compliance  
**So that** the society operates within legal requirements

**Acceptance Criteria:**

- Data privacy compliance settings
- Financial reporting requirements
- User consent management
- Audit trail maintenance
- Legal documentation storage

### Story 12: Backup and Recovery

**As an** Administratzailea  
**I want to** manage data backup and recovery  
**So that** society data is protected against loss

**Acceptance Criteria:**

- Automated backup scheduling
- Data restoration procedures
- Backup verification processes
- Disaster recovery planning
- Data retention policies
