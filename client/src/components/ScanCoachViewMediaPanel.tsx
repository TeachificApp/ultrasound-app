/**
 * ScanCoachViewMediaPanel — clinical vs reference media side-by-side (square tiles).
 *
 * Merges override fields (echoImages, echoImageUrl, anatomyImageUrl) with
 * admin-uploaded view media (getMediaByView clinical / reference roles).
 */
import { useMemo } from "react";
import { Scan } from "lucide-react";
import { trpc } from "@/lib/trpc";

export type ScanCoachViewMediaSource = {
  echoImages?: Array<{ url: string; caption?: string | null }>;
  echoImageUrl?: string | null;
  anatomyImageUrl?: string | null;
  transducerImageUrl?: string | null;
  /** Second clinical image (pair 2, e.g. UE Aortic Arch SAX) */
  anatomy2ImageUrl?: string | null;
  /** Second reference image (pair 2) */
  transducer2ImageUrl?: string | null;
  /** Legacy fetal / diagram field */
  imageUrl?: string | null;
};

type MediaItem = {
  key: string;
  url: string;
  caption?: string | null;
  mediaType?: string | null;
};

function isVideoMedia(url: string, mediaType?: string | null): boolean {
  if (mediaType === "clip") return true;
  return /\.(mp4|webm|ogv|mov|wmv)$/i.test(url.split("?")[0] ?? "");
}

function itemsFromEchoFields(view?: ScanCoachViewMediaSource): MediaItem[] {
  if (!view) return [];
  const imgs = view.echoImages;
  if (imgs && imgs.length > 0) {
    return imgs.map((img, i) => ({
      key: `echo-${img.url}-${i}`,
      url: img.url,
      caption: img.caption,
      mediaType: isVideoMedia(img.url) ? "clip" : "image",
    }));
  }
  if (view.echoImageUrl) {
    return [
      {
        key: `echo-legacy-${view.echoImageUrl}`,
        url: view.echoImageUrl,
        caption: null,
        mediaType: isVideoMedia(view.echoImageUrl) ? "clip" : "image",
      },
    ];
  }
  return [];
}

function itemsFromReferenceFields(view?: ScanCoachViewMediaSource): MediaItem[] {
  if (!view) return [];
  const items: MediaItem[] = [];
  if (view.anatomyImageUrl || view.imageUrl) {
    const url = view.anatomyImageUrl || view.imageUrl!;
    items.push({
      key: `anatomy-${url}`,
      url,
      caption: "Anatomy reference",
      mediaType: "image",
    });
  }
  if (view.transducerImageUrl) {
    items.push({
      key: `transducer-${view.transducerImageUrl}`,
      url: view.transducerImageUrl,
      caption: "Probe position",
      mediaType: "image",
    });
  }
  return items;
}

function itemsFromPair2Fields(view?: ScanCoachViewMediaSource): { clinical: MediaItem[]; reference: MediaItem[] } {
  if (!view) return { clinical: [], reference: [] };
  const clinical: MediaItem[] = [];
  const reference: MediaItem[] = [];
  if (view.anatomy2ImageUrl) {
    clinical.push({
      key: `anatomy2-${view.anatomy2ImageUrl}`,
      url: view.anatomy2ImageUrl,
      caption: "Clinical 2",
      mediaType: "image",
    });
  }
  if (view.transducer2ImageUrl) {
    reference.push({
      key: `transducer2-${view.transducer2ImageUrl}`,
      url: view.transducer2ImageUrl,
      caption: "Reference 2",
      mediaType: "image",
    });
  }
  return { clinical, reference };
}

function dedupeByUrl(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function MediaSquare({ item }: { item: MediaItem }) {
  const isVideo = isVideoMedia(item.url, item.mediaType);
  return (
    <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-[#189aa130] bg-gray-950">
      {isVideo ? (
        <video
          src={item.url}
          className="w-full h-full object-contain"
          autoPlay
          loop
          muted
          playsInline
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : (
        <img
          src={item.url}
          alt={item.caption ?? "Scan coach media"}
          className="w-full h-full object-contain"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
      {item.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/65 px-2 py-1">
          <p className="text-[10px] text-white truncate text-center">{item.caption}</p>
        </div>
      )}
    </div>
  );
}

function MediaColumn({
  title,
  items,
  emptyHint,
  darkLabels,
  hideLabel = false,
  hideIfEmpty = false,
}: {
  title: string;
  items: MediaItem[];
  emptyHint: string;
  darkLabels?: boolean;
  /** When true, the column title label is not rendered */
  hideLabel?: boolean;
  /** When true, the entire column is hidden if items is empty (no placeholder) */
  hideIfEmpty?: boolean;
}) {
  if (hideIfEmpty && items.length === 0) return null;

  const labelClass = darkLabels
    ? "text-[10px] font-semibold text-white/70 uppercase tracking-wide mb-2 text-center"
    : "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center";

  return (
    <div className="flex flex-col min-w-0">
      {!hideLabel && <p className={labelClass}>{title}</p>}
      {items.length === 0 ? (
        <div
          className={`aspect-square rounded-xl flex items-center justify-center border-2 border-dashed ${
            darkLabels ? "border-white/25 bg-black/20" : "border-[#189aa140] bg-[#f0fbfc]/50"
          }`}
        >
          <p className={`text-xs text-center px-3 ${darkLabels ? "text-white/45" : "text-gray-400"}`}>
            {emptyHint}
          </p>
        </div>
      ) : (
        <div className="grid gap-2 grid-cols-1">
          {items.map((item) => (
            <MediaSquare key={item.key} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function useScanCoachViewMedia(viewId: string, view?: ScanCoachViewMediaSource) {
  const { data: dbMedia = [] } = trpc.scanCoachAdmin.getMediaByView.useQuery(
    { viewId },
    { staleTime: 60_000 },
  );

  return useMemo(() => {
    const clinicalFromDb = (dbMedia as Array<{ id: number; url: string; caption?: string | null; mediaType?: string; role?: string }>)
      .filter((m) => m.role === "clinical")
      .map((m) => ({
        key: `db-clinical-${m.id}`,
        url: m.url,
        caption: m.caption,
        mediaType: m.mediaType,
      }));

    const referenceFromDb = (dbMedia as Array<{ id: number; url: string; caption?: string | null; mediaType?: string; role?: string }>)
      .filter((m) => m.role === "reference" || m.role === "general" || !m.role)
      .map((m) => ({
        key: `db-ref-${m.id}`,
        url: m.url,
        caption: m.caption,
        mediaType: m.mediaType,
      }));

    const clinicalItems = dedupeByUrl([...itemsFromEchoFields(view), ...clinicalFromDb]);
    const referenceItems = dedupeByUrl([...itemsFromReferenceFields(view), ...referenceFromDb]);
    return {
      clinicalItems,
      referenceItems,
      hasAny: clinicalItems.length > 0 || referenceItems.length > 0,
    };
  }, [view, dbMedia]);
}

export type ScanCoachViewMediaPanelProps = {
  viewId: string;
  view?: ScanCoachViewMediaSource;
  /** Dashed placeholder when both columns are empty (AAUS view cards) */
  showPlaceholder?: boolean;
  /** Labels on dark backgrounds (POCUS header, IHE panels) */
  darkLabels?: boolean;
  className?: string;
  /** Number of clinical+reference pairs to render (default 1). Set to 2 for views like UE Aortic Arch */
  mediaPairs?: number;
  /** When true, column titles ("Clinical", "Reference") are hidden */
  hideColumnLabels?: boolean;
  /** When true, empty columns are hidden entirely instead of showing a placeholder */
  hideEmptyColumns?: boolean;
};

export type ScanCoachViewMediaCardProps = ScanCoachViewMediaPanelProps & {
  title?: string;
};

/** White card wrapper used on IHE ScanCoach and editor preview */
export function ScanCoachViewMediaCard({
  title = "View Reference Images",
  className = "p-4",
  ...panelProps
}: ScanCoachViewMediaCardProps) {
  const { hasAny } = useScanCoachViewMedia(panelProps.viewId, panelProps.view);
  if (!hasAny && !panelProps.showPlaceholder) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3
          className="font-bold text-sm text-gray-700"
          style={{ fontFamily: "Merriweather, serif" }}
        >
          {title}
        </h3>
      </div>
      <div className="bg-gray-950">
        <ScanCoachViewMediaPanel
          {...panelProps}
          className={className}
          darkLabels={panelProps.darkLabels ?? true}
        />
      </div>
    </div>
  );
}

export function ScanCoachViewMediaPanel({
  viewId,
  view,
  showPlaceholder = false,
  darkLabels = false,
  className = "mx-5 mt-4",
  mediaPairs = 1,
  hideColumnLabels = false,
  hideEmptyColumns = false,
}: ScanCoachViewMediaPanelProps) {
  const { clinicalItems, referenceItems, hasAny } = useScanCoachViewMedia(viewId, view);
  const pair2 = mediaPairs >= 2 ? itemsFromPair2Fields(view) : { clinical: [], reference: [] };
  const hasPair2 = pair2.clinical.length > 0 || pair2.reference.length > 0;
  const hasAnything = hasAny || hasPair2;
  if (!hasAnything && !showPlaceholder) return null;

  if (!hasAnything && showPlaceholder) {
    if (darkLabels) {
      return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
          <MediaColumn title="Clinical" items={[]} emptyHint="No clinical image or clip" darkLabels />
          <MediaColumn title="Reference" items={[]} emptyHint="No reference image or diagram" darkLabels />
        </div>
      );
    }
    return (
      <div
        className={`rounded-xl flex items-center justify-center ${className}`}
        style={{
          height: 140,
          background: "linear-gradient(135deg, #0e1e2e20, #189aa120)",
          border: "2px dashed #189aa140",
        }}
      >
        <div className="text-center">
          <Scan className="w-8 h-8 text-[#189aa1] mx-auto mb-2 opacity-50" />
          <p className="text-xs text-gray-400">Clinical & reference media</p>
          <p className="text-xs text-gray-300">Add via Admin → ScanCoach Editor</p>
        </div>
      </div>
    );
  }

  // For single-pair views with hideEmptyColumns, determine grid width dynamically
  const pair1HasClinical = clinicalItems.length > 0;
  const pair1HasReference = referenceItems.length > 0;
  const pair1BothPresent = pair1HasClinical && pair1HasReference;
  const pair1GridClass = (hideEmptyColumns && !pair1BothPresent) ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Pair 1 */}
      {hasAny && (
        <div className={`grid gap-4 ${pair1GridClass}`}>
          <MediaColumn
            title={mediaPairs >= 2 ? "Clinical 1" : "Clinical"}
            items={clinicalItems}
            emptyHint="No clinical image or clip"
            darkLabels={darkLabels}
            hideLabel={hideColumnLabels}
            hideIfEmpty={hideEmptyColumns}
          />
          <MediaColumn
            title={mediaPairs >= 2 ? "Reference 1" : "Reference"}
            items={referenceItems}
            emptyHint="No reference image or diagram"
            darkLabels={darkLabels}
            hideLabel={hideColumnLabels}
            hideIfEmpty={hideEmptyColumns}
          />
        </div>
      )}
      {/* Pair 2 — only rendered when mediaPairs >= 2 and at least one image is present */}
      {mediaPairs >= 2 && hasPair2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MediaColumn
            title="Clinical 2"
            items={pair2.clinical}
            emptyHint="No second clinical image"
            darkLabels={darkLabels}
            hideLabel={hideColumnLabels}
            hideIfEmpty={hideEmptyColumns}
          />
          <MediaColumn
            title="Reference 2"
            items={pair2.reference}
            emptyHint="No second reference image"
            darkLabels={darkLabels}
            hideLabel={hideColumnLabels}
            hideIfEmpty={hideEmptyColumns}
          />
        </div>
      )}
    </div>
  );
}
