/**
 * teachRouter.ts — TEACH workspace for LMS Instructors and EducatorAssist™ educators.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { storagePut } from "../storage";
import {
  educatorOrgs,
  mediaAssets,
  mediaVersions,
  teachMaterialPermissions,
  teachMaterials,
  users,
} from "../../drizzle/schema";
import {
  canPerformTeachAction,
  getTeachUserContext,
  listAccessibleMaterials,
  parseSlidesData,
  teachFolderSlug,
} from "../lib/teachAccess";

const slideSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  imageUrl: z.string().optional(),
  notes: z.string().optional(),
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

async function requireTeachAccess(userId: number) {
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
        slides: parseSlidesData(material.slidesData),
        mediaUrl,
        isOwner: material.ownerUserId === ctx.user.id,
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

      const [matResult] = await db.insert(teachMaterials).values({
        ownerUserId: ctx.user.id,
        ownerContext: input.ownerContext,
        lmsInstructorId: teachCtx.lmsInstructor?.id ?? null,
        educatorOrgId: input.educatorOrgId ?? null,
        materialType: isPresentation ? "presentation" : mediaType === "document" ? "document" : "media",
        title: input.title,
        description: input.description ?? null,
        mediaAssetId: assetId,
        status: "draft",
      });

      return { materialId: (matResult as { insertId: number }).insertId, mediaAssetId: assetId, folder };
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
});
