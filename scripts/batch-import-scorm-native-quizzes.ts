#!/usr/bin/env tsx
/**
 * Batch-import every SCORM/ZIP/.quiz media asset into native Quiz Creator quizzes.
 * Writes one `.aausquiz` file per imported quiz when --export-dir is set.
 *
 * Usage:
 *   JWT_SECRET=... STRIPE_SECRET_KEY=... DATABASE_URL=... \
 *     pnpm exec tsx scripts/batch-import-scorm-native-quizzes.ts --admin-user-id 1
 *
 * Options:
 *   --admin-user-id <id>   Required. Platform admin user id for createdByUserId.
 *   --export-dir <path>    Write separate .aausquiz files (default: ./exports/native-quizzes)
 *   --replace              Replace quizzes previously imported from the same media asset
 *   --limit <n>            Max media assets to scan (default 200)
 *   --asset-id <id>        Import a single media asset (repeatable)
 *   --dry-run              List importable assets only
 */
import path from "path";
import { getDb } from "../server/db";
import {
  batchImportScormQuizzesToNative,
  listImportableScormQuizAssets,
} from "../server/lib/scormQuizBuilderImport";

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const adminUserId = Number(readArg("--admin-user-id"));
  if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
    console.error("Missing required --admin-user-id <number>");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL is required for batch import");
    process.exit(1);
  }

  const limit = Number(readArg("--limit") ?? "200");
  const assetIds = process.argv
    .filter((arg, idx, arr) => arr[idx - 1] === "--asset-id")
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (hasFlag("--dry-run")) {
    const assets = assetIds.length
      ? assetIds.map((id) => ({ id, title: `Asset ${id}`, slug: "", fileName: null, mediaType: "scorm" }))
      : await listImportableScormQuizAssets(limit);
    console.log(JSON.stringify({ count: assets.length, assets }, null, 2));
    return;
  }

  const exportDir = readArg("--export-dir") ?? path.join(process.cwd(), "exports", "native-quizzes");
  const result = await batchImportScormQuizzesToNative(adminUserId, {
    mediaAssetIds: assetIds.length ? assetIds : undefined,
    replaceExisting: hasFlag("--replace"),
    exportDir,
    limit,
  });

  console.log(JSON.stringify({ exportDir, ...result }, null, 2));
  if (result.errors.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
