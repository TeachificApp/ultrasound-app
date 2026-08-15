export const AI_SOURCE_FILE_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type AiSourceFileMimeType = typeof AI_SOURCE_FILE_MIME_TYPES[number];

export type AiSourceFile = {
  url: string;
  mimeType: AiSourceFileMimeType;
  name: string;
};

export function isSupportedAiSourceMimeType(mimeType: string | undefined) {
  return Boolean(mimeType && (AI_SOURCE_FILE_MIME_TYPES as readonly string[]).includes(mimeType));
}

export function getAiSourceUploadDecision(user: { role?: string } | null | undefined, mimeType: string | undefined) {
  if (!user || user.role !== "admin") return { allowed: false as const, status: 401, error: "Unauthorized" };
  if (!isSupportedAiSourceMimeType(mimeType)) return { allowed: false as const, status: 400, error: "Only PDF, JPG, PNG, and WebP files are supported." };
  return { allowed: true as const, status: 200, error: null };
}

export function buildAiSourceMessage(instruction: string, sourceFile?: AiSourceFile) {
  if (!sourceFile) return instruction;
  const fileContext = `\n\nUse the attached source file, “${sourceFile.name}”, as the primary factual source. Do not invent details absent from it. ${instruction}`;
  if (sourceFile.mimeType === "application/pdf") {
    return [
      { type: "text", text: fileContext },
      { type: "file_url", file_url: { url: sourceFile.url, mime_type: "application/pdf" } },
    ];
  }
  return [
    { type: "text", text: fileContext },
    { type: "image_url", image_url: { url: sourceFile.url, detail: "high" } },
  ];
}
