/**
 * POST /api/upload-lesson-document
 *
 * Multipart upload for PDF / PowerPoint lesson document conversion.
 * Base64-over-tRPC hits the ~10 MB proxy body limit and returns HTML error pages
 * that the tRPC client surfaces as "Unexpected token" JSON parse failures.
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { lmsLessons, userRoles } from "../../drizzle/schema";
import { storagePut, storagePutLarge } from "../storage";
import {
  assertLessonDocumentUpload,
  getLessonDocumentKind,
  LESSON_DOCUMENT_MAX_BYTES,
} from "../lib/documentRichContent";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LESSON_DOCUMENT_MAX_BYTES + 1 },
});

async function authenticateLmsAdmin(req: Request): Promise<{ id: number; role: string } | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) return null;
    if (user.role === "admin") return { id: user.id, role: user.role };
    const db = await getDb();
    if (!db) return null;
    const assignedRoles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));
    const hasManagerAccess = assignedRoles.some(({ role }) =>
      role === "platform_admin" || role === "platform_owner" || role === "platform_manager",
    );
    return hasManagerAccess ? { id: user.id, role: user.role } : null;
  } catch {
    return null;
  }
}

router.post(
  "/api/upload-lesson-document",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const user = await authenticateLmsAdmin(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const lessonId = Number(req.body.lessonId);
      if (!Number.isInteger(lessonId) || lessonId <= 0) {
        res.status(400).json({ error: "A valid lessonId is required." });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database unavailable" });
        return;
      }

      const [lesson] = await db
        .select({ id: lmsLessons.id })
        .from(lmsLessons)
        .where(eq(lmsLessons.id, lessonId))
        .limit(1);
      if (!lesson) {
        res.status(404).json({ error: "Lesson not found." });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const { originalname, mimetype, buffer, size } = req.file;
      const kind = getLessonDocumentKind(originalname, mimetype);
      if (!kind) {
        res.status(400).json({ error: "Choose a PDF or PowerPoint .pptx file." });
        return;
      }

      try {
        assertLessonDocumentUpload(originalname, mimetype, size);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unsupported document." });
        return;
      }

      const cleanFileName = originalname
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120) || `lesson-document.${kind}`;
      const token = randomBytes(12).toString("hex");
      const fileKey = `lms-documents/lesson-${lesson.id}/${token}/source-${cleanFileName}`;
      const sourceMimeType = kind === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

      const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
      const { url } = size > LARGE_FILE_THRESHOLD
        ? await storagePutLarge(fileKey, buffer, sourceMimeType)
        : await storagePut(fileKey, buffer, sourceMimeType);

      res.json({
        url,
        fileKey,
        fileName: originalname,
        mimeType: sourceMimeType,
        fileSize: size,
      });
    } catch (err: any) {
      console.error("[upload-lesson-document]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  },
);

export function registerUploadLessonDocumentRoute(app: import("express").Application) {
  app.use(router);
}
