/**
 * Authenticated learner file delivery — digital downloads and course certificates.
 * Serves bytes through the app with correct Content-Disposition and fresh storage URLs,
 * and records download limits only after the file is successfully retrieved.
 */
import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import {
  digitalProductFiles,
  digitalProducts,
  lmsCertificates,
  lmsCourses,
} from "../../drizzle/schema";
import { downloadStorageObject } from "../lib/downloadStorageObject";
import {
  isPurchaseAccessActive,
  loadPurchaseForUser,
  validateDownloadAttempt,
  recordDigitalDownloadEvent,
} from "../lib/downloadAccess";
import { sanitizeDownloadFilename } from "../lib/sanitizeDownloadFilename";
import { storageKeyFromStoredUrl } from "../lib/resolveStoredFileUrl";

const router = Router();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

function sendFileBuffer(
  res: Response,
  buffer: Buffer,
  opts: { fileName: string; mimeType: string; inline: boolean },
): void {
  const safeName = sanitizeDownloadFilename(opts.fileName);
  const disposition = opts.inline ? "inline" : "attachment";
  res.setHeader("Content-Type", opts.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `${disposition}; filename="${safeName}"`);
  res.setHeader("Content-Length", String(buffer.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.send(buffer);
}

router.get(
  "/api/learner/digital-download/:productId/files/:fileId",
  async (req: Request, res: Response) => {
    try {
      let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Sign in required" });
        return;
      }
      if (!user) {
        res.status(401).json({ error: "Sign in required" });
        return;
      }

      const productId = Number(req.params.productId);
      const fileId = Number(req.params.fileId);
      if (!Number.isInteger(productId) || !Number.isInteger(fileId)) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }

      const inline = req.query.inline === "1" || req.query.disposition === "inline";
      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Service unavailable" });
        return;
      }

      const [product] = await db.select().from(digitalProducts).where(eq(digitalProducts.id, productId)).limit(1);
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      const isAdminPreview = user.role === "admin" && req.query.preview === "1";
      let purchase = null;
      if (!product.isFree && !isAdminPreview) {
        purchase = await loadPurchaseForUser(db, user.id, productId);
        if (!purchase || !isPurchaseAccessActive(purchase)) {
          res.status(403).json({ error: "Download access not available" });
          return;
        }
      }

      const [file] = await db
        .select()
        .from(digitalProductFiles)
        .where(and(eq(digitalProductFiles.id, fileId), eq(digitalProductFiles.productId, productId)))
        .limit(1);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      if (purchase && !inline) {
        const check = await validateDownloadAttempt(db, purchase, fileId, purchase.productMaxDownloads);
        if (!check.allowed) {
          res.status(403).json({ error: check.reason });
          return;
        }
      }

      const storageKey = file.fileKey || storageKeyFromStoredUrl(file.fileUrl);
      if (!storageKey) {
        res.status(404).json({ error: "File storage key missing" });
        return;
      }

      let buffer: Buffer;
      try {
        buffer = await downloadStorageObject(storageKey, file.fileUrl);
      } catch (err: any) {
        console.error("[learnerProtectedDownloads] digital file fetch failed:", err?.message ?? err);
        res.status(404).json({ error: "File could not be loaded from storage. Please contact support." });
        return;
      }

      if (purchase && !inline) {
        await recordDigitalDownloadEvent(db, {
          userId: user.id,
          productId,
          fileId,
          purchaseId: purchase.id,
          fileName: file.fileName,
          ipAddress: clientIp(req),
          userAgent: req.headers["user-agent"] ?? null,
          productTitle: purchase.productTitle,
        });
      }

      sendFileBuffer(res, buffer, {
        fileName: file.fileName,
        mimeType: file.mimeType ?? "application/octet-stream",
        inline,
      });
    } catch (err: any) {
      console.error("[learnerProtectedDownloads] digital download error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Download failed" });
    }
  },
);

router.get(
  "/api/learner/certificate/:courseSlug",
  async (req: Request, res: Response) => {
    try {
      let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Sign in required" });
        return;
      }
      if (!user) {
        res.status(401).json({ error: "Sign in required" });
        return;
      }

      const courseSlug = req.params.courseSlug;
      const inline = req.query.inline === "1" || req.query.disposition === "inline";
      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Service unavailable" });
        return;
      }

      const [course] = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title })
        .from(lmsCourses)
        .where(eq(lmsCourses.slug, courseSlug))
        .limit(1);
      if (!course) {
        res.status(404).json({ error: "Course not found" });
        return;
      }

      const [cert] = await db
        .select()
        .from(lmsCertificates)
        .where(and(eq(lmsCertificates.userId, user.id), eq(lmsCertificates.courseId, course.id)))
        .limit(1);
      if (!cert?.certificateUrl) {
        res.status(404).json({ error: "Certificate not found" });
        return;
      }

      const storageKey = storageKeyFromStoredUrl(cert.certificateUrl);
      if (!storageKey) {
        res.status(404).json({ error: "Certificate storage location unknown" });
        return;
      }

      let buffer: Buffer;
      try {
        buffer = await downloadStorageObject(storageKey, cert.certificateUrl);
      } catch (err: any) {
        console.error("[learnerProtectedDownloads] certificate fetch failed:", err?.message ?? err);
        res.status(404).json({ error: "Certificate file could not be loaded. Try Download again to regenerate." });
        return;
      }

      const fileName = `${sanitizeDownloadFilename(course.title)}_Certificate.pdf`;
      sendFileBuffer(res, buffer, {
        fileName,
        mimeType: "application/pdf",
        inline,
      });
    } catch (err: any) {
      console.error("[learnerProtectedDownloads] certificate error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Certificate download failed" });
    }
  },
);

export function registerLearnerProtectedDownloadRoutes(app: import("express").Application): void {
  app.use(router);
}
