# User Stories: Reservations (Erreserbak)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#2-reservations-erreserbak-reservationsmd)

## Epic: Table and Equipment Reservations

### Story 1: Create Reservation

**As a** Bazkidea or Laguna  
**I want to** reserve tables and kitchen equipment  
**So that** I can organize events and ensure availability

**Acceptance Criteria:**

- List view (table) of upcoming reservations; no calendar UI
- Button to open a form for a new reservation
- Select table(s) for reservation
- Select kitchen equipment (cooking surface, griddle, ovens)
- Choose event type: hamaiketako, comida, merienda, cena, cumpleaños
- A table reserved for an event type is unavailable for additional reservations of that event type on the same day
- Automatic cost calculation based on selected resources
- Confirmation of reservation with details
- Event-day consumptions are **not** logged within the reservation flow; they are recorded later as standard consumptions (bar tab) with no special “event consumption” feature.

### Story 2: View My Reservations

**As a** Bazkidea or Laguna  
**I want to** see my upcoming and past reservations  
**So that** I can manage my planned events

**Acceptance Criteria:**

- List of current/future reservations with dates (table view)
- Historical view of past reservations
- Ability for the creator to cancel their upcoming reservations (with time limits)
- View reservation details including costs
- Export personal reservation list (no calendar export)

### Story 3: Reservation Calendar

**As a** Bazkidea or Laguna  
**I want to** see a calendar of all reservations  
**So that** I can plan around existing bookings

## Epic: Reservation Management (Sotolaria/Administratzailea)

### Story 4: Manage All Reservations

**As a** Sotolaria or Administratzailea  
**I want to** view and manage all reservations  
**So that** I can coordinate resources and resolve conflicts

**Acceptance Criteria:**

- Complete reservation list with all users
- Ability to modify or cancel any reservation
- Conflict detection and resolution tools
- Resource availability overview
- Export reservation reports by date range

### Story 5: Resource Configuration

**As an** Administratzailea  
**I want to** configure available resources and pricing  
**So that** the reservation system reflects actual capacity

**Acceptance Criteria:**

- Define table types and quantities
- Configure kitchen equipment inventory
- Set pricing for different resources
- Define time slots and availability rules
- Configure event types and associated costs

## Epic: Reservation Costs

### Story 6: Cost Calculation

**As a** Bazkidea or Laguna  
**I want to** see the costs associated with my reservation  
**So that** I can understand the financial commitment

**Acceptance Criteria:**

- Real-time cost calculation during reservation
- Breakdown of costs by resource (tables, equipment, event type)
- Total cost display before confirmation
- Receipt generation after reservation

### Story 7: Cost Integration with Credits

**As a** system  
**I want to** automatically charge reservation costs to the responsible Bazkidea  
**So that** accounting is accurate and automated

**Acceptance Criteria:**

- Automatic charge to Bazkidea's credit account
- Clear indication of cost responsibility
- Integration with Zorrak (credits) system
- Notification of charges to responsible party
