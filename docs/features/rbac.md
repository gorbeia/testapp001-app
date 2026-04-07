# Role-Based Access Control (RBAC)

## Goals

- **One access model**: fine-grained **permissions** checked on API and client.
- **Two user attributes** (stored on `users`):
  - **`accessRole`**: `admin` | `treasurer` | `cellarman` | `member` — determines which permissions the user has.
  - **`membershipType`**: `full_member` | `companion` — business classification (e.g. pricing, product write rules for companions); not a permission list.

## Permission catalog

Permissions are defined in code in [`shared/permissions.ts`](../../shared/permissions.ts) (`Permission` constants). Each permission maps to specific routes or behaviors.

## Role → permission mapping

Also in [`shared/permissions.ts`](../../shared/permissions.ts): `ROLE_PERMISSIONS`.

- **`admin`**: all permissions.
- **`treasurer`**: financial/registry operations (credits, SEPA, movements, bank transfers, society settings, categories, reservation registry, moderate others’ reservations, etc.) — see file for the exact list.
- **`cellarman`**: products (when also `full_member`), consumptions admin, reservation moderation, user list, notification broadcast.
- **`member`**: no extra permissions (own data only, per existing `requireAuth` routes).

## API enforcement

- [`server/routes/middleware.ts`](../../server/routes/middleware.ts): `requirePermission(...permissions)` — user must have **at least one** of the listed permissions (OR).
- Legacy `requireAdmin` / `requireTreasurer` removed; each route declares the permission(s) it needs.

## JWT session

[`jwtUserPayloadSchema`](../../shared/schema.ts) includes `accessRole` and `membershipType` (not the old `role` / `function` text fields).

## Client enforcement

- [`client/src/lib/auth.ts`](../../client/src/lib/auth.ts): `userCan(user, permission)` using shared `hasPermission`.
- [`ProtectedRoute`](../../client/src/components/ProtectedRoute.tsx): `requires={Permission.X}` or an array (OR).
- Sidebar and pages use `userCan` / `Permission` for visibility.

## User management UI

[`UsersPage`](../../client/src/pages/UsersPage.tsx): admins set **membership type** and **access role**; effective permissions for the selected role are shown as read-only chips. `POST /api/users` accepts optional `accessRole`, `membershipType`, contact fields, and linked member.

## Database

PostgreSQL enums `access_role` and `membership_type`; migration [`migrations/0005_user_rbac.sql`](../../migrations/0005_user_rbac.sql) backfills from legacy `function` / `role` columns when present.

## Related stories

- [`authentication.md`](./authentication.md) — login/session
- [`user-management.md`](./user-management.md) — admin user CRUD
