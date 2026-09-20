import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { and, eq } from "drizzle-orm";
import { getDb, getUserRoles } from "../db";
import { sdk } from "../_core/sdk";
import { storageGet, storagePut, storagePutLarge } from "../storage";
import { studyGroupActivity, studyGroupDocuments, studyGroupMembers, studyGroups } from "../../drizzle/schema";

const router = Router();
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
const ENCRYPTED_DOCUMENT_MAGIC = Buffer.from("SGD1");
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) callback(null, true);
    else callback(new Error("Unsupported document type. Upload a PDF, Word, PowerPoint, spreadsheet, CSV, or text file."));
  },
});

function studyGroupDocumentKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Study Group document encryption is not configured.");
  return createHash("sha256").update(`study-group-documents:${secret}`).digest();
}

function encryptStudyGroupDocument(buffer: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", studyGroupDocumentKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([ENCRYPTED_DOCUMENT_MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

function decryptStudyGroupDocument(buffer: Buffer) {
  const minimumLength = ENCRYPTED_DOCUMENT_MAGIC.length + 12 + 16;
  if (buffer.length < minimumLength || !buffer.subarray(0, ENCRYPTED_DOCUMENT_MAGIC.length).equals(ENCRYPTED_DOCUMENT_MAGIC)) {
    throw new Error("Study Group document payload is invalid.");
  }
  const ivStart = ENCRYPTED_DOCUMENT_MAGIC.length;
  const tagStart = ivStart + 12;
  const contentStart = tagStart + 16;
  const decipher = createDecipheriv("aes-256-gcm", studyGroupDocumentKey(), buffer.subarray(ivStart, tagStart));
  decipher.setAuthTag(buffer.subarray(tagStart, contentStart));
  return Buffer.concat([decipher.update(buffer.subarray(contentStart)), decipher.final()]);
}

async function canAccessGroup(userId: number, legacyRole: string | null | undefined, groupId: number) {
  const db = await getDb();
  if (!db) return false;
  const roles = legacyRole === "admin" ? ["platform_admin"] : await getUserRoles(userId);
  if (roles.some(role => role === "platform_admin" || role === "platform_owner")) return true;
  const [membership] = await db.select({ id: studyGroupMembers.id })
    .from(studyGroupMembers)
    .innerJoin(studyGroups, eq(studyGroups.id, studyGroupMembers.groupId))
    .where(and(
      eq(studyGroupMembers.groupId, groupId),
      eq(studyGroupMembers.userId, userId),
      eq(studyGroupMembers.inviteStatus, "active"),
      eq(studyGroups.status, "active"),
    ))
    .limit(1);
  return Boolean(membership);
}

router.post("/api/upload/study-group-document", upload.single("file"), async (req: Request, res: Response) => {
  try {
    let user: { id: number; role?: string | null } | null = null;
    try { user = await sdk.authenticateRequest(req) as { id: number; role?: string | null }; } catch { /* unauthenticated below */ }
    if (!user) return res.status(401).json({ error: "Sign in to upload a group document." });
    const groupId = Number(req.body?.groupId);
    if (!Number.isSafeInteger(groupId) || groupId <= 0) return res.status(400).json({ error: "A valid Study Group is required." });
    if (!await canAccessGroup(user.id, user.role, groupId)) return res.status(403).json({ error: "This Study Group is private." });
    if (!req.file) return res.status(400).json({ error: "Select a document to upload." });
    const extension = req.file.originalname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const key = `study-groups/${groupId}/${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
    const encryptedDocument = encryptStudyGroupDocument(req.file.buffer);
    const { key: storageKey } = encryptedDocument.length > LARGE_FILE_THRESHOLD
      ? await storagePutLarge(key, encryptedDocument, "application/octet-stream")
      : await storagePut(key, encryptedDocument, "application/octet-stream");
    const db = await getDb();
    if (!db) throw new Error("Study Groups are temporarily unavailable.");
    const inserted = await db.insert(studyGroupDocuments).values({
      groupId,
      title: req.file.originalname.slice(0, 255),
      storageKey,
      fileUrl: `study-group-private://${storageKey}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedByUserId: user.id,
    }).$returningId();
    await db.insert(studyGroupActivity).values({
      groupId,
      actorUserId: user.id,
      action: "document_uploaded",
      summary: `Uploaded document: ${req.file.originalname.slice(0, 450)}`,
      entityType: "document",
      entityId: inserted[0]?.id ?? null,
    });
    return res.json({ documentId: inserted[0]?.id ?? null, originalName: req.file.originalname, mimeType: req.file.mimetype, fileSize: req.file.size });
  } catch (error) {
    console.error("[study-group-document-upload] upload failed", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Document upload failed. Please try again." });
  }
});

router.get("/api/study-groups/:groupId/documents/:documentId/download", async (req: Request, res: Response) => {
  try {
    let user: { id: number; role?: string | null } | null = null;
    try { user = await sdk.authenticateRequest(req) as { id: number; role?: string | null }; } catch { /* unauthenticated below */ }
    if (!user) return res.status(401).json({ error: "Sign in to download this group document." });
    const groupId = Number(req.params.groupId);
    const documentId = Number(req.params.documentId);
    if (!Number.isSafeInteger(groupId) || groupId <= 0 || !Number.isSafeInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ error: "A valid Study Group document is required." });
    }
    if (!await canAccessGroup(user.id, user.role, groupId)) return res.status(403).json({ error: "This Study Group is private." });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Study Groups are temporarily unavailable." });
    const [document] = await db.select({ storageKey: studyGroupDocuments.storageKey, title: studyGroupDocuments.title, mimeType: studyGroupDocuments.mimeType })
      .from(studyGroupDocuments)
      .where(and(eq(studyGroupDocuments.id, documentId), eq(studyGroupDocuments.groupId, groupId)))
      .limit(1);
    if (!document || !document.storageKey.startsWith(`study-groups/${groupId}/`)) return res.status(404).json({ error: "Document not found." });
    const { url } = await storageGet(document.storageKey);
    const stored = await fetch(url);
    if (!stored.ok) throw new Error("Study Group document object could not be retrieved.");
    const encryptedDocument = Buffer.from(await stored.arrayBuffer());
    const plaintext = decryptStudyGroupDocument(encryptedDocument);
    const safeName = document.title.replace(/[\r\n"\\]/g, "_");
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Length", String(plaintext.length));
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    return res.status(200).send(plaintext);
  } catch (error) {
    console.error("[study-group-document-download] download failed", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Document download could not be prepared. Please try again." });
  }
});

export function registerStudyGroupDocumentUploadRoute(app: import("express").Application) {
  app.use(router);
}
