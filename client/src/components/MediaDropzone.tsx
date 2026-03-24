/**
 * MediaDropzone — reusable drag-and-drop + click-to-upload media zone.
 *
 * Key behavior:
 *  - Suppresses the browser's default "open file in new tab" action by
 *    attaching window-level dragover/drop listeners while the component
 *    is mounted.  This prevents the browser from stealing the drop event
 *    when the pointer briefly leaves the zone boundary.
 *  - Accepts images and/or video depending on the `accept` prop.
 *  - Uploads via POST /api/upload-question-media (multipart/form-data).
 *  - Calls `onUploaded(url, mediaType)` on success.
 *  - Shows an inline preview (image or video) once a URL is set.
 *  - Allows the parent to pass an existing `value` URL and clear it.
 */

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, X, UploadCloud } from "lucide-react";
import { toast } from "sonner";

export type MediaType = "image" | "video";

interface MediaDropzoneProps {
  /** Current media URL (controlled). Pass empty string for no media. */
  value: string;
  /** Called when a new file has been successfully uploaded. */
  onUploaded: (url: string, mediaType: MediaType) => void;
  /** Called when the user removes the current media. */
  onClear: () => void;
  /** Label shown above the zone. */
  label?: string;
  /** Whether the field is required. */
  required?: boolean;
  /** Accept string for the hidden file input. Defaults to images + video. */
  accept?: string;
  /** Hint text shown inside the empty zone. */
  hint?: string;
  /** Upload endpoint. Defaults to /api/upload-question-media */
  uploadEndpoint?: string;
  /** Extra class names on the outer wrapper. */
  className?: string;
  /** Max height of the preview image/video (Tailwind class). */
  previewMaxH?: string;
}

const DEFAULT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/x-ms-wmv,.wmv,.mp4,.gif";

function isVideoUrl(url: string) {
  return /\.(mp4|wmv|webm|mov|avi)(\?|$)/i.test(url);
}

export function MediaDropzone({
  value,
  onUploaded,
  onClear,
  label,
  required,
  accept = DEFAULT_ACCEPT,
  hint = "Drag & drop or click to upload",
  uploadEndpoint = "/api/upload-question-media",
  className = "",
  previewMaxH = "max-h-48",
}: MediaDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Suppress browser default "open in new tab" for file drops ──────────
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      // Only suppress when files are being dragged (not internal DnD like
      // sortable lists).
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  // ── Upload helper ────────────────────────────────────────────────────────
  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(uploadEndpoint, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      if (!data.url) throw new Error("No URL returned from server");
      const mediaType: MediaType =
        data.mediaType === "video" || isVideoUrl(data.url) ? "video" : "image";
      onUploaded(data.url, mediaType);
      toast.success(
        mediaType === "video" ? "Video uploaded" : "Image uploaded"
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ── Event handlers ───────────────────────────────────────────────────────
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only clear dragOver when leaving the zone entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={label ?? "Media upload zone"}
        className={[
          "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all select-none",
          dragOver
            ? "border-teal-500 bg-teal-50 scale-[1.01]"
            : "border-teal-200 hover:border-teal-400 hover:bg-teal-50/40",
        ].join(" ")}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-teal-600 py-4">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Uploading…</span>
          </div>
        ) : value ? (
          <div className="relative">
            {isVideoUrl(value) ? (
              <video
                src={value}
                controls
                controlsList="nodownload"
                className={`w-full ${previewMaxH} rounded-lg bg-black`}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={value}
                alt="Media preview"
                className={`w-full ${previewMaxH} object-contain rounded-lg`}
              />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow transition-colors"
              aria-label="Remove media"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <p className="text-xs text-teal-600 mt-1.5">
              Click to replace · drag a new file to swap
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <UploadCloud className="w-9 h-9 text-teal-300" />
            <p className="text-sm text-gray-600 font-medium">{hint}</p>
            <p className="text-xs text-gray-400">
              JPEG · PNG · WEBP · GIF · MP4 · WMV &nbsp;·&nbsp; Max 100 MB
            </p>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
