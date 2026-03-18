/**
 * POST /api/upload-question-media
 *
 * Admin-only endpoint for uploading echo images OR video clips for questions.
 * Accepts: JPEG, PNG, WEBP, GIF (images) or MP4, WEBM, MOV, WMV, AVI (videos).
 * Returns { url, fileKey, mediaType: "image" | "video" }.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { storagePut } from "../storage";
import { sdk } from "../_core/sdk";

const router = Router();

// Accept images and videos up to 100 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedImages = /^image\/(jpeg|jpg|png|webp|gif)$/;
    const allowedVideos = /^video\/(mp4|webm|quicktime|x-msvideo|x-matroska|x-ms-wmv|avi)$/;
    if (allowedImages.test(file.mimetype) || allowedVideos.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, GIF, MP4, WEBM, MOV, WMV, AVI.`));
    }
  },
});

router.post(
  "/api/upload-question-media",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Auth check — admin only
      let user = null;
      try { user = await sdk.authenticateRequest(req); } catch {}
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
      if (user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
      if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }

      const { originalname, mimetype, buffer } = req.file;
      const isVideo = mimetype.startsWith("video/");
      const ext = originalname.split(".").pop()?.toLowerCase() ?? (isVideo ? "mp4" : "jpg");
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const folder = isVideo ? "question-videos" : "question-images";
      const fileKey = `${folder}/${Date.now()}-${randomSuffix}.${ext}`;

      const { url } = await storagePut(fileKey, buffer, mimetype);
      res.json({ url, fileKey, mediaType: isVideo ? "video" : "image" });
    } catch (err: any) {
      console.error("[upload-question-media]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  }
);

export function registerUploadQuestionMediaRoute(app: import("express").Express) {
  app.use(router);
}
