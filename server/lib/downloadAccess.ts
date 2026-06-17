/**
 * Digital download access control — per-file limits, expiry, activity logging.
 */

import { and, eq, sql, or, isNull } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import {
  digitalDownloadEvents,
  digitalProductFiles,
  digitalProducts,
  digitalPurchaseActivity,
  digitalPurchases,
} from "../../drizzle/schema";

export type PurchaseAccessRow = {
  id: number;
  userId: number;
  productId: number;
  status: string;
  maxDownloadsPerFile: number | null;
  accessExpiresAt: Date | null;
  purchasedAt: Date;
  stripeCheckoutSessionId: string | null;
  amount: number | null;
  currency: string;
};

export type FileDownloadStats = {
  fileId: number;
  fileName: string;
  downloaded: number;
  remaining: number | null;
  canDownload: boolean;
};

export function isPurchaseAccessActive(purchase: {
  status?: string;
  accessExpiresAt?: Date | null;
}): boolean {
  if (purchase.status === "revoked" || purchase.status === "expired" || purchase.status === "refunded") {
    return false;
  }
  if (purchase.accessExpiresAt && purchase.accessExpiresAt.getTime() <= Date.now()) {
    return false;
  }
  return true;
}

export function resolveMaxDownloadsPerFile(
  purchase: { maxDownloadsPerFile?: number | null },
  product?: { maxDownloadsPerFile?: number | null },
): number | null {
  if (purchase.maxDownloadsPerFile === null && product?.maxDownloadsPerFile === null) return null;
  return purchase.maxDownloadsPerFile ?? product?.maxDownloadsPerFile ?? 3;
}

export async function countFileDownloads(
  db: MySql2Database<typeof schema>,
  purchaseId: number,
  fileId: number,
  userId?: number,
): Promise<number> {
  const conditions = userId
    ? or(
        eq(digitalDownloadEvents.purchaseId, purchaseId),
        and(isNull(digitalDownloadEvents.purchaseId), eq(digitalDownloadEvents.userId, userId), eq(digitalDownloadEvents.fileId, fileId)),
      )
    : eq(digitalDownloadEvents.purchaseId, purchaseId);

  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(digitalDownloadEvents)
    .where(and(conditions!, eq(digitalDownloadEvents.fileId, fileId)));
  return Number(row?.c ?? 0);
}

export async function getFileDownloadStatsForPurchase(
  db: MySql2Database<typeof schema>,
  purchase: PurchaseAccessRow,
  productMaxDownloads: number | null | undefined,
): Promise<FileDownloadStats[]> {
  const files = await db
    .select({ id: digitalProductFiles.id, fileName: digitalProductFiles.fileName })
    .from(digitalProductFiles)
    .where(eq(digitalProductFiles.productId, purchase.productId))
    .orderBy(digitalProductFiles.sortOrder);

  const active = isPurchaseAccessActive(purchase);
  const limit = resolveMaxDownloadsPerFile(purchase, { maxDownloadsPerFile: productMaxDownloads });

  return Promise.all(
    files.map(async (file) => {
      const downloaded = await countFileDownloads(db, purchase.id, file.id, purchase.userId);
      const remaining = limit === null ? null : Math.max(0, limit - downloaded);
      const canDownload = active && (limit === null || downloaded < limit);
      return {
        fileId: file.id,
        fileName: file.fileName,
        downloaded,
        remaining,
        canDownload,
      };
    }),
  );
}

export type DownloadAttemptResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export async function validateDownloadAttempt(
  db: MySql2Database<typeof schema>,
  purchase: PurchaseAccessRow,
  fileId: number,
  productMaxDownloads?: number | null,
): Promise<DownloadAttemptResult> {
  if (!isPurchaseAccessActive(purchase)) {
    if (purchase.status === "revoked") return { allowed: false, reason: "Your access to this order has been revoked." };
    if (purchase.status === "expired" || (purchase.accessExpiresAt && purchase.accessExpiresAt.getTime() <= Date.now())) {
      return { allowed: false, reason: "This download order has expired." };
    }
    if (purchase.status === "refunded") return { allowed: false, reason: "This order was refunded." };
    return { allowed: false, reason: "Download access is not available." };
  }

  const [file] = await db
    .select({ id: digitalProductFiles.id })
    .from(digitalProductFiles)
    .where(and(eq(digitalProductFiles.id, fileId), eq(digitalProductFiles.productId, purchase.productId)))
    .limit(1);
  if (!file) return { allowed: false, reason: "File not found." };

  const limit = resolveMaxDownloadsPerFile(purchase, { maxDownloadsPerFile: productMaxDownloads });
  if (limit !== null) {
    const downloaded = await countFileDownloads(db, purchase.id, fileId, purchase.userId);
    if (downloaded >= limit) {
      return { allowed: false, reason: `Download limit reached (${limit} per file).` };
    }
  }

  return { allowed: true };
}

export async function logPurchaseActivity(
  db: MySql2Database<typeof schema>,
  opts: {
    purchaseId: number;
    eventType: string;
    message: string;
    ipAddress?: string | null;
    fileId?: number | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(digitalPurchaseActivity).values({
    purchaseId: opts.purchaseId,
    eventType: opts.eventType,
    message: opts.message,
    ipAddress: opts.ipAddress?.substring(0, 64) ?? null,
    fileId: opts.fileId ?? null,
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
  });
}

export function formatOrderRef(purchase: { id: number; stripeCheckoutSessionId?: string | null }): string {
  if (purchase.stripeCheckoutSessionId) {
    return purchase.stripeCheckoutSessionId.replace(/^cs_(test|live)_/, "").toUpperCase().slice(0, 17);
  }
  return `ORD-${purchase.id}`;
}

export async function loadPurchaseForUser(
  db: MySql2Database<typeof schema>,
  userId: number,
  productId: number,
): Promise<(PurchaseAccessRow & { productTitle: string; productMaxDownloads: number | null }) | null> {
  const [row] = await db
    .select({
      id: digitalPurchases.id,
      userId: digitalPurchases.userId,
      productId: digitalPurchases.productId,
      status: digitalPurchases.status,
      maxDownloadsPerFile: digitalPurchases.maxDownloadsPerFile,
      accessExpiresAt: digitalPurchases.accessExpiresAt,
      purchasedAt: digitalPurchases.purchasedAt,
      stripeCheckoutSessionId: digitalPurchases.stripeCheckoutSessionId,
      amount: digitalPurchases.amount,
      currency: digitalPurchases.currency,
      productTitle: digitalProducts.title,
      productMaxDownloads: digitalProducts.maxDownloadsPerFile,
    })
    .from(digitalPurchases)
    .innerJoin(digitalProducts, eq(digitalProducts.id, digitalPurchases.productId))
    .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, productId)))
    .limit(1);
  return row ?? null;
}

export function computeAccessExpiresAt(productDefaultAccessDays: number | null | undefined): Date | null {
  if (!productDefaultAccessDays || productDefaultAccessDays <= 0) return null;
  return new Date(Date.now() + productDefaultAccessDays * 24 * 60 * 60 * 1000);
}
