/**
 * POST /api/question-bank/scorm-import/confirm
 *
 * REST confirm for Media Repository "Extract to Question Bank" — avoids tRPC
 * proxy timeouts and HTML error pages on long-running media uploads.
 */
import { Router, type Request, type Response } from "express";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { commitScormImportToQuestionBank } from "../lib/scormQuestionBankCommit";

const router = Router();

const confirmInputSchema = z.object({
  mediaAssetId: z.number().int().optional(),
  importStorageKey: z.string().min(1).optional(),
  bufferBase64: z.string().optional(),
  groupIds: z.array(z.string()).optional(),
  extraTagIds: z.array(z.number().int()).optional(),
  folderId: z.number().int().optional(),
  newFolderName: z.string().max(200).optional(),
  parentFolderId: z.number().int().optional(),
  includeQuestionBankIds: z.boolean().optional(),
}).refine(
  (v) =>
    (v.mediaAssetId != null && v.mediaAssetId > 0)
    || !!v.importStorageKey?.length
    || !!v.bufferBase64?.length,
  { message: "Provide mediaAssetId, importStorageKey, or bufferBase64 for SCORM import" },
);

function trpcErrorStatus(code: TRPCError["code"]): number {
  switch (code) {
    case "UNAUTHORIZED": return 401;
    case "FORBIDDEN": return 403;
    case "NOT_FOUND": return 404;
    case "BAD_REQUEST": return 400;
    case "PRECONDITION_FAILED": return 412;
    case "INTERNAL_SERVER_ERROR": return 500;
    default: return 500;
  }
}

router.post(
  "/api/question-bank/scorm-import/confirm",
  async (req: Request, res: Response) => {
    try {
      let user: { id: number; role: string } | null = null;
      try {
        const authed = await sdk.authenticateRequest(req);
        if (authed?.role === "admin") user = { id: authed.id, role: authed.role };
      } catch {
        user = null;
      }
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const parsed = confirmInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database unavailable" });
        return;
      }

      const result = await commitScormImportToQuestionBank(db, user.id, parsed.data);
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof TRPCError) {
        res.status(trpcErrorStatus(err.code)).json({ error: err.message });
        return;
      }
      console.error("[scorm-import/confirm]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to import SCORM quiz to Question Bank",
      });
    }
  },
);

export function registerScormQuestionBankImportRoute(app: import("express").Application) {
  app.use(router);
}
