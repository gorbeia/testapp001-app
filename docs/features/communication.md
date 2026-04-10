# User Stories: Communication — Oharrak (notes) & Jakinarazpenak

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#6-communication--oharrak--jakinarazpenak-communicationmd)

This document covers **society notes** (multilingual DB content) and **in-app notifications**, both backed by PostgreSQL + Express.

---

## Epic: Society notes (Oharrak)

> **Implementation note:** Domain model uses **`notes`** + **`note_messages`** tables (per-language title/content). REST surface: **`/api/notes`** (society-scoped via authenticated user). Admin UI: **`NotesManagementPage`** at **`/oharrak`** (`ProtectedRoute` / administratzailea). Notes can be converted into **`notifications`** for members (see notifications routes).

### Story 1: Create Note

**As an** Administratzailea (or role allowed by API/UI)  
**I want to** publish society notices  
**So that** members see important information

**Acceptance Criteria:**

- **Shipped:** create flow with **eu** and **es** (and extensible language keys) title/body via note messages
- ❌ Rich-text HTML editor, scheduling, priority flags, audience targeting — **not implemented** (content is structured per implementation / plain text in messages)

---

### Story 2: View Notes

**As a** Bazkidea or Laguna  
**I want to** read notices  
**So that** I stay informed

**Acceptance Criteria:**

- **Shipped:** recent notes on the **dashboard** (`RecentNotes` → `GET /api/notes`)
- **Shipped:** full list/management for admins at `/oharrak`
- ❌ Personal read/unread state, search filters for members — **not implemented** as originally specified

---

### Story 3: Note Management

**As an** Administratzailea  
**I want to** maintain notices  
**So that** information stays accurate

**Acceptance Criteria:**

- **Shipped:** edit + delete via `/api/notes` and admin UI
- ❌ Archive workflow, expiry dates, view analytics — **not implemented**

---

## Epic: In-app notifications (Jakinarazpenak)

### Story 4: Notifications inbox

**As a** member  
**I want to** see notifications in the app  
**So that** I do not miss society messages

**Acceptance Criteria:**

- **Shipped:** **`/jakinarazpenak`** page backed by **`notifications`** + **`notification_messages`** tables and `/api/notifications` routes (see server implementation)
- Notes flow can fan out converted notifications (implementation-specific)

---

## Epic: Communication preferences

### Story: Email channel & language

**As a** member  
**I want to** receive jakinarazpenak by email when I choose to  
**So that** I see important updates without opening the app

**Acceptance Criteria:**

- **Shipped:** transactional SMTP via **`server/lib/mail`** (nodemailer); env **`EMAIL_ENABLED`**, **`SMTP_*`**, **`MAIL_FROM`** (see `.env.example` and installation guide).
- **Shipped:** after user-targeted notifications are persisted (`notifyFinancialEvent`, reservations, **`POST /api/notifications`**, note fan-out), the app queues an email to **`users.username`** when **`users.notify_email`** is true.
- **Shipped:** per-user **`communication_language`** (profile + JWT); **`sendRawEmail`** for non-notification mail later.
- Quiet hours, push/SMS channels, template library — **not implemented** (legacy epic remainder).

---

## Epic: Communication Analytics (backlog)

### Stories 7–8: Analytics & legal archive

**Status:** ❌ **Not implemented**

---

## Quick reference

| Feature            | Route / API                                                 | Status  |
| ------------------ | ----------------------------------------------------------- | ------- |
| Notes admin        | `/oharrak`, `/api/notes`                                    | Shipped |
| Notifications      | `/jakinarazpenak`, `/api/notifications`                     | Shipped |
| Email (jakinaraz.) | SMTP env + `server/lib/mail`; prefs `/profila`, profile API | Shipped |
