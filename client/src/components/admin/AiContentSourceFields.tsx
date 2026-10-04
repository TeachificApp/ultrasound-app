import React from "react";
import { AI_SOURCE_FILE_MAX_COUNT, AI_SOURCE_URL_MAX_COUNT, AI_TARGET_WORD_COUNT_MAX, AI_TARGET_WORD_COUNT_MIN } from "@shared/aiContentSources";
import { AiSourceFileReview, type AiSourceReviewFile } from "./AiSourceFileReview";
import { uploadAiGenerationSourceFiles } from "@/lib/aiSourceUpload";

export type AiContentSourceFieldState = {
  sourceText: string;
  sourceUrls: string[];
  sourceFiles: AiSourceReviewFile[];
  targetWordCount: string;
};

export const EMPTY_AI_CONTENT_SOURCE_STATE: AiContentSourceFieldState = {
  sourceText: "",
  sourceUrls: [""],
  sourceFiles: [],
  targetWordCount: "",
};

export function AiContentSourceFields({
  value,
  onChange,
  showWordCount = true,
  fileDescription = `Combine up to ${AI_SOURCE_FILE_MAX_COUNT} PDFs or images with optional pasted text and public web pages.`,
}: {
  value: AiContentSourceFieldState;
  onChange: (next: AiContentSourceFieldState) => void;
  showWordCount?: boolean;
  fileDescription?: string;
}) {
  const [uploading, setUploading] = React.useState(false);

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    try {
      const uploaded = await uploadAiGenerationSourceFiles(files, value.sourceFiles.length);
      if (uploaded.length > 0) {
        onChange({
          ...value,
          sourceFiles: [...value.sourceFiles, ...uploaded].slice(0, AI_SOURCE_FILE_MAX_COUNT),
        });
      }
    } catch (error: any) {
      const { toast } = await import("sonner");
      toast.error(error?.message ?? "Source upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Reference text (optional)</label>
        <textarea
          value={value.sourceText}
          onChange={e => onChange({ ...value, sourceText: e.target.value })}
          placeholder="Paste notes, outline excerpts, or other reference text to ground the generation…"
          className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-xs resize-none h-16 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">Source web pages (optional)</label>
        {value.sourceUrls.map((sourceUrl, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="url"
              value={sourceUrl}
              onChange={e => {
                const next = [...value.sourceUrls];
                next[index] = e.target.value;
                onChange({ ...value, sourceUrls: next });
              }}
              placeholder="https://example.org/article"
              className="h-8 flex-1 rounded-md border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {value.sourceUrls.length > 1 && (
              <button
                type="button"
                className="text-xs text-red-600 hover:text-red-700 px-2"
                onClick={() => onChange({ ...value, sourceUrls: value.sourceUrls.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {value.sourceUrls.length < AI_SOURCE_URL_MAX_COUNT && (
          <button
            type="button"
            className="text-xs text-teal-700 hover:text-teal-900"
            onClick={() => onChange({ ...value, sourceUrls: [...value.sourceUrls, ""] })}
          >
            + Add another URL
          </button>
        )}
      </div>

      <AiSourceFileReview
        sourceFiles={value.sourceFiles}
        isUploading={uploading}
        onFiles={files => { void handleFiles(files); }}
        onRemove={index => onChange({ ...value, sourceFiles: value.sourceFiles.filter((_, i) => i !== index) })}
        description={fileDescription}
        maxFiles={AI_SOURCE_FILE_MAX_COUNT}
      />

      {showWordCount && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Target output length (words, optional)</label>
          <input
            type="number"
            min={AI_TARGET_WORD_COUNT_MIN}
            max={AI_TARGET_WORD_COUNT_MAX}
            value={value.targetWordCount}
            onChange={e => onChange({ ...value, targetWordCount: e.target.value })}
            placeholder={`e.g. 300 (${AI_TARGET_WORD_COUNT_MIN}–${AI_TARGET_WORD_COUNT_MAX.toLocaleString("en-US")})`}
            className="w-full h-8 rounded-md border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <p className="mt-1 text-[11px] text-gray-500">When set, generated HTML is trimmed or extended to stay near this word count.</p>
        </div>
      )}
    </div>
  );
}

export function parseTargetWordCount(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < AI_TARGET_WORD_COUNT_MIN || parsed > AI_TARGET_WORD_COUNT_MAX) return undefined;
  return parsed;
}
