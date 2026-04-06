#!/usr/bin/env node
/**
 * Runs open-source dependency security checks and exits with the highest status code.
 * 1. pnpm audit — npm advisory DB (moderate+)
 * 2. Retire.js — known vulnerable JS libraries under node_modules
 */
import { spawnSync } from "node:child_process";

function runPnpm(args) {
  const result = spawnSync("pnpm", args, { stdio: "inherit", shell: process.platform === "win32" });
  const code = result.status;
  return typeof code === "number" ? code : 1;
}

// Use the public npm registry for advisories only (installs still follow .npmrc).
// Private mirrors often omit the audit API and return 400.
const auditRegistry = process.env.PNPM_AUDIT_REGISTRY ?? "https://registry.npmjs.org/";
const auditBase = ["audit", "--registry", auditRegistry, "--audit-level", "moderate"];
const auditArgs = process.argv.includes("--prod") ? ["audit", "-P", "--registry", auditRegistry, "--audit-level", "moderate"] : auditBase;

const codeAudit = runPnpm(auditArgs);
// --severity: without it, retire defaults to "none" and always exits 0 even when vulns are listed
const codeRetire = runPnpm(["exec", "retire", "--path", ".", "--severity", "medium"]);

process.exit(Math.max(codeAudit, codeRetire));
