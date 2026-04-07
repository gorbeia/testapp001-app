# User Stories: Inventory Management (Produktuak)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#7-inventory-management-produktuak-inventorymd)

## Epic: Product Management

### Story 1: Add New Products

**As a** Sotolaria (and Administratzailea per API)  
**I want to** add new products to the inventory  
**So that** I can track all available items for consumption

**Acceptance Criteria:**

- **Shipped:** `ProductsPage` at **`/produktuak`** — create dialog with name, description, **category** (required FK), **price**, **stock**, **unit**, **minStock**, **supplier** text, `isActive`
- **Shipped:** `POST /api/products` (admin-only guard in route code: checks `role`/`function` combination — see server)
- ❌ Per–user-type pricing — **not implemented** (single `price` field)
- ❌ Product image upload — **not implemented**

---

### Story 2: Update Product Information

**As a** Sotolaria  
**I want to** modify product details  
**So that** inventory information remains current

**Acceptance Criteria:**

- **Shipped:** edit dialog + `PUT /api/products/:id` for name, description, category, price, unit, min stock, supplier, active flag (**`stock` is rejected** on PUT; use adjustment flow below)
- ❌ Audit trail of non-stock field changes — **not implemented**
- **Shipped:** stock changes via **`POST /api/products/:id/adjust`** (types **`adjustment`** / **`damage`**) write **`stock_movements`** rows

---

### Story 3: View Product Catalog

**As a** Sotolaria or Administratzailea  
**I want to** browse the product catalog  
**So that** I can manage inventory effectively

**Acceptance Criteria:**

- **Shipped:** search by name, filter by category, low-stock emphasis, table listing
- ❌ Sort columns, export CSV — **not implemented**

---

## Epic: Product Categories (related domain)

### Story 3b: Manage categories

**As an** Administratzailea / Diruzaina (per `/api/categories` permissions)  
**I want to** maintain bilingual categories  
**So that** POS and catalog group products consistently

**Acceptance Criteria:**

- **Shipped:** **`/kategoriak`** — colors, icons, sort order, **eu/es** names via **`category_messages`**, soft delete when unused, reorder endpoint
- See also [consumptions.md](./consumptions.md) Story 5

---

## Epic: Stock Management

### Story 4: Stock Updates

**As a** Sotolaria  
**I want to** update stock levels  
**So that** inventory quantities are accurate

**Acceptance Criteria:**

- **Shipped:** per-product **`stock_mode`**: **`auto`** (consumption decrements stock + **`stock_movements`** type **`consumption`**), **`manual`** (stock updates only via **`/hornidurak`**, stock take finalize, **`POST /api/products/:id/adjust`** — POS does not decrement), **`none`** (no inventory: no receipt lines, excluded from stock takes and low-stock; adjust rejected)
- **Shipped:** manual stock changes via **`Stock doitu` / adjust dialog** on **`/produktuak`** and audited **`POST /api/products/:id/adjust`** (not available when **`stock_mode`** is **`none`**)
- **Shipped:** automatic decrement when consumption items are posted — **only** when **`stock_mode`** is **`auto`**
- ❌ Batch adjustment wizard — **not implemented**

---

### Story 5: Low Stock Alerts

**As a** Sotolaria  
**I want to** be warned when stock is low  
**So that** I can reorder in time

**Acceptance Criteria:**

- **Shipped:** `minStock` threshold on product; low-stock banner / highlighting on **`ProductsPage`**
- **Shipped:** In-app notifications to **admin** / **cellarman** (full members) when stock first crosses to at or below `minStock`, debounced per product via DB flag **`low_stock_notified`** (cleared when stock rises above threshold); reconciliation after consumptions, adjustments, receipts, stock take finalize, and catalog create/update
- **Shipped:** Dashboard card for product managers — **`GET /api/products/low-stock-summary`** + widget on **`/`** (Hasiera)
- ❌ Supplier integrations — **not implemented**

---

### Story 6: Inventory Movements

**As a** Sotolaria  
**I want to** inspect stock change history  
**So that** I have visibility into movements

**Acceptance Criteria:**

- **Shipped:** `stock_movements` populated from **consumption** (type **`consumption`**) and from **adjust / damage** ( **`POST /api/products/:id/adjust`** )
- **Shipped:** **`GET /api/stock-movements`** (filters: product, type, date range, pagination) and **`GET /api/products/:id/stock-movements`**
- **Shipped:** admin UI **`/stock-aldaketak`** (“Stock aldaketak”) — list and filters (distinct from account **`/mugimenduak`**)
- **Shipped:** **`purchase`** rows from **`POST /api/stock-receipts`** (hornidura / supply receipt); see Purchase epic

---

## Epic: Purchase Management

### Stories 7–9: Purchases, Suppliers, POs

**Acceptance criteria (current):**

- **Shipped:** **`stock_receipts`** + **`stock_receipt_lines`**; **`POST /api/stock-receipts`** (multi-line, updates `products.stock`, **`stock_movements`** type **`purchase`**); **`GET /api/stock-receipts`** and **`GET /api/stock-receipts/:id`**; UI **`/hornidurak`**
- ❌ **`supplier`** row is still free text on product and optional fields on receipt — **no** supplier master / PO workflow

---

## Epic: Stock take (physical count)

### Story: Periodic inventory count

**As a** Sotolaria  
**I want to** run a stock take and align system quantities with the count  
**So that** drift is corrected with an audit trail

**Acceptance criteria:**

- **Shipped:** **`stock_takes`** + **`stock_take_lines`**; one **draft** per society (DB unique partial index); **`POST /api/stock-takes`** (all active products or optional `productIds`); **`PATCH /api/stock-takes/:takeId/lines/:lineId`**; **`POST /api/stock-takes/:id/finalize`** (writes **`adjustment`** movements when counted ≠ current stock); **`POST /api/stock-takes/:id/cancel`**; UI **`/inbentarioa`**

---

## Epic: Inventory Analytics

### Stories 10–12: Reports, consumption analytics, optimization

**Status:** ❌ **Not implemented**
