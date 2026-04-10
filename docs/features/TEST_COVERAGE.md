# Test coverage matrix

Status legend: **✓** = covered · **—** = not applicable / deferred · _(empty)_ = gap to fill later.

**Tiers**

| Tier            | Command / location                                                                | Purpose                                         |
| --------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Unit**        | `pnpm test:unit` — `server/**/*.test.ts`, `shared/**/*.test.ts` (Vitest)          | Pure logic, mocked DB                           |
| **Integration** | `pnpm test:integration` — `integration/features/*.feature` (Cucumber + Supertest) | API contracts, RBAC, business rules (seeded DB) |
| **E2E**         | `pnpm test:e2e` — `e2e/features/*.feature` (Cucumber + Playwright)                | Critical UI journeys                            |

**Maintenance:** When you add or change a behavioral test, update this file and keep `IMPLEMENTATION_STATUS.md` aligned. Integration scenarios may use `@story:…` tags for traceability (`grep -r '@story:' integration/features/`).

---

## 1. Authentication (`authentication.md`)

| Story area                                | Unit                         | Integration                                  | E2E                       |
| ----------------------------------------- | ---------------------------- | -------------------------------------------- | ------------------------- |
| Login / tokens / cookies / tenant-by-host | `shared/tenant-host.test.ts` | `auth.feature` (incl. public tenant-by-host) | `login.feature` (UI)      |
| Refresh / logout                          | —                            | `auth.feature`                               | —                         |
| RBAC (API)                                | —                            | `rbac.feature`                               | —                         |
| RBAC (sidebar / URL)                      | —                            | —                                            | `role-based-menu.feature` |

## 2. User management (`user-management.md`)

| Story area                  | Unit | Integration                     | E2E                              |
| --------------------------- | ---- | ------------------------------- | -------------------------------- |
| List / create / permissions | —    | `users.feature`, `rbac.feature` | `users.feature` (create flow UI) |

## 3. Reservations (`reservations.md`)

| Story area                    | Unit | Integration                                                                                                                | E2E                                             |
| ----------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| CRUD / list                   | —    | `reservations.feature`                                                                                                     | `reservation-management.feature`                |
| Configurable meal types (API) | —    | `reservations.feature` (`@reservation-meal-types-restricted`), `societies.feature` (`@society-reservation-meal-types-put`) | —                                               |
| Prepayment ledger floor (API) | —    | `reservations.feature` (`@prepayment-ledger-floor`)                                                                        | —                                               |
| Prepayment ledger floor (UI)  | —    | —                                                                                                                          | `prepayment-ledger-floor.feature`               |
| Cancellation + notification   | —    | —                                                                                                                          | `reservation-cancellation-notification.feature` |

## 3a. Society calendar (`society-calendar.md`)

| Story area                       | Unit | Integration                                                 | E2E |
| -------------------------------- | ---- | ----------------------------------------------------------- | --- |
| Events CRUD + reservation blocks | —    | `society-calendar.feature` (`@story:cal-1`, `@story:cal-3`) | —   |

## 4. Consumptions (`consumptions.md`)

| Story area                       | Unit | Integration                | E2E                              |
| -------------------------------- | ---- | -------------------------- | -------------------------------- |
| Session / items / close          | —    | `consumptions.feature`     | `consumption-management.feature` |
| Cash pending / settlements (API) | —    | `cash-settlements.feature` | —                                |

## 5. Ledger & prepayments (`account-movements.md`, credits)

| Story area                         | Unit                            | Integration                 | E2E                                       |
| ---------------------------------- | ------------------------------- | --------------------------- | ----------------------------------------- |
| My movements / refund (API)        | ✓ (ledger math, select helpers) | `account-movements.feature` | —                                         |
| Bank transfers / validate / reject | —                               | `bank-transfers.feature`    | `bank-transfers.feature` (ledger line UI) |
| SEPA bounce (unknown credit)       | —                               | `account-movements.feature` | —                                         |
| Debts / credits listing (API)      | —                               | `debts.feature`             | —                                         |

## 6. Catalog & society settings

| Story area                                                    | Unit | Integration          | E2E                              |
| ------------------------------------------------------------- | ---- | -------------------- | -------------------------------- |
| Products CRUD                                                 | —    | `products.feature`   | —                                |
| Categories                                                    | —    | `categories.feature` | —                                |
| Society PATCH (incl. payment methods, reservation meal types) | —    | `societies.feature`  | `society-management.feature`     |
| Image uploads (logo, map, avatar, product)                    | —    | —                    | —                                |
| SEPA mode / sidebar                                           | —    | —                    | `sepa-billing-frequency.feature` |

## 7. Inventory / stock (`inventory.md`)

| Story area              | Unit                  | Integration     | E2E |
| ----------------------- | --------------------- | --------------- | --- |
| Movements list / adjust | ✓ (inventory helpers) | `stock.feature` | —   |

## 8. Communication (`communication.md`)

| Story area                      | Unit                                         | Integration             | E2E |
| ------------------------------- | -------------------------------------------- | ----------------------- | --- |
| Notifications                   | —                                            | `notifications.feature` | —   |
| Email content locale resolution | `server/lib/mail/notification-email.test.ts` | —                       | —   |
| Notes                           | —                                            | `notes.feature`         | —   |

## 9. Subscriptions

| Story area              | Unit | Integration             | E2E |
| ----------------------- | ---- | ----------------------- | --- |
| Subscription types CRUD | —    | `subscriptions.feature` | —   |

## 10. Real-time debt UI

| Story area                            | Unit | Integration | E2E                                  |
| ------------------------------------- | ---- | ----------- | ------------------------------------ |
| Zorrak grid updates after consumption | —    | —           | `real-time-debt-calculation.feature` |

## 11. User profile (`user-profile.md`)

| Story area   | Unit | Integration | E2E                    |
| ------------ | ---- | ----------- | ---------------------- |
| IBAN edit UX | —    | —           | `user-profile.feature` |

---

### E2E features removed or slimmed (superseded by integration)

API-heavy or duplicate coverage was moved to `integration/` per the integration test strategy. Removed E2E features include: `my-debts`, `zorrak-debts`, `society-accounting`, `consumption-cash-pending`, `sepa-bounce`, `refunds`, `stock-takes`, `stock-receipts`, `stock-changes`, `society-payment-methods`, `product-management`. Slimmed: `role-based-menu` (no in-browser API 403 checks), `prepayment-ledger-floor` (no API call from browser), `bank-transfers` (single UI scenario), `society-management` (single scenario), `sepa-billing-frequency` (SEPA disabled / sidebar only).
