---
name: audit-i18n
description: >-
  Audits the React client for hardcoded user-visible strings and mismatched eu/es
  translation keys in client/src/lib/i18n.ts. Use when the user asks to check
  i18n, audit translations, find hardcoded strings, or verify bilingual
  coverage.
---

# Audit i18n (client + dictionaries)

## Goal

1. Find **user-visible** strings in **`client/src/**/*.tsx`** that bypass **`t()`** from `useLanguage()`.
2. Find **key mismatches** between **`eu`** and **`es`** maps in [client/src/lib/i18n.ts](client/src/lib/i18n.ts) (and `en` if present).

## Steps — hardcoded UI strings

1. Scan **`.tsx`** files under `client/src/` (prioritize `pages/`, `components/`).
2. Flag likely user-facing literals:
   - JSX text nodes: `<div>Hello</div>` (not inside `{t(...)}`)
   - Props: `placeholder="..."`, `title="..."`, `aria-label="..."`, `alt="..."`, `description="..."` on UI components (exclude technical `className`, `data-testid`, `http` URLs)
   - `throw new Error("...")` or toast/copy that surfaces to users
3. **Allowlist** (do not flag without reason):
   - Strings already inside **`t("key")`** or **`t(\`key.${x}\`)`**
   - Dev-only `console.*` messages
   - Regex / numeric-only placeholders
   - File extensions, MIME types, test ids

4. Output a table: **file:line**, **string snippet**, **suggested `t` key**.

## Steps — dictionary parity

1. Open `client/src/lib/i18n.ts` and locate the **`eu`** and **`es`** record objects.
2. Collect keys from each (top-level keys only unless nested structure is flat).
3. Report:
   - **keys in `eu` missing in `es`**
   - **keys in `es` missing in `eu`**
4. Optionally flag duplicate English copy used where Basque should be default per `.cursor/rules/i18n.mdc`.

## Steps — server API messages (optional)

If the user wants full-stack i18n audit: scan **`server/routes/**/*.ts`** for hardcoded `message:` strings returned to clients; prefer **`server/lib/i18n`** `translate` + `TranslationKey` where appropriate.

## Fix pattern

```tsx
const { t } = useLanguage();
// Before: <CardTitle>Hurrengoak</CardTitle>
<CardTitle>{t("dashboard.upcoming")}</CardTitle>
```

Add **`dashboard.upcoming`** (example) to both **`eu`** and **`es`** in `i18n.ts`.

## After fixes

- `pnpm check`
- Smoke-test language toggle on edited screens
