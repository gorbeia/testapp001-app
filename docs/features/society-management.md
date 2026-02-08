# User Stories: Society Management (Elkartea)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#7-society-management-elkartea-society-managementmd)

## Epic: Society Configuration

### Story 1: Society Information

**As an** Administratzailea  
**I want to** configure basic society information  
**So that** the application reflects the society's identity

**Acceptance Criteria:**

- Society name configuration (Izena)
- Contact information management
- Society description and details
- Logo and branding elements
- Society establishment date

### Story 2: SEPA Configuration

**As an** Administratzailea  
**I want to** configure SEPA payment settings  
**So that** bank transfers can be processed correctly

**Acceptance Criteria:**

- Society IBAN configuration (cuenta emisora)
- Creditor ID setup for SEPA compliance
- Bank contact information
- Payment processing preferences
- SEPA file format specifications

### Story 3: Society Rules and Policies

**As an** Administratzailea  
**I want to** establish society rules  
**So that** all users understand the operating procedures

**Acceptance Criteria:**

- Reservation rules and limits
- Payment policies and deadlines
- User conduct guidelines
- Access control policies
- Rule versioning and history

## Epic: Administrative Functions

### Story 4: Role Assignment

**As an** Administratzailea  
**I want to** assign administrative functions to Bazkidea  
**So that** society management responsibilities are properly distributed

**Acceptance Criteria:**

- Assign Administratzailea role
- Assign Diruzaina (Tesorero) role
- Assign Sotolaria (Bodeguero) role
- Create role-specific login accounts
- Maintain role assignment history

### Story 5: Function Transfer

**As an** Administratzailea  
**I want to** transfer administrative functions between users  
**So that** leadership changes are managed smoothly

**Acceptance Criteria:**

- Process for transferring roles
- Temporary delegation capabilities
- Access revocation procedures
- Notification of role changes
- Audit trail of all transfers

### Story 6: Administrative Access

**As a** Bazkidea with administrative function  
**I want to** access my administrative dashboard  
**So that** I can perform my specific duties

**Acceptance Criteria:**

- Separate login for administrative functions
- Role-specific dashboard and tools
- Access to relevant administrative data
- Function-specific permissions
- Logout from administrative mode

## Epic: Society Operations

### Story 7: Operating Hours

**As an** Administratzailea  
**I want to** configure society operating hours  
**So that** users know when services are available

**Acceptance Criteria:**

- Set regular operating hours
- Configure special holiday hours
- Define reservation time slots
- Set maintenance periods
- Display current status to users

### Story 8: Resource Configuration

**As an** Administratzailea  
**I want to** configure physical resources  
**So that** the reservation system matches actual capacity

**Acceptance Criteria:**

- Table configuration and numbering
- Kitchen equipment setup
- Capacity limits and rules
- Resource availability schedules
- Maintenance scheduling for equipment

### Story 9: Fee Structure

**As a** Diruzaina or Administratzailea  
**I want to** configure fee structures  
**So that** charges are consistent and transparent

**Acceptance Criteria:**

- Set table reservation fees
- Configure equipment usage costs
- Define event type pricing
- Set member fee schedules
- Create special pricing rules

## Epic: Reporting and Compliance

### Story 10: Society Statistics

**As an** Administratzailea  
**I want to** view society statistics  
**So that** I can understand membership and usage trends

**Acceptance Criteria:**

- Member count and demographics
- Usage statistics by category
- Revenue and expense summaries
- Growth trends over time
- Comparative period analysis

### Story 11: Compliance Management

**As an** Administratzailea  
**I want to** ensure regulatory compliance  
**So that** the society operates within legal requirements

**Acceptance Criteria:**

- Data privacy compliance settings
- Financial reporting requirements
- User consent management
- Audit trail maintenance
- Legal documentation storage

### Story 12: Backup and Recovery

**As an** Administratzailea  
**I want to** manage data backup and recovery  
**So that** society data is protected against loss

**Acceptance Criteria:**

- Automated backup scheduling
- Data restoration procedures
- Backup verification processes
- Disaster recovery planning
- Data retention policies
