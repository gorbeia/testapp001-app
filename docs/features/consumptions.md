# User Stories: Consumptions (Kontsumoak)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#3-consumptions-kontsumoak-consumptionsmd)

## Epic: Consumption Registration

### Story 1: Register Bar Consumption

**As a** Bazkidea or Laguna  
**I want to** register products consumed at the bar  
**So that** consumption is properly tracked and billed

**Acceptance Criteria:**

- Product selection interface with search
- Quantity entry for each product
- Real-time cost calculation
- Confirmation of consumption registration

### Story 2: View Consumption History

**As a** Bazkidea or Laguna  
**I want to** see my consumption history  
**So that** I can track my spending and activities

**Acceptance Criteria:**

- Chronological list of personal consumptions
- Filter by date range
- Show associated costs and running totals
- Export consumption reports

## Epic: Consumption Management (Sotolaria)

### Story 3: Manage All Consumptions

**As a** Sotolaria  
**I want to** view and manage all consumptions  
**So that** I can monitor sales and inventory usage

**Acceptance Criteria:**

- Complete consumption list across all users
- Filter by date, user, or product
- Ability to correct consumption entries
- Real-time sales analytics
- Export consumption reports for accounting

### Story 4: Consumption Categories

**As a** Sotolaria  
**I want to** categorize products for better tracking  
**So that** I can analyze sales patterns by category

**Acceptance Criteria:**

- Product category management
- Assign categories to products
- Category-based consumption reports
- Sales analysis by category
- Inventory tracking by category

## Epic: Inventory Integration

### Story 5: Inventory Update

**As a** system  
**I want to** automatically update inventory when consumptions are registered  
**So that** stock levels remain accurate

**Acceptance Criteria:**

- Automatic stock reduction on consumption
- Low stock alerts for popular items
- Integration with product management
- Historical consumption data for reordering
- Prevent sales of out-of-stock items

### Story 6: Consumption Analytics

**As a** Diruzaina or Administratzailea  
**I want to** analyze consumption patterns  
**So that** I can make informed business decisions

**Acceptance Criteria:**

- Consumption trends over time
- Popular products analysis
- Peak consumption periods
- User consumption patterns
- Revenue analysis by product category
