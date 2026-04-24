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
import { storagePut } from "../storage";
import { sdk } from "../_core/sdk";

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
      let user: any = null;
      try { user = await sdk.authenticateRequest(req); } catch {}
      if (!user || user.role !== "admin") {
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
      res.json({ url, fileKey });
    } catch (err: any) {
      console.error("[upload-course-image]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  }
);

export function registerUploadCourseImageRoute(app: import("express").Application) {
  app.use(router);
}
