import { TRPCError } from "@trpc/server";
import type { AiContentGenerationSources } from "../../shared/aiContentSources";
import { AI_SOURCE_BLIND_WRITING_RULE, buildAiSourceMessage, type AiSourceFile } from "./aiSourceFile";
import { fetchAiGenerationSourceUrl } from "./aiWebSource";

export type ResolvedAiWebSource = { url: string; text: string };

export async function resolveAiWebSources(sourceUrls: string[] | undefined): Promise<ResolvedAiWebSource[]> {
  if (!sourceUrls?.length) return [];
  const resolved: ResolvedAiWebSource[] = [];
  for (const sourceUrl of sourceUrls) {
    try {
      resolved.push(await fetchAiGenerationSourceUrl(sourceUrl));
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "A web page could not be used as source material.",
      });
    }
  }
  return resolved;
}

export function buildAiWebSourcesContext(webSources: ResolvedAiWebSource[]): string {
  if (webSources.length === 0) return "";
  const sections = webSources.map(
    (source, index) =>
      `--- BEGIN SOURCE MATERIAL ${index + 1} ---\n${source.text}\n--- END SOURCE MATERIAL ${index + 1} ---`,
  );
  return `\n\nThe following public web-page text is for silent factual grounding. Do not reproduce URLs or identify these pages in learner-facing text.\n${sections.join("\n")}\n${AI_SOURCE_BLIND_WRITING_RULE}`;
}

export function buildAiPastedSourceContext(sourceText: string | undefined): string {
  const trimmed = sourceText?.trim();
  if (!trimmed) return "";
  return `\n\nThe following pasted reference text is for silent factual grounding. Do not mention that it was supplied.\n--- BEGIN REFERENCE TEXT ---\n${trimmed.slice(0, 20_000)}\n--- END REFERENCE TEXT ---\n${AI_SOURCE_BLIND_WRITING_RULE}`;
}

/** Builds multimodal or plain-text user content from instruction + optional sources. */
export async function buildRichTextAiUserContent(
  instruction: string,
  sources: Pick<AiContentGenerationSources, "sourceText" | "sourceUrls" | "sourceFiles">,
): Promise<string | ReturnType<typeof buildAiSourceMessage>> {
  const webSources = await resolveAiWebSources(sources.sourceUrls);
  const sourceFiles = (sources.sourceFiles ?? []) as AiSourceFile[];
  const contextSuffix = `${buildAiPastedSourceContext(sources.sourceText)}${buildAiWebSourcesContext(webSources)}`;
  const fullInstruction = `${instruction}${contextSuffix}`.trim();
  if (sourceFiles.length === 0) return fullInstruction;
  return buildAiSourceMessage(fullInstruction, sourceFiles);
}

export function targetWordCountPromptLine(targetWordCount: number | undefined): string {
  if (!targetWordCount) return "";
  const maxWords = Math.ceil(targetWordCount * 1.1);
  const minWords = Math.floor(targetWordCount * 0.9);
  return ` Output length: the readable word count (excluding HTML tags) must be approximately ${targetWordCount} words, staying between ${minWords} and ${maxWords} words. Do not significantly exceed ${maxWords} words.`;
}
