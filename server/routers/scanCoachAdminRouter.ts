/**
 * scanCoachAdminRouter.ts
 * Platform-admin CRUD for ScanCoach WYSIWYG overrides.
 * Access: platform_admin role or owner (role === "admin").
 *
 * Procedures:
 *   listOverrides(module?)              — fetch all overrides, optionally filtered by module
 *   upsertOverride(input)               — create or update a text/image override for a view
 *   uploadImage(input)                  — accept base64 image, upload to S3, return URL
 *   deleteOverride(id)                  — remove an override row entirely
 *   clearImageField(id, field)          — null out a single image field on an override
 *   uploadAdditionalMedia(input)        — upload extra educational image/video to a section
 *   deleteAdditionalMedia(id, mediaKey) — remove a specific item from additionalMedia JSON
 *   addCustomView(input)                — create a new admin-defined view not in static registry
 *   deleteCustomView(id)                — remove an admin-defined custom view
 *   listCustomViews(module?)            — list all custom views, optionally by module
 *   getMediaByView(viewId)              — get all media for a specific TEE/ICE view
 *   getMediaByViews(viewIds)            — bulk-fetch media for multiple views
 *   uploadViewMedia(input)              — upload reference image/video for TEE/ICE view
 *   deleteViewMedia(id)                 — delete a media record by ID
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getDb,
  getUserRoles,
  insertScanCoachMedia,
  getScanCoachMediaByView,
  getScanCoachMediaByViews,
  deleteScanCoachMedia,
} from "../db";
import { scanCoachOverrides } from "../../drizzle/schema";
import { storagePut } from "../storage";

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function assertPlatformAdmin(ctx: { user: { id: number; role: string } }) {
  const roles = await getUserRoles(ctx.user.id);
  const ok = ctx.user.role === "admin" || roles.includes("platform_admin");
  if (!ok) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  }
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const MODULE_VALUES = ["tte", "tee", "ice", "uea", "strain", "hocm", "stress", "structural", "fetal", "chd", "diastolic", "pulm", "pocus_efast", "pocus_rush", "pocus_cardiac", "pocus_lung", "achd", "ecg"] as const;

const upsertSchema = z.object({
  module: z.enum(MODULE_VALUES),
  viewId: z.string().min(1).max(64),
  viewName: z.string().max(128).optional(),
  // Image URLs (already uploaded — pass null to clear)
  echoImageUrl: z.string().url().nullable().optional(),
  anatomyImageUrl: z.string().url().nullable().optional(),
  transducerImageUrl: z.string().url().nullable().optional(),
  // Text overrides
  description: z.string().nullable().optional(),
  probe: z.string().nullable().optional(),
  anatomy: z.string().nullable().optional(),
  // JSON arrays encoded as strings
  howToGet: z.string().nullable().optional(),
  tips: z.string().nullable().optional(),
  pitfalls: z.string().nullable().optional(),
  structures: z.string().nullable().optional(),
  measurements: z.string().nullable().optional(),
  criticalFindings: z.string().nullable().optional(),
});

const imageUploadSchema = z.object({
  module: z.enum(MODULE_VALUES),
  viewId: z.string().min(1).max(64),
  /** Which image slot to fill: echo | anatomy | transducer */
  slot: z.enum(["echo", "anatomy", "transducer"]),
  /** Base64-encoded image data (without data: prefix) */
  base64Data: z.string(),
  /** MIME type, e.g. image/jpeg or video/mp4 */
  mimeType: z.string().regex(/^(image\/(jpeg|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime|x-ms-wmv|x-msvideo|avi))$/),
  /** Original filename for the S3 key */
  fileName: z.string().max(128),
});

const additionalMediaUploadSchema = z.object({
  module: z.enum(MODULE_VALUES),
  viewId: z.string().min(1).max(64),
  /** Section this media belongs to: echo | anatomy | transducer | additional */
  section: z.enum(["echo", "anatomy", "transducer", "additional"]).default("additional"),
  base64Data: z.string(),
  mimeType: z.string().regex(/^(image\/(jpeg|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime|x-ms-wmv|x-msvideo|avi))$/),
  fileName: z.string().max(128),
  caption: z.string().max(255).optional(),
});

// ─── Helper: get or create override row ──────────────────────────────────────

async function getOrCreateOverride(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  module: string,
  viewId: string,
  userId: number
): Promise<number> {
  const existing = await db
    .select({ id: scanCoachOverrides.id })
    .from(scanCoachOverrides)
    .where(and(eq(scanCoachOverrides.module, module), eq(scanCoachOverrides.viewId, viewId)))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [result] = await db.insert(scanCoachOverrides).values({
    module,
    viewId,
    updatedByUserId: userId,
  });
  return (result as any).insertId as number;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const scanCoachAdminRouter = router({
  /**
   * List all overrides, optionally filtered by module.
   * Returns an array of ScanCoachOverride rows.
   */
  listOverrides: publicProcedure
    .input(z.object({ module: z.enum(MODULE_VALUES).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db.select().from(scanCoachOverrides);
      if (input?.module) {
        return rows.filter((r: typeof rows[0]) => r.module === input.module);
      }
      return rows;
    }),

  /**
   * Create or update a text/image override for a specific view.
   * Uses module + viewId as the natural key (upsert via delete + insert).
   */
  upsertOverride: protectedProcedure
    .input(upsertSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Check if a row already exists for this module + viewId
      const existing = await db
        .select({ id: scanCoachOverrides.id })
        .from(scanCoachOverrides)
        .where(
          and(
            eq(scanCoachOverrides.module, input.module),
            eq(scanCoachOverrides.viewId, input.viewId)
          )
        )
        .limit(1);

      const payload = {
        module: input.module,
        viewId: input.viewId,
        viewName: input.viewName ?? null,
        echoImageUrl: input.echoImageUrl ?? null,
        anatomyImageUrl: input.anatomyImageUrl ?? null,
        transducerImageUrl: input.transducerImageUrl ?? null,
        description: input.description ?? null,
        probe: input.probe ?? null,
        anatomy: input.anatomy ?? null,
        howToGet: input.howToGet ?? null,
        tips: input.tips ?? null,
        pitfalls: input.pitfalls ?? null,
        structures: input.structures ?? null,
        measurements: input.measurements ?? null,
        criticalFindings: input.criticalFindings ?? null,
        updatedByUserId: ctx.user.id,
      };

      if (existing.length > 0) {
        await db
          .update(scanCoachOverrides)
          .set(payload)
          .where(eq(scanCoachOverrides.id, existing[0].id));
        return { id: existing[0].id, created: false };
      } else {
        const [result] = await db.insert(scanCoachOverrides).values(payload);
        return { id: (result as any).insertId as number, created: true };
      }
    }),

  /**
   * Upload an image to S3 and return the CDN URL.
   * The caller should then call upsertOverride with the returned URL.
   */
  uploadImage: protectedProcedure
    .input(imageUploadSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Decode base64 → Buffer
      const buffer = Buffer.from(input.base64Data, "base64");

      // Build a non-enumerable S3 key with a random suffix
      const mimeToExt: Record<string, string> = {
        "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
        "image/webp": "webp", "image/svg+xml": "svg",
        "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogv", "video/quicktime": "mov",
        "video/x-ms-wmv": "wmv", "video/x-msvideo": "avi", "video/avi": "avi",
      };
      const ext = mimeToExt[input.mimeType] ?? input.mimeType.split("/")[1];
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `scancoach/${input.module}/${input.viewId}/${input.slot}-${safeFileName}-${randomSuffix}.${ext}`;

      const { url } = await storagePut(key, buffer, input.mimeType);

      // Auto-upsert the image URL into the override row
      const slotField = {
        echo: "echoImageUrl",
        anatomy: "anatomyImageUrl",
        transducer: "transducerImageUrl",
      }[input.slot] as "echoImageUrl" | "anatomyImageUrl" | "transducerImageUrl";

      const existing = await db
        .select({ id: scanCoachOverrides.id })
        .from(scanCoachOverrides)
        .where(
          and(
            eq(scanCoachOverrides.module, input.module),
            eq(scanCoachOverrides.viewId, input.viewId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(scanCoachOverrides)
          .set({ [slotField]: url, updatedByUserId: ctx.user.id })
          .where(eq(scanCoachOverrides.id, existing[0].id));
      } else {
        const [insertResult] = await db.insert(scanCoachOverrides).values({
          module: input.module,
          viewId: input.viewId,
          [slotField]: url,
          updatedByUserId: ctx.user.id,
        });
        void insertResult; // result used only for side effect
      }

      return { url, key };
    }),

  /**
   * Upload an additional educational image/video for a section.
   * Appends to the additionalMedia JSON array on the override row.
   */
  uploadAdditionalMedia: protectedProcedure
    .input(additionalMediaUploadSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const buffer = Buffer.from(input.base64Data, "base64");
      const mimeToExt: Record<string, string> = {
        "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
        "image/webp": "webp", "image/svg+xml": "svg",
        "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogv", "video/quicktime": "mov",
        "video/x-ms-wmv": "wmv", "video/x-msvideo": "avi", "video/avi": "avi",
      };
      const ext = mimeToExt[input.mimeType] ?? input.mimeType.split("/")[1];
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `scancoach/${input.module}/${input.viewId}/extra-${safeFileName}-${randomSuffix}.${ext}`;

      const { url } = await storagePut(key, buffer, input.mimeType);

      // Get or create the override row
      const rowId = await getOrCreateOverride(db, input.module, input.viewId, ctx.user.id);

      // Fetch current additionalMedia JSON
      const [row] = await db
        .select({ additionalMedia: scanCoachOverrides.additionalMedia })
        .from(scanCoachOverrides)
        .where(eq(scanCoachOverrides.id, rowId))
        .limit(1);

      const existing: Array<{ key: string; url: string; caption: string | null; section: string; mediaType: string }> =
        row?.additionalMedia ? JSON.parse(row.additionalMedia as string) : [];

      const mediaType = input.mimeType.startsWith("video/") ? "video" : "image";
      const newItem = {
        key,
        url,
        caption: input.caption ?? null,
        section: input.section,
        mediaType,
      };

      const updated = [...existing, newItem];

      await db
        .update(scanCoachOverrides)
        .set({ additionalMedia: JSON.stringify(updated), updatedByUserId: ctx.user.id })
        .where(eq(scanCoachOverrides.id, rowId));

      return { url, key, mediaType };
    }),

  /**
   * Remove a specific item from the additionalMedia JSON array by its S3 key.
   */
  deleteAdditionalMedia: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      mediaKey: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [row] = await db
        .select({ additionalMedia: scanCoachOverrides.additionalMedia })
        .from(scanCoachOverrides)
        .where(eq(scanCoachOverrides.id, input.id))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Override row not found" });

      const existing: Array<{ key: string }> = row.additionalMedia
        ? JSON.parse(row.additionalMedia as string)
        : [];

      const updated = existing.filter((item) => item.key !== input.mediaKey);

      await db
        .update(scanCoachOverrides)
        .set({ additionalMedia: JSON.stringify(updated), updatedByUserId: ctx.user.id })
        .where(eq(scanCoachOverrides.id, input.id));

      return { deleted: true };
    }),

  /**
   * Add a custom (admin-defined) view not in the static registry.
   * Sets isCustomView = 1 on the override row.
   */
  addCustomView: protectedProcedure
    .input(z.object({
      module: z.enum(MODULE_VALUES),
      viewId: z.string().min(1).max(64),
      viewName: z.string().min(1).max(128),
      sortOrder: z.number().int().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Check for duplicate
      const existing = await db
        .select({ id: scanCoachOverrides.id })
        .from(scanCoachOverrides)
        .where(and(eq(scanCoachOverrides.module, input.module), eq(scanCoachOverrides.viewId, input.viewId)))
        .limit(1);

      if (existing.length > 0) {
        // Update to mark as custom view
        await db
          .update(scanCoachOverrides)
          .set({ viewName: input.viewName, isCustomView: true, sortOrder: input.sortOrder, updatedByUserId: ctx.user.id })
          .where(eq(scanCoachOverrides.id, existing[0].id));
        return { id: existing[0].id, created: false };
      }

      const [result] = await db.insert(scanCoachOverrides).values({
        module: input.module,
        viewId: input.viewId,
        viewName: input.viewName,
        isCustomView: true,
        sortOrder: input.sortOrder,
        updatedByUserId: ctx.user.id,
      });
      return { id: (result as any).insertId as number, created: true };
    }),

  /**
   * Delete a custom view override row (admin-defined views only).
   */
  deleteCustomView: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(scanCoachOverrides).where(
        and(eq(scanCoachOverrides.id, input.id), eq(scanCoachOverrides.isCustomView, true))
      );
      return { deleted: true };
    }),

  /**
   * List all custom views, optionally filtered by module.
   */
  listCustomViews: publicProcedure
    .input(z.object({ module: z.enum(MODULE_VALUES).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db
        .select()
        .from(scanCoachOverrides)
        .where(eq(scanCoachOverrides.isCustomView, true));
      if (input?.module) {
        return rows.filter((r: typeof rows[0]) => r.module === input.module);
      }
      return rows;
    }),

  /**
   * Delete an entire override row by ID.
   */
  deleteOverride: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(scanCoachOverrides).where(eq(scanCoachOverrides.id, input.id));
      return { deleted: true };
    }),

  /**
   * Clear a single image field on an existing override (set to null).
   */
  clearImageField: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        field: z.enum(["echoImageUrl", "anatomyImageUrl", "transducerImageUrl"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(scanCoachOverrides)
        .set({ [input.field]: null, updatedByUserId: ctx.user.id })
        .where(eq(scanCoachOverrides.id, input.id));
      return { cleared: true };
    }),

  // ─── TEE/ICE ScanCoach Media procedures ────────────────────────────────────

  /**
   * Get all media for a specific TEE/ICE view (public — users see filled slots only).
   */
  getMediaByView: publicProcedure
    .input(z.object({ viewId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      return getScanCoachMediaByView(input.viewId);
    }),

  /**
   * Bulk-fetch media for multiple views at once (used for preloading all views in a section).
   */
  getMediaByViews: publicProcedure
    .input(z.object({ viewIds: z.array(z.string().min(1).max(64)).max(50) }))
    .query(async ({ input }) => {
      return getScanCoachMediaByViews(input.viewIds);
    }),

  /**
   * Upload a reference image or video clip for a TEE/ICE view (admin only).
   * Accepts base64-encoded data, uploads to S3, and stores the record.
   */
  uploadViewMedia: protectedProcedure
    .input(
      z.object({
        viewId: z.string().min(1).max(64),
        mediaType: z.enum(["image", "clip"]),
        /** Base64-encoded file data (without data: prefix) */
        base64Data: z.string(),
        /** MIME type, e.g. image/jpeg or video/mp4 */
        mimeType: z.string().regex(/^(image\/(jpeg|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime|x-ms-wmv|x-msvideo|avi))$/),
        /** Original filename */
        fileName: z.string().max(128),
        caption: z.string().max(255).optional(),
        sortOrder: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);

      const buffer = Buffer.from(input.base64Data, "base64");
      const mimeToExt: Record<string, string> = {
        "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
        "image/webp": "webp", "image/svg+xml": "svg",
        "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogv", "video/quicktime": "mov",
        "video/x-ms-wmv": "wmv", "video/x-msvideo": "avi", "video/avi": "avi",
      };
      const ext = mimeToExt[input.mimeType] ?? input.mimeType.split("/")[1];
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `scancoach/tee-ice/${input.viewId}/${input.mediaType}-${safeFileName}-${randomSuffix}.${ext}`;

      const { url } = await storagePut(key, buffer, input.mimeType);

      const id = await insertScanCoachMedia({
        viewId: input.viewId,
        mediaType: input.mediaType,
        url,
        fileKey: key,
        caption: input.caption ?? null,
        sortOrder: input.sortOrder,
        uploadedBy: ctx.user.id,
      });

      return { id, url, key };
    }),

  /**
   * Delete a media record by ID (admin only). The S3 file is NOT deleted — only the DB record.
   */
  deleteViewMedia: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      await deleteScanCoachMedia(input.id);
      return { deleted: true };
    }),

  /**
   * Update editable section labels for a view.
   * echoLabel, probeLabel, anatomyLabel, transducerLabel — pass null to reset to default.
   */
  upsertSectionLabels: protectedProcedure
    .input(z.object({
      module: z.enum(MODULE_VALUES),
      viewId: z.string().min(1).max(64),
      echoLabel: z.string().max(128).nullable().optional(),
      probeLabel: z.string().max(128).nullable().optional(),
      anatomyLabel: z.string().max(128).nullable().optional(),
      transducerLabel: z.string().max(128).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rowId = await getOrCreateOverride(db, input.module, input.viewId, ctx.user.id);

      await db
        .update(scanCoachOverrides)
        .set({
          echoLabel: input.echoLabel ?? null,
          probeLabel: input.probeLabel ?? null,
          anatomyLabel: input.anatomyLabel ?? null,
          transducerLabel: input.transducerLabel ?? null,
          updatedByUserId: ctx.user.id,
        })
        .where(eq(scanCoachOverrides.id, rowId));

      return { id: rowId, updated: true };
    }),
});
