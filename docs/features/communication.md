# User Stories: Communication — Oharrak (notes), Jakinarazpenak & Txata

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#6-communication--oharrak--txata-communicationmd)

This document reflects the **shipped** design: **notes** (multilingual DB content) and **notifications** are backed by PostgreSQL + Express. **Txata (chat)** is **not** implemented in the codebase.

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

## Epic: Internal Chat (Txata) — **not shipped**

### Story 5: Send Messages

**As a** Bazkidea or Laguna  
**I want to** send messages to other users  
**So that** I can communicate directly with society members

**Status:** ❌ **Not implemented** — no chat tables, routes, or production UI in-repo (any legacy mock components are not routed in `App.tsx`).

---

### Story 6: Receive Messages

**As a** Bazkidea or Laguna  
**I want to** receive messages from other users  
**So that** I can stay connected with the community

**Status:** ❌ **Not implemented**

---

### Story 7: Chat Management

**As an** Administratzailea  
**I want to** monitor and manage chat  
**So that** communication stays appropriate

**Status:** ❌ **Not implemented**

---

## Epic: Communication Preferences (original backlog)

### Stories 8–9: Notification settings & templates

**Status:** ❌ **Not implemented** (no quiet hours, channel preferences, or template library as specified in the legacy epic).

---

## Epic: Communication Analytics (original backlog)

### Stories 10–11: Analytics & legal archive

**Status:** ❌ **Not implemented**

---

## Quick reference

| Feature | Route / API | Status |
|---------|-------------|--------|
| Notes admin | `/oharrak`, `/api/notes` | Shipped |
| Notifications | `/jakinarazpenak`, `/api/notifications` | Shipped |
| Chat (Txata) | — | Not shipped |
