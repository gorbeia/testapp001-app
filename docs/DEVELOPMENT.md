# Development guide

Local setup, database, running the app, and tests for **Elkartearen App** (UI brand: **Gure Txokoa**).

For production deployment on Ubuntu, see [INSTALLATION_UBUNTU_24.md](./INSTALLATION_UBUNTU_24.md). For architecture and stack details, see [TECHNICAL_DOCUMENTATION.md](../TECHNICAL_DOCUMENTATION.md) in the repo root.

## Prerequisites

- **Node.js** — version in `package.json` → `engines` (currently **Node ≥ 24**).
- **pnpm** — [Installation](https://pnpm.io/installation)
- **Docker** and **Docker Compose** — optional local PostgreSQL (`pnpm docker:db:up`)

## Getting started

1. **Clone and install**

```bash
git clone <repository-url>
cd <repo-directory>
pnpm install
```

2. **Environment**

```bash
cp .env.example .env
```

Adjust at least:

- **`DATABASE_URL`** — Postgres connection (default in `.env.example` matches `docker-compose.yml`: user/password `postgres`, database `elkartearen`, port `5432`).
- **`SESSION_SECRET`** — long random string for sessions.
- **`JWT_SECRET`** — signs society-app access and refresh tokens (cookies / `Authorization: Bearer`). Use a strong secret in production; the example value is for local dev only.
- **`BACKOFFICE_JWT_SECRET`** — separate secret for platform superadmin JWTs (`/elkarteapp/kudeaketa/*`).
- **`PORT`** — API dev port (default **5000**).
- **`VITE_API_URL`** — API base URL the browser uses (local dev: typically `http://localhost:5000`).

## Database

1. **Start PostgreSQL (Docker)**

```bash
pnpm docker:db:up
```

Wait until the container is healthy (Compose healthcheck).

2. **Apply schema (Drizzle push)**

```bash
pnpm db:push
```

Syncs `shared/schema.ts` to the database (no migration files required for a fresh local DB).

3. **Seed demo data** (recommended for local use and E2E)

```bash
pnpm db:seed
```

Demo login used in E2E: society **`GT001`**, password **`demo`** (e.g. admin **`admin@txokoa.eus`**).

**Full reset (wipe + push + optional seed):**

```bash
pnpm db:reset:seed
```

`pnpm db:reset` drops all `public` tables and runs `db:push` (destructive; local/dev only).

### Database commands (quick reference)

| Command | When to use |
|--------|-------------|
| `pnpm docker:db:up` | Start local Postgres (Docker). |
| `pnpm db:push` | Sync `shared/schema.ts` to the DB (typical **local dev**). |
| `pnpm db:seed` | Load demo data via `script/seed.ts`. |
| `pnpm db:reset` | Wipe `public` + `db:push` (destructive). |
| `pnpm db:reset:seed` | `db:reset` then `db:seed`. |
| `pnpm db:generate` | Generate SQL migrations from schema (review/commit for deploy). |
| `pnpm db:migrate` | Apply pending migrations from `./migrations`. |
| `pnpm db:studio` | Drizzle Studio (browse data). |
| `pnpm docker:db:reset` | Recreate Postgres volume; then `db:push` / `db:reset:seed`. |

## Running the application

### Development

```bash
pnpm dev
```

Open **http://localhost:5000** (or your `PORT`).

- If **`pnpm dev`** fails with **`listen ENOTSUP`** (e.g. macOS `reusePort`), set **`HOST=127.0.0.1`** in `.env` if needed.
- **Port 5000 in use on macOS:** AirPlay Receiver often uses 5000. Disable it under **System Settings → General → AirDrop & Handoff → AirPlay Receiver**, **or** set **`PORT=5001`** and **`VITE_API_URL=http://localhost:5001`** in `.env`. Set **`E2E_BASE_URL`** if E2E should target a non-default origin.

### Production build

```bash
pnpm build
pnpm start
```

Serves the built client and the bundled API from `dist/`.

## Tests

### Integration (API, no browser)

Cucumber + Supertest against Express **in-process** with the same **`DATABASE_URL`** as local Postgres (no `pnpm dev`).

```bash
pnpm docker:db:up
pnpm db:push
pnpm db:seed
pnpm test:integration
```

Focused runs: `pnpm test:integration:only`, `pnpm test:integration:feature -- integration/features/auth.feature`, `pnpm test:integration:verbose`. See [features/TEST_COVERAGE.md](./features/TEST_COVERAGE.md).

### E2E (Playwright + Cucumber)

1. **One-time:** `pnpm exec playwright install`
2. **DB:** Postgres up, `pnpm db:push`, `pnpm db:seed`
3. **Terminal A:** `pnpm dev`
4. **Terminal B:** `pnpm test:e2e`

Base URL: **`E2E_BASE_URL`** if set, else **`VITE_API_URL`**, else **`http://localhost:${PORT}`** (see `e2e/steps/base-url.ts`).

Focused runs:

```bash
pnpm test:e2e:only
pnpm test:e2e:feature -- e2e/features/login.feature
pnpm test:e2e:verbose
E2E_DEBUG=1 pnpm test:e2e
```

**`E2E_HEADED`:** set to `false` for headless Chromium; otherwise the default is headed.

### Unit tests

```bash
pnpm test:unit
```

Vitest (`server/**/*.test.ts`, `shared/**/*.test.ts`).

## Scripts reference

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server (Express + Vite middleware) |
| `pnpm build` / `pnpm start` | Production build / run |
| `pnpm check` | TypeScript (`tsc`) |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm lint:ci` | ESLint errors only (CI) |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm db:*` | See table above |
| `pnpm docker:db:*` | Postgres via Docker Compose |
| `pnpm test:unit` | Vitest |
| `pnpm test:integration` | Cucumber API tests |
| `pnpm test:e2e` | Cucumber browser tests |
| `pnpm audit:security` | Dependency audit ([`script/security-audit.mjs`](../script/security-audit.mjs): `pnpm audit` + Retire.js) |
| `pnpm audit:security:prod` | Audit production deps only |

Override audit registry with **`PNPM_AUDIT_REGISTRY`** if needed.

## CI

Workflows under [`.github/workflows/`](../.github/workflows/): **CI** (Prettier, `pnpm check`, `pnpm lint:ci`, `pnpm test:unit`, Postgres, `db:push`, `pnpm db:seed`, `pnpm test:integration`, `pnpm build`), **E2E** (Postgres, seed, `pnpm dev`, `pnpm test:e2e`), **Security audit** (weekly + manual).

## Related docs

- Feature specs: [docs/features/](./features/)
- Implementation status: [docs/features/IMPLEMENTATION_STATUS.md](./features/IMPLEMENTATION_STATUS.md)
- Known issues: [docs/KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
