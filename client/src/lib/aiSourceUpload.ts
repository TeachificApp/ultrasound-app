import { toast } from "sonner";
import { AI_SOURCE_FILE_MAX_COUNT } from "@shared/aiContentSources";

export type UploadedAiSourceFile = { url: string; mimeType: string; name: string };

export async function uploadAiGenerationSourceFiles(
  files: File[],
  existingCount: number,
): Promise<UploadedAiSourceFile[]> {
  const acceptedFiles = files.slice(0, Math.max(0, AI_SOURCE_FILE_MAX_COUNT - existingCount));
  if (files.length > acceptedFiles.length) {
    toast.error(`You can use up to ${AI_SOURCE_FILE_MAX_COUNT} source files per generation.`);
  }
  if (acceptedFiles.some(file => file.size > 50 * 1024 * 1024)) {
    toast.error("Each source file must be 50 MB or smaller.");
    return [];
  }
  if (acceptedFiles.length === 0) return [];

  const uploaded = await Promise.all(acceptedFiles.map(async file => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload-ai-generation-source", { method: "POST", credentials: "include", body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.sourceFile) throw new Error(payload.error || `Could not upload ${file.name}`);
    return payload.sourceFile as UploadedAiSourceFile;
  }));
  return uploaded;
}

export function buildAiSourceMutationPayload(state: {
  sourceText?: string;
  sourceUrls?: string[];
  sourceFiles?: UploadedAiSourceFile[];
  targetWordCount?: number | null;
}) {
  const sourceText = state.sourceText?.trim() || undefined;
  const sourceUrls = (state.sourceUrls ?? []).map(url => url.trim()).filter(Boolean);
  const sourceFiles = state.sourceFiles?.length ? state.sourceFiles : undefined;
  const targetWordCount = state.targetWordCount && state.targetWordCount > 0 ? state.targetWordCount : undefined;
  return {
    ...(sourceText ? { sourceText } : {}),
    ...(sourceUrls.length ? { sourceUrls } : {}),
    ...(sourceFiles ? { sourceFiles } : {}),
    ...(targetWordCount ? { targetWordCount } : {}),
  };
}

export function hasAiSourceInput(state: {
  prompt?: string;
  sourceText?: string;
  sourceUrls?: string[];
  sourceFiles?: UploadedAiSourceFile[];
}): boolean {
  return Boolean(
    state.prompt?.trim() ||
    state.sourceText?.trim() ||
    (state.sourceUrls ?? []).some(url => url.trim()) ||
    (state.sourceFiles?.length ?? 0) > 0,
  );
}
