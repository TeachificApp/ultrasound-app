/** Admin-only source upload for PDF/image-driven course and quiz generation. */
import { Router, Request, Response } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { sdk } from "../_core/sdk";
import { storagePut } from "../storage";
import { getAiSourceUploadDecision, isSupportedAiSourceMimeType } from "../lib/aiSourceFile";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, isSupportedAiSourceMimeType(file.mimetype)),
});

router.post("/api/upload-ai-generation-source", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    const decision = getAiSourceUploadDecision(user, req.file?.mimetype);
    if (!decision.allowed) return res.status(decision.status).json({ error: decision.error });
    if (!req.file) return res.status(400).json({ error: "Upload a PDF, JPG, PNG, or WebP image up to 20 MB." });
    const extension = req.file.originalname.split(".").pop()?.toLowerCase() || "source";
    const key = `ai-generation-sources/${user.id}/${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
    return res.json({ sourceFile: { url, mimeType: req.file.mimetype, name: req.file.originalname }, fileKey: key });
  } catch (error: any) {
    console.error("[upload-ai-generation-source]", error);
    return res.status(500).json({ error: error?.message ?? "Source upload failed" });
  }
});

export function registerUploadAiGenerationSourceRoute(app: import("express").Application) { app.use(router); }
