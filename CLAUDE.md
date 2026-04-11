# Elkartetippia — Claude Code project instructions

## Stack

**Vite + React 18** SPA (`wouter`), **Express** API, **PostgreSQL** + **Drizzle ORM**, JWT in httpOnly cookies + Bearer, **Tailwind** + shadcn/Radix, **TanStack Query**, **RHF + Zod**.

This is **not** Next.js. Files under `client/src/components/ui/` may contain `"use client"` from shadcn templates — it has **no effect** in Vite; ignore it for routing/SSR assumptions.

## Folder map

| Path | Role |
|------|------|
| `client/src/` | React app: pages, components, hooks, `lib/` |
| `server/` | Express entry, `routes/`, `db.ts`, `lib/` |
| `shared/` | Drizzle schema, shared TS (`schema.ts`, `society.ts`) |
| `e2e/` | Cucumber features + Playwright steps (browser) |
| `integration/` | Cucumber API tests + Supertest (no browser) |
| `server/app.ts` | Express `createApp()` — used by `server/index.ts` and integration tests |
| `docs/features/` | Feature specs + `IMPLEMENTATION_STATUS.md` |
| `script/` | build, seed, DB reset |

## Path aliases (must use)

- `@/*` → `client/src/*` (see `tsconfig.json` / `vite.config.ts`)
- `@shared/*` → `shared/*`

## Multi-tenancy

Most domain rows are scoped by **`societyId`**. On the server, derive it from **`req.user`** (JWT payload) via helpers like `getUserSocietyId` — **never** trust client-sent `societyId` for authorization or row ownership on write paths.

## Product / i18n

**Euskara (eu)** is primary UI language; **Castellano (es)** secondary. Routes often use Basque slugs (e.g. `/egutegia`, `/kontsumoak`).

## When unsure

Read adjacent route files in `server/routes/`, page files in `client/src/pages/`, and `@shared/schema` before inventing new patterns.

---

## Feature workflow & docs

- Feature requirements: **`docs/features/*.md`** (user stories + acceptance criteria).
- **Live delivery tracker:** **`docs/features/IMPLEMENTATION_STATUS.md`** (✅ implemented, 🟡 partial/mock/UI-only, ❌ missing).
- **Test coverage matrix:** **`docs/features/TEST_COVERAGE.md`** — maps user stories to unit / integration / E2E tests.

**After code changes:** update `IMPLEMENTATION_STATUS.md` in the same conversation so status matches reality. When tests change, update `TEST_COVERAGE.md`.

For non-trivial features: add or extend a spec under `docs/features/` and add/update rows in `IMPLEMENTATION_STATUS.md` before or alongside implementation.

---

## Database schema (`shared/schema.ts`)

- Use **`pgTable`** from `drizzle-orm/pg-core`.
- Tenant-owned data: include **`societyId`** referencing `societies.id` unless the table is global.
- For each table that receives HTTP writes, export **`createInsertSchema(table).pick({ ... })`** (drizzle-zod). Route handlers should `safeParse` against these.
- Use Drizzle/`sql` patterns consistent with existing tables (`defaultNow()`, `updatedAt`).

**After schema changes:**
- Dev: `pnpm db:push`
- Migrations: `pnpm db:generate` then `pnpm db:migrate`
- Full reset: `pnpm db:reset` (drops all tables in `public` dynamically, then `pnpm db:push`)

---

## API routes (`server/routes`)

### Handler shape

```typescript
async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ...
  } catch (err) {
    next(err);
  }
}
```

### Middleware chain (typical order)

1. `sessionMiddleware` — JWT from cookie `auth-token` or `Authorization: Bearer`
2. `requireAuth` — `401` if no `req.user`
3. Optional: `requireAdmin`, `requireTreasurer`, or inline role checks

Import from `server/routes/middleware.ts`.

### Validation

Before **inserts/updates** from `req.body`, validate with `createInsertSchema(...).pick({...})` (or a dedicated Zod schema) from `@shared/schema`. Use `safeParse`; on failure return `400` with a clear `message`. **Do not** spread unchecked `req.body` into Drizzle.

### Tenancy

- Resolve `societyId` from **`getUserSocietyId(req.user!)`** for reads/writes.
- For updates/deletes: `and(eq(table.id, id), eq(table.societyId, societyId))`.

### Responses

- Expected failures: `res.status(4xx).json({ message: "..." })`
- Unexpected: `next(err)` → global handler returns `500`
- List/detail: `200`, Create: `201` + created row JSON

---

## React / client (`client/src`)

### UI primitives

Use **shadcn-style** components from `@/components/ui/`. Compose classes with **`cn()`** from `@/lib/utils`. Prefer **Tailwind** utilities + CSS variables from `client/src/index.css`.

### Data fetching

Use **TanStack React Query** (`useQuery`, `useMutation`). On successful mutations, `invalidateQueries` for affected keys. Prefer patterns from `client/src/lib/queryClient.ts`.

### Forms

Use **`react-hook-form`** + **`@hookform/resolvers/zod`** + a **Zod** schema. New or heavily edited forms should follow RHF + Zod (not ad-hoc `useState` for field values).

### Auth & HTTP

Use **`useAuth()`** for session. For calls outside shared query helpers, use **`authFetch`** from `@/lib/api` so `Authorization` and language headers stay consistent.

### i18n

All user-visible strings: **`useLanguage()`** + **`t("key")`**. Add keys to **both** `eu` and `es` in `client/src/lib/i18n.ts`. Do not ship hardcoded Basque/Spanish UI copy in components.

### Pages

- **Named exports** for page components where the codebase already does so.
- Wrap risky page trees with `react-error-boundary` / `ErrorFallback` where the app already uses it.
- Colocate small page-specific fetch helpers in `pages/<feature>/api.ts`.

---

## Internationalization

- **Primary:** Euskara **`eu`** · **Secondary:** Castellano **`es`**
- Client: every user-visible string via `t("key")` + `useLanguage()`. Add keys to **both** `eu` and `es` maps.
- Server (`server/lib/i18n/`): resolve language with `getLanguageFromRequest(req)`; use `translate(key, language)` or `createI18nHelper(req)` for request-scoped helpers.
- Multilingual DB fields: follow the pattern of the nearest existing table in `@shared/schema.ts`.

---

## Testing

### Test tiers

| Tier | Location | Runner | Use for |
|------|-----------|--------|---------|
| **Unit** | `server/**/*.test.ts` | Vitest | Pure logic, mocked DB |
| **Integration** | `integration/features/` | Cucumber + Supertest | API contracts, RBAC, business rules |
| **E2E** | `e2e/features/` | Cucumber + Playwright | Critical UI journeys |

Prefer new **backend** coverage in **integration** features, not browser E2E.

### E2E (`e2e/`)

- Gherkin: `e2e/features/**/*.feature` · Steps: `e2e/steps/**/*.ts`
- Base URL: `E2E_BASE_URL` → `VITE_API_URL` → `http://localhost:${PORT}` (see `e2e/steps/base-url.ts`)
- Commands: `pnpm test:e2e` · `pnpm test:e2e:verbose` · `pnpm test:e2e:only` (runs `@only` tagged) · `pnpm test:e2e:feature -- e2e/features/<name>.feature`
- Enable `E2E_DEBUG=1` for console output; `E2E_HEADED` for headed runs.
- Prefer stable selectors: roles, labels, `data-testid`. Avoid Tailwind class selectors.

### Integration (`integration/`)

- Gherkin: `integration/features/**/*.feature` · Steps: `integration/steps/**/*.ts` (Supertest on `server/app.ts` — **never** import Playwright here)
- Per-scenario Supertest agent with cookie jar (`integration/steps/hooks.ts`); store `lastResponse` and `createdIds`.
- Step layers: generic HTTP helpers → auth steps (`Given I am authenticated as a "{role}" user`) → thin domain steps.
- Commands: `pnpm test:integration` · `pnpm test:integration:verbose` · `pnpm test:integration:only` · `pnpm test:integration:feature -- integration/features/<name>.feature`
- Tag scenarios with **`@story:X-Y`** and update `docs/features/TEST_COVERAGE.md` when tests change.

### Data

Seed before runs: `pnpm db:seed` (reset if needed: `pnpm db:reset:seed`).
