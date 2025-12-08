# User Stories: Reservations (Erreserbak)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#2-reservations-erreserbak-reservationsmd)

## Epic: Table and Equipment Reservations

### Story 1: Create Reservation
**As a** Bazkidea or Laguna  
**I want to** reserve tables and kitchen equipment  
**So that** I can organize events and ensure availability  

**Acceptance Criteria:**
- Calendar view showing available dates and times
- Select table(s) for reservation
- Select kitchen equipment (cooking surface, griddle, ovens)
- Choose event type: hamaiketako, comida, merienda, cena, cumpleaños
- Automatic cost calculation based on selected resources
- Confirmation of reservation with details

### Story 2: View My Reservations
**As a** Bazkidea or Laguna  
**I want to** see my upcoming and past reservations  
**So that** I can manage my planned events  

**Acceptance Criteria:**
- List of current/future reservations with dates
- Historical view of past reservations
- Ability to cancel upcoming reservations (with time limits)
- View reservation details including costs
- Export personal reservation calendar

### Story 3: Reservation Calendar
**As a** Bazkidea or Laguna  
**I want to** see a calendar of all reservations  
**So that** I can plan around existing bookings  

**Acceptance Criteria:**
- Monthly/weekly calendar view
- Color-coded reservations by type
- Filter by event type
- Show availability status for different time slots
- Quick access to create new reservation from calendar

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
