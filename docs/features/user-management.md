# User Management

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#2-user-management-user-managementmd)

## Overview

User management covers creating, viewing, updating and deleting members (bazkideak) and companions (lagunak) from the administration UI, including role/function assignment and linking companions to members.

**Route:** `/erabiltzaileak` — **`UsersPage`** (SPA access: **`administratzailea`** via `ProtectedRoute`; **`GET /api/users`** allows diruzaina or administratzailea).

---

## Stories

### 1. List users

- **As a** Administratzailea (Administrator)
- **I want to** see a table of all users with their key details
- **So that** I can quickly understand who is registered in the system

**Acceptance criteria**

- The list shows name, email, role, function, phone, **ledger balance** (`accountBalance` from `GET /api/users`), IBAN (truncated) **unless `sepaMode === disabled`**, linked member (if any), **subscription type**, **active/inactive** state.
- Both bazkideak and lagunak are visible in the same table.
- I can filter by role (bazkidea / laguna / all) and **status** (active / inactive / all).
- I can search by name or email (client-side on fetched rows).

---

### 2. Create a new member

- **As a** Administratzailea
- **I want to** add a new bazkide with their contact and bank details
- **So that** the member can use the app and be included in financial exports

**Acceptance criteria**

- From the Users page I can open a "New user" dialog with fields for name, email, phone, role, function, IBAN, subscription type, etc.
- **Shipped gap:** the create handler currently persists **`username`/email** and **`password`** (often a demo password); other visible inputs may **not** be wired into `POST /api/users` — follow-up needed to align UI with API body (`insertUserSchema` / route validation).
- A success notification is shown after creation when the API succeeds.
- Validation should require email (and role per product rules) — behavior matches current client checks.

---

### 3. Create a companion linked to a member

- **As a** Administratzailea
- **I want to** add a laguna linked to an existing bazkide
- **So that** companions can book and consume under the member’s account

**Acceptance criteria**

- In the "New user" dialog I can choose role = laguna and see a linked-member control.
- **Partial gap:** linked member is **not** reliably persisted from create — use **`PUT /api/users/:id`** after creation or fix the dialog binding. Schema supports **`linkedMemberId`** / **`linkedMemberName`**.
- When populated, the linked member’s name appears in the table.

---

### 4. Edit user details

- **As a** Administratzailea
- **I want to** update a user’s contact or role information
- **So that** the registry stays accurate over time

**Acceptance criteria**

- From each row I can open an "Edit" action.
- I can change name, phone, role, function, IBAN, **subscription type** (`subscriptionTypeId`).
- **Note:** linked member is **read-only** in edit UI today; backend **`PUT /api/users/:id`** can still accept link fields if extended.
- Changes are saved with **`PUT /api/users/:id`** and reflected in the table.
- A confirmation or success notification is shown after saving.

---

### 5. Delete a user

- **As a** Administratzailea
- **I want to** delete a user from the system when they are no longer active
- **So that** the registry contains only valid, active users

**Acceptance criteria**

- From each row I can choose a "Delete" option.
- Before deletion the system asks for confirmation (localized text).
- On confirm, **`DELETE /api/users/:id`** runs; dependency errors return **400** with detail.
- A small notification confirms the deletion.

---

### 6. Role-based access to user management

- **As a** Bazkidea or Laguna
- **I want to** be prevented from accessing the administration users page
- **So that** only authorized roles can manage users

**Acceptance criteria**

- Only **administratzailea** can open `/erabiltzaileak` in the SPA today (treasurer-only access is a product decision).
- Non-authorized users attempting direct URLs get **AccessDenied** / redirect behavior per `ProtectedRoute`.
- **Backend:** mutations require **`requireAdmin`**; listing uses **`requireTreasurer`** (diruzaina can call API without having the Users UI).

---

### 7. Activate / deactivate user

- **As a** Administratzailea
- **I want to** toggle whether a user may use the system
- **So that** former members do not retain active access

**Acceptance criteria**

- Row action calls **`PATCH /api/users/:id/toggle-active`**.
- **`isActive`** flips server-side and the table updates after refetch.

---

### 8. Assign subscription type

- **As a** Administratzailea
- **I want to** attach a membership fee plan to a user
- **So that** subscription metadata is stored on the member record

**Acceptance criteria**

- Types are managed under **`/subscriptions`**.
- User edit dialog sets **`subscriptionTypeId`**; table shows plan name/amount.
