/**
 * Safe wrapper around `drizzle-kit push`.
 * Aborts before touching the database if DATABASE_URL is not local.
 * Use ALLOW_PRODUCTION_DB_OPS=1 to bypass (e.g. in CI against staging).
 */
import * as dotenv from "dotenv";
import { execSync } from "child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guardProduction } from "./lib/guard-production";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config();
guardProduction("db:push (drizzle-kit push)");

const extraArgs = process.argv.slice(2).join(" ");
execSync(`pnpm exec drizzle-kit push ${extraArgs}`, { stdio: "inherit", cwd: repoRoot });
