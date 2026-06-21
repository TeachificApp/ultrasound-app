/**
 * POST /api/upload-navigator-image
 *
 * Admin-only endpoint for uploading clinical images for Navigator sections.
 * Accepts a multipart/form-data upload with a single `file` field (images only).
 * Returns { url, fileKey }.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { storagePut, storagePutLarge } from "../storage";
import { sdk } from "../_core/sdk";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error(`Only images are allowed. Received: ${file.mimetype}`));
    }
  },
});

router.post(
  "/api/upload-navigator-image",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Admin-only auth check
      let user = null;
      try { user = await sdk.authenticateRequest(req); } catch {}
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (user.role !== "admin") {
        res.status(403).json({ error: "Admin only" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const { originalname, mimetype, buffer, size } = req.file;
      const ext = originalname.split(".").pop()?.toLowerCase() ?? "jpg";
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `navigator-images/${Date.now()}-${randomSuffix}.${ext}`;

      // Use R2 multipart for files over 20 MB to avoid storage proxy timeouts
      const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
      const { url } = size > LARGE_FILE_THRESHOLD
        ? await storagePutLarge(fileKey, buffer, mimetype)
        : await storagePut(fileKey, buffer, mimetype);

      res.json({ url, fileKey });
    } catch (err: any) {
      console.error("[upload-navigator-image]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  }
);

export function registerUploadNavigatorImageRoute(app: import("express").Express) {
  app.use(router);
}
