/**
 * teachRouter.ts — TEACH workspace for LMS Instructors and EducatorAssist™ educators.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, isNotNull, lt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { storagePut } from "../storage";
import {
  educatorOrgs,
  mediaAssets,
  mediaVersions,
  teachFolders,
  teachMaterialPermissions,
  teachMaterials,
  teachSlideMasters,
  users,
} from "../../drizzle/schema";
import {
  canPerformTeachAction,
  getTeachUserContext,
  listAccessibleMaterials,
  teachFolderSlug,
} from "../lib/teachAccess";
import { parseTeachSlides } from "../../shared/teachPresentation";
import {
  applyMasterToPresentation,
  createDefaultMasterSlides,
  masterSlidesToJson,
  parseMasterSlides,
  type TeachMasterSlide,
} from "../../shared/teachSlideMaster";
import { parsePptxBuffer } from "../lib/pptxImport";

const slideSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().optional(),
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  transition: z.object({
    type: z.string(),
    durationMs: z.number(),
  }).optional(),
  advanceAfterMs: z.number().nullable().optional(),
  elements: z.array(z.object({
    id: z.string(),
    type: z.enum(["text", "image", "video", "shape"]),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    zIndex: z.number(),
    content: z.string().optional(),
    src: z.string().optional(),
    style: z.record(z.unknown()).optional(),
    video: z.object({
      autoplay: z.boolean(),
      loop: z.boolean(),
      muted: z.boolean(),
      controls: z.boolean(),
      startAtSec: z.number().optional(),
    }).optional(),
    shape: z.enum(["rectangle", "ellipse"]).optional(),
    fill: z.string().optional(),
    stroke: z.string().optional(),
    entrance: z.object({
      type: z.string(),
      durationMs: z.number(),
      delayMs: z.number(),
      trigger: z.enum(["onClick", "withPrevious", "afterPrevious", "auto"]),
    }).optional(),
  })).optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
});

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${randomBytes(4).toString("hex")}`;
}

function detectMediaType(mimeType: string): "image" | "video" | "audio" | "document" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint") ||
    mimeType.includes("word")
  ) {
    return "document";
  }
  return "other";
}

export async function requireTeachAccess(userId: number) {
  const ctx = await getTeachUserContext(userId);
  if (!ctx.canAccessTeach) {
    throw new TRPCError({ code: "FORBIDDEN", message: "TEACH access required." });
  }
  return ctx;
}

async function getMaterialOrThrow(materialId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const [material] = await db.select().from(teachMaterials).where(eq(teachMaterials.id, materialId)).limit(1);
  if (!material) throw new TRPCError({ code: "NOT_FOUND", message: "Material not found" });
  return material;
}

async function getMasterOrThrow(masterId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const [master] = await db.select().from(teachSlideMasters).where(eq(teachSlideMasters.id, masterId)).limit(1);
  if (!master) throw new TRPCError({ code: "NOT_FOUND", message: "Slide master not found" });
  return master;
}

async function resolveSlidesForMaterial(material: typeof teachMaterials.$inferSelect) {
  let slides = parseTeachSlides(material.slidesData);
  if (material.slideMasterId) {
    const db = await getDb();
    if (db) {
      const [master] = await db
        .select()
        .from(teachSlideMasters)
        .where(eq(teachSlideMasters.id, material.slideMasterId))
        .limit(1);
      if (master && material.masterForced) {
        slides = applyMasterToPresentation(slides, parseMasterSlides(master.masterSlidesData));
      }
    }
  }
  return slides;
}

async function uploadPptxImage(userId: number, folder: string) {
  return async (fileName: string, data: Buffer, mimeType: string) => {
    const slug = generateSlug(fileName);
    const s3Key = `media-repo/${slug}/pptx-${fileName}`;
    const { url } = await storagePut(s3Key, data, mimeType);
    return url;
  };
}

export const teachRouter = router({
  getMyContext: protectedProcedure.query(async ({ ctx }) => {
    const teachCtx = await getTeachUserContext(ctx.user.id);
    const db = await getDb();
    if (db && teachCtx.educatorOrgs.length > 0) {
      const orgIds = teachCtx.educatorOrgs.map((o) => o.orgId);
      const { inArray } = await import("drizzle-orm");
      const orgs = await db
        .select({ id: educatorOrgs.id, name: educatorOrgs.name })
        .from(educatorOrgs)
        .where(inArray(educatorOrgs.id, orgIds));
      teachCtx.educatorOrgs = teachCtx.educatorOrgs.map((o) => ({
        ...o,
        orgName: orgs.find((org) => org.id === o.orgId)?.name ?? o.orgName,
      }));
    }
    return teachCtx;
  }),

  listMyMaterials: protectedProcedure.query(async ({ ctx }) => {
    await requireTeachAccess(ctx.user.id);
    const materials = await listAccessibleMaterials(ctx.user.id);
    return materials.map((m) => ({
      ...m,
      isOwner: m.ownerUserId === ctx.user.id,
      slidesData: undefined,
    }));
  }),

  adminListAll: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(200) }).optional())
    .query(async ({ ctx, input }) => {
      const teachCtx = await getTeachUserContext(ctx.user.id);
      if (!teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(teachMaterials)
        .orderBy(desc(teachMaterials.updatedAt))
        .limit(input?.limit ?? 200);
      const ownerIds = [...new Set(rows.map((r) => r.ownerUserId))];
      const { inArray } = await import("drizzle-orm");
      const owners =
        ownerIds.length > 0
          ? await db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(users)
              .where(inArray(users.id, ownerIds))
          : [];
      return rows.map((m) => ({
        ...m,
        slidesData: undefined,
        owner: owners.find((o) => o.id === m.ownerUserId) ?? null,
      }));
    }),

  getMaterial: protectedProcedure
    .input(z.object({ materialId: z.number() }))
    .query(async ({ ctx, input }) => {
      const material = await getMaterialOrThrow(input.materialId);
      const allowed = await canPerformTeachAction(ctx.user.id, material, "view");
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      let mediaUrl: string | null = null;
      if (db && material.mediaAssetId) {
        const [ver] = await db
          .select({ s3Url: mediaVersions.s3Url })
          .from(mediaVersions)
          .where(eq(mediaVersions.assetId, material.mediaAssetId))
          .orderBy(desc(mediaVersions.versionNumber))
          .limit(1);
        mediaUrl = ver?.s3Url ?? null;
      }
      return {
        ...material,
        slides: await resolveSlidesForMaterial(material),
        mediaUrl,
        isOwner: material.ownerUserId === ctx.user.id,
        masterForced: material.masterForced ?? false,
        slideMasterId: material.slideMasterId ?? null,
      };
    }),

  createPresentation: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(300),
        description: z.string().optional(),
        ownerContext: z.enum(["lms_instructor", "educator_assist"]).default("lms_instructor"),
        educatorOrgId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (input.ownerContext === "educator_assist") {
        if (!input.educatorOrgId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "educatorOrgId required for EducatorAssist context" });
        }
        const hasOrg = teachCtx.educatorOrgs.some(
          (o) => o.orgId === input.educatorOrgId && o.orgRole === "education_admin",
        );
        if (!hasOrg && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not an EducatorAssist admin for this org" });
        }
      }

      const defaultSlides = JSON.stringify([{ id: "1", title: "Slide 1", content: "", notes: "" }]);
      const [result] = await db.insert(teachMaterials).values({
        ownerUserId: ctx.user.id,
        ownerContext: input.ownerContext,
        lmsInstructorId: teachCtx.lmsInstructor?.id ?? null,
        educatorOrgId: input.educatorOrgId ?? null,
        materialType: "presentation",
        title: input.title,
        description: input.description ?? null,
        slidesData: defaultSlides,
        status: "draft",
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  updatePresentation: protectedProcedure
    .input(
      z.object({
        materialId: z.number(),
        title: z.string().min(1).max(300).optional(),
        description: z.string().optional(),
        slides: z.array(slideSchema).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const material = await getMaterialOrThrow(input.materialId);
      const allowed = await canPerformTeachAction(ctx.user.id, material, "edit");
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.slides !== undefined) updates.slidesData = JSON.stringify(input.slides);
      if (input.status !== undefined) updates.status = input.status;
      await db.update(teachMaterials).set(updates).where(eq(teachMaterials.id, input.materialId));
      return { ok: true };
    }),

  uploadMaterial: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(300),
        description: z.string().optional(),
        fileData: z.string().min(1),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(128),
        fileSize: z.number().int().positive(),
        ownerContext: z.enum(["lms_instructor", "educator_assist"]).default("lms_instructor"),
        educatorOrgId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      // File size enforcement: unlimited for admins, 200 MB for instructors
      const maxBytes = (teachCtx.isPlatformAdmin || teachCtx.isEducationManager) ? Infinity : 200 * 1024 * 1024;
      if (input.fileSize > maxBytes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File exceeds the 200 MB limit for instructors." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const folder = teachFolderSlug(ctx.user.id);
      const slug = generateSlug(input.title);
      const buffer = Buffer.from(input.fileData, "base64");
      const mediaType = detectMediaType(input.mimeType);
      const s3Key = `media-repo/${slug}/v1-${input.fileName}`;
      const { url: s3Url } = await storagePut(s3Key, buffer, input.mimeType);

      const [assetResult] = await db.insert(mediaAssets).values({
        slug,
        title: input.title,
        description: input.description ?? null,
        mediaType: mediaType === "other" ? "document" : mediaType,
        mimeType: input.mimeType,
        access: "private",
        folder,
        createdByUserId: ctx.user.id,
      });
      const assetId = (assetResult as { insertId: number }).insertId;

      await db.insert(mediaVersions).values({
        assetId,
        versionNumber: 1,
        s3Key,
        s3Url,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        uploadedByUserId: ctx.user.id,
      });

      const isPresentation =
        input.mimeType.includes("presentation") || input.fileName.match(/\.(ppt|pptx)$/i);

      let slidesData: string | null = null;
      let slideMasterId: number | null = null;
      const isPptx = input.fileName.match(/\.pptx$/i) || input.mimeType.includes("presentationml");

      if (isPptx) {
        try {
          const parsed = await parsePptxBuffer(buffer, await uploadPptxImage(ctx.user.id, folder));
          slidesData = JSON.stringify(parsed.slides);
          if (parsed.masterSlides.length > 0) {
            const [masterResult] = await db.insert(teachSlideMasters).values({
              ownerUserId: ctx.user.id,
              name: `${input.title} Master`,
              description: `Imported from ${input.fileName}`,
              masterSlidesData: masterSlidesToJson(parsed.masterSlides),
              isGlobal: false,
            });
            slideMasterId = (masterResult as { insertId: number }).insertId;
          }
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err instanceof Error ? err.message : "Failed to parse PowerPoint file",
          });
        }
      }

      const [matResult] = await db.insert(teachMaterials).values({
        ownerUserId: ctx.user.id,
        ownerContext: input.ownerContext,
        lmsInstructorId: teachCtx.lmsInstructor?.id ?? null,
        educatorOrgId: input.educatorOrgId ?? null,
        materialType: isPresentation ? "presentation" : mediaType === "document" ? "document" : "media",
        title: input.title,
        description: input.description ?? null,
        mediaAssetId: assetId,
        slidesData,
        slideMasterId,
        status: "draft",
      });

      return {
        materialId: (matResult as { insertId: number }).insertId,
        mediaAssetId: assetId,
        folder,
        parsed: isPptx,
        slideMasterId,
      };
    }),

  /**
   * parsePptxFromUrl — called after a chunked upload completes.
   * Fetches the PPTX from S3, parses it, and creates a teachMaterial record.
   * This is the large-file alternative to uploadMaterial (which uses base64 tRPC).
   */
  parsePptxFromUrl: protectedProcedure
    .input(
      z.object({
        assetId: z.number(),
        s3Url: z.string().url(),
        s3Key: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
        title: z.string().min(1).max(300),
        description: z.string().optional(),
        ownerContext: z.enum(["lms_instructor", "educator_assist"]).default("lms_instructor"),
        educatorOrgId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const folder = teachFolderSlug(ctx.user.id);
      const isPptx = input.fileName.match(/\.pptx$/i) || input.mimeType.includes("presentationml");
      const isPresentation = input.mimeType.includes("presentation") || input.fileName.match(/\.(ppt|pptx)$/i);

      let slidesData: string | null = null;
      let slideMasterId: number | null = null;

      if (isPptx) {
        // Fetch the PPTX from S3 and parse it
        try {
          const https = await import("https");
          const http = await import("http");
          const buffer = await new Promise<Buffer>((resolve, reject) => {
            const proto = input.s3Url.startsWith("https") ? https.default : http.default;
            proto.get(input.s3Url as any, (res: any) => {
              const chunks: Buffer[] = [];
              res.on("data", (c: Buffer) => chunks.push(c));
              res.on("end", () => resolve(Buffer.concat(chunks)));
              res.on("error", reject);
            }).on("error", reject);
          });
          const parsed = await parsePptxBuffer(buffer, await uploadPptxImage(ctx.user.id, folder));
          slidesData = JSON.stringify(parsed.slides);
          if (parsed.masterSlides.length > 0) {
            const [masterResult] = await db.insert(teachSlideMasters).values({
              ownerUserId: ctx.user.id,
              name: `${input.title} Master`,
              description: `Imported from ${input.fileName}`,
              masterSlidesData: masterSlidesToJson(parsed.masterSlides),
              isGlobal: false,
            });
            slideMasterId = (masterResult as { insertId: number }).insertId;
          }
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err instanceof Error ? err.message : "Failed to parse PowerPoint file",
          });
        }
      }

      const [matResult] = await db.insert(teachMaterials).values({
        ownerUserId: ctx.user.id,
        ownerContext: input.ownerContext,
        lmsInstructorId: teachCtx.lmsInstructor?.id ?? null,
        educatorOrgId: input.educatorOrgId ?? null,
        materialType: isPresentation ? "presentation" : "document",
        title: input.title,
        description: input.description ?? null,
        mediaAssetId: input.assetId,
        slidesData,
        slideMasterId,
        status: "draft",
      });

      return {
        materialId: (matResult as { insertId: number }).insertId,
        mediaAssetId: input.assetId,
        folder,
        parsed: !!isPptx,
        slideMasterId,
      };
    }),

  deleteMaterial: protectedProcedure
    .input(z.object({ materialId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const material = await getMaterialOrThrow(input.materialId);
      const allowed = await canPerformTeachAction(ctx.user.id, material, "manage");
      if (!allowed && material.ownerUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(teachMaterialPermissions).where(eq(teachMaterialPermissions.materialId, input.materialId));
      await db.delete(teachMaterials).where(eq(teachMaterials.id, input.materialId));
      return { ok: true };
    }),

  listPermissions: protectedProcedure
    .input(z.object({ materialId: z.number() }))
    .query(async ({ ctx, input }) => {
      const material = await getMaterialOrThrow(input.materialId);
      const allowed = await canPerformTeachAction(ctx.user.id, material, "manage");
      if (!allowed && material.ownerUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) return [];
      const perms = await db
        .select()
        .from(teachMaterialPermissions)
        .where(eq(teachMaterialPermissions.materialId, input.materialId));
      const userIds = perms.map((p) => p.granteeUserId);
      const { inArray } = await import("drizzle-orm");
      const grantees =
        userIds.length > 0
          ? await db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(users)
              .where(inArray(users.id, userIds))
          : [];
      return perms.map((p) => ({
        ...p,
        grantee: grantees.find((g) => g.id === p.granteeUserId) ?? null,
      }));
    }),

  grantPermission: protectedProcedure
    .input(
      z.object({
        materialId: z.number(),
        granteeEmail: z.string().email(),
        canView: z.boolean().default(true),
        canPresent: z.boolean().default(false),
        canEdit: z.boolean().default(false),
        canManage: z.boolean().default(false),
        canCopy: z.boolean().default(false),
        canDownload: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const material = await getMaterialOrThrow(input.materialId);
      const allowed = await canPerformTeachAction(ctx.user.id, material, "manage");
      if (!allowed && material.ownerUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [grantee] = await db.select().from(users).where(eq(users.email, input.granteeEmail)).limit(1);
      if (!grantee) throw new TRPCError({ code: "NOT_FOUND", message: "User not found with that email" });

      await db
        .insert(teachMaterialPermissions)
        .values({
          materialId: input.materialId,
          granteeUserId: grantee.id,
          canView: input.canView,
          canPresent: input.canPresent,
          canEdit: input.canEdit,
          canManage: input.canManage,
          canCopy: input.canCopy,
          canDownload: input.canDownload,
          grantedByUserId: ctx.user.id,
        })
        .onDuplicateKeyUpdate({
          set: {
            canView: input.canView,
            canPresent: input.canPresent,
            canEdit: input.canEdit,
            canManage: input.canManage,
            canCopy: input.canCopy,
            canDownload: input.canDownload,
            grantedByUserId: ctx.user.id,
          },
        });
      return { ok: true, granteeUserId: grantee.id };
    }),

  revokePermission: protectedProcedure
    .input(z.object({ permissionId: z.number(), materialId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const material = await getMaterialOrThrow(input.materialId);
      const allowed = await canPerformTeachAction(ctx.user.id, material, "manage");
      if (!allowed && material.ownerUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(teachMaterialPermissions).where(eq(teachMaterialPermissions.id, input.permissionId));
      return { ok: true };
    }),

  copyToMyAccount: protectedProcedure
    .input(z.object({ materialId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const material = await getMaterialOrThrow(input.materialId);
      const allowed = await canPerformTeachAction(ctx.user.id, material, "copy");
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Copy permission required" });
      const teachCtx = await requireTeachAccess(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result] = await db.insert(teachMaterials).values({
        ownerUserId: ctx.user.id,
        ownerContext: material.ownerContext,
        lmsInstructorId: teachCtx.lmsInstructor?.id ?? null,
        educatorOrgId: material.educatorOrgId,
        materialType: material.materialType,
        title: `${material.title} (Copy)`,
        description: material.description,
        slidesData: material.slidesData,
        mediaAssetId: null,
        status: "draft",
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  importPptx: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(300),
        description: z.string().optional(),
        fileData: z.string().min(1),
        fileName: z.string().min(1).max(255),
        fileSize: z.number().int().positive(),
        ownerContext: z.enum(["lms_instructor", "educator_assist"]).default("lms_instructor"),
        educatorOrgId: z.number().optional(),
        saveImportedMaster: z.boolean().default(true),
        applyMaster: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      // File size enforcement: unlimited for admins, 200 MB for instructors
      const maxBytes = (teachCtx.isPlatformAdmin || teachCtx.isEducationManager) ? Infinity : 200 * 1024 * 1024;
      if (input.fileSize > maxBytes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File exceeds the 200 MB limit for instructors." });
      }
      if (!input.fileName.match(/\.pptx$/i)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only .pptx files are supported for import" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const buffer = Buffer.from(input.fileData, "base64");
      const folder = teachFolderSlug(ctx.user.id);
      const parsed = await parsePptxBuffer(buffer, await uploadPptxImage(ctx.user.id, folder));

      let slideMasterId: number | null = null;
      if (input.saveImportedMaster && parsed.masterSlides.length > 0) {
        const [masterResult] = await db.insert(teachSlideMasters).values({
          ownerUserId: ctx.user.id,
          name: `${input.title} Master`,
          description: `Imported from ${input.fileName}`,
          masterSlidesData: masterSlidesToJson(parsed.masterSlides),
          isGlobal: false,
        });
        slideMasterId = (masterResult as { insertId: number }).insertId;
      }

      let slides = parsed.slides;
      if (input.applyMaster && slideMasterId) {
        slides = applyMasterToPresentation(slides, parsed.masterSlides);
      }

      const slug = generateSlug(input.title);
      const s3Key = `media-repo/${slug}/v1-${input.fileName}`;
      const { url: s3Url } = await storagePut(s3Key, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");

      const [assetResult] = await db.insert(mediaAssets).values({
        slug,
        title: input.title,
        description: input.description ?? null,
        mediaType: "document",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        access: "private",
        folder,
        createdByUserId: ctx.user.id,
      });
      const assetId = (assetResult as { insertId: number }).insertId;

      await db.insert(mediaVersions).values({
        assetId,
        versionNumber: 1,
        s3Key,
        s3Url,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        uploadedByUserId: ctx.user.id,
      });

      const [matResult] = await db.insert(teachMaterials).values({
        ownerUserId: ctx.user.id,
        ownerContext: input.ownerContext,
        lmsInstructorId: teachCtx.lmsInstructor?.id ?? null,
        educatorOrgId: input.educatorOrgId ?? null,
        materialType: "presentation",
        title: input.title,
        description: input.description ?? null,
        mediaAssetId: assetId,
        slidesData: JSON.stringify(slides),
        slideMasterId,
        masterForced: false,
        status: "draft",
      });

      return {
        materialId: (matResult as { insertId: number }).insertId,
        slideCount: slides.length,
        slideMasterId,
        warnings: parsed.warnings,
      };
    }),

  listMasters: protectedProcedure.query(async ({ ctx }) => {
    await requireTeachAccess(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const teachCtx = await getTeachUserContext(ctx.user.id);
    const { or } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(teachSlideMasters)
      .where(
        or(
          eq(teachSlideMasters.ownerUserId, ctx.user.id),
          eq(teachSlideMasters.isGlobal, true),
        ),
      )
      .orderBy(desc(teachSlideMasters.updatedAt));
    return rows.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      isGlobal: m.isGlobal,
      isDefaultForced: m.isDefaultForced,
      isOwner: m.ownerUserId === ctx.user.id,
      canEdit:
        m.ownerUserId === ctx.user.id ||
        teachCtx.isPlatformAdmin ||
        teachCtx.isEducationManager,
      updatedAt: m.updatedAt,
    }));
  }),

  getMaster: protectedProcedure
    .input(z.object({ masterId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireTeachAccess(ctx.user.id);
      const master = await getMasterOrThrow(input.masterId);
      const teachCtx = await getTeachUserContext(ctx.user.id);
      if (!master.isGlobal && master.ownerUserId !== ctx.user.id && !teachCtx.isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return {
        ...master,
        masterSlides: parseMasterSlides(master.masterSlidesData),
        isOwner: master.ownerUserId === ctx.user.id,
      };
    }),

  createMaster: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(300),
        description: z.string().optional(),
        isGlobal: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      if (input.isGlobal && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin required for global masters" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(teachSlideMasters).values({
        ownerUserId: ctx.user.id,
        name: input.name,
        description: input.description ?? null,
        masterSlidesData: masterSlidesToJson(createDefaultMasterSlides()),
        isGlobal: input.isGlobal,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  updateMaster: protectedProcedure
    .input(
      z.object({
        masterId: z.number(),
        name: z.string().min(1).max(300).optional(),
        description: z.string().optional(),
        masterSlides: z.array(slideSchema.extend({
          layoutRole: z.string().optional(),
          name: z.string().optional(),
        })).optional(),
        isGlobal: z.boolean().optional(),
        isDefaultForced: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const master = await getMasterOrThrow(input.masterId);
      const teachCtx = await getTeachUserContext(ctx.user.id);
      const canEdit =
        master.ownerUserId === ctx.user.id ||
        teachCtx.isPlatformAdmin ||
        teachCtx.isEducationManager;
      if (!canEdit) throw new TRPCError({ code: "FORBIDDEN" });

      if (input.isGlobal && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (input.isDefaultForced) {
        await db.update(teachSlideMasters).set({ isDefaultForced: false });
      }

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.masterSlides !== undefined) updates.masterSlidesData = JSON.stringify(input.masterSlides);
      if (input.isGlobal !== undefined) updates.isGlobal = input.isGlobal;
      if (input.isDefaultForced !== undefined) updates.isDefaultForced = input.isDefaultForced;

      await db.update(teachSlideMasters).set(updates).where(eq(teachSlideMasters.id, input.masterId));
      return { ok: true };
    }),

  deleteMaster: protectedProcedure
    .input(z.object({ masterId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const master = await getMasterOrThrow(input.masterId);
      const teachCtx = await getTeachUserContext(ctx.user.id);
      if (
        master.ownerUserId !== ctx.user.id &&
        !teachCtx.isPlatformAdmin &&
        !teachCtx.isEducationManager
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(teachMaterials).set({ slideMasterId: null, masterForced: false }).where(eq(teachMaterials.slideMasterId, input.masterId));
      await db.delete(teachSlideMasters).where(eq(teachSlideMasters.id, input.masterId));
      return { ok: true };
    }),

  applyMasterToPresentation: protectedProcedure
    .input(
      z.object({
        materialId: z.number(),
        masterId: z.number(),
        forced: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const material = await getMaterialOrThrow(input.materialId);
      const allowed = await canPerformTeachAction(ctx.user.id, material, "edit");
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });

      const teachCtx = await getTeachUserContext(ctx.user.id);
      if (input.forced && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager && material.ownerUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot force master without manage access" });
      }

      const master = await getMasterOrThrow(input.masterId);
      if (!master.isGlobal && master.ownerUserId !== ctx.user.id && !teachCtx.isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Master not accessible" });
      }

      const masterSlides = parseMasterSlides(master.masterSlidesData);
      const slides = applyMasterToPresentation(parseTeachSlides(material.slidesData), masterSlides);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(teachMaterials)
        .set({
          slidesData: JSON.stringify(slides),
          slideMasterId: input.masterId,
          masterForced: input.forced,
        })
        .where(eq(teachMaterials.id, input.materialId));

      return { ok: true, slideCount: slides.length };
    }),

  // ─── Folder management ────────────────────────────────────────────────
  listFolders: protectedProcedure.query(async ({ ctx }) => {
    const teachCtx = await requireTeachAccess(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    if (teachCtx.isPlatformAdmin || teachCtx.isEducationManager) {
      const { inArray } = await import("drizzle-orm");
      const rows = await db.select().from(teachFolders).orderBy(teachFolders.name);
      const ownerIds = [...new Set(rows.map((r) => r.ownerUserId))];
      const owners = ownerIds.length > 0
        ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ownerIds))
        : [];
      return rows.map((r) => ({ ...r, ownerName: owners.find((o) => o.id === r.ownerUserId)?.name ?? null }));
    }
    return db.select().from(teachFolders).where(eq(teachFolders.ownerUserId, ctx.user.id)).orderBy(teachFolders.name);
  }),

  createFolder: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(300), parentId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireTeachAccess(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(teachFolders).values({
        ownerUserId: ctx.user.id,
        name: input.name,
        parentId: input.parentId ?? null,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  renameFolder: protectedProcedure
    .input(z.object({ folderId: z.number(), name: z.string().min(1).max(300) }))
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [folder] = await db.select().from(teachFolders).where(eq(teachFolders.id, input.folderId)).limit(1);
      if (!folder) throw new TRPCError({ code: "NOT_FOUND" });
      if (folder.ownerUserId !== ctx.user.id && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.update(teachFolders).set({ name: input.name }).where(eq(teachFolders.id, input.folderId));
      return { ok: true };
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ folderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [folder] = await db.select().from(teachFolders).where(eq(teachFolders.id, input.folderId)).limit(1);
      if (!folder) throw new TRPCError({ code: "NOT_FOUND" });
      if (folder.ownerUserId !== ctx.user.id && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Move materials in this folder back to root
      await db.update(teachMaterials).set({ folderId: null, folderName: null }).where(eq(teachMaterials.folderId, input.folderId));
      await db.delete(teachFolders).where(eq(teachFolders.id, input.folderId));
      return { ok: true };
    }),

  moveMaterialToFolder: protectedProcedure
    .input(z.object({ materialId: z.number(), folderId: z.number().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      const material = await getMaterialOrThrow(input.materialId);
      if (material.ownerUserId !== ctx.user.id && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let folderName: string | null = null;
      if (input.folderId != null) {
        const [folder] = await db.select().from(teachFolders).where(eq(teachFolders.id, input.folderId)).limit(1);
        if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
        folderName = folder.name;
      }
      await db.update(teachMaterials).set({ folderId: input.folderId, folderName }).where(eq(teachMaterials.id, input.materialId));
      return { ok: true };
    }),

  renameMaterial: protectedProcedure
    .input(z.object({ materialId: z.number(), title: z.string().min(1).max(300) }))
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      const material = await getMaterialOrThrow(input.materialId);
      if (material.ownerUserId !== ctx.user.id && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(teachMaterials).set({ title: input.title }).where(eq(teachMaterials.id, input.materialId));
      return { ok: true };
    }),

  trashMaterial: protectedProcedure
    .input(z.object({ materialId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      const material = await getMaterialOrThrow(input.materialId);
      if (material.ownerUserId !== ctx.user.id && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(teachMaterials).set({ trashedAt: new Date(), trashedBy: ctx.user.id }).where(eq(teachMaterials.id, input.materialId));
      return { ok: true };
    }),

  restoreMaterial: protectedProcedure
    .input(z.object({ materialId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await requireTeachAccess(ctx.user.id);
      const material = await getMaterialOrThrow(input.materialId);
      if (material.ownerUserId !== ctx.user.id && !teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(teachMaterials).set({ trashedAt: null, trashedBy: null }).where(eq(teachMaterials.id, input.materialId));
      return { ok: true };
    }),

  listTrash: protectedProcedure.query(async ({ ctx }) => {
    const teachCtx = await requireTeachAccess(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    if (teachCtx.isPlatformAdmin || teachCtx.isEducationManager) {
      const { inArray } = await import("drizzle-orm");
      const rows = await db.select().from(teachMaterials).where(isNotNull(teachMaterials.trashedAt)).orderBy(desc(teachMaterials.trashedAt));
      const ownerIds = [...new Set(rows.map((r) => r.ownerUserId))];
      const owners = ownerIds.length > 0
        ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ownerIds))
        : [];
      return rows.map((r) => ({ ...r, slidesData: undefined, ownerName: owners.find((o) => o.id === r.ownerUserId)?.name ?? null }));
    }
    const rows = await db.select().from(teachMaterials)
      .where(and(eq(teachMaterials.ownerUserId, ctx.user.id), isNotNull(teachMaterials.trashedAt)))
      .orderBy(desc(teachMaterials.trashedAt));
    return rows.map((r) => ({ ...r, slidesData: undefined }));
  }),

  purgeExpiredTrash: protectedProcedure.mutation(async ({ ctx }) => {
    const teachCtx = await getTeachUserContext(ctx.user.id);
    if (!teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expired = await db.select({ id: teachMaterials.id }).from(teachMaterials)
      .where(and(isNotNull(teachMaterials.trashedAt), lt(teachMaterials.trashedAt, cutoff)));
    for (const row of expired) {
      await db.delete(teachMaterialPermissions).where(eq(teachMaterialPermissions.materialId, row.id));
      await db.delete(teachMaterials).where(eq(teachMaterials.id, row.id));
    }
    return { purged: expired.length };
  }),

  // ─── Admin force master ────────────────────────────────────────────────
  adminForceMaster: protectedProcedure
    .input(
      z.object({
        materialId: z.number(),
        masterId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const teachCtx = await getTeachUserContext(ctx.user.id);
      if (!teachCtx.isPlatformAdmin && !teachCtx.isEducationManager) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const material = await getMaterialOrThrow(input.materialId);
      const master = await getMasterOrThrow(input.masterId);
      const slides = applyMasterToPresentation(
        parseTeachSlides(material.slidesData),
        parseMasterSlides(master.masterSlidesData),
      );
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(teachMaterials)
        .set({
          slidesData: JSON.stringify(slides),
          slideMasterId: input.masterId,
          masterForced: true,
        })
        .where(eq(teachMaterials.id, input.materialId));
      return { ok: true };
    }),
});
