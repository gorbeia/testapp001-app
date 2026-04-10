---
name: scaffold-feature
description: >-
  Scaffolds a new tenant-scoped domain feature end-to-end in this repo: Drizzle
  schema, reset script, Express routes, client page, routing, sidebar, i18n, and
  docs. Use when the user asks to scaffold a feature, add a new domain, or
  create CRUD for a new entity (events, suppliers, etc.).
---

# Scaffold feature (Elkartetippia)

## Before coding

Confirm with the user (or infer from context):

- Entity name and DB table name(s)
- Fields and types (`varchar`, `text`, `integer`, `boolean`, FKs)
- Which roles can access the UI (`ProtectedRoute` / sidebar — see existing `App.tsx` / `AppSidebar.tsx`)
- Basque route slug (e.g. `/gertaerak`) and nav label keys
- Whether seed data is needed (`script/seed-*.ts` + register in `script/seed.ts`)

## Checklist (copy and track)

```
- [ ] shared/schema.ts — pgTable + insert*Schema (drizzle-zod)
- [ ] (No change) `script/reset.ts` — dynamic drop; new tables need no reset-script edit
- [ ] server/routes/<feature>.ts — registerXRoutes, middleware, tenancy, Zod safeParse
- [ ] server/routes/index.ts — import + registerXRoutes(app)
- [ ] client/src/pages/<Feature>Page.tsx — Query + RHF + shadcn
- [ ] client/src/App.tsx — Route + ProtectedRoute
- [ ] client/src/components/AppSidebar.tsx — nav item + access
- [ ] client/src/lib/i18n.ts — eu + es keys
- [ ] docs/features/<feature>.md + IMPLEMENTATION_STATUS.md
- [ ] Optional: script/seed-<feature>.ts + call from `script/seed.ts`
- [ ] Optional: e2e/features + e2e/steps (see create-e2e-test skill)
```

## Rules to follow

- **Tenancy:** reads/writes on tenant tables must filter by `societyId` from the JWT user (see `.cursor/rules/api-routes.mdc`). Updates/deletes: `and(eq(table.id, id), eq(table.societyId, societyId))`.
- **Validation:** validate `req.body` with `@shared/schema` insert schema + `safeParse` before insert/update.
- **`getUserSocietyId`:** match the implementation in `server/routes/index.ts`. Route modules **cannot** import from `./index` (circular). Inline the same 5-line helper or extract to a small `server/lib/` module both `index.ts` and routes can import (preferred long-term).
- **i18n:** every new UI string in **eu** and **es**.

## After implementation

- `pnpm check`
- `pnpm db:reset:seed` or `pnpm db:push` as appropriate
- Smoke-test the new route in the browser

## Reference

Templates and snippets: [reference.md](reference.md)
