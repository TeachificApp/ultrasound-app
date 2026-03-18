/**
 * POST /api/upload-case-media
 *
 * Accepts a multipart/form-data upload with a single `file` field.
 * Validates the session cookie (must be authenticated), uploads to S3 via storagePut,
 * and returns { url, fileKey }.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { storagePut } from "../storage";
import { sdk } from "../_core/sdk";

const router = Router();

// Store files in memory (max 100 MB per file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image|video)\//;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

router.post(
  "/api/upload-case-media",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Auth check
      let user = null;
      try { user = await sdk.authenticateRequest(req); } catch {}
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const { originalname, mimetype, buffer } = req.file;
      const ext = originalname.split(".").pop()?.toLowerCase() ?? "bin";
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `case-media/${user.id}/${Date.now()}-${randomSuffix}.${ext}`;

      const { url } = await storagePut(fileKey, buffer, mimetype);

      res.json({ url, fileKey });
    } catch (err: any) {
      console.error("[upload-case-media]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  }
);

export function registerUploadCaseMediaRoute(app: import("express").Express) {
  app.use(router);
}
