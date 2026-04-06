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

- **Shipped:** edit dialog + `PUT /api/products/:id` for name, description, category, price, stock, unit, min stock, supplier, active flag
- ❌ Audit trail of field changes — **not implemented**
- **Note:** editing **`stock` directly** does **not** write a `stock_movements` row (only consumption flow does today)

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

- **Partial:** manual numeric edit via product update UI/API
- **Shipped:** automatic decrement when consumption items are posted (with **`stock_movements`** row, type **`consumption`**)
- ❌ Reason-coded adjustments, batch adjustment wizard — **not implemented**

---

### Story 5: Low Stock Alerts

**As a** Sotolaria  
**I want to** be warned when stock is low  
**So that** I can reorder in time

**Acceptance Criteria:**

- **Partial:** `minStock` threshold on product; low-stock banner / highlighting on **`ProductsPage`**
- ❌ Push notifications, supplier integrations — **not implemented**

---

### Story 6: Inventory Movements

**As a** Sotolaria  
**I want to** inspect stock change history  
**So that** I have visibility into movements

**Acceptance Criteria:**

- **Partial:** `stock_movements` table populated from **consumption** flow only (schema allows `purchase` / `adjustment` / `damage` but app does not write them yet)
- ❌ HTTP API + admin UI to list/filter movements — **not implemented**

---

## Epic: Purchase Management

### Stories 7–9: Purchases, Suppliers, POs

**Status:** ❌ **Not implemented** beyond optional **`supplier`** string on `products`.

---

## Epic: Inventory Analytics

### Stories 10–12: Reports, consumption analytics, optimization

**Status:** ❌ **Not implemented**
