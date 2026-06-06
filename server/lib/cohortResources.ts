import { and, desc, eq } from "drizzle-orm";
import type { LmsCohortResource } from "../../drizzle/schema";
import { digitalProducts, mediaAssets, mediaVersions } from "../../drizzle/schema";

export type EnrichedCohortResource = LmsCohortResource & {
  actionUrl: string | null;
  downloadFileName: string | null;
  mediaAssetTitle: string | null;
  downloadProductTitle: string | null;
  scope: "course" | "cohort";
};

/** Resolve link/download URLs and labels for admin + learner views. */
export async function enrichCohortResources(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>,
  rows: LmsCohortResource[],
): Promise<EnrichedCohortResource[]> {
  return Promise.all(
    rows.map(async (row) => {
      let actionUrl: string | null = null;
      let downloadFileName: string | null = row.fileName ?? null;
      let mediaAssetTitle: string | null = null;
      let downloadProductTitle: string | null = null;

      if (row.actionType === "link") {
        actionUrl = row.linkUrl ?? null;
      } else if (row.actionType === "download") {
        if (row.downloadSource === "upload") {
          actionUrl = row.fileUrl ?? null;
        } else if (row.downloadSource === "media_repo" && row.mediaAssetId) {
          const [asset] = await db
            .select({ title: mediaAssets.title })
            .from(mediaAssets)
            .where(eq(mediaAssets.id, row.mediaAssetId))
            .limit(1);
          mediaAssetTitle = asset?.title ?? null;
          const [ver] = await db
            .select({ s3Url: mediaVersions.s3Url, fileName: mediaVersions.fileName })
            .from(mediaVersions)
            .where(eq(mediaVersions.assetId, row.mediaAssetId))
            .orderBy(desc(mediaVersions.versionNumber))
            .limit(1);
          actionUrl = ver?.s3Url ?? null;
          downloadFileName = ver?.fileName ?? downloadFileName;
        } else if (row.downloadSource === "download_product" && row.downloadProductId) {
          const [prod] = await db
            .select({ slug: digitalProducts.slug, title: digitalProducts.title })
            .from(digitalProducts)
            .where(eq(digitalProducts.id, row.downloadProductId))
            .limit(1);
          downloadProductTitle = prod?.title ?? null;
          actionUrl = prod ? `/downloads/${prod.slug}` : null;
        }
      }

      return {
        ...row,
        actionUrl,
        downloadFileName,
        mediaAssetTitle,
        downloadProductTitle,
        scope: row.cohortGroupId ? ("cohort" as const) : ("course" as const),
      };
    }),
  );
}
