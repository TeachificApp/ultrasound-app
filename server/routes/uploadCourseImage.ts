/**
 * POST /api/upload-course-image
 *
 * Multipart image upload endpoint for LMS course cover images and landing page hero images.
 * Accepts a single `file` field (image only, max 10 MB).
 * Returns { url, fileKey }.
 *
 * Using multipart instead of base64-over-tRPC avoids the ~10 MB proxy body limit
 * and prevents the browser from freezing while encoding large files.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { getStorageHealth, storagePut } from "../storage";
import { getDb } from "../db";
import { mediaAssets, mediaVersions } from "../../drizzle/schema";
import { authenticateContentUploader } from "../lib/contentUploadAuth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error(`Only image files are allowed (got ${file.mimetype})`));
    }
  },
});

router.post(
  "/api/upload-course-image",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const user = await authenticateContentUploader(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      const { originalname, mimetype, buffer } = req.file;
      const ext = originalname.split(".").pop()?.toLowerCase() ?? "jpg";
      const suffix = randomBytes(6).toString("hex");
      const fileKey = `lms-images/${suffix}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, mimetype);
      // Save to Media Library (mediaAssets + mediaVersions) so it appears in the picker
      try {
        const db = await getDb();
        if (db) {
          const title = originalname.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          const slug = `lms-img-${suffix}`;
          const [inserted] = await db.insert(mediaAssets).values({
            slug,
            title,
            mediaType: "image",
            mimeType: mimetype,
            access: "public",
            thumbnailUrl: url,
            folder: "LMS Uploads",
            brand: "aaus",
            createdByUserId: user.id,
          });
          const assetId = (inserted as any).insertId;
          if (assetId) {
            await db.insert(mediaVersions).values({
              assetId,
              versionNumber: 1,
              s3Key: fileKey,
              s3Url: url,
              fileName: originalname,
              fileSize: buffer.length,
              mimeType: mimetype,
              uploadedByUserId: user.id,
            });
          }
        }
      } catch (libErr: any) {
        // Non-fatal: log but don't fail the upload
        console.warn("[upload-course-image] Media Library save failed:", libErr?.message);
      }
      res.json({ url, fileKey });
    } catch (err: any) {
      console.error("[upload-course-image]", err);
      const message = err?.message ?? "Upload failed";
      if (/access denied|accessdenied|not authorized|forbidden/i.test(message)) {
        const storage = await getStorageHealth("lms-images/storage-health").catch(() => null);
        res.status(503).json({
          error: "Image storage is temporarily unavailable. The deployment storage write permission must be restored.",
          storage,
        });
        return;
      }
      res.status(500).json({ error: message });
    }
  }
);

export function registerUploadCourseImageRoute(app: import("express").Application) {
  app.use(router);
}
