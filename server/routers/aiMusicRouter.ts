import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserRoles } from "../db";
import { extractAssistantText, invokeLLM } from "../_core/llm";

const MUSIC_MOODS = [
  "calm",
  "focused",
  "uplifting",
  "confident",
  "cinematic",
  "energetic",
] as const;

const MUSIC_TEXTURES = [
  "ambient",
  "lofi",
  "electronic",
  "minimal",
  "pulse",
  "rnb",
  "rap",
  "hiphop",
  "pop",
  "upbeat",
  "rock",
] as const;

export type AiLoopPlan = {
  title: string;
  bpm: number;
  keyRoot: number;
  scale: "major" | "minor" | "dorian";
  mood: (typeof MUSIC_MOODS)[number];
  texture: (typeof MUSIC_TEXTURES)[number];
  density: 1 | 2 | 3 | 4 | 5;
  swing: number;
  kickPattern: number[];
  snarePattern: number[];
  hatPattern: number[];
  bassPattern: number[];
  leadPattern: number[];
};

const platformAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role === "admin") return next();
  const roles = await getUserRoles(ctx.user.id);
  if (roles.includes("platform_admin") || roles.includes("platform_owner")) return next();
  throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
});

const loopInput = z.object({
  mood: z.enum(MUSIC_MOODS),
  texture: z.enum(MUSIC_TEXTURES),
  direction: z.string().trim().max(280).optional(),
  durationSeconds: z.literal(20).default(20),
});

const compositionSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    bpm: { type: "integer" },
    keyRoot: { type: "integer" },
    scale: { type: "string", enum: ["major", "minor", "dorian"] },
    density: { type: "integer" },
    swing: { type: "number" },
    kickPattern: { type: "array", items: { type: "integer" }, minItems: 16, maxItems: 16 },
    snarePattern: { type: "array", items: { type: "integer" }, minItems: 16, maxItems: 16 },
    hatPattern: { type: "array", items: { type: "integer" }, minItems: 16, maxItems: 16 },
    bassPattern: { type: "array", items: { type: "integer" }, minItems: 16, maxItems: 16 },
    leadPattern: { type: "array", items: { type: "integer" }, minItems: 16, maxItems: 16 },
  },
  required: ["title", "bpm", "keyRoot", "scale", "density", "swing", "kickPattern", "snarePattern", "hatPattern", "bassPattern", "leadPattern"],
  additionalProperties: false,
} as const;

const sanitizeBinaryPattern = (value: unknown, fallback: number[]) => Array.isArray(value) && value.length === 16
  ? value.map((step) => Number(step) > 0 ? 1 : 0)
  : fallback;

const sanitizePitchPattern = (value: unknown, fallback: number[]) => Array.isArray(value) && value.length === 16
  ? value.map((step) => Number.isFinite(Number(step)) && Number(step) >= -1 && Number(step) <= 24 ? Math.round(Number(step)) : -1)
  : fallback;

function defaultPlan(mood: AiLoopPlan["mood"], texture: AiLoopPlan["texture"]): AiLoopPlan {
  const energetic = mood === "energetic" || mood === "confident";
  const makePlan = (values: Omit<AiLoopPlan, "title" | "mood" | "texture">): AiLoopPlan => ({
    title: `${mood} ${texture} clinical loop`,
    mood,
    texture,
    ...values,
  });

  if (texture === "rnb") return makePlan({
    bpm: 88, keyRoot: 1, scale: "minor", density: 3, swing: 0.1,
    kickPattern: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
    snarePattern: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hatPattern: [1,0,1,0, 1,1,0,0, 1,0,1,0, 1,1,0,0],
    bassPattern: [0,-1,-1,0, -1,-1,7,-1, 5,-1,-1,5, 0,-1,7,-1],
    leadPattern: [-1,-1,7,-1, -1,10,-1,-1, 12,-1,10,-1, -1,7,-1,-1],
  });
  if (texture === "rap") return makePlan({
    bpm: 76, keyRoot: 0, scale: "minor", density: 3, swing: 0.02,
    kickPattern: [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,1,0,0],
    snarePattern: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    hatPattern: [1,0,1,1, 1,0,1,0, 1,1,1,0, 1,0,1,1],
    bassPattern: [0,-1,-1,-1, 0,-1,7,-1, 0,-1,-1,-1, 5,-1,0,-1],
    leadPattern: [-1,-1,-1,-1, 7,-1,-1,-1, -1,-1,10,-1, -1,-1,-1,-1],
  });
  if (texture === "hiphop") return makePlan({
    bpm: 92, keyRoot: 3, scale: "minor", density: 3, swing: 0.11,
    kickPattern: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
    snarePattern: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hatPattern: [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1],
    bassPattern: [0,-1,0,-1, 7,-1,-1,-1, 5,-1,0,-1, 7,-1,5,-1],
    leadPattern: [-1,7,-1,-1, -1,-1,10,-1, 12,-1,-1,10, -1,-1,7,-1],
  });
  if (texture === "pop") return makePlan({
    bpm: 112, keyRoot: 0, scale: "major", density: 4, swing: 0.02,
    kickPattern: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snarePattern: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hatPattern: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    bassPattern: [0,-1,0,-1, 5,-1,5,-1, 7,-1,7,-1, 5,-1,0,-1],
    leadPattern: [7,-1,9,-1, 12,-1,9,-1, 7,-1,9,-1, 14,-1,12,-1],
  });
  if (texture === "upbeat") return makePlan({
    bpm: 124, keyRoot: 0, scale: "major", density: 4, swing: 0.01,
    kickPattern: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snarePattern: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hatPattern: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    bassPattern: [0,-1,0,-1, 5,-1,5,-1, 7,-1,7,-1, 5,-1,0,-1],
    leadPattern: [7,-1,9,-1, 12,-1,9,-1, 7,-1,9,-1, 14,-1,12,-1],
  });
  if (texture === "rock") return makePlan({
    bpm: 108, keyRoot: 2, scale: "major", density: 4, swing: 0.015,
    kickPattern: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
    snarePattern: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hatPattern: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    bassPattern: [0,-1,0,-1, 5,-1,5,-1, 7,-1,7,-1, 5,-1,0,-1],
    leadPattern: [7,-1,7,-1, 12,-1,9,-1, 7,-1,9,-1, 14,-1,12,-1],
  });

  return {
    title: `${mood} ${texture} clinical loop`,
    bpm: energetic ? 116 : mood === "calm" ? 82 : 98,
    keyRoot: mood === "cinematic" ? 2 : 0,
    scale: mood === "uplifting" ? "major" : mood === "focused" ? "dorian" : "minor",
    mood,
    texture,
    density: energetic ? 4 : 3,
    swing: texture === "lofi" ? 0.12 : 0.03,
    kickPattern: energetic ? [1,0,0,0, 1,0,0,0, 1,0,1,0, 0,0,1,0] : [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snarePattern: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hatPattern: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    bassPattern: [0,-1,0,-1, 7,-1,0,-1, 5,-1,7,-1, 0,-1,5,-1],
    leadPattern: [-1,-1,7,-1, -1,10,-1,-1, 12,-1,10,-1, -1,7,-1,-1],
  };
}

function normalizePlan(value: unknown, mood: AiLoopPlan["mood"], texture: AiLoopPlan["texture"]): AiLoopPlan {
  const fallback = defaultPlan(mood, texture);
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const scale = raw.scale === "major" || raw.scale === "minor" || raw.scale === "dorian" ? raw.scale : fallback.scale;
  const title = typeof raw.title === "string" && raw.title.trim()
    ? raw.title.trim().replace(/[^a-z0-9 _-]/gi, "").slice(0, 72)
    : fallback.title;
  return {
    title,
    bpm: Math.max(64, Math.min(150, Math.round(Number(raw.bpm) || fallback.bpm))),
    keyRoot: Math.max(0, Math.min(11, Math.round(Number(raw.keyRoot) || fallback.keyRoot))),
    scale,
    mood,
    texture,
    density: Math.max(1, Math.min(5, Math.round(Number(raw.density) || fallback.density))) as AiLoopPlan["density"],
    swing: Math.max(0, Math.min(0.22, Number(raw.swing) || fallback.swing)),
    kickPattern: sanitizeBinaryPattern(raw.kickPattern, fallback.kickPattern),
    snarePattern: sanitizeBinaryPattern(raw.snarePattern, fallback.snarePattern),
    hatPattern: sanitizeBinaryPattern(raw.hatPattern, fallback.hatPattern),
    bassPattern: sanitizePitchPattern(raw.bassPattern, fallback.bassPattern),
    leadPattern: sanitizePitchPattern(raw.leadPattern, fallback.leadPattern),
  };
}

function parseComposition(value: string): unknown {
  const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  return JSON.parse(trimmed);
}

function textureDirection(texture: AiLoopPlan["texture"]) {
  switch (texture) {
    case "rnb": return "smooth contemporary R&B rhythm: round sub-bass, syncopated kick and clap, crisp closed/open hats, warm minor seventh-feeling chord movement, and a relaxed late-night groove";
    case "rap": return "clean current rap instrumental beat: tight low-end kick, deep 808-style sub-bass, sparse snare/clap accents, detailed hi-hat syncopation, and lots of space for on-screen text; no rapping or vocal samples";
    case "hiphop": return "modern hip-hop instrumental rhythm: head-nod drums, swung hi-hats, deep melodic sub-bass, warm chord pad, and a compact loopable groove; no rapping or vocal samples";
    case "pop": return "polished modern pop rhythm: a tight four-beat kick, bright snare backbeat, crisp hats, supportive major-key chord pad, and a memorable restrained synth hook";
    case "upbeat": return "energetic modern dance-pop instrumental: driving pulse, bright percussion, clean sub-bass, positive major-key chord movement, and high but controlled energy";
    case "rock": return "modern instrumental rock-inspired rhythm: punchy live-band style kick and snare, warm driven bass, rhythmic guitar-like synth voicing, and confident forward movement; no vocals";
    case "electronic": return "modern electronic instrumental: punchy sidechain-feeling kick and sub-bass, bright sequenced hats, a clean synth chord bed, and a compact melodic hook";
    case "pulse": return "modern pulse-driven instrumental: clean kick and bass lock, precise hats, dark-to-bright synthesizer movement, and a focused clinical-tech energy";
    case "lofi": return "modern lo-fi instrumental: dusty but clean hip-hop drum pocket, warm bass, lightly swung hats, soft chord pad, and a compact relaxed hook";
    case "ambient": return "modern ambient instrumental: wide warm pads, subtle low pulse, soft filtered texture, spacious chord movement, and minimal non-distracting percussion";
    case "minimal": return "modern minimal instrumental: clean tight kick, concise bass motif, sparse hats, restrained warm chord texture, and generous breathing room";
  }
}

/**
 * The language model creates a constrained original composition blueprint. The
 * browser synthesizes this plan locally into a short instrumental WAV loop and
 * then saves it through the brand-scoped Media Repository workflow. No third-
 * party track is copied or claimed as licensed catalogue music.
 */
export const aiMusicRouter = router({
  composeLoop: platformAdminProcedure
    .input(loopInput)
    .mutation(async ({ input }) => {
      const userDirection = input.direction ? ` Creator direction: ${input.direction}` : "";
      const response = await invokeLLM({
        transport: "auto",
        maxTokens: 650,
        outputSchema: { name: "instrumental_loop", schema: compositionSchema, strict: true },
        messages: [
          {
            role: "system",
            content: "You compose concise, original instrumental loop blueprints for a clinical education social-video export. Instrumental only: no vocals, rapping, spoken words, samples, artist references, existing songs, copyrighted material, lyrics, or medical claims. Produce a contemporary 16-step arrangement with a purposeful drum pocket, sub-bass, harmonic depth, and a restrained lead contour. It must loop cleanly, remain supportive beneath on-screen educational text, have no sudden drops, and never be distracting.",
          },
          {
            role: "user",
            content: `Instrumental only, no vocals or spoken/rapped content. Create one original 20-second ${input.mood} loop with this style: ${textureDirection(input.texture)}. Aim for a clean contemporary studio mix: layered kick/snare or clap/hat rhythm, controlled sub-bass, a harmonic chord contour, and a concise lead motif. Use practical tempo and small, balanced patterns. Density is 1 (very sparse) through 5 (busy); use 2–4 for readable card-video backing. keyRoot is chromatic 0–11. Pattern values: drum steps are 0/1; bass and lead steps are -1 for rest or semitone offsets 0–24. ${userDirection}`,
          },
        ],
      });

      let plan: AiLoopPlan;
      try {
        plan = normalizePlan(parseComposition(extractAssistantText(response)), input.mood, input.texture);
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "AI music composition did not return a usable loop. Please try again." });
      }

      return {
        provider: "AI composition plan",
        durationSeconds: input.durationSeconds,
        plan,
        notice: "This is an original instrumental loop generated from an AI composition plan and synthesized in the browser. Review it before publishing.",
      };
    }),
});

export { defaultPlan, normalizePlan, MUSIC_MOODS, MUSIC_TEXTURES, textureDirection };
