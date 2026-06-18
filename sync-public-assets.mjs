/**
 * sync-public-assets.mjs
 * Post-vite build step: force-copy critical public files and validate the build.
 *
 * Run via: node sync-public-assets.mjs  (from project root)
 * Called automatically by `pnpm build` after `vite build`.
 *
 * What it does:
 * 1. Force-copies sw.js, sw-clear.html, manifest.json from client/public → dist/public
 *    (Vite sometimes skips unchanged public files; this guarantees the latest version ships)
 * 2. Fails the build if dist/public/index.html is missing the entry <script> tag
 * 3. Fails the build if index.html still contains unresolved %VITE_ANALYTICS_*% placeholders
 */

import { copyFileSync, readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// __dirname = directory containing this script = project root
const root = dirname(fileURLToPath(import.meta.url));
const src = resolve(root, "client", "public");
const dest = resolve(root, "dist", "public");

const FILES_TO_SYNC = ["sw.js", "sw-clear.html", "manifest.json"];

// 1. Force-copy critical public files
for (const file of FILES_TO_SYNC) {
  const srcPath = resolve(src, file);
  const destPath = resolve(dest, file);
  if (!existsSync(srcPath)) {
    console.warn(`[sync-public-assets] WARN — source missing: ${file}`);
    continue;
  }
  copyFileSync(srcPath, destPath);
  console.log(`[sync-public-assets] Copied ${file}`);
}

// 2. Validate index.html
const indexPath = resolve(dest, "index.html");
if (!existsSync(indexPath)) {
  console.error("[sync-public-assets] FAIL — dist/public/index.html not found");
  process.exit(1);
}

const indexHtml = readFileSync(indexPath, "utf-8");

// Check for entry script tag
if (!indexHtml.includes('/assets/index-') && !indexHtml.includes('src="/assets/')) {
  console.error("[sync-public-assets] FAIL — index.html missing entry <script> tag");
  process.exit(1);
}

// Check for unresolved Vite env placeholders
if (indexHtml.includes("%VITE_ANALYTICS_")) {
  console.error("[sync-public-assets] FAIL — index.html has unresolved %VITE_ANALYTICS_*% placeholders");
  process.exit(1);
}

// 3. Verify sw.js version in dist matches source
const srcSwContent = readFileSync(resolve(src, "sw.js"), "utf-8");
const destSwContent = readFileSync(resolve(dest, "sw.js"), "utf-8");
if (srcSwContent !== destSwContent) {
  console.error("[sync-public-assets] FAIL — dist/public/sw.js does not match client/public/sw.js after copy");
  process.exit(1);
}

// Extract version for logging
const versionMatch = srcSwContent.match(/CACHE_VERSION\s*=\s*["'`]([^"'`]+)["'`]/);
const version = versionMatch ? versionMatch[1] : "unknown";

console.log(`[sync-public-assets] OK — sw.js ${version}, index.html valid`);
