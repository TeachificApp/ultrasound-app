#!/usr/bin/env tsx
/**
 * Import www.allaboutultrasound.com pages into marketing site staging DB.
 *
 * Usage:
 *   pnpm exec tsx scripts/import-aau-marketing-site.ts --limit 10
 *   pnpm exec tsx scripts/import-aau-marketing-site.ts --all
 *   pnpm exec tsx scripts/import-aau-marketing-site.ts --url https://www.allaboutultrasound.com/about.html
 *
 * Requires DATABASE_URL and network access to source site.
 */
import { getDb } from "../server/db";
import { bulkImportMarketingSite, importMarketingPage } from "../server/lib/marketingSiteImport";

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
  const all = args.includes("--all");
  const urlIdx = args.indexOf("--url");
  const singleUrl = urlIdx >= 0 ? args[urlIdx + 1] : undefined;

  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  if (singleUrl) {
    const r = await importMarketingPage(db, singleUrl);
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.status === "failed" ? 1 : 0);
  }

  const result = await bulkImportMarketingSite(db, {
    limit: all ? undefined : (limit ?? 25),
    skipExisting: !args.includes("--force"),
  });

  const imported = result.results.filter(r => r.status === "imported").length;
  const failed = result.results.filter(r => r.status === "failed").length;
  const skipped = result.results.filter(r => r.status === "skipped").length;
  console.log(`Done: ${imported} imported, ${skipped} skipped, ${failed} failed (${result.total} processed)`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
