import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type PageSeoMetadata = {
  title: string;
  description: string;
  keywords: string;
  image: string;
};

type PageSeoMetadataEditorProps = {
  value: PageSeoMetadata;
  onChange: (next: PageSeoMetadata) => void;
  fallbackTitle?: string;
  previewDomain?: string;
  uploadContext?: string;
  compact?: boolean;
  className?: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

/**
 * Shared page-editor SEO panel. Uploaded Open Graph images use the established
 * platform-admin-only page media route; the parent saves the returned URL with
 * its own page record along with title, description, and keywords.
 */
export function PageSeoMetadataEditor({
  value,
  onChange,
  fallbackTitle = "Page title",
  previewDomain,
  uploadContext = "seo",
  compact = false,
  className,
}: PageSeoMetadataEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState(false);
  const upload = trpc.auth.uploadPageMedia.useMutation({
    onError: (error) => toast.error(error.message || "Open Graph image upload failed."),
  });

  const update = (field: keyof PageSeoMetadata, next: string) => {
    if (field === "image") setImageError(false);
    onChange({ ...value, [field]: next });
  };

  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      toast.error("Choose a PNG, JPEG, or WebP image for social sharing.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Open Graph images must be 10 MB or smaller.");
      return;
    }

    try {
      const dataUri = await readFileAsDataUri(file);
      const result = await upload.mutateAsync({
        dataUri,
        mimeType: file.type,
        fileName: file.name,
        context: `${uploadContext}/open-graph`,
      });
      update("image", result.url);
      toast.success("Open Graph image uploaded. Save this page to publish it.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const title = value.title.trim() || fallbackTitle;
  const description = value.description.trim() || "A concise description will appear here when this page is shared.";
  const domain = previewDomain || (typeof window !== "undefined" ? window.location.hostname : "allaboutultrasound.com");

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
        <div>
          <h3 className={cn("font-semibold text-slate-800", compact ? "text-xs uppercase tracking-wide" : "text-sm")}>SEO & social preview</h3>
          {!compact && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Search metadata and the preview shown when this page is shared.</p>}
        </div>
      </div>

      <div className="space-y-2.5">
        <div>
          <Label className="text-xs">SEO / Open Graph title</Label>
          <Input value={value.title} onChange={(event) => update("title", event.target.value)} maxLength={255} placeholder={fallbackTitle} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Meta & Open Graph description</Label>
          <Textarea value={value.description} onChange={(event) => update("description", event.target.value)} maxLength={4000} rows={compact ? 3 : 4} placeholder="A clear summary for search results and social sharing" className="mt-1 text-sm" />
          <p className="mt-1 text-[11px] text-slate-500">{value.description.length}/160 recommended characters</p>
        </div>
        <div>
          <Label className="text-xs">SEO keywords</Label>
          <Input value={value.keywords} onChange={(event) => update("keywords", event.target.value)} placeholder="ultrasound, clinical education, CME" className="mt-1 h-8 text-sm" />
          <p className="mt-1 text-[11px] text-slate-500">Use a comma-separated list of relevant terms.</p>
        </div>
        <div>
          <Label className="text-xs">Open Graph image</Label>
          <Input value={value.image} onChange={(event) => update("image", event.target.value)} placeholder="Paste an image URL or upload below" className="mt-1 h-8 text-sm" />
          <div className="mt-2 flex flex-wrap gap-2">
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadImage(event.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-teal-200 text-xs text-teal-700 hover:bg-teal-50" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
              {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {upload.isPending ? "Uploading…" : "Upload image"}
            </Button>
            {value.image && <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-slate-600 hover:text-red-700" onClick={() => update("image", "")}><Trash2 className="h-3.5 w-3.5" /> Clear</Button>}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">PNG, JPEG, or WebP up to 10 MB. A 1200 × 630 image is recommended.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {value.image && !imageError ? (
          <img src={value.image} alt="Open Graph preview" className="aspect-[1.91/1] w-full object-cover" onError={() => setImageError(true)} />
        ) : (
          <div className="flex aspect-[1.91/1] items-center justify-center bg-gradient-to-br from-teal-700 to-cyan-500 text-teal-50"><ImagePlus className="h-8 w-8 opacity-80" /></div>
        )}
        <div className="space-y-1 p-3">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-teal-700">{domain}</p>
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{title}</p>
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
    </section>
  );
}
