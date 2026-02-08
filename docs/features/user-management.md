# User Management

## Overview

User management covers creating, viewing, updating and deleting members (bazkideak) and companions (lagunak) from the administration UI, including role/function assignment and linking companions to members.

---

## Stories

### 1. List users

- **As a** Administratzailea (Administrator)
- **I want to** see a table of all users with their key details
- **So that** I can quickly understand who is registered in the system

**Acceptance criteria**

- The list shows name, email, role, function, phone, linked member (if any).
- Both bazkideak and lagunak are visible in the same table.
- I can filter by role (bazkidea / laguna / all).
- I can search by name or email.

---

### 2. Create a new member

- **As a** Administratzailea
- **I want to** add a new bazkide with their contact and bank details
- **So that** the member can use the app and be included in financial exports

**Acceptance criteria**

- From the Users page I can open a "New user" dialog.
- I can enter name, email, phone, role, function and IBAN.
- On save, the user is stored in the database and appears in the table.
- A success notification is shown after creation.
- Validation prevents saving without at least email and role.

---

### 3. Create a companion linked to a member

- **As a** Administratzailea
- **I want to** add a laguna linked to an existing bazkide
- **So that** companions can book and consume under the member’s account

**Acceptance criteria**

- In the "New user" dialog I can choose role = laguna.
- When role is laguna, I can select a linked bazkide from a dropdown.
- The linked member’s name is visible in the users table.
- The relationship is stored in the database.

---

### 4. Edit user details

- **As a** Administratzailea
- **I want to** update a user’s contact or role information
- **So that** the registry stays accurate over time

**Acceptance criteria**

- From each row I can open an "Edit" action.
- I can change name, phone, role, function, IBAN and linked member.
- Changes are saved to the database and reflected in the table.
- A confirmation or success notification is shown after saving.

---

### 5. Delete a user

- **As a** Administratzailea
- **I want to** delete a user from the system when they are no longer active
- **So that** the registry contains only valid, active users

**Acceptance criteria**

- From each row I can choose a "Delete" option.
- Before deletion the system asks for confirmation (localized text).
- On confirm, the user is removed from the database and from the table.
- A small notification confirms the deletion.
- If the user cannot be deleted due to constraints, a clear error is shown.

---

### 6. Role-based access to user management

- **As a** Bazkidea or Laguna
- **I want to** be prevented from accessing the administration users page
- **So that** only authorized roles can manage users

**Acceptance criteria**

- Only Administratzailea (and, if desired, Diruzaina) can access `/erabiltzaileak`.
- Non-authorized users attempting to access the page are redirected or shown an error.
- This restriction is enforced on both frontend navigation and backend APIs.
