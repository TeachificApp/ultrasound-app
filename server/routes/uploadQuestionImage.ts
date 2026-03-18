/**
 * POST /api/upload-question-image
 *
 * Admin-only endpoint for uploading echo images OR video clips for image-based questions.
 * Accepts: JPEG, PNG, WEBP, GIF (images) or MP4, WMV (videos).
 * Returns { url, fileKey, mediaType: "image" | "video" }.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { storagePut } from "../storage";
import { sdk } from "../_core/sdk";

const router = Router();

// Store files in memory (max 100 MB for videos)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedImages = /^image\/(jpeg|jpg|png|webp|gif)$/;
    const allowedVideos = /^video\/(mp4|x-ms-wmv|quicktime|webm)$/;
    if (allowedImages.test(file.mimetype) || allowedVideos.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, GIF, MP4, WMV.`));
    }
  },
});

router.post(
  "/api/upload-question-image",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Auth check — admin only
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

      const { originalname, mimetype, buffer } = req.file;
      const isVideo = mimetype.startsWith("video/");
      const ext = originalname.split(".").pop()?.toLowerCase() ?? (isVideo ? "mp4" : "jpg");
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const folder = isVideo ? "question-videos" : "question-images";
      const fileKey = `${folder}/${Date.now()}-${randomSuffix}.${ext}`;

      const { url } = await storagePut(fileKey, buffer, mimetype);

      res.json({ url, fileKey, mediaType: isVideo ? "video" : "image" });
    } catch (err: any) {
      console.error("[upload-question-image]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  }
);

export function registerUploadQuestionImageRoute(app: import("express").Express) {
  app.use(router);
}
