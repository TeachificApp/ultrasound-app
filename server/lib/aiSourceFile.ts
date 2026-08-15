export const AI_SOURCE_FILE_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const AI_SOURCE_FILE_MAX_BYTES = 50 * 1024 * 1024;
export type AiSourceFileMimeType = typeof AI_SOURCE_FILE_MIME_TYPES[number];

export type AiSourceFile = {
  url: string;
  mimeType: AiSourceFileMimeType;
  name: string;
};

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
  const fileContext = `\n\nUse the attached source file${sourceFiles.length === 1 ? "" : "s"} (${sourceFiles.map(file => `“${file.name}”`).join(", ")}) as the primary factual source. Do not invent details absent from ${sourceFiles.length === 1 ? "it" : "them"}. ${instruction}`;
  return [
    { type: "text", text: fileContext },
    ...sourceFiles.map(sourceFile => sourceFile.mimeType === "application/pdf"
      ? { type: "file_url", file_url: { url: sourceFile.url, mime_type: "application/pdf" } }
      : { type: "image_url", image_url: { url: sourceFile.url, detail: "high" } }),
  ];
}
