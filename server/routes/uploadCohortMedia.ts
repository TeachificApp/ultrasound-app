/**
 * POST /api/upload/cohort-media
 *
 * Authenticated upload for cohort group discussion media (images + videos).
 * Accepts a single `file` field (image or video, max 100 MB).
 * Returns { url, fileKey, mimeType }.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { storagePut, storagePutLarge } from "../storage";
import { sdk } from "../_core/sdk";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error(`Only image and video files are allowed (got ${file.mimetype})`));
    }
  },
});

router.post(
  "/api/upload/cohort-media",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      let user: any = null;
      try { user = await sdk.authenticateRequest(req); } catch {}
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      const { originalname, mimetype, buffer, size } = req.file;
      const ext = originalname.split(".").pop()?.toLowerCase() ?? "bin";
      const suffix = randomBytes(6).toString("hex");
      const fileKey = `cohort-media/${user.id}/${suffix}.${ext}`;
      // Use R2 multipart for files over 20 MB to avoid storage proxy timeouts
      const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
      const { url } = size > LARGE_FILE_THRESHOLD
        ? await storagePutLarge(fileKey, buffer, mimetype)
        : await storagePut(fileKey, buffer, mimetype);
      res.json({ url, fileKey, mimeType: mimetype });
    } catch (err: any) {
      console.error("[upload-cohort-media]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  }
);

export function registerUploadCohortMediaRoute(app: import("express").Application) {
  app.use(router);
}
