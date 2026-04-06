# User Stories Index

## Elkartearen App - User Stories Documentation

This directory contains user stories organized by feature area for the Elkartearen App.

**Live tracker:** [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) (keep in sync when shipping or changing behavior).

## Available Stories

### Core Features

- **[Authentication](authentication.md)** — Login, tokens (httpOnly cookies + Bearer), access control
- **[User Management](user-management.md)** — Members and companions (`/erabiltzaileak`)
- **[User Profile](user-profile.md)** — Self-service profile (`/profila`)
- **[Reservations](reservations.md)** — Erreserbak (`/erreserbak`, `/nire-erreserbak`, `/admin-erreserbak`)
- **[Consumptions](consumptions.md)** — Kontsumoak POS and history
- **[Credits](credits.md)** — Zorrak, monthly debts, SEPA export (`/zorrak`, `/nire-zorrak`, `/sepa`)
- **[Account movements](account-movements.md)** — Ledger, transfers, refunds, SEPA bounce (`/nire-mugimenduak`, `/mugimenduak`, `/transferentziak`, `/itzulketak`)

### Communication Features

- **[Communication](communication.md)** — Oharrak (notes API + `/oharrak`), Jakinarazpenak (`/jakinarazpenak`)

### Management Features

- **[Inventory](inventory.md)** — Produktuak (`/produktuak`) and related stock behavior
- **[Society Management](society-management.md)** — Elkartea (`/elkartea`), tables (`/mahaiak`), subscriptions (`/subscriptions`)

### Technical Features

- **[Internationalization](internationalization.md)** — Euskara / Castellano (`client/src/lib/i18n.ts`)

## User Roles

### Primary Users

- **Bazkidea (Socio)** — Primary member with full access
- **Laguna (Acompañante)** — Secondary user linked to a Bazkidea

### Administrative Roles

- **Administratzailea (Administrator)** — System administration
- **Diruzaina (Tesorero)** — Financial management and SEPA
- **Sotolaria (Bodeguero)** — Inventory and stock management

> **Note:** Menus and middleware primarily key off **`function`** (above), not member **`role`** (`bazkidea` / `laguna`). See [authentication.md](./authentication.md).

## Implementation Priority (historical roadmap)

The product has progressed beyond this phased list; use **IMPLEMENTATION_STATUS.md** for current truth.

### Phase 1 – Foundation

1. Authentication system  
2. Basic user management  
3. Core reservation functionality  

### Phase 2 – Operations

1. Consumption tracking  
2. Credit management  
3. Inventory / products / categories  

### Phase 3 – Communication

1. Notes (oharrak) and notifications  

### Phase 4 – Advanced Features

1. SEPA export hardening (creditor from DB, validation)  
2. Advanced reporting  
3. Operational polish  

## Technical Notes

- **Languages:** Euskara (primary) + Castellano (secondary); bilingual data for categories and notes in PostgreSQL
- **Architecture:** Vite + React 18 SPA, Express API, PostgreSQL, Drizzle ORM
- **Auth:** JWT in httpOnly cookies + Bearer; refresh token cookie; TanStack Query on client for many flows
- **Debt calculation:** Cron + triggers aggregate consumptions/reservations into `credits` (see `credits.md`)
- **Deployment:** Docker-based setup (see repo root README)

## Story Format

Each user story follows:

- **As a** [user role]
- **I want to** [action/goal]
- **So that** [benefit/value]

with acceptance criteria grounded in the current implementation where verified.
