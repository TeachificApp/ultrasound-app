/**
 * POST /api/upload/cohort-resource
 *
 * Authenticated admin upload for cohort resource files (download action) and card images.
 * Accepts a single `file` field (max 50 MB).
 * Returns { url, fileKey, fileName }.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { storagePut, storagePutLarge } from "../storage";
import { sdk } from "../_core/sdk";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post(
  "/api/upload/cohort-resource",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      let user: any = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {}
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
      const suffix = randomBytes(6).toString("hex");
      const fileKey = `cohort-resources/${user.id}/${suffix}.${ext}`;
      // Use R2 multipart for files over 20 MB to avoid storage proxy timeouts
      const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
      const { url } = size > LARGE_FILE_THRESHOLD
        ? await storagePutLarge(fileKey, buffer, mimetype)
        : await storagePut(fileKey, buffer, mimetype);
      res.json({ url, fileKey, fileName: originalname, mimeType: mimetype });
    } catch (err: any) {
      console.error("[upload-cohort-resource]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  },
);

export function registerUploadCohortResourceRoute(app: import("express").Application) {
  app.use(router);
}
