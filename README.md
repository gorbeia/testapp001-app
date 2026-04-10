# Elkartearen App · Gure Txokoa

Web application for **gastronomic societies** (elkarte gastronomikoak): members manage reservations, consumptions, debts, inventory, and society communication from one place.

**Naming:** documentation and the repo use **Elkartearen App**; the member-facing UI is branded **Gure Txokoa** (see `client/index.html` and baseline copy in `client/src/lib/i18n.ts`).

---

## What it does

- **Members and companions** — Profiles, roles (admin, treasurer, cellarman, member), linked companion accounts.
- **Reservations** — Calendar, personal and admin views, table booking, pricing and prepayment rules where configured.
- **Consumptions** — POS-style consumption flow, history, cash settlement where enabled.
- **Money** — Account ledger, debts/credits, SEPA-related flows, bank transfer prepayment proposals, statements.
- **Inventory** — Products, categories, stock movements, receipts, stock takes, low-stock signals.
- **Society** — Settings (IBAN, SEPA cadence, payment methods, logo, reservation map), tables, subscription types.
- **Communication** — Society notes (oharrak), in-app notifications (jakinarazpenak), optional **email** for user-targeted notifications when SMTP is configured.
- **Public entry** — Bilingual marketing landing and **member login**; optional **per-society subdomain** for tenant routing.

Primary UI languages: **Euskara (eu)** and **Castellano (es)**. Many routes use Basque URL slugs (e.g. `/egutegia`, `/profila`).

---

## Who uses which area

| Audience | Purpose |
|----------|---------|
| **Bazkidea / Laguna** | Day-to-day: reservations, consumptions, profile, notifications, own movements/debts as allowed. |
| **Administratzailea, Diruzaina, Sotolaria** | Same app, extra menus: users, society settings, inventory, credits, movements, notes, etc., per permissions. |
| **Platform superadmin** | **Separate** session: create/manage **all societies** on the platform, superadmin accounts, subdomain DNS labels, and **SMTP test / email status** (no society member login). |

---

## Where to sign in

### Society app (members and staff)

- **Login:** **`/sartu`** (and deep links redirect here when logged out).
- **Landing (not on a tenant-only host):** **`/`** or **`/hasiera`** — public marketing; locale is independent of the signed-in app language.
- After login, navigation is **society-scoped** (one tenant per session, from login or host).

### Platform superadmin (multisociety backoffice)

Use this only for **hosting operators** who manage the whole installation, not for a single society’s day-to-day admins.

| Route | What it is |
|-------|------------|
| **`/elkarteapp/kudeaketa/login`** | Superadmin login (credentials in the `superadmins` table; **httpOnly** cookie, separate from member JWT). |
| **`/elkarteapp/kudeaketa`** | Redirects into the backoffice (societies list). |
| **`/elkarteapp/kudeaketa/societies`** | List/create societies, assign **subdomain** for tenant hosts. |
| **`/elkarteapp/kudeaketa/superadmins`** | Manage superadmin accounts. |
| **`/elkarteapp/kudeaketa/email`** | View outbound mail env flags (no secrets) and send an **SMTP test** message. |

> **Security:** Restrict who can reach `/elkarteapp/kudeaketa*` in production (path-based rules, VPN, or separate admin hostname) in addition to strong `BACKOFFICE_JWT_SECRET` and superadmin passwords.

---

## Documentation

| Document | Contents |
|----------|----------|
| **[docs/features/](docs/features/)** | User stories, acceptance criteria, **implementation status**, test coverage matrix. |
| **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** | Local dev: Node/pnpm, `.env`, Docker Postgres, `db:push` / seed, `pnpm dev`, tests, scripts, CI. |
| **[docs/INSTALLATION_UBUNTU_24.md](docs/INSTALLATION_UBUNTU_24.md)** | Production-style install on Ubuntu (PostgreSQL, env, TLS, SMTP, etc.). |
| **[TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md)** | Stack, folders, auth model, architecture notes. |
| **[docs/features/subdomain-tenancy.md](docs/features/subdomain-tenancy.md)** | Tenant apex domain and `societies.subdomain`. |
| **[docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)** | Gaps and technical debt. |

---

## Contributing / building from source

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for prerequisites, `pnpm install`, database setup, and test commands.
