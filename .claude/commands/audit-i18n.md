# Audit i18n (client + dictionaries)

Audit the React client for hardcoded user-visible strings and mismatched eu/es translation keys.

## Goal

1. Find **user-visible** strings in `client/src/**/*.tsx` that bypass `t()` from `useLanguage()`.
2. Find **key mismatches** between `eu` and `es` maps in [client/src/lib/i18n.ts](client/src/lib/i18n.ts).

## Steps — hardcoded UI strings

1. Scan `.tsx` files under `client/src/` (prioritize `pages/`, `components/`).
2. Flag likely user-facing literals:
   - JSX text nodes: `<div>Hello</div>` (not inside `{t(...)}`)
   - Props: `placeholder="..."`, `title="..."`, `aria-label="..."`, `alt="..."`, `description="..."` on UI components (exclude `className`, `data-testid`, `http` URLs)
   - `throw new Error("...")` or toast/copy that surfaces to users
3. **Allowlist** (do not flag):
   - Strings already inside `t("key")` or `` t(`key.${x}`) ``
   - Dev-only `console.*` messages
   - Regex / numeric-only placeholders
   - File extensions, MIME types, test ids
4. Output a table: **file:line**, **string snippet**, **suggested `t` key**.

## Steps — dictionary parity

1. Open `client/src/lib/i18n.ts` and locate the `eu` and `es` record objects.
2. Collect keys from each (top-level keys).
3. Report:
   - Keys in `eu` missing in `es`
   - Keys in `es` missing in `eu`
4. Flag duplicate English copy used where Basque should be default.

## Steps — server API messages (optional)

If the user wants a full-stack audit: scan `server/routes/**/*.ts` for hardcoded `message:` strings returned to clients; prefer `server/lib/i18n` `translate` + `TranslationKey` where appropriate.

## Fix pattern

```tsx
const { t } = useLanguage();
// Before: <CardTitle>Hurrengoak</CardTitle>
<CardTitle>{t("dashboard.upcoming")}</CardTitle>;
```

Add `dashboard.upcoming` to both `eu` and `es` in `client/src/lib/i18n.ts`.

## After fixes

- `pnpm check`
- Smoke-test language toggle on edited screens
