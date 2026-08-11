export type ScormExtractionStage = "not_required" | "queued" | "extracting" | "ready" | "failed";
export type ScormBackfillCounts = Record<"pending" | "processing" | "done" | "failed" | "skipped", number>;

export function isScormImportPackage(mediaType: string, fileName?: string | null): boolean {
  return ["scorm", "zip", "lms"].includes(mediaType)
    || /\.(zip|quiz)$/i.test(fileName ?? "");
}

export function resolveScormExtractionStage(params: {
  mediaType: string;
  fileName?: string | null;
  extractionStatus?: string | null;
}): ScormExtractionStage {
  if (!isScormImportPackage(params.mediaType, params.fileName)) return "not_required";
  if (params.extractionStatus === "done") return "ready";
  if (params.extractionStatus === "processing") return "extracting";
  if (params.extractionStatus === "failed") return "failed";
  return "queued";
}

export function summarizeScormExtractionStatuses(statuses: Array<string | null | undefined>): ScormBackfillCounts {
  const counts: ScormBackfillCounts = { pending: 0, processing: 0, done: 0, failed: 0, skipped: 0 };
  for (const status of statuses) {
    const key = (status ?? "pending") as keyof ScormBackfillCounts;
    if (key in counts) counts[key] += 1;
  }
  return counts;
}
