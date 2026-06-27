/**
 * POST /api/upload
 *
 * Generic multipart file upload endpoint used by uploadFile() helper in the frontend.
 * Accepts a file + folder + optional maxMB + allowedTypes fields.
 * Requires authentication. Uploads to S3 and returns { url, fileKey }.
 *
 * Query params / form fields:
 *   file         — the file to upload (multipart)
 *   folder       — S3 path prefix, e.g. "tee-ice/images"
 *   maxMB        — optional max file size in MB (default 100)
 *   allowedTypes — optional comma-separated type prefixes: "image", "video", "audio" (default all)
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { storagePut, storagePutLarge } from "../storage";
import { sdk } from "../_core/sdk";

const router = Router();

// Accept up to 200 MB in memory — multer streams directly, no temp files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

router.post(
  "/api/upload",
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

      const { originalname, mimetype, buffer, size } = req.file;

      // Validate allowed types
      const allowedTypes = (req.body.allowedTypes as string | undefined)
        ?.split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (allowedTypes && allowedTypes.length > 0) {
        const typeOk = allowedTypes.some((t) => mimetype.startsWith(t + "/") || mimetype === t);
        if (!typeOk) {
          res.status(400).json({ error: `File type not allowed: ${mimetype}` });
          return;
        }
      }

      // Validate max size
      const maxMB = req.body.maxMB ? parseInt(req.body.maxMB, 10) : 100;
      if (!isNaN(maxMB) && size > maxMB * 1024 * 1024) {
        res.status(400).json({ error: `File too large. Max ${maxMB} MB.` });
        return;
      }

      // Build S3 key
      const folder = (req.body.folder as string | undefined)?.replace(/[^a-zA-Z0-9/_-]/g, "_") ?? "uploads";
      const ext = originalname.split(".").pop()?.toLowerCase() ?? "bin";
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const safeBase = originalname.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const fileKey = `${folder}/${Date.now()}-${safeBase}-${randomSuffix}.${ext}`;

      // Use multipart upload for large files (>20 MB) to avoid proxy timeouts
      const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
      const { url } = size > LARGE_FILE_THRESHOLD
        ? await storagePutLarge(fileKey, buffer, mimetype)
        : await storagePut(fileKey, buffer, mimetype);

      res.json({ url, fileKey });
    } catch (err: any) {
      console.error("[upload-generic]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  }
);

export function registerUploadGenericRoute(app: import("express").Express) {
  app.use(router);
}
