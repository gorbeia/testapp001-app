# Elkartearen App

A modern web application built with React, TypeScript, and Express.js for managing a gastronomic society.

**Naming:** Docs and this repo use **Elkartearen App**. The running UI is branded **Gure Txokoa** in `client/index.html` and baseline translations (`client/src/lib/i18n.ts`).

## Prerequisites

- **Node.js** — version in `package.json` → `engines` (currently **Node >= 24**).
- **pnpm** — install: https://pnpm.io/installation
- **Docker** and **Docker Compose** — for local PostgreSQL (`pnpm docker:db:up`)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd <repo-directory>
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Environment variables**

   ```bash
   cp .env.example .env
   ```

   Adjust at least:
   - **`DATABASE_URL`** — must match your Postgres (default in `.env.example` matches `docker-compose.yml`: user/password `postgres`, database `elkartearen`, port `5432`).
   - **`SESSION_SECRET`** — set a long random string for sessions.
   - **`JWT_SECRET`** — signs and verifies **society app** access and refresh tokens (cookies / `Authorization: Bearer`). See `.env.example` for a **local-only** placeholder; in production use a strong random secret (never the example value).
   - **`BACKOFFICE_JWT_SECRET`** — same idea for **`/elkarteapp/kudeaketa`** superadmin JWTs (`server/routes/backoffice.ts`).
   - **`PORT`** — dev server port (default **5000**).
   - **`VITE_API_URL`** — API base URL the browser uses (for local dev, `http://localhost:5000` is typical).

## Database Setup

1. **Start PostgreSQL (Docker)**

   ```bash
   pnpm docker:db:up
   ```

   Wait until the container is healthy (Compose defines a healthcheck).

2. **Apply schema (Drizzle push)**

   ```bash
   pnpm db:push
   ```

   This syncs `shared/schema.ts` to the database (no separate migration files required for a fresh local DB).

3. **Seed demo data (recommended for local use and E2E)**

   ```bash
   pnpm db:seed
   ```

   Creates societies, users, products, reservations, etc. Demo login used in E2E: society **`GT001`**, password **`demo`** (e.g. admin: **`admin@txokoa.eus`**).

**Full reset (wipe + push + optional seed):**

```bash
pnpm db:reset:seed
```

(`pnpm db:reset` drops **all** `public` tables and runs `db:push`; it does **not** run `drizzle-kit migrate` in the classical sense.)

### Database commands (quick reference)

| Command                | When to use                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| `pnpm docker:db:up`    | Start local Postgres (Docker).                                             |
| `pnpm db:push`         | Sync `shared/schema.ts` to the DB (typical **local dev**).                 |
| `pnpm db:seed`         | Load demo data via **`script/seed.ts`** (single process).                  |
| `pnpm db:reset`        | Wipe `public` + `db:push` (destructive; **local/dev only**).               |
| `pnpm db:reset:seed`   | `db:reset` then `db:seed`.                                                 |
| `pnpm db:generate`     | Generate SQL migrations from schema (review/commit for deploy).            |
| `pnpm db:migrate`      | Apply pending migrations from `./migrations`.                              |
| `pnpm db:studio`       | Drizzle Studio (browse data).                                              |
| `pnpm docker:db:reset` | Recreate Postgres volume (empty server; then `db:push` / `db:reset:seed`). |

## Running the Application

### Development

```bash
pnpm dev
```

Open **http://localhost:5000** (or your `PORT`).

If **`pnpm dev`** fails with **`listen ENOTSUP`** (common on macOS with `reusePort`), the dev server no longer enables `reusePort` by default. If binding to **`0.0.0.0`** still fails (e.g. some sandboxes), set **`HOST=127.0.0.1`** in `.env` and open the same URL.

If you see **`EADDRINUSE`** on port 5000: **on macOS**, Apple **AirPlay Receiver** often binds port 5000 (process name **ControlCenter** in `lsof`). Turn it off under **System Settings → General → AirDrop & Handoff → AirPlay Receiver**, **or** set **`PORT=5001`** and **`VITE_API_URL=http://localhost:5001`** in `.env` — E2E tests then use that origin automatically (or set **`E2E_BASE_URL`** explicitly to override). Open `http://localhost:5001`. Otherwise, stop any other **`pnpm dev`** or run **`lsof -i :5000`** / **`kill <pid>`**.

### Production build

```bash
pnpm build
pnpm start
```

Serves the built client and the bundled API from `dist/`.

---

## E2E tests (Playwright + Cucumber)

Tests live under `e2e/features/` (Gherkin) and `e2e/steps/` (Playwright + Cucumber).

### One-time setup

1. **Playwright browser binaries**

   ```bash
   pnpm exec playwright install
   ```

2. **Database** — Postgres running, schema applied, **seeded** (same as “Seed demo data” above):

   ```bash
   pnpm docker:db:up
   pnpm db:push
   pnpm db:seed
   ```

### Running E2E

1. **Terminal A — app running**

   ```bash
   pnpm dev
   ```

2. **Terminal B — tests**

   ```bash
   pnpm test:e2e
   ```

   Playwright’s base URL comes from **`e2e/steps/base-url.ts`**, which loads **`.env`** and **`.env.local`**. Resolution order: **`E2E_BASE_URL`** if set, else **`VITE_API_URL`**, else **`http://localhost:${PORT}`** (PORT defaults to 5000). Keep **`PORT`** / **`VITE_API_URL`** aligned with **`pnpm dev`**.

**Focused runs:**

```bash
# Only scenarios tagged @only in the feature files
pnpm test:e2e:only

# Single feature file (note the `--` so pnpm forwards the path)
pnpm test:e2e:feature -- e2e/features/login.feature

# Verbose step-by-step output (pretty formatter)
pnpm test:e2e:verbose
pnpm test:e2e:feature:verbose -- e2e/features/login.feature

# Optional: print step debug logs from e2eDebug()
E2E_DEBUG=1 pnpm test:e2e
```

### E2E environment variables

- **`E2E_BASE_URL`** — optional override for the SPA origin used in all `page.goto` calls.
- **`E2E_DEBUG`** — set to `1` or `true` to print optional step diagnostics (`e2eDebug` in step files).
- If omitted, **`VITE_API_URL`** is used (typical dev setup), then **`http://localhost:${PORT}`**.

Playwright launch options in `login.steps.ts` treat **`E2E_HEADED`** as follows:

- Set **`E2E_HEADED=false`** for **headless** Chromium.
- If **`E2E_HEADED` is unset** or not `"false"`, the browser runs **headed** (visible) with the current step defaults.

Adjust if your local runs need a different default.

### Coverage overview

There are **12** feature files under `e2e/features/` (login, users, profile, reservations, products, consumptions, debts, society, menus, notifications/real-time, etc.). For gaps vs API surface, see `docs/KNOWN_ISSUES.md`.

---

## Available scripts

| Script                                    | Purpose                                                        |
| ----------------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                                | Development server (Express + Vite middleware)                 |
| `pnpm build`                              | Production build (client + server bundle)                      |
| `pnpm start`                              | Run production bundle                                          |
| `pnpm check`                              | TypeScript (`tsc`)                                             |
| `pnpm lint` / `pnpm lint:fix`             | ESLint (`lint` fails on any warning)                           |
| `pnpm lint:ci`                            | ESLint **errors only** (used by CI; ignores warning noise)     |
| `pnpm format` / `pnpm format:check`       | Prettier                                                       |
| `pnpm db:push`                            | Push Drizzle schema to DB                                      |
| `pnpm db:generate` / `pnpm db:migrate`    | Migrations workflow (when you use migration files)             |
| `pnpm db:studio`                          | Drizzle Studio                                                 |
| `pnpm db:seed`                            | Seed demo data                                                 |
| `pnpm db:reset`                           | Drop app tables + `db:push`                                    |
| `pnpm db:reset:seed`                      | `db:reset` then `db:seed`                                      |
| `pnpm docker:db:up` / `down` / `reset`    | Postgres via Docker Compose                                    |
| `pnpm test:unit`                          | Vitest unit tests (ledger rules/service; no DB)                |
| `pnpm test:e2e`                           | Full Cucumber suite (compact **`progress-bar`** output)        |
| `pnpm test:e2e:verbose`                   | Same suite, **pretty** (verbose) formatter                     |
| `pnpm test:e2e:only`                      | `@only` scenarios                                              |
| `pnpm test:e2e:feature -- <path>`         | One `.feature` file                                            |
| `pnpm test:e2e:feature:verbose -- <path>` | One feature file, **pretty** formatter                         |
| `pnpm audit:security`                     | Dependency security audit (see below)                          |
| `pnpm audit:security:prod`                | Same audit, **production** dependencies only (`pnpm audit -P`) |

### Dependency security audit

Runs two open-source checks via [`script/security-audit.mjs`](script/security-audit.mjs):

1. **`pnpm audit`** — npm security advisory database; **moderate** and above fail the script. Uses the **public** registry (`https://registry.npmjs.org/`) for the audit request so private mirrors that do not implement the audit API still work. Override with **`PNPM_AUDIT_REGISTRY`** if needed.
2. **[Retire.js](https://github.com/RetireJS/retire.js)** — scans `node_modules` for JS libraries with known vulnerabilities (`pnpm exec retire`, **medium+** severity fails).

Apply fixes with **`pnpm audit --fix`** (review lockfile changes) or targeted dependency upgrades. **Retire** may flag **transitive** copies of libraries (e.g. nested `lodash`); resolve with overrides/upstream upgrades or a [`.retireignore.json`](https://github.com/RetireJS/retire.js) only when accepted as false positives.

### GitHub Actions

Workflows in [`.github/workflows/`](.github/workflows/): **CI** (Prettier, `pnpm check`, `pnpm lint:ci`, `pnpm test:unit`, `pnpm build` on PRs and pushes to `main`), **E2E** (Postgres service, `drizzle-kit push`, `pnpm db:seed`, `pnpm dev`, `pnpm test:e2e`), and **Security audit** (weekly + manual, `pnpm audit:security`).

---

## More documentation

- Feature specs and implementation status: `docs/features/`
- Technical overview: `TECHNICAL_DOCUMENTATION.md`
- Known issues / debt: `docs/KNOWN_ISSUES.md`
