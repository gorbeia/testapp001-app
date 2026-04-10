# Public society self-signup (marketing / landing)

## Goal

Allow visitors on the **public apex** site to provision a new tenant (`societies` row + first **admin** `users` row), opt in to product news, verify email, and sign in (including host-based tenant URL when multitenancy is configured).

## User stories

### Story 1: Configure society from landing

**As a** potential buyer  
**I want to** enter my society details and administrator account on the public site  
**So that** I can start using the application without backoffice intervention

**Acceptance criteria (shipped):**

- Landing CTAs on `/` and `/hasiera` link to `/sortu-elkartea` (`client/src/landing/` — isolated copy in `landing/i18n.ts`).
- Form collects society profile (name, optional tagline, acronym, contact), optional subdomain when `VITE_TENANT_APEX_DOMAIN` / `TENANT_APEX_DOMAIN` are set, administrator name/email/password, **marketing opt-in** (off by default), and **terms acceptance** (required).
- Submits to `POST /api/public/society-signup` (rate-limited). New societies use `sepaMode: "disabled"` until configured in-app, with explicit default `paymentMethods` / `reservationMealTypes`, plus **bootstrap** rows: one general product category (eu/es messages) and one reservation table (`Mahaia 1`, capacity 1–50) so the first admin can add products and reservations immediately (`server/lib/society-provision.ts`).
- Success: redirects to `https://{subdomain}.{apex}/sartu` when multitenancy is enabled; otherwise shows alphabetic society id and link to `/sartu`.
- User receives a **verification email** (via existing `sendRawEmail` / SMTP when configured; `MAIL_LOG_TO_STDOUT` supported).

### Story 2: Verify email

**As a** new administrator  
**I want to** confirm my email address  
**So that** I can sign in securely

**Acceptance criteria (shipped):**

- Email contains a link to `/egiaztatu-posta?token=…` (base URL from `APP_PUBLIC_ORIGIN`, or local default `http://localhost:${PORT}` when unset — same as `pnpm dev`).
- `GET /api/public/verify-email?token=…` validates a hashed token in `user_email_verifications`, sets `users.email_verified_at`, sends welcome email, returns JSON `ok`.
- `POST /api/login` returns **403** with `code: "EMAIL_NOT_VERIFIED"` until verified; app login UI shows `emailNotVerified` (`client/src/lib/i18n.ts`).

### Story 3: Public subdomain check

**As a** visitor  
**I want to** see whether my chosen subdomain is free  
**So that** I can complete signup without surprises

**Acceptance criteria (shipped):**

- `GET /api/public/check-subdomain?value=…` (rate-limited) returns `{ available, reason? }` using the same rules as backoffice (`shared/tenant-host.ts`).

## Data model

- `users.marketing_opt_in` (boolean, default false).
- `users.email_verified_at` (nullable timestamp). **Existing** accounts after upgrade must run `pnpm db:backfill:email-verified` or re-seed so login is not blocked.
- `user_email_verifications` (one-time token hash, `expires_at`, cascade delete on user).

## Related code

- API: `server/routes/public-signup.ts`, `server/lib/society-provision.ts`, `server/lib/mail/signup-email.ts`
- Shared validation: `publicSocietySignupBodySchema`, `publicVerifyEmailQuerySchema` in `shared/schema.ts`
- Landing UI: `client/src/landing/CreateSocietyLandingPage.tsx`, `VerifyEmailLandingPage.tsx`
