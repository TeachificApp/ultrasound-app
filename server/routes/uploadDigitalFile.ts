/**
 * POST /api/upload-digital-file
 *
 * Multipart file upload endpoint for digital download product files.
 * Accepts a single `file` field (any file type, max 200 MB).
 * Returns { url, fileKey, filename, size, mimeType }.
 *
 * Using multipart instead of base64-over-tRPC avoids the ~10 MB proxy body limit
 * and prevents the browser from freezing while encoding large files.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { storagePut, storagePutLarge } from "../storage";
import { sdk } from "../_core/sdk";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

router.post(
  "/api/upload-digital-file",
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
      const { originalname, mimetype, buffer, size } = req.file;
      const ext = originalname.split(".").pop()?.toLowerCase() ?? "bin";
      const suffix = randomBytes(8).toString("hex");
      const safeName = originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const fileKey = `digital-files/${suffix}-${safeName}`;
      // Use R2 multipart for files over 20 MB to avoid storage proxy timeouts
      const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
      const { url } = size > LARGE_FILE_THRESHOLD
        ? await storagePutLarge(fileKey, buffer, mimetype)
        : await storagePut(fileKey, buffer, mimetype);
      res.json({ url, fileKey, filename: originalname, size, mimeType: mimetype });
    } catch (err: any) {
      console.error("[upload-digital-file]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  }
);

export function registerUploadDigitalFileRoute(app: import("express").Application) {
  app.use(router);
}
