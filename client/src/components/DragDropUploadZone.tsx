/**
 * DragDropUploadZone
 * A reusable drag-and-drop file upload zone that also supports click-to-browse.
 *
 * Props:
 *   onFile(file: File) — called when a valid file is selected/dropped
 *   accept            — MIME types string, e.g. "image/*,video/*"
 *   maxSizeMB         — optional max file size in MB (default 500, no practical limit)
 *   uploading         — show spinner instead of idle state
 *   previewUrl        — if set, show a thumbnail/video preview with a remove button
 *   onRemove          — called when the user clicks the × on the preview
 *   label             — optional label override (default "Drag & drop or click to upload")
 *   sublabel          — optional sub-label (e.g. "JPG, PNG, MP4 · Max 50 MB")
 *   className         — extra Tailwind classes on the root element
 */

import { useRef, useState, useCallback, DragEvent } from "react";
import { Upload, Loader2, X, Film, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragDropUploadZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  uploading?: boolean;
  previewUrl?: string;
  onRemove?: () => void;
  label?: string;
  sublabel?: string;
  className?: string;
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm|ogg|avi|wmv|flv|mkv)(\?|$)/i.test(url);
}

export default function DragDropUploadZone({
  onFile,
  accept = "image/*,video/*",
  maxSizeMB = 500,
  uploading = false,
  previewUrl,
  onRemove,
  label = "Drag & drop or click to upload",
  sublabel,
  className,
}: DragDropUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const validate = useCallback(
    (file: File): boolean => {
      setSizeError(null);
      const limitBytes = maxSizeMB * 1024 * 1024;
      if (file.size > limitBytes) {
        setSizeError(`File is too large. Max size is ${maxSizeMB} MB.`);
        return false;
      }
      return true;
    },
    [maxSizeMB]
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validate(file)) onFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validate(file)) onFile(file);
    e.target.value = "";
  };

  // If we have a preview, show it instead of the drop zone
  if (previewUrl && !uploading) {
    const isVid = isVideoUrl(previewUrl);
    return (
      <div className={cn("relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50", className)}>
        {isVid ? (
          <video
            src={previewUrl}
            controls
            controlsList="nodownload"
            className="w-full max-h-52 object-contain bg-black"
          />
        ) : (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full max-h-52 object-contain"
          />
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {/* Re-upload overlay on hover */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-all cursor-pointer group"
          onClick={() => inputRef.current?.click()}
        >
          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full transition-opacity">
            <Upload className="w-3.5 h-3.5" /> Replace
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div
        role="button"
        tabIndex={0}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !uploading && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none",
          "min-h-[96px] px-4 py-5 text-center",
          uploading
            ? "border-[#189aa1]/40 bg-teal-50 cursor-default"
            : dragOver
            ? "border-[#189aa1] bg-teal-50 scale-[1.01] shadow-sm"
            : "border-gray-300 bg-gray-50 hover:border-[#189aa1] hover:bg-teal-50/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />

        {uploading ? (
          <>
            <Loader2 className="w-7 h-7 text-[#189aa1] animate-spin" />
            <span className="text-sm text-[#189aa1] font-medium">Uploading…</span>
          </>
        ) : dragOver ? (
          <>
            <div className="w-10 h-10 rounded-full bg-[#189aa1]/15 flex items-center justify-center">
              <Upload className="w-5 h-5 text-[#189aa1]" />
            </div>
            <span className="text-sm font-semibold text-[#189aa1]">Drop to upload</span>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              {accept.includes("video") ? (
                <Film className="w-5 h-5 text-gray-400" />
              ) : (
                <ImageIcon className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-700">{label}</span>
              {sublabel && (
                <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
              )}
            </div>
          </>
        )}
      </div>
      {sizeError && (
        <p className="text-xs text-red-500">{sizeError}</p>
      )}
    </div>
  );
}
