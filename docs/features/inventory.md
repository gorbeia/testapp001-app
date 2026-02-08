# User Stories: Inventory Management (Produktuak)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#6-inventory-management-produktuak-inventorymd)

## Epic: Product Management

### Story 1: Add New Products

**As a** Sotolaria  
**I want to** add new products to the inventory  
**So that** I can track all available items for consumption

**Acceptance Criteria:**

- Product creation form with essential fields
- Product categorization (drinks, food, supplies)
- Price configuration for different user types
- Stock quantity initialization
- Product image upload option

### Story 2: Update Product Information

**As a** Sotolaria  
**I want to** modify product details  
**So that** inventory information remains current

**Acceptance Criteria:**

- Edit product name, description, and category
- Update pricing information
- Modify stock quantities
- Change product status (active/inactive)
- Log all changes for audit trail

### Story 3: View Product Catalog

**As a** Sotolaria or Administratzailea  
**I want to** browse the complete product catalog  
**So that** I can manage inventory effectively

**Acceptance Criteria:**

- Searchable product list
- Filter by category, status, or stock level
- Sort by various criteria (name, price, stock)
- Quick view of product details
- Export product list for external use

## Epic: Stock Management

### Story 4: Stock Updates

**As a** Sotolaria  
**I want to** update stock levels  
**So that** inventory quantities are accurate

**Acceptance Criteria:**

- Manual stock adjustment interface
- Reason codes for stock changes (damage, loss, correction)
- Batch stock updates for multiple items
- Stock level history tracking
- Automatic stock reduction from consumptions

### Story 5: Low Stock Alerts

**As a** Sotolaria  
**I want to** receive alerts when stock is low  
**So that** I can reorder products in time

**Acceptance Criteria:**

- Configurable minimum stock thresholds
- Automatic low stock notifications
- Recommended reorder quantities
- Supplier information integration
- Alert escalation for critical items

### Story 6: Inventory Movements

**As a** Sotolaria  
**I want to** track all inventory movements  
**So that** I have complete visibility of stock changes

**Acceptance Criteria:**

- Complete movement history log
- Filter movements by type, date, or product
- Movement reasons and responsible person
- Balance verification reports
- Export movement logs for accounting

## Epic: Purchase Management

### Story 7: Record Purchases

**As a** Sotolaria  
**I want to** record product purchases  
**So that** I can track acquisition costs and suppliers

**Acceptance Criteria:**

- Purchase recording form
- Supplier information management
- Purchase price tracking
- Automatic stock increase on purchase
- Purchase categorization and tagging

### Story 8: Supplier Management

**As a** Sotolaria  
**I want to** manage supplier information  
**So that** I can maintain good vendor relationships

**Acceptance Criteria:**

- Supplier database with contact information
- Product-supplier relationships
- Purchase history by supplier
- Supplier performance metrics
- Preferred supplier designation

### Story 9: Purchase Orders

**As a** Sotolaria  
**I want to** create and manage purchase orders  
**So that** I can organize procurement effectively

**Acceptance Criteria:**

- Purchase order creation
- Order status tracking (pending, received, cancelled)
- Multiple delivery support
- Budget approval workflows
- Order history and analytics

## Epic: Inventory Analytics

### Story 10: Inventory Reports

**As a** Diruzaina or Administratzailea  
**I want to** analyze inventory performance  
**So that** I can make informed purchasing decisions

**Acceptance Criteria:**

- Stock value reports
- Turnover rates by product
- Cost of goods sold analysis
- Seasonal demand patterns
- Profit margins by product category

### Story 11: Consumption Analytics

**As a** Sotolaria  
**I want to** understand consumption patterns  
**So that** I can optimize stock levels

**Acceptance Criteria:**

- Most/least popular products
- Consumption trends over time
- Peak usage periods
- User preference analysis
- Forecasting recommendations

### Story 12: Inventory Optimization

**As a** Sotolaria  
**I want to** optimize inventory levels  
**So that** I reduce waste and improve efficiency

**Acceptance Criteria:**

- Recommended reorder points
- Economic order quantity calculations
- Expiry date tracking (if applicable)
- Waste reduction suggestions
- Storage efficiency recommendations
