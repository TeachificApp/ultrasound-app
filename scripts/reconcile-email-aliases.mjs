#!/usr/bin/env node
/**
 * Audit and reconcile email alias integrity (platform owner stray aliases, conflicts).
 *
 * Usage:
 *   DATABASE_URL=mysql://... pnpm exec tsx scripts/reconcile-email-aliases.mjs
 *   DATABASE_URL=mysql://... pnpm exec tsx scripts/reconcile-email-aliases.mjs --apply
 */
import { getDb } from "../server/db.ts";
import {
  auditEmailAliasIntegrity,
  ensureEmailAliasIntegrity,
} from "../server/lib/ensureEmailAliasIntegrity.ts";

const apply = process.argv.includes("--apply");

async function main() {
  if (!process.env.DATABASE_URL && !process.env.RAILWAY_MYSQL_URL) {
    console.error("DATABASE_URL or RAILWAY_MYSQL_URL is required");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("Database unavailable");
    process.exit(1);
  }

  const before = await auditEmailAliasIntegrity(db);
  console.log(JSON.stringify({ phase: "audit", before }, null, 2));

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to reconcile.");
    process.exit(0);
  }

  const reconcile = await ensureEmailAliasIntegrity(db);
  const after = await auditEmailAliasIntegrity(db);
  console.log(JSON.stringify({ phase: "reconcile", reconcile, after }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
