/**
 * Shared TEACH PPTX import logic — used by tRPC and /api/upload-teach/parse.
 */
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { getDb } from "../db";
import { downloadStorageObject } from "./downloadStorageObject";
import { parsePptxBuffer } from "./pptxImport";
import { getTeachUserContext, teachFolderSlug } from "./teachAccess";
import { teachMaterials, teachSlideMasters } from "../../drizzle/schema";
import { masterSlidesToJson } from "../../shared/teachSlideMaster";
import { storagePut } from "../storage";
import { eq } from "drizzle-orm";

const SLIDES_S3_THRESHOLD = 10 * 1024 * 1024;
export const TEACH_IMPORT_PENDING = "__import_pending__";
export const TEACH_IMPORT_FAILED_PREFIX = "IMPORT_FAILED:";

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${randomBytes(4).toString("hex")}`;
}

async function persistSlidesJson(
  json: string,
  userId: number,
  label: string,
): Promise<{ slidesData: string | null; slidesDataUrl: string | null }> {
  if (Buffer.byteLength(json, "utf8") <= SLIDES_S3_THRESHOLD) {
    return { slidesData: json, slidesDataUrl: null };
  }
  const key = `teach-slides/${userId}/${label}-${randomBytes(8).toString("hex")}.json`;
  const { url } = await storagePut(key, Buffer.from(json, "utf8"), "application/json");
  return { slidesData: null, slidesDataUrl: url };
}

export type TeachUploadedFileInput = {
  userId: number;
  assetId: number;
  s3Key: string;
  s3Url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  title: string;
  description?: string;
  ownerContext: "lms_instructor" | "educator_assist";
  educatorOrgId?: number;
};

export type TeachUploadedFileResult = {
  materialId: number;
  mediaAssetId: number;
  folder: string;
  parsed: boolean;
  slideMasterId: number | null;
  processing: boolean;
};

async function requireTeach(userId: number) {
  const teachCtx = await getTeachUserContext(userId);
  if (!teachCtx.canAccessTeach) {
    throw new TRPCError({ code: "FORBIDDEN", message: "TEACH access required." });
  }
  return teachCtx;
}

export async function createTeachMaterialDraft(input: TeachUploadedFileInput): Promise<TeachUploadedFileResult> {
  const teachCtx = await requireTeach(input.userId);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const folder = teachFolderSlug(input.userId);
  const isPptx = Boolean(input.fileName.match(/\.pptx$/i) || input.mimeType.includes("presentationml"));
  const isPresentation = input.mimeType.includes("presentation") || Boolean(input.fileName.match(/\.(ppt|pptx)$/i));

  const [matResult] = await db.insert(teachMaterials).values({
    ownerUserId: input.userId,
    ownerContext: input.ownerContext,
    lmsInstructorId: teachCtx.lmsInstructor?.id ?? null,
    educatorOrgId: input.educatorOrgId ?? null,
    materialType: isPresentation ? "presentation" : "document",
    title: input.title,
    description: isPptx ? TEACH_IMPORT_PENDING : (input.description ?? null),
    mediaAssetId: input.assetId,
    slidesData: null,
    slidesDataUrl: null,
    slideMasterId: null,
    status: "draft",
  });

  return {
    materialId: (matResult as { insertId: number }).insertId,
    mediaAssetId: input.assetId,
    folder,
    parsed: false,
    slideMasterId: null,
    processing: isPptx,
  };
}

export async function parseAndUpdateTeachMaterial(
  materialId: number,
  input: TeachUploadedFileInput,
): Promise<{ parsed: boolean; slideMasterId: number | null }> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const isPptx = Boolean(input.fileName.match(/\.pptx$/i) || input.mimeType.includes("presentationml"));
  if (!isPptx) {
    await db.update(teachMaterials).set({ description: input.description ?? null }).where(eq(teachMaterials.id, materialId));
    return { parsed: false, slideMasterId: null };
  }

  try {
    const buffer = await downloadStorageObject(input.s3Key, input.s3Url);
    const parsed = await parsePptxBuffer(buffer);
    const persisted = await persistSlidesJson(
      JSON.stringify(parsed.slides),
      input.userId,
      generateSlug(input.title),
    );

    let slideMasterId: number | null = null;
    if (parsed.masterSlides.length > 0) {
      const [masterResult] = await db.insert(teachSlideMasters).values({
        ownerUserId: input.userId,
        name: `${input.title} Master`,
        description: `Imported from ${input.fileName}`,
        masterSlidesData: masterSlidesToJson(parsed.masterSlides),
        isGlobal: false,
      });
      slideMasterId = (masterResult as { insertId: number }).insertId;
    }

    await db.update(teachMaterials).set({
      slidesData: persisted.slidesData,
      slidesDataUrl: persisted.slidesDataUrl,
      slideMasterId,
      description: input.description ?? null,
      materialType: "presentation",
    }).where(eq(teachMaterials.id, materialId));

    return { parsed: true, slideMasterId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse PowerPoint file";
    await db.update(teachMaterials).set({
      description: `${TEACH_IMPORT_FAILED_PREFIX} ${message}`,
    }).where(eq(teachMaterials.id, materialId));
    throw err;
  }
}

/** Synchronous import — used by tRPC uploadMaterial path and small files. */
export async function importTeachUploadedFileSync(input: TeachUploadedFileInput): Promise<TeachUploadedFileResult> {
  const draft = await createTeachMaterialDraft(input);
  if (!draft.processing) return draft;

  const { parsed, slideMasterId } = await parseAndUpdateTeachMaterial(draft.materialId, input);
  return {
    ...draft,
    parsed,
    slideMasterId,
    processing: false,
  };
}

/** Start import in background; returns immediately with materialId for polling. */
export function importTeachUploadedFileAsync(input: TeachUploadedFileInput): Promise<TeachUploadedFileResult> {
  return createTeachMaterialDraft(input).then(async (draft) => {
    if (!draft.processing) return draft;

    setImmediate(() => {
      parseAndUpdateTeachMaterial(draft.materialId, input).catch((err) => {
        console.error(`[teachPptxImport] Background parse failed for material ${draft.materialId}:`, err);
      });
    });

    return draft;
  });
}
