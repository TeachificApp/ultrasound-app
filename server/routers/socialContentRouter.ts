/**
 * socialContentRouter.ts
 *
 * Admin-only tRPC procedures for generating ultrasound/echocardiography
 * social media content (memes, educational posts, clinical pearls, etc.)
 * using the Forge LLM API, with optional abstract AI background generation.
 *
 * Image approach:
 * - "abstract" = AI-generated abstract/decorative backgrounds (no anatomy)
 * - "upload"   = admin uploads their own clinical image via /api/upload-social-image
 * - "none"     = text-only card (no image)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { generateImage } from "../_core/imageGeneration";
import { getDb, getUserRoles } from "../db";
import { mediaAssets, socialPostLibrary } from "../../drizzle/schema";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const isOwner = ctx.user.role === "admin";
  if (isOwner) return next();
  return getUserRoles(ctx.user.id).then((roles) => {
    if (roles.includes("platform_admin") || roles.includes("platform_owner")) return next();
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  });
});

const CONTENT_TYPES = [
  "meme",
  "clinical_pearl",
  "did_you_know",
  "motivational",
  "myth_vs_fact",
  "tip_of_the_day",
  "anatomy_spotlight",
  "case_teaser",
] as const;

const AAUS_CATEGORIES = [
  "Abdominal",
  "Small Parts",
  "Pelvic/Gyn",
  "OB 1st Trimester",
  "OB 2nd/3rd Trimester",
  "Fetal Echo",
  "Breast",
  "Vascular",
  "MSK",
  "POCUS",
  "Physics",
  "General Ultrasound",
] as const;

const IHE_CATEGORIES = [
  "Transthoracic Echo",
  "Transesophageal Echo",
  "Intracardiac Echo",
  "Pediatric/Congenital Echo",
  "Fetal Echo",
] as const;

const CATEGORIES = [...AAUS_CATEGORIES, ...IHE_CATEGORIES] as const;

type ContentType = (typeof CONTENT_TYPES)[number];

function getSystemPrompt(contentType: ContentType, brand: "aaus" | "iheartecho"): string {
  const brandContext = brand === "iheartecho"
    ? "iHeartEcho™, a professional echocardiography education platform for sonographers, physicians, and echo learners"
    : "All About Ultrasound™, a professional ultrasound education platform for sonographers, physicians, and ultrasound learners";
  const base = `You are a creative social media content specialist for ${brandContext}. Generate engaging, accurate, and shareable content that fits this selected brand.`;

  const typePrompts: Record<ContentType, string> = {
    meme: `${base}
Generate a funny, relatable meme for ultrasound/echocardiography professionals. The humor should be insider-level (things only sonographers/cardiologists would understand) but still lighthearted and professional. Think of common frustrations, amusing patient interactions (anonymized), equipment quirks, or exam-day humor.
Format: A short top-line setup and a punchline/bottom-line. Keep it concise for a graphic card.`,

    clinical_pearl: `${base}
Generate a concise, high-value clinical pearl that sonographers and physicians would find immediately useful in practice. Focus on scanning technique, measurement tips, diagnostic criteria, or protocol shortcuts.`,

    did_you_know: `${base}
Generate an interesting, lesser-known fact about ultrasound, sonography, or echocardiography. It should be surprising or educational — something even experienced professionals might not know. Include the source guideline or historical context if relevant.`,

    motivational: `${base}
Generate an inspirational/motivational message for ultrasound professionals. Acknowledge the challenges of the profession (long hours, difficult patients, complex pathology) while celebrating the impact and skill of sonographers. Keep it authentic, not generic.`,

    myth_vs_fact: `${base}
Generate a common misconception or myth in ultrasound/echocardiography practice, paired with the correct fact. This should be educational and help dispel outdated or incorrect beliefs. Cite relevant guidelines when possible.`,

    tip_of_the_day: `${base}
Generate a practical, actionable scanning tip that improves image quality, patient comfort, or workflow efficiency. Be specific — include transducer type, patient positioning, or machine settings when relevant.`,

    anatomy_spotlight: `${base}
Generate an interesting anatomical fact or scanning consideration for a specific structure visualized on ultrasound. Include normal measurements, common variants, or pathological findings to watch for.`,

    case_teaser: `${base}
Generate a brief clinical scenario that presents an interesting ultrasound finding. Describe what was seen (without revealing the diagnosis immediately) to create engagement. The teaser should make professionals want to comment their diagnosis.`,
  };

  return typePrompts[contentType];
}

function buildUserPrompt(contentType: ContentType, category: string, customTopic: string | undefined, brand: "aaus" | "iheartecho"): string {
  const topicContext = customTopic
    ? `Topic focus: ${customTopic}`
    : `Category: ${category}`;
  const audience = brand === "iheartecho"
    ? "Echocardiographers, cardiac sonographers, cardiologists, echo fellows, and echo students"
    : "Sonographers, ultrasound technologists, physicians, radiology residents, and ultrasound students";

  return `Generate social media content for the following:
- Content type: ${contentType.replace(/_/g, " ")}
- ${topicContext}
- Target audience: ${audience}

Return your response as a JSON object with exactly these fields:
{
  "headline": "Short, punchy headline for the graphic card (max 10 words)",
  "body": "The main content text for the graphic card (max 80 words for memes, max 120 words for educational content)",
  "subtext": "Optional supporting text or source/guideline reference (max 30 words, or empty string)",
  "socialCaption": "Ready-to-post social media caption with an optional restrained professional emoji and call-to-action (max 200 words, do NOT include hashtags)",
  "category": "${category}"
}

IMPORTANT: Use no more than two professional, relevant emojis in socialCaption. Never place emojis in clinical facts, question wording, options, answers, or explanations. Return ONLY the JSON object, no markdown formatting or code blocks.`;
}

function getBrandCategories(brand: "aaus" | "iheartecho") {
  return brand === "iheartecho" ? IHE_CATEGORIES : AAUS_CATEGORIES;
}

function resolveRequestedBrand(inputBrand: "aaus" | "iheartecho" | undefined, contextBrand: "aaus" | "iheartecho") {
  return inputBrand ?? contextBrand;
}

/**
 * Build an ABSTRACT background prompt — no anatomical imagery.
 * Generates decorative, professional backgrounds with medical-themed
 * abstract elements (waveforms, gradients, geometric patterns).
 */
function buildAbstractImagePrompt(
  item: { headline: string; category: string; contentType: string },
  userStyleHint?: string
): string {
  if (userStyleHint && userStyleHint.trim()) {
    return `Abstract decorative background for a medical education social media card. Style: ${userStyleHint.trim()}. Use teal (#189aa1) and aqua (#4ad9e0) color accents on a dark background. NO anatomical imagery, NO ultrasound images, NO organs, NO medical equipment. Only abstract shapes, gradients, waveforms, geometric patterns, or bokeh effects. Clean, modern, professional. No text.`;
  }

  // Category-themed abstract styles (no anatomy)
  const categoryStyles: Record<string, string> = {
    "Abdominal": "flowing wave patterns with warm teal gradients, subtle circular bokeh",
    "Small Parts": "delicate geometric mesh with fine teal lines on dark background",
    "Pelvic/Gyn": "soft gradient curves with layered teal and aqua tones",
    "OB 1st Trimester": "gentle flowing curves with soft aqua light effects",
    "OB 2nd/3rd Trimester": "smooth organic curves with warm teal gradient layers",
    "Fetal Echo": "rhythmic wave patterns suggesting heartbeat, teal pulse lines on dark",
    "Breast": "clean radial gradient with subtle teal concentric rings",
    "Vascular": "flowing stream-like abstract lines in teal and aqua on dark background",
    "MSK": "angular geometric patterns with strong teal accent lines",
    "POCUS": "dynamic abstract waveform burst with teal energy ripples",
    "Physics": "sound wave visualization pattern, abstract frequency lines in teal/aqua",
    "Transthoracic Echo": "rhythmic pulse wave pattern with teal and aqua gradient, abstract heartbeat lines",
    "Transesophageal Echo": "precise layered waveform lines with deep teal and aqua highlights",
    "Intracardiac Echo": "dynamic circular pulse field with crisp aqua pathways on deep teal",
    "Pediatric/Congenital Echo": "gentle heart-rhythm curves and bright aqua motion accents",
    "General Ultrasound": "abstract sound wave ripples with teal gradient on dark background",
  };

  const style = categoryStyles[item.category] || "abstract teal gradient with geometric patterns on dark background";

  return `Abstract decorative background for a medical education social media card about "${item.headline}". Style: ${style}. Use teal (#189aa1) and aqua (#4ad9e0) color accents. NO anatomical imagery, NO ultrasound images, NO organs, NO medical devices, NO people. Only abstract shapes, gradients, waveforms, geometric patterns, or light effects. Clean, modern, professional. No text, no watermarks.`;
}

export const socialContentRouter = router({
  generateContent: adminProcedure
    .input(
      z.object({
        contentType: z.enum(CONTENT_TYPES),
        category: z.enum(CATEGORIES),
        brand: z.enum(["aaus", "iheartecho"]).optional(),
        customTopic: z.string().max(200).optional(),
        count: z.number().min(1).max(5).default(1),
        imageMode: z.enum(["none", "abstract", "upload"]).default("none"),
        imageStyleHint: z.string().max(500).optional(),
        layoutMode: z.enum(["card", "infographic"]).default("card"),
        cardTheme: z.enum(["dark", "light", "white", "teal", "aqua"]).default("light"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { contentType, category, customTopic, count, imageMode, imageStyleHint, layoutMode, cardTheme } = input;
      const brand = resolveRequestedBrand(input.brand, ctx.brand);
      if (!getBrandCategories(brand).includes(category as never)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a category available for the selected brand" });
      }

      const results: Array<{
        headline: string;
        body: string;
        subtext: string;
        socialCaption: string;
        category: string;
        contentType: string;
        imageUrl?: string;
        imageSource?: "ai" | "upload" | "media_repository";
      }> = [];

      for (let i = 0; i < count; i++) {
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: getSystemPrompt(contentType, brand) },
              { role: "user", content: buildUserPrompt(contentType, category, customTopic, brand) },
            ],
            maxTokens: 2000,
          });

          const raw = response.choices?.[0]?.message?.content;
          const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((p: any) => p.text || "").join("") : "";

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON object found in LLM response");
          }

          const parsed = JSON.parse(jsonMatch[0]);
          const item = {
            headline: parsed.headline || "Untitled",
            body: parsed.body || "",
            subtext: parsed.subtext || "",
            socialCaption: parsed.socialCaption || "",
            category,
            contentType,
            imageUrl: undefined as string | undefined,
            imageSource: undefined as "ai" | "upload" | "media_repository" | "google" | undefined,
          };

          // Generate abstract background if requested
          if (imageMode === "abstract") {
            try {
              const prompt = buildAbstractImagePrompt(item, imageStyleHint);
              console.log(`[SocialContent] Generating abstract background for item ${i + 1}`);
              const { url } = await generateImage({ prompt });
              item.imageUrl = url;
              item.imageSource = "ai";
              console.log(`[SocialContent] Abstract background generated: ${url}`);
            } catch (imgErr) {
              console.error(`[SocialContent] Abstract image generation failed for item ${i + 1}:`, imgErr);
            }
          }

          results.push(item);
        } catch (err) {
          console.error(`[SocialContent] Generation ${i + 1} failed:`, err);
          if (i === 0 && results.length === 0) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Content generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            });
          }
        }
      }

      return { items: results };
    }),

  /** Generate a standalone abstract background image */
  generateAbstractImage: adminProcedure
    .input(
      z.object({
        styleHint: z.string().max(500).optional(),
        headline: z.string(),
        category: z.string(),
        contentType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const prompt = buildAbstractImagePrompt(
        { headline: input.headline, category: input.category, contentType: input.contentType },
        input.styleHint
      );
      console.log(`[SocialContent] Generating standalone abstract image`);
      const { url } = await generateImage({ prompt });
      return { imageUrl: url };
    }),

  listSavedPosts: adminProcedure
    .input(z.object({
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      limit: z.number().int().min(1).max(100).default(40),
    }).default({ limit: 40 }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const brand = resolveRequestedBrand(input.brand, ctx.brand);
      return db
        .select()
        .from(socialPostLibrary)
        .where(and(eq(socialPostLibrary.brand, brand), isNull(socialPostLibrary.deletedAt)))
        .orderBy(desc(socialPostLibrary.updatedAt), desc(socialPostLibrary.id))
        .limit(input.limit);
    }),

  /** Saves a completed administrator-reviewed Social Post to the shared library. */
  savePostToLibrary: adminProcedure
    .input(z.object({
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      headline: z.string().trim().min(1).max(512),
      body: z.string().trim().min(1).max(20_000),
      subtext: z.string().trim().max(5_000).nullable().optional(),
      socialCaption: z.string().trim().min(1).max(20_000),
      category: z.enum(CATEGORIES),
      contentType: z.enum(CONTENT_TYPES),
      layoutMode: z.enum(["card", "infographic"]),
      cardTheme: z.enum(["dark", "light", "white", "teal", "aqua"]),
      imageUrl: z.string().url().nullable().optional(),
      imageSource: z.enum(["ai", "upload", "media_repository", "google"]).nullable().optional(),
      mediaAssetId: z.number().int().positive().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { brand: requestedBrand, ...post } = input;
      const brand = resolveRequestedBrand(requestedBrand, ctx.brand);
      if (!getBrandCategories(brand).includes(post.category as never)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a category available for the selected brand" });
      }
      if (post.mediaAssetId) {
        const [asset] = await db
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(and(
            eq(mediaAssets.id, post.mediaAssetId),
            eq(mediaAssets.brand, brand),
            isNull(mediaAssets.deletedAt),
          ))
          .limit(1);
        if (!asset) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Selected media asset is not available for this brand" });
        }
      }
      const created = await db.insert(socialPostLibrary).values({
        brand,
        headline: post.headline,
        body: post.body,
        subtext: post.subtext ?? null,
        socialCaption: post.socialCaption,
        category: post.category,
        contentType: post.contentType,
        layoutMode: post.layoutMode,
        cardTheme: post.cardTheme,
        imageUrl: post.imageUrl ?? null,
        imageSource: post.imageSource ?? null,
        mediaAssetId: post.mediaAssetId ?? null,
        createdByUserId: ctx.user.id,
      }).$returningId();
      const id = Number(created[0]?.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Post Library save did not return a record ID" });
      }
      return { id };
    }),

  updateSavedPost: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      headline: z.string().trim().min(1).max(512).optional(),
      body: z.string().trim().min(1).max(20_000).optional(),
      subtext: z.string().trim().max(5_000).nullable().optional(),
      socialCaption: z.string().trim().min(1).max(20_000).optional(),
      category: z.enum(CATEGORIES).optional(),
      contentType: z.enum(CONTENT_TYPES).optional(),
      layoutMode: z.enum(["card", "infographic"]).optional(),
      cardTheme: z.enum(["dark", "light", "white", "teal", "aqua"]).optional(),
      imageUrl: z.string().url().nullable().optional(),
      imageSource: z.enum(["ai", "upload", "media_repository", "google"]).nullable().optional(),
      mediaAssetId: z.number().int().positive().nullable().optional(),
      imageOriginalUrl: z.string().url().nullable().optional(),
      imageSourcePageUrl: z.string().url().nullable().optional(),
      imageAttribution: z.string().max(1000).nullable().optional(),
      imageLicense: z.string().max(255).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, brand: requestedBrand, ...changes } = input;
      const brand = resolveRequestedBrand(requestedBrand, ctx.brand);
      if (changes.category && !getBrandCategories(brand).includes(changes.category as never)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a category available for the selected brand" });
      }
      if (changes.mediaAssetId) {
        const [asset] = await db
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(and(
            eq(mediaAssets.id, changes.mediaAssetId),
            eq(mediaAssets.brand, brand),
            isNull(mediaAssets.deletedAt),
          ))
          .limit(1);
        if (!asset) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Selected media asset is not available for this brand" });
        }
      }
      const result = await db
        .update(socialPostLibrary)
        .set(changes)
        .where(and(eq(socialPostLibrary.id, id), eq(socialPostLibrary.brand, brand), isNull(socialPostLibrary.deletedAt)));
      if (Number((result as any).affectedRows ?? 0) === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved social post not found for this brand" });
      }
      return { success: true };
    }),

  markSavedPostPublished: adminProcedure
    .input(z.object({ id: z.number().int().positive(), brand: z.enum(["aaus", "iheartecho"]).optional(), published: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const brand = resolveRequestedBrand(input.brand, ctx.brand);
      const result = await db
        .update(socialPostLibrary)
        .set({
          status: input.published ? "published" : "draft",
          publishedAt: input.published ? new Date() : null,
          publishedByUserId: input.published ? ctx.user.id : null,
        })
        .where(and(eq(socialPostLibrary.id, input.id), eq(socialPostLibrary.brand, brand), isNull(socialPostLibrary.deletedAt)));
      if (Number((result as any).affectedRows ?? 0) === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved social post not found for this brand" });
      }
      return { success: true };
    }),

  flagSavedPost: adminProcedure
    .input(z.object({ id: z.number().int().positive(), brand: z.enum(["aaus", "iheartecho"]).optional(), comment: z.string().trim().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const brand = resolveRequestedBrand(input.brand, ctx.brand);
      const result = await db
        .update(socialPostLibrary)
        .set({ flaggedAt: new Date(), flaggedByUserId: ctx.user.id, flagComment: input.comment, flagResolvedAt: null })
        .where(and(eq(socialPostLibrary.id, input.id), eq(socialPostLibrary.brand, brand), isNull(socialPostLibrary.deletedAt)));
      if (Number((result as any).affectedRows ?? 0) === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved social post not found for this brand" });
      }
      return { success: true };
    }),

  deleteSavedPost: adminProcedure
    .input(z.object({ id: z.number().int().positive(), brand: z.enum(["aaus", "iheartecho"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const brand = resolveRequestedBrand(input.brand, ctx.brand);
      const result = await db
        .update(socialPostLibrary)
        .set({ status: "archived", deletedAt: new Date(), deletedByUserId: ctx.user.id })
        .where(and(eq(socialPostLibrary.id, input.id), eq(socialPostLibrary.brand, brand), isNull(socialPostLibrary.deletedAt)));
      if (Number((result as any).affectedRows ?? 0) === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved social post not found for this brand" });
      }
      return { success: true };
    }),

  getContentTypes: adminProcedure.query(() => {
    return CONTENT_TYPES.map((t) => ({
      value: t,
      label: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  }),

  getCategories: adminProcedure.query(() => {
    return CATEGORIES.map((c) => ({ value: c, label: c }));
  }),

  getBrandCategories: adminProcedure
    .input(z.object({ brand: z.enum(["aaus", "iheartecho"]).optional() }).optional())
    .query(({ ctx, input }) => {
      const brand = resolveRequestedBrand(input?.brand, ctx.brand);
      return getBrandCategories(brand).map((c) => ({ value: c, label: c }));
    }),
});
