import { z } from "zod";

/** Maximum PDF/image source files per AI generation request. */
export const AI_SOURCE_FILE_MAX_COUNT = 10;

/** Maximum public web-page URLs per AI generation request. */
export const AI_SOURCE_URL_MAX_COUNT = 5;

/** Maximum characters of optional pasted source text. */
export const AI_SOURCE_TEXT_MAX_CHARS = 20_000;

/** Minimum / maximum user-specified output word count. */
export const AI_TARGET_WORD_COUNT_MIN = 50;
export const AI_TARGET_WORD_COUNT_MAX = 10_000;

export const AiSourceFileInputSchema = z.object({
  url: z.string().url(),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  name: z.string().min(1).max(255),
});

export type AiSourceFileInput = z.infer<typeof AiSourceFileInputSchema>;

export const AiContentGenerationSourcesSchema = z.object({
  /** Optional pasted reference text (separate from the generation prompt). */
  sourceText: z.string().max(AI_SOURCE_TEXT_MAX_CHARS).optional(),
  /** Public web pages used as silent factual grounding. */
  sourceUrls: z.array(z.string().url().max(2048)).max(AI_SOURCE_URL_MAX_COUNT).optional(),
  /** Uploaded PDFs or images (reviewed before generation). */
  sourceFiles: z.array(AiSourceFileInputSchema).max(AI_SOURCE_FILE_MAX_COUNT).optional(),
  /** Desired readable word count for generated HTML output. */
  targetWordCount: z.number().int().min(AI_TARGET_WORD_COUNT_MIN).max(AI_TARGET_WORD_COUNT_MAX).optional(),
});

export type AiContentGenerationSources = z.infer<typeof AiContentGenerationSourcesSchema>;

export function hasAiContentGenerationSources(input: Partial<AiContentGenerationSources>): boolean {
  return Boolean(
    input.sourceText?.trim() ||
    (input.sourceUrls?.length ?? 0) > 0 ||
    (input.sourceFiles?.length ?? 0) > 0,
  );
}
