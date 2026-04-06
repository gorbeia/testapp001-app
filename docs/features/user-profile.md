# User Profile Management

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#10-user-profile-user-profilemd)

## Epic: User Profile

### Story: View Personal Profile

**As a** logged-in user  
**I want to** view my personal profile information  
**So that** I can see and manage my account details

**Acceptance Criteria:**

- **Route:** **`/profila`** — `UserProfile` component (linked from sidebar / header per layout).
- Display: name, email (from `username`), **role** badge, **function** badge (unless arrunta), phone, IBAN.
- Show **linked member** block when `linkedMemberName` / related fields are present (Laguna).
- Responsive layout; loading/error states per implementation.

---

## Edit Personal Profile

### Story: Edit Personal Profile

**As a** logged-in user  
**I want to** edit my personal profile information  
**So that** I can keep my account details up to date

**Acceptance Criteria:**

- Editable fields sent with **`PUT /api/users/:id/profile`** (self-only: path id must match session user): **`name`**, **`phone`**, **`iban`**.
- Successful save updates **`AuthContext`** / local user cache and shows feedback (toast).
- **Note:** server re-issues JWT cookie on profile update so claims match DB.

---

### Story: Change Password

**As a** logged-in user  
**I want to** change my password  
**So that** I can maintain account security

**Acceptance Criteria:**

- Form with **current password**, **new password**, **confirm**; client enforces match + **minimum length (6)** per implementation.
- Submits to **`POST /api/change-password`**.
- **Engineering:** verify hashing and JWT/password alignment before production hardening (see [authentication.md](./authentication.md)).

---

## Related docs

- [authentication.md](./authentication.md) — login, tokens, access control overview.
