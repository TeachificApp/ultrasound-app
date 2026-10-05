import { TRPCError } from "@trpc/server";

export const SCORM_IMPORT_STAGE_COPY = {
  reading_package: "SCORM import could not read the extracted package. Confirm extraction has completed, then try again.",
  preparing_media: "SCORM import stopped while preparing associated images or videos. No Question Bank records were saved.",
  saving_questions: "SCORM import stopped while saving Question Bank records. A retry is duplicate-safe and will preserve any records already saved.",
} as const;

export type ScormImportStage = keyof typeof SCORM_IMPORT_STAGE_COPY;

export class ScormImportStageError extends Error {
  constructor(
    public readonly stage: ScormImportStage,
    public readonly code: TRPCError["code"] = "INTERNAL_SERVER_ERROR",
  ) {
    super(SCORM_IMPORT_STAGE_COPY[stage]);
    this.name = "ScormImportStageError";
  }
}

function safeFailureCategory(error: unknown): string {
  if (error instanceof TRPCError) return error.code;
  if (error instanceof Error) return error.name === "Error" ? "Error" : error.name.slice(0, 80);
  return typeof error;
}

export function classifyScormImportFailure(stage: ScormImportStage, error: unknown): ScormImportStageError {
  if (error instanceof ScormImportStageError) return error;
  const code = error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR";
  // Keep operational logs useful without leaking package content, object keys, URLs, or session data.
  console.error(`[QuestionBank] SCORM import stage=${stage} failed (${safeFailureCategory(error)}).`);
  return new ScormImportStageError(stage, code);
}

export async function runScormImportStage<T>(
  stage: ScormImportStage,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw classifyScormImportFailure(stage, error);
  }
}
