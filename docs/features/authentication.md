# User Stories: Authentication

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#1-authentication-authenticationmd)
>
> **Related:** User administration stories live in [user-management.md](./user-management.md). Profile UI details: [user-profile.md](./user-profile.md).

## Epic: User Authentication

### Story 1: User Login

**As a** Bazkidea (socio) or Laguna (acompañante)  
**I want to** log in with my society id, email, and password  
**So that** I can access the society's management system

**Acceptance Criteria:**

- Login requires **society alphabetic id** (e.g. seed `GT001`), **email**, and **password** (`LoginForm` → `POST /api/login`)
- Credentials validated against PostgreSQL (`users.username` is login email; bcrypt or legacy plain check per server)
- **Tokens:** short-lived **access** JWT in httpOnly **`auth-token`** cookie + **Bearer** token returned/stored client-side; **refresh** JWT in httpOnly **`refresh-token`** cookie (7-day lifetime) used by `POST /api/refresh`
- Successful login lands on the dashboard (`AuthenticatedApp`)
- Errors shown for invalid society/user/password
- Session continuity via cookie + `localStorage` (`auth:user`, `auth:token`, …) and periodic refresh (`AuthProvider`)
- **Logout:** `POST /api/logout` clears cookies + client storage
- **Testing:** E2E login scenarios under `e2e/features/login.feature`
- **Separate:** Backoffice operators use `POST /api/backoffice/login` + **`backoffice-token`** (not a society user)

---

### Story 2: Access Control (functions vs member types)

**As a** system  
**I want to** enforce permissions from the user’s **function** and gate routes  
**So that** each role sees the right tools

**Acceptance Criteria:**

- **`role`** (member type): `bazkidea` | `laguna` — who the person is in the society
- **`function`** (access level used by most middleware): `administratzailea` | `diruzaina` | `sotolaria` | `arrunta`
- **Server:** middleware such as `requireAdmin`, `requireTreasurer`, `requireAuth` checks **`req.user.function`** (and sometimes `role` in isolated routes — see code audit if tightening)
- **Client:** `ProtectedRoute`, sidebar visibility (`client/src/lib/auth.ts`) mirror functions for menu/features
- Unauthorized deep links show access denied or redirect patterns per `ProtectedRoute` / E2E expectations
- **Testing:** `e2e/features/role-based-menu.feature`

---

## Epic: User Management (legacy stories in this file)

> **Source of truth for admin user CRUD:** [user-management.md](./user-management.md). The stories below remain as a short summary to avoid broken bookmarks; prefer the dedicated doc for acceptance detail.

### Story 3: Create New User

See [user-management.md](./user-management.md) §2–3. **Partial gap:** create dialog must persist all displayed fields (see user-management PRD).

### Story 4: Manage User Roles and Functions

**As an** Administratzailea  
**I want to** modify `role` / `function` / linking fields  
**So that** access control stays accurate

**Acceptance Criteria:**

- **Shipped:** `PUT /api/users/:id` updates `role`, `function`, subscription, contact fields; list + edit UI on **`/erabiltzaileak`**
- ❌ Audit trail of role changes — **not implemented**
- **Partial gap:** Laguna linking from create dialog — **see user-management.md**

### Story 5: User Directory

See [user-management.md](./user-management.md) §1. Export — **not implemented**.

---

## Epic: User Profile Management

### Story 6: View Personal Profile

**As a** Bazkidea or Laguna  
**I want to** view my personal profile information  
**So that** I can verify my details and understand my access level

**Acceptance Criteria:**

- **Shipped:** **`/profila`** — `UserProfile` shows name, email (`username`), `role` + `function` badges, phone, IBAN, linked member when present
- Edit limited fields in-place (see Story 7 companion in `user-profile.md`)

---

### Story 7: Update Password

**As a** user  
**I want to** change my password  
**So that** I can maintain account security

**Acceptance Criteria:**

- **Shipped:** profile card calls **`POST /api/change-password`** with `currentPassword` + `newPassword` (min length 6 per implementation)
- **Engineering note:** server handler should be reviewed for production (hashing, JWT payload vs DB password alignment)
