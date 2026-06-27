/**
 * ScanCoachMediaPanel — Admin-only media upload panel for ScanCoach views.
 *
 * Provides two upload zones:
 *   • Clinical Image  (green) — real patient scans
 *   • Reference Image (blue)  — diagrams, schematics, annotated images, clips
 *
 * Used in:
 *   - Platform Admin → ScanCoach Editor (/admin/scancoach)
 *
 * Calls:
 *   - trpc.scanCoachAdmin.getMediaByView
 *   - trpc.scanCoachAdmin.uploadViewMedia
 *   - trpc.scanCoachAdmin.deleteViewMedia
 */
import React, { useRef, useCallback } from "react";
import { Upload, ImagePlus, Video, X, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { uploadFile } from "@/lib/uploadFile";

// ─── UploadZone ───────────────────────────────────────────────────────────────

function UploadZone({
  label,
  role,
  viewId,
  media,
  uploading,
  uploadError,
  uploadSuccess,
  caption,
  onCaptionChange,
  onFile,
  onDelete,
  accentColor,
  borderColor,
}: {
  label: string;
  role: "clinical" | "reference";
  viewId: string;
  media: Array<{ id: number; url: string; mediaType: string; caption?: string | null; role?: string | null }>;
  uploading: boolean;
  uploadError: string | null;
  uploadSuccess: boolean;
  caption: string;
  onCaptionChange: (v: string) => void;
  onFile: (file: File, role: "clinical" | "reference") => void;
  onDelete: (id: number) => void;
  accentColor: string;
  borderColor: string;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roleMedia = media.filter(
    (m) => !m.role || m.role === role || (role === "reference" && m.role === "general"),
  );

  return (
    <div
      className="rounded-xl border p-3 mb-3"
      style={{ borderColor, background: role === "clinical" ? "#f0fdf4" : "#eff6ff" }}
    >
      <p className="text-xs font-bold mb-2" style={{ color: accentColor }}>
        {label}
      </p>

      {roleMedia.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {roleMedia.map((m) => (
            <div
              key={m.id}
              className="relative rounded-lg overflow-hidden border border-gray-100 group"
            >
              {m.mediaType === "image" ? (
                <img
                  src={m.url}
                  alt={m.caption ?? label}
                  className="w-full object-contain bg-gray-900 max-h-36"
                />
              ) : (
                <video
                  src={m.url}
                  className="w-full max-h-36 bg-gray-900"
                  autoPlay
                  loop
                  muted
                  playsInline
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                />
              )}
              {m.caption && (
                <p className="text-xs text-gray-500 px-2 py-1 truncate">{m.caption}</p>
              )}
              <button
                onClick={() => onDelete(m.id)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="absolute top-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                {m.mediaType === "clip"
                  ? "Clip"
                  : role === "clinical"
                  ? "Clinical"
                  : "Reference"}
              </span>
            </div>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => onCaptionChange(e.target.value)}
        className="w-full text-xs border rounded-lg px-3 py-1.5 mb-2 bg-white focus:outline-none focus:ring-1"
        style={{ borderColor }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f, role);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragOver ? accentColor : borderColor,
          background: dragOver ? "#f0fdf4" : "transparent",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/x-ms-wmv,.wmv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f, role);
          }}
        />
        <div
          className="flex items-center justify-center gap-2 mb-0.5"
          style={{ color: accentColor }}
        >
          <ImagePlus className="w-3.5 h-3.5" />
          <Video className="w-3.5 h-3.5" />
        </div>
        <p className="text-xs font-medium" style={{ color: accentColor }}>
          {uploading ? "Uploading…" : "Drop or click to browse"}
        </p>
        <p className="text-xs mt-0.5 text-gray-400">
          JPEG, PNG, WebP, GIF (max 10 MB) · MP4, WebM (max 50 MB)
        </p>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 mt-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
          <X className="w-3.5 h-3.5 flex-shrink-0" />
          {uploadError}
        </div>
      )}
      {uploadSuccess && (
        <div className="flex items-center gap-2 mt-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          Uploaded successfully.
        </div>
      )}
    </div>
  );
}

// ─── AdminMediaPanel ──────────────────────────────────────────────────────────

export function ScanCoachMediaPanel({ viewId }: { viewId: string }) {
  const utils = trpc.useUtils();
  const [uploadingRole, setUploadingRole] = React.useState<"clinical" | "reference" | null>(null);
  const [uploadError, setUploadError] = React.useState<{ clinical: string | null; reference: string | null }>({
    clinical: null,
    reference: null,
  });
  const [uploadSuccess, setUploadSuccess] = React.useState<{ clinical: boolean; reference: boolean }>({
    clinical: false,
    reference: false,
  });
  const [captions, setCaptions] = React.useState<{ clinical: string; reference: string }>({
    clinical: "",
    reference: "",
  });

  const { data: media = [] } = trpc.scanCoachAdmin.getMediaByView.useQuery({ viewId });

  const uploadMutation = trpc.scanCoachAdmin.uploadViewMedia.useMutation({
    onSuccess: (_data, vars) => {
      const role = vars.role as "clinical" | "reference";
      setUploadSuccess((s) => ({ ...s, [role]: true }));
      setUploadingRole(null);
      setCaptions((c) => ({ ...c, [role]: "" }));
      utils.scanCoachAdmin.getMediaByView.invalidate({ viewId });
      setTimeout(() => setUploadSuccess((s) => ({ ...s, [role]: false })), 3000);
    },
    onError: (err, vars) => {
      const role = vars.role as "clinical" | "reference";
      setUploadError((s) => ({ ...s, [role]: err.message ?? "Upload failed" }));
      setUploadingRole(null);
    },
  });

  const deleteMutation = trpc.scanCoachAdmin.deleteViewMedia.useMutation({
    onSuccess: () => utils.scanCoachAdmin.getMediaByView.invalidate({ viewId }),
  });

  const handleFile = useCallback(
    async (file: File, role: "clinical" | "reference") => {
      setUploadError((s) => ({ ...s, [role]: null }));
      setUploadSuccess((s) => ({ ...s, [role]: false }));
      setUploadingRole(role);
      try {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) {
          setUploadError((s) => ({ ...s, [role]: "Only images and videos are supported." }));
          setUploadingRole(null);
          return;
        }
        const maxMB = isVideo ? 50 : 10;
        if (file.size > maxMB * 1024 * 1024) {
          setUploadError((s) => ({ ...s, [role]: `File too large. Max ${maxMB} MB.` }));
          setUploadingRole(null);
          return;
        }
        const folder = isVideo ? "scancoach/clips" : `scancoach/${role}`;
        const { url, fileKey } = await uploadFile(file, folder, {
          maxMB,
          allowedTypes: isVideo ? "video" : "image",
        });
        await uploadMutation.mutateAsync({
          viewId,
          mediaType: isVideo ? "clip" : "image",
          role,
          url,
          fileKey,
          mimeType: file.type,
          fileName: file.name,
          caption: captions[role].trim() || undefined,
          sortOrder: (media as any[]).filter((m) => m.role === role).length,
        });
      } catch (e: any) {
        setUploadError((s) => ({ ...s, [role]: e?.message ?? "Upload failed" }));
        setUploadingRole(null);
      }
    },
    [viewId, captions, media, uploadMutation],
  );

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-amber-500 text-white">
            <Upload className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-amber-800">Admin: Reference Media</span>
        </div>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          Admin only
        </span>
      </div>

      <UploadZone
        label="Clinical Image (real patient scan)"
        role="clinical"
        viewId={viewId}
        media={media as any[]}
        uploading={uploadingRole === "clinical"}
        uploadError={uploadError.clinical}
        uploadSuccess={uploadSuccess.clinical}
        caption={captions.clinical}
        onCaptionChange={(v) => setCaptions((c) => ({ ...c, clinical: v }))}
        onFile={handleFile}
        onDelete={(id) => deleteMutation.mutate({ id })}
        accentColor="#16a34a"
        borderColor="#bbf7d0"
      />

      <UploadZone
        label="Reference Image (diagram / schematic / annotated)"
        role="reference"
        viewId={viewId}
        media={media as any[]}
        uploading={uploadingRole === "reference"}
        uploadError={uploadError.reference}
        uploadSuccess={uploadSuccess.reference}
        caption={captions.reference}
        onCaptionChange={(v) => setCaptions((c) => ({ ...c, reference: v }))}
        onFile={handleFile}
        onDelete={(id) => deleteMutation.mutate({ id })}
        accentColor="#2563eb"
        borderColor="#bfdbfe"
      />
    </div>
  );
}
