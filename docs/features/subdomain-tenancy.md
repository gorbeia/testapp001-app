# User stories: Tenant subdomains (optional multitenancy)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) (Authentication + Platform backoffice + Public landing).

## Epic: Host-based tenant entry

### Story 1: Resolve tenant from subdomain

**As a** visitor  
**I want to** open the app on my society’s subdomain  
**So that** I see that society’s branding on login and do not need the public marketing page

**Acceptance criteria (shipped):**

- Optional env **`TENANT_APEX_DOMAIN`** (e.g. `example.com`) on the API; optional **`VITE_TENANT_APEX_DOMAIN`** (same value) on the SPA build for first-paint routing.
- **`GET /api/public/tenant-by-host`** returns `{ mode: "apex", multitenancyEnabled }` on apex/`www` (or when env is off), or `{ mode: "tenant", … }` for `{subdomain}.{apex}` when `societies.subdomain` matches. Use **`multitenancyEnabled`** to see if the server has **`TENANT_APEX_DOMAIN`** set.
- Unauthenticated users on a valid tenant host are redirected from `/` and `/hasiera` to **`/sartu`** (no landing CTA).
- **`POST /api/login`** resolves the society from the **`Host`** header when on a tenant host and rejects mismatched `societyId` in the body.
- When multitenancy is enabled, **`POST /api/login`** on the **apex** or **`www`** host returns **403** with code **`LOGIN_REQUIRES_TENANT_HOST`** (society sign-in must happen on the tenant subdomain).

### Story 2: Superadmin configures subdomain

**As a** superadmin  
**I want to** set a unique DNS label per society  
**So that** each tenant can use its own subdomain

**Acceptance criteria (shipped):**

- Column **`societies.subdomain`** (nullable, unique when set); validation (DNS label, reserved words).
- **`PATCH /api/backoffice/societies/:id`** with `{ subdomain: string | null }`; **`GET /api/backoffice/societies/check-subdomain`** for UI validation.
- Backoffice societies UI: edit subdomain per society with availability feedback.

### Story 3: Apex is marketing-only (subdomain mode)

**As a** visitor on the main site  
**I want** create-society to be the primary action and society sign-in to use each society’s URL  
**So that** I am not confused by a full app login on the wrong host

**Acceptance criteria (shipped):**

- On **`mode: "apex"`** with **`multitenancyEnabled: true`**, the SPA only exposes marketing routes: **`/`**, **`/hasiera`**, **`/sortu-elkartea`**, **`/egiaztatu-posta`**, **`/elkartea-sartu`** (access help), forgot/reset password, and superadmin **`/elkarteapp/kudeaketa/*`**.
- **`/sartu`** on apex redirects to **`/elkartea-sartu`**. Other deep links redirect to **`/`**.
- If a society session cookie exists on apex (edge case), the client clears the session and returns to **`/`**.
- **`VITE_TENANT_APEX_DOMAIN`** + **`GET /api/public/tenant-by-host`** drive the same behavior in the client.

### Story 4: Email reminder of society URLs

**As a** member who forgot their society web address  
**I want** to enter my login email on the main site  
**So that** I receive links to each tenant I can access

**Acceptance criteria (shipped):**

- **`POST /api/public/society-access-urls`** with **`{ email }`**: returns **200** `{ ok: true }` always (anti-enumeration); **404** when **`TENANT_APEX_DOMAIN`** is not set (non-multitenancy installs).
- When the email matches verified, active users in societies with a **non-null subdomain**, the app sends one email listing **`https://{subdomain}.{TENANT_APEX_DOMAIN}/sartu`** per society.
- Rate limits align with public password reset (IP + per-email bucket).
- Login email is **unique per society** (`users` composite unique on **`(society_id, username)`**), so the same address may have separate accounts in different societies.

### Operations

- Nginx: same upstream for apex and **`*.apex`**; TLS wildcard via Let’s Encrypt **DNS-01** (see [INSTALLATION_UBUNTU_24.md](../INSTALLATION_UBUNTU_24.md)).
- **`TRUST_PROXY=1`** or production enables **`trust proxy`** in Express for correct secure/client IP behavior behind nginx.

### Why does `GET /api/public/tenant-by-host` return `{ "mode": "apex" }`?

- **`multitenancyEnabled: false`** in the JSON means **`TENANT_APEX_DOMAIN` is not set** for the Node process (PM2 / systemd / Docker must load the same env you use locally). Fix: set the variable and restart the app.
- **`multitenancyEnabled: true`** with **`mode: "apex"`** means multitenancy is on, but the **`Host`** header is not exactly **`{subdomain}.{TENANT_APEX_DOMAIN}`** (e.g. you opened the apex or `www`, the browser host is `localhost`, nginx forwards the wrong host, or `TENANT_APEX_DOMAIN` does not match the real DNS suffix).
- The Host must be a **single** label plus apex (not `a.b.example.com`); see [`shared/tenant-host.ts`](../../shared/tenant-host.ts) `parseHostForTenant`.
