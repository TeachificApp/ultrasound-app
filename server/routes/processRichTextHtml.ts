/**
 * POST /api/process-rich-text-html
 *
 * Uploads embedded base64 images in rich-text HTML and returns HTML with hosted URLs.
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { processRichTextHtml } from "../lib/processRichTextHtml";
import { authenticateContentUploader } from "../lib/contentUploadAuth";

const router = Router();

const bodySchema = z.object({
  html: z.string().min(1).max(50_000_000),
  context: z.string().max(64).optional(),
});

router.post("/api/process-rich-text-html", async (req: Request, res: Response) => {
  try {
    const user = await authenticateContentUploader(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const html = await processRichTextHtml(parsed.data.html, parsed.data.context ?? "rich-text");
    res.json({ html: html ?? "" });
  } catch (err: any) {
    console.error("[process-rich-text-html]", err);
    res.status(500).json({ error: err?.message ?? "Processing failed" });
  }
});

export function registerProcessRichTextHtmlRoute(app: import("express").Application) {
  app.use(router);
}
