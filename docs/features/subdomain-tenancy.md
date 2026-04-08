# User stories: Tenant subdomains (optional multitenancy)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) (Authentication + Platform backoffice + Public landing).

## Epic: Host-based tenant entry

### Story 1: Resolve tenant from subdomain

**As a** visitor  
**I want to** open the app on my society’s subdomain  
**So that** I see that society’s branding on login and do not need the public marketing page

**Acceptance criteria (shipped):**

- Optional env **`TENANT_APEX_DOMAIN`** (e.g. `example.com`) on the API; optional **`VITE_TENANT_APEX_DOMAIN`** (same value) on the SPA build for first-paint routing.
- **`GET /api/public/tenant-by-host`** returns `{ mode: "apex" }` on apex/`www`, or `{ mode: "tenant", societyId, alphabeticId, name, acronym, shortDescription, logoUrl }` for `{subdomain}.{apex}` when `societies.subdomain` matches.
- Unauthenticated users on a valid tenant host are redirected from `/` and `/hasiera` to **`/sartu`** (no landing CTA).
- **`POST /api/login`** resolves the society from the **`Host`** header when on a tenant host and rejects mismatched `societyId` in the body.

### Story 2: Superadmin configures subdomain

**As a** superadmin  
**I want to** set a unique DNS label per society  
**So that** each tenant can use its own subdomain

**Acceptance criteria (shipped):**

- Column **`societies.subdomain`** (nullable, unique when set); validation (DNS label, reserved words).
- **`PATCH /api/backoffice/societies/:id`** with `{ subdomain: string | null }`; **`GET /api/backoffice/societies/check-subdomain`** for UI validation.
- Backoffice societies UI: edit subdomain per society with availability feedback.

### Operations

- Nginx: same upstream for apex and **`*.apex`**; TLS wildcard via Let’s Encrypt **DNS-01** (see [INSTALLATION_UBUNTU_24.md](../INSTALLATION_UBUNTU_24.md)).
- **`TRUST_PROXY=1`** or production enables **`trust proxy`** in Express for correct secure/client IP behavior behind nginx.
