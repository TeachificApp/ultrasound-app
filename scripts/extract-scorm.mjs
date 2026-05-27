import { getDb } from "../server/db.ts";
import { mediaAssets, mediaVersions } from "../drizzle/schema.ts";
import { eq, desc, isNull, and } from "drizzle-orm";
import { extractAndUploadScorm } from "../server/routes/scormExtractor.ts";

const slug = process.argv[2] || "unlimited-registry-review-quiz-fetal-echo-fa9b8efc";

async function main() {
  console.log(`Looking up asset: ${slug}`);
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.slug, slug), isNull(mediaAssets.deletedAt)))
    .limit(1);
  if (!asset) { console.error("Asset not found"); process.exit(1); }
  console.log(`Found asset: id=${asset.id}, title=${asset.title}`);

  const [version] = await db
    .select()
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, asset.id))
    .orderBy(desc(mediaVersions.versionNumber))
    .limit(1);
  if (!version) { console.error("No version found"); process.exit(1); }
  console.log(`Version: id=${version.id}, s3Url=${version.s3Url}`);
  console.log(`Current scormExtractedPrefix: ${version.scormExtractedPrefix || "(none)"}`);

  console.log("\nStarting SCORM extraction...");
  await extractAndUploadScorm(version.id, version.s3Url, slug);
  console.log("\nDone!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
