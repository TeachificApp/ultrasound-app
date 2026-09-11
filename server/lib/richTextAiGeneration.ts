import { TRPCError } from "@trpc/server";
import { hasAiContentGenerationSources, type AiContentGenerationSources } from "../../shared/aiContentSources";
import { invokeLLM } from "../_core/llm";
import { buildRichTextAiUserContent, targetWordCountPromptLine } from "./aiContentSources";
import {
  countRenderedWords,
  enforceTargetWordCount,
  MIN_FULL_LESSON_WORDS,
  TARGET_FULL_LESSON_WORDS,
  trimHtmlToWordCount,
  wordsRemainingToTarget,
} from "./lessonContentGeneration";

export type RichTextAiFormat = "full_lesson" | "text" | "outline" | "summary" | "quiz_questions";

const FORMAT_INSTRUCTIONS: Record<RichTextAiFormat, string> = {
  full_lesson: `Write a complete, publication-ready lesson. Use a meaningful clinical introduction; clearly labeled sections for anatomy or physiology where relevant, scanning technique, interpretation, common pitfalls, and clinical pearls; and a concise conclusion. Use <h2>, <h3>, <p>, and <ul>/<li> tags. Do not include <html>, <head>, or <body> tags.`,
  text: "Write comprehensive, well-structured content in HTML format. Use <h2>, <h3>, <p>, and <ul>/<li> tags where appropriate. Do not include <html>, <head>, or <body> tags.",
  outline: "Create a detailed outline in HTML format with main sections as <h2> headings, sub-points as <h3> headings, and key learning objectives as a <ul> list at the top.",
  summary: "Write a concise summary of the key concepts in HTML format. Use <p> for intro and <ul><li> bullet points for the main takeaways.",
  quiz_questions: "Generate 5 quiz questions with answers in HTML format. Format as <ol> with each <li> containing the question in <strong> and the answer in a <p> below it.",
};

function cleanLlmHtml(content: string): string {
  return content.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
}

function resolveFullLessonWordTargets(targetWordCount: number | undefined): { minWords: number; targetWords: number } {
  if (targetWordCount) {
    return {
      minWords: Math.floor(targetWordCount * 0.9),
      targetWords: targetWordCount,
    };
  }
  return { minWords: MIN_FULL_LESSON_WORDS, targetWords: TARGET_FULL_LESSON_WORDS };
}

export async function generateRichTextHtmlContent(input: {
  lessonTitle: string;
  courseTitle?: string;
  format: RichTextAiFormat;
  sources?: Pick<AiContentGenerationSources, "sourceText" | "sourceUrls" | "sourceFiles">;
  targetWordCount?: number;
  extraSystemInstruction?: string;
  userContextSuffix?: string;
}): Promise<{ content: string; wordCount: number }> {
  if (!input.lessonTitle.trim() && !hasAiContentGenerationSources(input.sources ?? {})) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a prompt or provide source material (text, URL, or files)." });
  }

  const { minWords, targetWords } = input.format === "full_lesson"
    ? resolveFullLessonWordTargets(input.targetWordCount)
    : { minWords: input.targetWordCount ? Math.floor(input.targetWordCount * 0.9) : 0, targetWords: input.targetWordCount ?? 0 };

  const lengthInstruction = input.format === "full_lesson"
    ? ` The lesson must contain at least ${minWords.toLocaleString("en-US")} readable words, excluding HTML markup. Target approximately ${targetWords.toLocaleString("en-US")} readable words.`
    : targetWordCountPromptLine(input.targetWordCount ?? undefined);

  const instruction = `${FORMAT_INSTRUCTIONS[input.format]}${lengthInstruction}`;
  const userInstruction = `Generate content for: "${input.lessonTitle || "the supplied source material"}"${input.courseTitle ? ` (part of the course "${input.courseTitle}")` : ""}.${input.userContextSuffix ?? ""}`;
  const userContent = await buildRichTextAiUserContent(userInstruction, input.sources ?? {});

  const generate = async (revisionInstruction?: string) => {
    const response = await invokeLLM({
      transport: "auto",
      maxTokens: input.format === "full_lesson" ? 6000 : 4000,
      messages: [
        {
          role: "system",
          content: `You are an expert medical ultrasound educator creating content for All About Ultrasound™ and iHeartEcho™ online learning platforms. Generate high-quality, clinically accurate content for ultrasound and echocardiography education. ${instruction}${input.extraSystemInstruction ? ` ${input.extraSystemInstruction}` : ""} Return only the HTML fragment — no markdown code fences, no surrounding tags.`,
        },
        {
          role: "user",
          content: revisionInstruction
            ? (typeof userContent === "string" ? `${userContent}\n\n${revisionInstruction}` : [{ type: "text", text: `${(userContent as any[])[0]?.text ?? userInstruction}\n\n${revisionInstruction}` }, ...(userContent as any[]).slice(1)])
            : userContent as any,
        },
      ],
    });
    return cleanLlmHtml((response.choices?.[0]?.message?.content ?? "") as string);
  };

  let cleaned = await generate();

  if (input.format === "full_lesson") {
    cleaned = await enforceTargetWordCount(
      cleaned,
      targetWords,
      async (draft, wordsNeeded) =>
        generate(`The draft below is only ${countRenderedWords(draft).toLocaleString("en-US")} readable words and needs ${Math.max(wordsNeeded, wordsRemainingToTarget(draft, targetWords)).toLocaleString("en-US")} additional words to reach the target. Write ONLY new, non-duplicative HTML sections that continue this exact lesson. Do not restart, summarize, mention the prior draft, or include markdown fences. Preserve the lesson topic and add clinically useful depth.\n\nCURRENT DRAFT:\n${draft}`),
    );
    if (countRenderedWords(cleaned) < minWords) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `AI returned an incomplete full lesson. Full lessons require at least ${minWords.toLocaleString("en-US")} words; please generate again.`,
      });
    }
  } else if (input.targetWordCount) {
    cleaned = await enforceTargetWordCount(
      cleaned,
      input.targetWordCount,
      async (draft, wordsNeeded) =>
        generate(`The draft below is only ${countRenderedWords(draft).toLocaleString("en-US")} readable words and needs about ${wordsNeeded.toLocaleString("en-US")} more words. Write ONLY new, non-duplicative HTML that continues this content. Do not restart or include markdown fences.\n\nCURRENT DRAFT:\n${draft}`),
    );
  }

  if (input.targetWordCount && countRenderedWords(cleaned) > Math.ceil(input.targetWordCount * 1.1)) {
    cleaned = trimHtmlToWordCount(cleaned, Math.ceil(input.targetWordCount * 1.1));
  }

  return { content: cleaned, wordCount: countRenderedWords(cleaned) };
}

/** Trims combined email body blocks to approximate target word count. */
export function enforceTargetWordCountOnEmailBlocks(
  blocks: Array<{ type: string; data?: Record<string, unknown> }>,
  targetWordCount: number,
): typeof blocks {
  const textTypes = new Set(["text", "heading", "quote", "ai_content"]);
  const countAll = () => blocks.reduce((sum, block) => {
    if (!textTypes.has(block.type)) return sum;
    const html = String(block.data?.html ?? block.data?.text ?? "");
    return sum + countRenderedWords(html);
  }, 0);

  const maxWords = Math.ceil(targetWordCount * 1.1);
  if (countAll() <= maxWords) return blocks;

  const next = blocks.map(block => ({ ...block, data: { ...(block.data ?? {}) } }));
  for (let i = next.length - 1; i >= 0 && countAll() > maxWords; i -= 1) {
    const block = next[i];
    if (!textTypes.has(block.type)) continue;
    const field = block.type === "button" ? "text" : "html";
    const current = String(block.data?.[field] ?? "");
    if (!current) continue;
    const blockWords = countRenderedWords(current);
    const excess = countAll() - maxWords;
    if (blockWords <= excess) {
      block.data![field] = "";
      continue;
    }
    block.data![field] = trimHtmlToWordCount(current, Math.max(1, blockWords - excess));
  }
  return next;
}
