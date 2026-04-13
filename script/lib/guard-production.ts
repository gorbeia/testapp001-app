/**
 * Aborts the process if DATABASE_URL points to a non-local host.
 *
 * Safe hosts: localhost, 127.0.0.1, ::1, and single-label names (Docker
 * service names like "db", "postgres"). Anything with dots that isn't
 * 127.x.x.x is considered remote/production.
 *
 * Override: set ALLOW_PRODUCTION_DB_OPS=1 to bypass (CI against staging, etc.)
 */
export function guardProduction(scriptName: string): void {
  if (process.env.ALLOW_PRODUCTION_DB_OPS === "1") {
    console.warn(
      `[guard] ALLOW_PRODUCTION_DB_OPS=1 — skipping production check for ${scriptName}`
    );
    return;
  }

  const url = process.env.DATABASE_URL ?? "";

  let host: string;
  try {
    // postgres:// or postgresql:// URLs
    host = new URL(url).hostname;
  } catch {
    // If URL parsing fails, err on the side of caution
    console.error(
      `[guard] Could not parse DATABASE_URL — refusing to run ${scriptName} in case it targets production.`
    );
    process.exit(1);
  }

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    // Docker service names have no dots (e.g. "db", "postgres")
    !host.includes(".");

  if (!isLocal) {
    console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  PRODUCTION SAFEGUARD — operation aborted                        ║
╠══════════════════════════════════════════════════════════════════╣
║  ${scriptName.padEnd(64)}║
║  DATABASE_URL host: ${host.slice(0, 45).padEnd(45)}║
║                                                                  ║
║  This script is destructive and must not run against a remote    ║
║  database. If you genuinely need to run this on a non-local DB,  ║
║  set ALLOW_PRODUCTION_DB_OPS=1 in your environment.             ║
╚══════════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }
}
