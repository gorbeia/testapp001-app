# User Stories Index

## Elkartearen App - User Stories Documentation

This directory contains comprehensive user stories organized by feature area for the Elkartearen App implementation.

## Available Stories

### Core Features
- **[Authentication](authentication.md)** - User login, role management, and access control
- **[Reservations](reservations.md)** - Table and equipment reservations (Erreserbak)
- **[Consumptions](consumptions.md)** - Product consumption tracking (Kontsumoak)
- **[Credits](credits.md)** - Credit management and SEPA export (Zorrak)

### Communication Features
- **[Communication](communication.md)** - Announcements and internal chat (Oharrak & Txata)

### Management Features
- **[Inventory](inventory.md)** - Product and inventory management (Produktuak)
- **[Society Management](society-management.md)** - Society configuration and administration (Elkartea)

### Technical Features
- **[Internationalization](internationalization.md)** - Bilingual support (Euskara/Castellano)

## User Roles

### Primary Users
- **Bazkidea (Socio)** - Primary member with full access
- **Laguna (Acompañante)** - Secondary user linked to a Bazkidea

### Administrative Roles
- **Administratzailea (Administrator)** - System administration
- **Diruzaina (Tesorero)** - Financial management and SEPA
- **Sotolaria (Bodeguero)** - Inventory and stock management

## Implementation Priority

### Phase 1 - Foundation
1. Authentication system
2. Basic user management
3. Core reservation functionality

### Phase 2 - Operations
1. Consumption tracking
2. Credit management
3. Inventory system

### Phase 3 - Communication
1. Announcements system
2. Internal chat
3. Notification management

### Phase 4 - Advanced Features
1. SEPA export functionality
2. Advanced reporting
3. System optimization

## Technical Notes

- **Language**: Euskara (primary) + Castellano (secondary)
- **Architecture**: React + Express.js + PostgreSQL
- **Authentication**: Email/password with role-based access
- **Database**: PostgreSQL with Drizzle ORM
- **Deployment**: Docker-based setup

## Story Format

Each user story follows the standard format:
- **As a** [user role]
- **I want to** [action/goal]
- **So that** [benefit/value]

With detailed acceptance criteria for implementation guidance.
