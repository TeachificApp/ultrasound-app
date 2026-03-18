/*
  ScanCoachEditor.tsx — WYSIWYG ScanCoach content editor for platform admins.
  Allows admins to:
    • Select any ScanCoach module (TTE, TEE, ICE, UEA, Strain)
    • Browse all views in a sidebar list
    • Upload / replace / remove images (echo, anatomy, transducer) via drag-and-drop or file picker
    • Edit text fields (description, howToGet, tips, pitfalls, structures, measurements, criticalFindings)
    • Toggle "Preview as User" to see exactly how the view looks to end-users (with overrides applied)
    • Save changes — persisted to DB and reflected live in the ScanCoach pages
  Access: platform_admin or owner role only.
*/
import React, { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  SCANCOACH_MODULES,
  IMAGE_SLOTS,
  TEXT_FIELDS,
  type ScanCoachModule,
  type ImageSlotKey,
} from "@/lib/scanCoachRegistry";
import {
  Upload, Trash2, Save, ChevronLeft, ChevronRight,
  Image as ImageIcon, Edit3, Eye, Loader2, CheckCircle2,
  AlertCircle, ExternalLink, Layers, AlertTriangle,
  Stethoscope, Ruler, Lightbulb, Activity, Heart, Baby,
  Zap, Scan, Wind, Microscope, Users, Shield,
} from "lucide-react";

// Icon map for each ScanCoach module
const MODULE_ICONS: Record<string, React.ReactNode> = {
  tte:        <Stethoscope className="w-5 h-5" />,
  tee:        <Microscope className="w-5 h-5" />,
  ice:        <Scan className="w-5 h-5" />,
  uea:        <Zap className="w-5 h-5" />,
  strain:     <Activity className="w-5 h-5" />,
  hocm:       <Heart className="w-5 h-5" />,
  stress:     <Ruler className="w-5 h-5" />,
  structural: <Layers className="w-5 h-5" />,
  fetal:      <Baby className="w-5 h-5" />,
  chd:        <Users className="w-5 h-5" />,
  diastolic:  <Wind className="w-5 h-5" />,
  pulm:       <Wind className="w-5 h-5" />,
  pocus_efast:   <Shield className="w-5 h-5" />,
  pocus_rush:    <Zap className="w-5 h-5" />,
  pocus_cardiac: <Heart className="w-5 h-5" />,
  pocus_lung:    <Wind className="w-5 h-5" />,
};

const BRAND = "#189aa1";

// ─── Types ────────────────────────────────────────────────────────────────────

type Override = {
  id: number;
  module: string;
  viewId: string;
  viewName: string | null;
  echoImageUrl: string | null;
  anatomyImageUrl: string | null;
  transducerImageUrl: string | null;
  description: string | null;
  howToGet: string | null;
  tips: string | null;
  pitfalls: string | null;
  structures: string | null;
  measurements: string | null;
  criticalFindings: string | null;
  updatedAt: Date;
};

type DraftState = {
  description: string;
  howToGet: string;
  tips: string;
  pitfalls: string;
  structures: string;
  measurements: string;
  criticalFindings: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseArrayField(value: string | null): string {
  if (!value) return "";
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) return arr.join("\n");
  } catch {
    // not JSON, return as-is
  }
  return value;
}

function toJsonArray(value: string): string {
  const lines = value.split("\n").map((l) => l.trim()).filter(Boolean);
  return JSON.stringify(lines);
}

/** Parse a JSON-array field back to string[] */
function parseToStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) return arr as string[];
  } catch {
    return value.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  return [];
}

// ─── Preview as User ─────────────────────────────────────────────────────────
// Renders the selected view as a live iframe of the actual ScanCoach page.

/**
 * Build the preview URL for a given module + view.
 * Each module has a different URL structure:
 *   - /scan-coach?tab=X  → append &view=viewId
 *   - /tee-scan-coach    → append ?view=viewId
 *   - /scan-coach?tab=chd → use ?tab=chd&defect=viewId&stage=viewId
 */
// Maps CHD stage IDs to their parent defect IDs for deep-linking
const CHD_STAGE_TO_DEFECT: Record<string, string> = {
  "asd-diagnosis": "asd", "asd-post-closure": "asd",
  "vsd-diagnosis": "vsd", "vsd-post-closure": "vsd",
  "tof-preop": "tof", "tof-postop": "tof", "tof-surveillance": "tof",
  "hlhs-prenatal-neonatal": "hlhs", "hlhs-post-norwood": "hlhs", "hlhs-interstage": "hlhs",
  "hlhs-post-glenn": "hlhs", "hlhs-post-fontan": "hlhs",
  "dtga-preop": "dtga", "dtga-post-aso": "dtga",
  "cavsd-preop": "cavsd", "cavsd-postop": "cavsd",
  "coa-diagnosis": "coa", "coa-postop": "coa",
  "tapvr-preop": "tapvr", "tapvr-postop": "tapvr",
  "truncus-preop": "truncus", "truncus-postop": "truncus",
  "ebstein-assessment": "ebstein", "ebstein-postop": "ebstein",
  "paivs-preop": "paivs", "paivs-postop": "paivs",
  "dorv-preop": "dorv", "dorv-postop": "dorv",
  "ta-preop": "tricuspid-atresia", "ta-fontan": "tricuspid-atresia",
  "iaa-preop": "iaa", "iaa-postop": "iaa",
  "heterotaxy-assessment": "heterotaxy",
};

function buildPreviewUrl(modulePath: string, moduleKey: string, viewId: string): string {
  const base = window.location.origin;
  if (moduleKey === "chd") {
    // CHD uses defect + stage params — map stage IDs to their parent defect
    const defectId = CHD_STAGE_TO_DEFECT[viewId] ?? viewId;
    return `${base}/scan-coach?tab=chd&defect=${encodeURIComponent(defectId)}&stage=${encodeURIComponent(viewId)}&preview=1`;
  }
  if (modulePath.includes("?")) {
    // Already has query params (e.g. /scan-coach?tab=tte)
    return `${base}${modulePath}&view=${encodeURIComponent(viewId)}&preview=1`;
  }
  // Dedicated page (e.g. /tee-scan-coach)
  return `${base}${modulePath}?view=${encodeURIComponent(viewId)}&preview=1`;
}

function ScanCoachViewPreview({
  viewId,
  viewName,
  override,
  moduleKey,
  modulePath,
}: {
  viewId: string;
  viewName: string;
  override: Override | undefined;
  moduleKey: string;
  modulePath: string;
}) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = buildPreviewUrl(modulePath, moduleKey, viewId);

  // Reset loading state when view changes
  React.useEffect(() => {
    setIframeLoading(true);
    setIframeError(false);
  }, [viewId, moduleKey]);

  return (
    <div className="space-y-3">
      {/* Preview banner */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            <strong>Live Preview</strong> — this is exactly what end-users see for <em>{viewName}</em>.
            Saved overrides are reflected immediately.
          </p>
        </div>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-semibold"
        >
          <ExternalLink className="w-3 h-3" /> Open in new tab
        </a>
      </div>

      {/* Override status */}
      {override && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {override.echoImageUrl && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Echo Image</Badge>}
          {override.anatomyImageUrl && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Anatomy Image</Badge>}
          {override.transducerImageUrl && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Transducer Image</Badge>}
          {override.description && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Description</Badge>}
          {override.howToGet && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>How To Get</Badge>}
          {override.tips && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Tips</Badge>}
          {override.pitfalls && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Pitfalls</Badge>}
          {override.structures && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Structures</Badge>}
          {override.measurements && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Measurements</Badge>}
          {override.criticalFindings && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Critical Findings</Badge>}
          <span className="text-[10px] text-gray-400 self-center ml-1">Last saved: {new Date(override.updatedAt).toLocaleString()}</span>
        </div>
      )}
      {!override && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 border border-gray-200">
          <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs text-gray-500">No overrides saved yet — showing default content from the component.</p>
        </div>
      )}

      {/* Live iframe */}
      <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm" style={{ height: "75vh", minHeight: 480 }}>
        {iframeLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
            <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: BRAND }} />
            <p className="text-sm text-gray-500">Loading live preview…</p>
            <p className="text-xs text-gray-400 mt-1">{viewName}</p>
          </div>
        )}
        {iframeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-gray-600 font-semibold">Preview unavailable</p>
            <p className="text-xs text-gray-400 mt-1 mb-3">The page could not be loaded in the preview frame.</p>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold"
              style={{ background: BRAND }}
            >
              <ExternalLink className="w-4 h-4" /> Open in new tab
            </a>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={previewUrl}
          title={`Live preview: ${viewName}`}
          className="w-full h-full border-0"
          onLoad={() => setIframeLoading(false)}
          onError={() => { setIframeLoading(false); setIframeError(true); }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}

// ─── (Legacy static preview helpers — kept for reference, no longer used in UI) ─
function _legacyStaticPreviewContent({
  viewId, viewName, override,
}: { viewId: string; viewName: string; override: Override | undefined }) {
  const abbr = viewId.toUpperCase().slice(0, 4);
  const echoImageUrl = override?.echoImageUrl ?? null;
  const anatomyImageUrl = override?.anatomyImageUrl ?? null;
  const transducerImageUrl = override?.transducerImageUrl ?? null;
  const description = override?.description ?? null;
  const structures = parseToStringArray(override?.structures ?? null);
  const measurements = parseToStringArray(override?.measurements ?? null);
  const howToGet = parseToStringArray(override?.howToGet ?? null);
  const tips = parseToStringArray(override?.tips ?? null);
  const pitfalls = parseToStringArray(override?.pitfalls ?? null);
  const criticalFindings = parseToStringArray(override?.criticalFindings ?? null);

  const hasAnyContent = echoImageUrl || anatomyImageUrl || transducerImageUrl
    || description || structures.length || measurements.length
    || howToGet.length || tips.length || pitfalls.length || criticalFindings.length;

  if (!hasAnyContent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-dashed border-gray-200">
        <Eye className="w-10 h-10 text-gray-200 mb-3" />
        <h3 className="font-bold text-gray-400 mb-1">No overrides yet</h3>
        <p className="text-sm text-gray-400 max-w-xs">
          Switch to <strong>Edit</strong> mode to upload images and add content. The preview will update as you save changes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: BRAND + "30", background: BRAND + "08" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: BRAND }}>
              {abbr}
            </div>
            <div>
              <h2 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{viewName}</h2>
              {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Three-column: transducer | structures | measurements */}
      {(transducerImageUrl || structures.length > 0 || measurements.length > 0 || howToGet.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Transducer / How to Get */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
              <Stethoscope className="w-4 h-4" style={{ color: BRAND }} />
              Transducer Positioning
            </h3>
            {transducerImageUrl ? (
              <img
                src={transducerImageUrl}
                alt={`${viewName} transducer position`}
                className="w-full rounded-lg object-contain mb-3"
                style={{ maxHeight: "220px" }}
              />
            ) : (
              <div className="w-full h-24 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center mb-3">
                <span className="text-xs text-gray-400">No transducer image</span>
              </div>
            )}
            {howToGet.length > 0 && (
              <ul className="space-y-1.5 mt-2">
                {howToGet.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                      style={{ background: BRAND }}>
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Structures */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
              <Eye className="w-4 h-4" style={{ color: BRAND }} />
              Structures
            </h3>
            {structures.length > 0 ? (
              <ul className="space-y-1.5">
                {structures.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: BRAND }} />
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 italic">No structures defined</p>
            )}
          </div>

          {/* Measurements */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
              <Ruler className="w-4 h-4" style={{ color: BRAND }} />
              Key Measurements
            </h3>
            {measurements.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {measurements.map((m, i) => (
                  <span key={i} className="px-2 py-1 rounded text-xs font-mono text-white"
                    style={{ background: BRAND }}>
                    {m}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No measurements defined</p>
            )}
          </div>
        </div>
      )}

      {/* Echo Image + Anatomy */}
      {(echoImageUrl || anatomyImageUrl) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" style={{ color: BRAND }} />
            <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>View Reference Images</h3>
          </div>
          <div className={`bg-gray-950 grid gap-2 p-4 ${echoImageUrl && anatomyImageUrl ? "grid-cols-2" : "grid-cols-1"}`}>
            {echoImageUrl && (
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-gray-400">Clinical Echo</p>
                <img
                  src={echoImageUrl}
                  alt={`${viewName} clinical echo`}
                  className="max-h-64 object-contain rounded w-full"
                  style={{ background: "#030712" }}
                />
              </div>
            )}
            {anatomyImageUrl && (
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-gray-400">Anatomy Reference</p>
                <img
                  src={anatomyImageUrl}
                  alt={`${viewName} anatomy`}
                  className="max-h-64 object-contain rounded w-full"
                  style={{ background: "#030712" }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tips & Pitfalls */}
      {(tips.length > 0 || pitfalls.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tips.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
                <Lightbulb className="w-4 h-4 text-green-500" />
                Scanning Tips
              </h3>
              <ul className="space-y-2">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-500 font-bold mt-0.5">+</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pitfalls.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Common Pitfalls
              </h3>
              <ul className="space-y-2">
                {pitfalls.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Critical Findings */}
      {criticalFindings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-bold text-sm text-red-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
            <AlertCircle className="w-4 h-4 text-red-500" />
            Critical Findings
          </h3>
          <ul className="space-y-1.5">
            {criticalFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="text-red-500 font-bold mt-0.5">!</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Override summary footer */}
      <div className="bg-[#189aa1]/5 border border-[#189aa1]/20 rounded-xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#189aa1]">Active overrides:</span>
          {echoImageUrl && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Echo Image</Badge>}
          {anatomyImageUrl && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Anatomy Image</Badge>}
          {transducerImageUrl && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Transducer Image</Badge>}
          {description && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Description</Badge>}
          {structures.length > 0 && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Structures ({structures.length})</Badge>}
          {measurements.length > 0 && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Measurements ({measurements.length})</Badge>}
          {howToGet.length > 0 && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>How To Get ({howToGet.length} steps)</Badge>}
          {tips.length > 0 && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Tips ({tips.length})</Badge>}
          {pitfalls.length > 0 && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Pitfalls ({pitfalls.length})</Badge>}
          {criticalFindings.length > 0 && <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>Critical Findings ({criticalFindings.length})</Badge>}
        </div>
        {override && (
          <p className="text-[10px] text-gray-400 mt-1.5">
            Last saved: {new Date(override.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Image Upload Zone ────────────────────────────────────────────────────────

function ImageUploadZone({
  slot,
  currentUrl,
  onUploaded,
  onCleared,
  isUploading,
  setIsUploading,
}: {
  slot: typeof IMAGE_SLOTS[number];
  currentUrl: string | null | undefined;
  onUploaded: (url: string) => void;
  onCleared: () => void;
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast.error("Please upload an image (JPEG, PNG, GIF, WebP, SVG) or video (MP4, WebM, MOV)");
        return;
      }
      const maxSize = isVideo ? 100 * 1024 * 1024 : 8 * 1024 * 1024;
      const maxLabel = isVideo ? "100 MB" : "8 MB";
      if (file.size > maxSize) {
        toast.error(`${isVideo ? "Video" : "Image"} must be under ${maxLabel}`);
        return;
      }
      setIsUploading(true);
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        onUploaded(base64 + "|" + file.type + "|" + file.name);
      } catch {
        toast.error("Failed to read image file");
        setIsUploading(false);
      }
    },
    [onUploaded, setIsUploading]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">{slot.label}</span>
        {currentUrl && (
          <button
            onClick={onCleared}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400">{slot.hint}</p>

      {currentUrl && (
        <div className="relative rounded-lg overflow-hidden bg-gray-950 border border-gray-200" style={{ minHeight: 120 }}>
          {/\.(mp4|webm|ogv|mov)$/i.test(currentUrl) ? (
            <video
              src={currentUrl}
              controls
              className="w-full max-h-48 object-contain"
            />
          ) : (
            <img
              src={currentUrl}
              alt={slot.label}
              className="w-full object-contain max-h-48"
            />
          )}
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 bg-black/60 rounded p-1 text-white hover:bg-black/80"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver ? "border-[#189aa1] bg-[#189aa1]/5" : "border-gray-200 hover:border-[#189aa1]/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-[#189aa1]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Uploading…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <Upload className="w-5 h-5" />
            <span className="text-xs">{currentUrl ? "Replace media" : "Upload image or video"}</span>
            <span className="text-[10px]">JPEG, PNG, GIF, WebP, SVG · MP4, WebM, MOV · max 100 MB</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime,video/x-ms-wmv,.wmv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

export default function ScanCoachEditor() {
  const { user } = useAuth();
  const [selectedModule, setSelectedModule] = useState<ScanCoachModule>("tte");
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<ImageSlotKey | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  const utils = trpc.useUtils();

  const { data: overrides = [], isLoading: loadingOverrides } = trpc.scanCoachAdmin.listOverrides.useQuery(
    { module: selectedModule },
    { staleTime: 0 }
  );

  const { data: isAdmin, isLoading: checkingAdmin } = trpc.platformAdmin.isAdmin.useQuery();

  const upsertMutation = trpc.scanCoachAdmin.upsertOverride.useMutation({
    onSuccess: () => {
      utils.scanCoachAdmin.listOverrides.invalidate();
      toast.success("Changes saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadImageMutation = trpc.scanCoachAdmin.uploadImage.useMutation({
    onSuccess: () => {
      utils.scanCoachAdmin.listOverrides.invalidate();
      setUploadingSlot(null);
      toast.success("Image uploaded and saved");
    },
    onError: (e) => {
      setUploadingSlot(null);
      toast.error(e.message);
    },
  });

  const clearImageMutation = trpc.scanCoachAdmin.clearImageField.useMutation({
    onSuccess: () => {
      utils.scanCoachAdmin.listOverrides.invalidate();
      toast.success("Image removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteOverrideMutation = trpc.scanCoachAdmin.deleteOverride.useMutation({
    onSuccess: () => {
      utils.scanCoachAdmin.listOverrides.invalidate();
      setDraft(null);
      toast.success("Override deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const moduleMeta = SCANCOACH_MODULES.find((m) => m.key === selectedModule)!;
  const currentOverride: Override | undefined = overrides.find(
    (o: Override) => o.viewId === selectedViewId
  );

  const handleSelectView = (viewId: string) => {
    setSelectedViewId(viewId);
    setPreviewMode(false); // reset to edit mode on new view selection
    const ov = overrides.find((o: Override) => o.viewId === viewId);
    setDraft({
      description: ov?.description ?? "",
      howToGet: parseArrayField(ov?.howToGet ?? null),
      tips: parseArrayField(ov?.tips ?? null),
      pitfalls: parseArrayField(ov?.pitfalls ?? null),
      structures: parseArrayField(ov?.structures ?? null),
      measurements: parseArrayField(ov?.measurements ?? null),
      criticalFindings: parseArrayField(ov?.criticalFindings ?? null),
    });
  };

  const handleSaveText = () => {
    if (!selectedViewId || !draft) return;
    const viewMeta = moduleMeta.views.find((v) => v.id === selectedViewId);
    upsertMutation.mutate({
      module: selectedModule,
      viewId: selectedViewId,
      viewName: viewMeta?.name,
      description: draft.description || null,
      howToGet: draft.howToGet ? toJsonArray(draft.howToGet) : null,
      tips: draft.tips ? toJsonArray(draft.tips) : null,
      pitfalls: draft.pitfalls ? toJsonArray(draft.pitfalls) : null,
      structures: draft.structures ? toJsonArray(draft.structures) : null,
      measurements: draft.measurements ? toJsonArray(draft.measurements) : null,
      criticalFindings: draft.criticalFindings ? toJsonArray(draft.criticalFindings) : null,
    });
  };

  const handleImageUploaded = (slot: ImageSlotKey, rawData: string) => {
    if (!selectedViewId) return;
    const [base64Data, mimeType, fileName] = rawData.split("|");
    setUploadingSlot(slot);
    const slotKey = slot === "echoImageUrl" ? "echo" : slot === "anatomyImageUrl" ? "anatomy" : "transducer";
    uploadImageMutation.mutate({
      module: selectedModule,
      viewId: selectedViewId,
      slot: slotKey,
      base64Data,
      mimeType,
      fileName,
    });
  };

  const handleClearImage = (slot: ImageSlotKey) => {
    if (!currentOverride) return;
    clearImageMutation.mutate({ id: currentOverride.id, field: slot });
  };

  const handleDeleteOverride = () => {
    if (!currentOverride) return;
    if (!confirm("Delete all overrides for this view? The static defaults will be restored.")) return;
    deleteOverrideMutation.mutate({ id: currentOverride.id });
  };

  if (checkingAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-6">Platform admin access is required to use the ScanCoach Editor.</p>
          <Link href="/">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const selectedViewName = moduleMeta.views.find((v) => v.id === selectedViewId)?.name ?? "";

  return (
    <Layout>
      {/* Page header */}
      <div
        className="border-b"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-5 h-5 text-[#4ad9e0]" />
                <span className="text-xs font-semibold text-[#4ad9e0] uppercase tracking-wider">Platform Admin</span>
              </div>
              <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                ScanCoach Editor
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Upload images and edit content for any ScanCoach view. Changes are reflected live.
              </p>
            </div>
            <Link href="/platform-admin">
              <Button variant="outline" size="sm" className="text-white border-white/30 bg-white/10 hover:bg-white/20">
                <ChevronLeft className="w-4 h-4 mr-1" /> Admin Panel
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Module selector grid */}
      <div className="bg-gray-50 border-b">
        <div className="container py-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Select a Module to Edit</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {SCANCOACH_MODULES.map((mod) => {
              const overrideCount = overrides.filter((o: Override) => o.module === mod.key).length;
              const isActive = selectedModule === mod.key;
              return (
                <button
                  key={mod.key}
                  onClick={() => {
                    setSelectedModule(mod.key);
                    setSelectedViewId(null);
                    setDraft(null);
                    setPreviewMode(false);
                  }}
                  className={`relative flex flex-col items-center gap-2 px-3 py-4 rounded-xl border-2 text-center transition-all font-semibold ${
                    isActive
                      ? "border-[#189aa1] bg-[#189aa1] text-white shadow-md scale-[1.02]"
                      : "border-gray-200 bg-white text-gray-600 hover:border-[#189aa1]/50 hover:bg-[#f0fbfc] hover:text-[#189aa1] hover:shadow-sm"
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? "bg-white/20" : "bg-[#189aa1]/10"
                  }`} style={isActive ? {} : { color: BRAND }}>
                    {MODULE_ICONS[mod.key] ?? <Layers className="w-5 h-5" />}
                  </div>
                  {/* Label */}
                  <span className="text-xs leading-tight">{mod.label.replace(" ScanCoach", "")}</span>
                  {/* View count */}
                  <span className={`text-[10px] ${
                    isActive ? "text-white/70" : "text-gray-400"
                  }`}>{mod.views.length} views</span>
                  {/* Override badge */}
                  {overrideCount > 0 && (
                    <span className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-white/25 text-white" : "bg-[#189aa1] text-white"
                    }`}>
                      {overrideCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main layout: sidebar + editor/preview */}
      <div className="container py-6">
        <div className="flex gap-6 min-h-[70vh]">
          {/* View list sidebar */}
          <div
            className={`transition-all duration-200 ${sidebarOpen ? "w-64 flex-shrink-0" : "w-10 flex-shrink-0"}`}
          >
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                {sidebarOpen && (
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Views</span>
                )}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
              {sidebarOpen && (
                <div className="divide-y divide-gray-50">
                  {loadingOverrides ? (
                    <div className="p-4 flex justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-[#189aa1]" />
                    </div>
                  ) : (
                    moduleMeta.views.map((view) => {
                      const hasOverride = overrides.some((o: Override) => o.viewId === view.id);
                      const isSelected = selectedViewId === view.id;
                      return (
                        <button
                          key={view.id}
                          onClick={() => handleSelectView(view.id)}
                          className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-[#189aa1]/10 text-[#189aa1] font-semibold"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <span className="truncate">{view.name}</span>
                          {hasOverride && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: BRAND }} />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Editor / Preview panel */}
          <div className="flex-1 min-w-0">
            {!selectedViewId ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                <Edit3 className="w-10 h-10 text-gray-200 mb-3" />
                <h3 className="font-bold text-gray-500 mb-1">Select a view to edit</h3>
                <p className="text-sm text-gray-400 max-w-xs">
                  Choose a view from the list on the left to upload images or edit content.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
                  Views with a teal dot have existing overrides
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* View header with Edit / Preview toggle */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>
                          {moduleMeta.label}
                        </Badge>
                        {currentOverride && (
                          <Badge className="text-xs text-white" style={{ background: BRAND }}>
                            Has Overrides
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                        {selectedViewName}
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">View ID: <code className="font-mono">{selectedViewId}</code></p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Edit / Preview toggle */}
                      <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => setPreviewMode(false)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                            !previewMode
                              ? "text-white"
                              : "text-gray-500 hover:text-gray-700 bg-white"
                          }`}
                          style={!previewMode ? { background: BRAND } : {}}
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => setPreviewMode(true)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                            previewMode
                              ? "text-white"
                              : "text-gray-500 hover:text-gray-700 bg-white"
                          }`}
                          style={previewMode ? { background: "#f59e0b" } : {}}
                        >
                          <Eye className="w-3 h-3" />
                          Preview as User
                        </button>
                      </div>

                      <a
                        href={moduleMeta.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#189aa1] hover:underline flex items-center gap-1 px-2 py-1.5"
                      >
                        <ExternalLink className="w-3 h-3" /> Live Page
                      </a>
                      {currentOverride && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteOverride}
                          className="text-red-500 border-red-200 hover:bg-red-50 text-xs"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Delete Override
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── PREVIEW MODE ── */}
                {previewMode ? (
                  <ScanCoachViewPreview
                    viewId={selectedViewId}
                    viewName={selectedViewName}
                    override={currentOverride}
                    moduleKey={selectedModule}
                    modulePath={moduleMeta.path}
                  />
                ) : (
                  <>
                    {/* Image uploads */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <ImageIcon className="w-4 h-4" style={{ color: BRAND }} />
                        <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>
                          Reference Images
                        </h3>
                        <span className="text-xs text-gray-400">Upload images to override the static defaults</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {IMAGE_SLOTS.filter((slot) => !(selectedModule === "ice" && slot.key === "transducerImageUrl")).map((slot) => (
                          <ImageUploadZone
                            key={slot.key}
                            slot={slot}
                            currentUrl={currentOverride?.[slot.key]}
                            isUploading={uploadingSlot === slot.key}
                            setIsUploading={(v) => setIsUploading(v ? slot.key : null)}
                            onUploaded={(rawData) => handleImageUploaded(slot.key, rawData)}
                            onCleared={() => handleClearImage(slot.key)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Text content editor */}
                    {draft && (
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Edit3 className="w-4 h-4" style={{ color: BRAND }} />
                            <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>
                              Text Content
                            </h3>
                          </div>
                          <Button
                            size="sm"
                            onClick={handleSaveText}
                            disabled={upsertMutation.isPending}
                            style={{ background: BRAND }}
                            className="text-white hover:opacity-90"
                          >
                            {upsertMutation.isPending ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving…</>
                            ) : (
                              <><Save className="w-3 h-3 mr-1" /> Save Changes</>
                            )}
                          </Button>
                        </div>

                        <div className="space-y-5">
                          {TEXT_FIELDS.map((field) => {
                            const value = draft[field.key as keyof DraftState];
                            return (
                              <div key={field.key}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-xs font-semibold text-gray-600">{field.label}</label>
                                  {field.isArray && (
                                    <span className="text-[10px] text-gray-400">One item per line</span>
                                  )}
                                </div>
                                <Textarea
                                  value={value}
                                  onChange={(e) =>
                                    setDraft((d) => d ? { ...d, [field.key]: e.target.value } : d)
                                  }
                                  placeholder={
                                    field.isArray
                                      ? `Enter each ${field.label.toLowerCase()} item on a new line…`
                                      : `Enter ${field.label.toLowerCase()}…`
                                  }
                                  rows={field.isArray ? 4 : 3}
                                  className="text-sm font-mono resize-y"
                                />
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                          <p className="text-xs text-gray-400">
                            Leave a field blank to use the static default from the component.
                            {currentOverride && (
                              <span className="ml-1">
                                Last updated: {new Date(currentOverride.updatedAt).toLocaleString()}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPreviewMode(true)}
                              className="text-amber-600 border-amber-200 hover:bg-amber-50 text-xs"
                            >
                              <Eye className="w-3 h-3 mr-1" /> Preview
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveText}
                              disabled={upsertMutation.isPending}
                              style={{ background: BRAND }}
                              className="text-white hover:opacity-90"
                            >
                              {upsertMutation.isPending ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving…</>
                              ) : (
                                <><Save className="w-3 h-3 mr-1" /> Save Changes</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Override summary */}
                    {currentOverride && (
                      <div className="bg-[#189aa1]/5 border border-[#189aa1]/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-[#189aa1]" />
                          <span className="text-sm font-semibold text-[#189aa1]">Active Overrides</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {IMAGE_SLOTS.map((slot) =>
                            currentOverride[slot.key] ? (
                              <Badge key={slot.key} variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>
                                {slot.label}
                              </Badge>
                            ) : null
                          )}
                          {TEXT_FIELDS.map((field) =>
                            currentOverride[field.key as keyof Override] ? (
                              <Badge key={field.key} variant="outline" className="text-xs" style={{ borderColor: BRAND, color: BRAND }}>
                                {field.label}
                              </Badge>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );

  function setIsUploading(slot: ImageSlotKey | null) {
    setUploadingSlot(slot);
  }
}
