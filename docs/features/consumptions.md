# User Stories: Consumptions (Kontsumoak)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#4-consumptions-kontsumoak-consumptionsmd)

## Epic: Consumption Registration

### Story 1: Register Bar Consumption (session flow)

**As a** Bazkidea or Laguna  
**I want to** register products consumed at the bar  
**So that** consumption is properly tracked and billed

**Acceptance Criteria:**

- **Shipped flow** (`/kontsumoak`, `ConsumptionsPage`):
  1. **`POST /api/consumptions`** — open a consumption session (tab) for the current user / society
  2. **`POST /api/consumptions/:id/items`** — add cart lines (product id, quantity); server snapshots **unit price** from product, updates **`consumptions.totalAmount`**, **decrements `products.stock`**, appends **`stock_movements`** (`type: consumption`, negative quantity). **Debt calculation** runs after relevant writes.
  3. **`POST /api/consumptions/:id/close`** — sets **`closedAt`** / **`closedBy`**; stock already updated on item POST
- Product grid with **category filter** and search (categories from `/api/categories`)
- Cart with quantity adjusters and running totals
- Confirmation / feedback in UI (toasts, dialogs per implementation)
- ❌ Blocking sales when stock is zero — **not enforced** (stock may go negative)

---

### Story 2: View Consumption History (member)

**As a** Bazkidea or Laguna  
**I want to** see my consumption history  
**So that** I can track my spending and activities

**Acceptance Criteria:**

- **Shipped**: `MyConsumptionsPage` at **`/nire-konsumoak`**, `GET /api/consumptions/user` with search/month style filters
- List + detail (items via `/api/consumptions/:id/items` per client wiring)
- ❌ Export consumption reports — **not implemented**

---

### Story 3: Close Consumption Session

**As a** system / operator  
**I want to** close a consumption tab when finished  
**So that** no further lines are added and the session has a clear end time

**Acceptance Criteria:**

- **Shipped**: `POST /api/consumptions/:id/close` persists close metadata; POS flow calls it after posting items

---

## Epic: Consumption Management (staff)

### Story 4: Manage All Consumptions

**As a** Sotolaria, Diruzaina, or Administratzailea (per API rules)  
**I want to** view society consumptions  
**So that** I can monitor sales and support members

**Acceptance Criteria:**

- **Shipped**: `ConsumptionsListPage` at **`/kontsumoak-zerrenda`**, `GET /api/consumptions` with **`userId`** / **`month`** filters
- Detail fetch: `GET /api/consumptions/:id` (+ items)
- ❌ Correcting line items after the fact, analytics dashboards, CSV export — **not implemented**

---

### Story 5: Product Categories (admin)

**As a** Sotolaria / treasurer / admin (per `/api/categories` rules)  
**I want to** manage product categories with Basque and Spanish labels  
**So that** the POS and catalog stay organized

**Acceptance Criteria:**

- **Shipped**: **`/kategoriak`** — CRUD + reorder + soft delete; bilingual names/descriptions via **`category_messages`**; `/api/categories` respects `Accept-Language`
- Products must reference a category (`ProductsPage` / `/api/products`)
- ❌ Category-based **reports** and revenue analytics — **not implemented** (see Story 7 below)

---

## Epic: Inventory Integration

### Story 6: Inventory Update from Consumptions

**As a** system  
**I want to** update inventory when consumption lines are posted  
**So that** stock levels stay aligned with sales

**Acceptance Criteria:**

- **Shipped**: decrement on **`POST .../items`**; **`stock_movements`** audit row per decrement
- **Shipped**: `minStock` on products + low-stock cue on **`/produktuak`** (banner / highlights)
- ❌ Automatic reorder suggestions, push alerts — **not implemented**
- Manual stock edits via **`PUT /api/products`** change `stock` **without** creating a movement (see `inventory.md`)

---

### Story 7: Consumption Analytics

**As a** Diruzaina or Administratzailea  
**I want to** analyze consumption patterns  
**So that** I can make informed business decisions

**Acceptance Criteria:**

- ❌ Trends, peaks, category revenue reports — **not implemented** (may use raw SQL/API counts in future)
