export const AI_SOURCE_FILE_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const AI_SOURCE_FILE_MAX_BYTES = 50 * 1024 * 1024;
export type AiSourceFileMimeType = typeof AI_SOURCE_FILE_MIME_TYPES[number];

export type AiSourceFile = {
  url: string;
  mimeType: AiSourceFileMimeType;
  name: string;
};

export const AI_SOURCE_BLIND_WRITING_RULE = "Treat supplied material as silent factual grounding only. Generated questions, answer choices, explanations, correct feedback, and incorrect feedback must stand alone and must never mention or cite the source, source page, URL, document, guide, PDF, file, transcript, passage, reading, supplied material, or named standard.";

const DIRECT_SOURCE_REFERENCE = /\b(?:the\s+(?:source|source\s+(?:page|document|material|file|pdf)|transcript|document|guide|pdf|file|passage|reading|materials?)|this\s+(?:document|guide|pdf|file|passage|reading|material)|(?:provided|uploaded|supplied)\s+(?:source|document|guide|pdf|file|passage|reading|material)|according\s+to\s+(?:the\s+)?(?:source|document|guide|pdf|file|passage|reading|material)|as\s+per\s+(?:the\s+)?(?:source|document|guide|pdf|file|passage|reading|material)|based\s+on\s+(?:the\s+)?(?:source|document|guide|pdf|file|passage|reading|material))\b/i;

export function hasDirectAiSourceReference(value: unknown): boolean {
  if (typeof value === "string") return DIRECT_SOURCE_REFERENCE.test(value);
  if (Array.isArray(value)) return value.some(hasDirectAiSourceReference);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasDirectAiSourceReference);
  return false;
}

export function isSupportedAiSourceMimeType(mimeType: string | undefined) {
  return Boolean(mimeType && (AI_SOURCE_FILE_MIME_TYPES as readonly string[]).includes(mimeType));
}

export function isWithinAiSourceFileSizeLimit(size: number) {
  return Number.isFinite(size) && size >= 0 && size <= AI_SOURCE_FILE_MAX_BYTES;
}

export function getAiSourceUploadDecision(user: { role?: string } | null | undefined, mimeType: string | undefined) {
  if (!user || user.role !== "admin") return { allowed: false as const, status: 401, error: "Unauthorized" };
  if (!isSupportedAiSourceMimeType(mimeType)) return { allowed: false as const, status: 400, error: "Only PDF, JPG, PNG, and WebP files are supported." };
  return { allowed: true as const, status: 200, error: null };
}

export function buildAiSourceMessage(instruction: string, sourceInput?: AiSourceFile | AiSourceFile[]) {
  const sourceFiles = (Array.isArray(sourceInput) ? sourceInput : sourceInput ? [sourceInput] : []).slice(0, 3);
  if (sourceFiles.length === 0) return instruction;
  const fileContext = `\n\nUse the attached source file${sourceFiles.length === 1 ? "" : "s"} (${sourceFiles.map(file => `“${file.name}”`).join(", ")}) as the primary factual source. Do not invent details absent from ${sourceFiles.length === 1 ? "it" : "them"}. ${AI_SOURCE_BLIND_WRITING_RULE} ${instruction}`;
  return [
    { type: "text", text: fileContext },
    ...sourceFiles.map(sourceFile => sourceFile.mimeType === "application/pdf"
      ? { type: "file_url", file_url: { url: sourceFile.url, mime_type: "application/pdf" } }
      : { type: "image_url", image_url: { url: sourceFile.url, detail: "high" } }),
  ];
}
