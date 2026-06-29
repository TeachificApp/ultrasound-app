/*
  FetalCHDCoach.tsx
  iHeartEcho™ / All About Ultrasound — Fetal Echo CHD ScanCoach
  Renders the "Congenital Heart Defects" tab inside the Fetal Echo ScanCoach.
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import {
  AlertTriangle, ChevronLeft, ChevronRight,
  Heart, Activity, Eye, Info, Stethoscope, ImageIcon, Layers,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  FETAL_CHD_VIEWS,
  CHD_CATEGORIES,
  type ChdView,
} from "@/lib/fetalChdData";

const BRAND = "#189aa1";
const BRAND_LIGHT = "#4ad9e0";

// ─── Category colours ─────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<ChdView["category"], string> = {
  "Septal Defects":        "#189aa1",
  "Outflow Tract":         "#0e7490",
  "Valve Anomalies":       "#0369a1",
  "Great Vessel":          "#7c3aed",
  "Complex / Conotruncal": "#b91c1c",
  "Situs / Heterotaxy":    "#b45309",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
      <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>{label}</h3>
    </div>
  );
}

function BulletList({ items, color, icon: Icon }: { items: string[]; color: string; icon?: React.ElementType }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          {Icon
            ? <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
            : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
          }
          {item}
        </li>
      ))}
    </ul>
  );
}

// ─── Image grid for a CHD view ────────────────────────────────────────────────

function ChdImageGrid({
  chdId,
  module,
  slots,
  chdImages,
}: {
  chdId: string;
  module: "fetal" | "fetal_ihe";
  slots: ChdView["imageSlots"];
  chdImages: Record<string, Record<string, { imageUrl: string | null; fileKey: string | null; label: string | null }>>;
}) {
  const viewImages = chdImages[chdId] ?? {};
  const filledSlots = slots.filter(s => viewImages[s.slotKey]?.imageUrl);

  if (filledSlots.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <SectionHeader icon={ImageIcon} label="Clinical Images" color={BRAND} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        {filledSlots.map(slot => {
          const img = viewImages[slot.slotKey];
          const label = img?.label ?? slot.defaultLabel;
          return (
            <div key={slot.slotKey} className="flex flex-col gap-1">
              <div className="rounded-lg overflow-hidden bg-gray-900 aspect-video">
                <img
                  src={img!.imageUrl!}
                  alt={label}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-xs text-gray-500 text-center leading-tight">{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FetalCHDCoach({
  module = "fetal",
  isPremium = false,
}: {
  module?: "fetal" | "fetal_ihe";
  isPremium?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(FETAL_CHD_VIEWS[0].id);
  const [expandedCategory, setExpandedCategory] = useState<ChdView["category"] | null>(null);

  const view = useMemo(
    () => FETAL_CHD_VIEWS.find(v => v.id === selectedId) ?? FETAL_CHD_VIEWS[0],
    [selectedId]
  );

  const currentIndex = FETAL_CHD_VIEWS.findIndex(v => v.id === selectedId);
  const prevView = currentIndex > 0 ? FETAL_CHD_VIEWS[currentIndex - 1] : null;
  const nextView = currentIndex < FETAL_CHD_VIEWS.length - 1 ? FETAL_CHD_VIEWS[currentIndex + 1] : null;

  const color = CATEGORY_COLORS[view.category] ?? BRAND;

  // Fetch CHD images from DB
  const { data: chdImages = {} } = trpc.scanCoachAdmin.getChdImages.useQuery(
    { module },
    { staleTime: 60_000 }
  );

  // Group views by category
  const grouped = useMemo(() => {
    const map: Record<string, ChdView[]> = {};
    for (const cat of CHD_CATEGORIES) {
      map[cat] = FETAL_CHD_VIEWS.filter(v => v.category === cat);
    }
    return map;
  }, []);

  function selectView(id: string) {
    setSelectedId(id);
    // Auto-expand the category of the selected view
    const v = FETAL_CHD_VIEWS.find(v => v.id === id);
    if (v) setExpandedCategory(v.category);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
      {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="lg:col-span-1 lg:order-1 order-2 lg:sticky lg:top-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100" style={{ background: `${BRAND}08` }}>
            <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>CHD Views</h3>
            <p className="text-xs text-gray-400 mt-0.5">{FETAL_CHD_VIEWS.length} congenital defects</p>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            {CHD_CATEGORIES.map(cat => {
              const catViews = grouped[cat] ?? [];
              const catColor = CATEGORY_COLORS[cat] ?? BRAND;
              const isExpanded = expandedCategory === cat || catViews.some(v => v.id === selectedId);
              return (
                <div key={cat}>
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50"
                  >
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: catColor }}>{cat}</span>
                    <span className="text-xs text-gray-400">{catViews.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="py-1">
                      {catViews.map(v => (
                        <button
                          key={v.id}
                          onClick={() => selectView(v.id)}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-all ${
                            selectedId === v.id
                              ? "text-white"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                          style={selectedId === v.id ? { background: catColor } : {}}
                        >
                          <span className="text-xs font-mono font-bold flex-shrink-0 w-10 opacity-70">{v.abbr}</span>
                          <span className="text-xs font-medium leading-tight">{v.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Detail panel ────────────────────────────────────────────────── */}
      <div className="lg:col-span-3 lg:order-2 order-1 space-y-4">

        {/* Header card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: color + "30", background: color + "08" }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: color }}>
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{view.name}</h2>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
                      {view.abbr}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">{view.category}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{view.prevalence}</span>
                  </div>
                </div>
              </div>
              {/* Prev / Next navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => prevView && selectView(prevView.id)}
                  disabled={!prevView}
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <button
                  onClick={() => nextView && selectView(nextView.id)}
                  disabled={!nextView}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: color }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-gray-700 leading-relaxed">{view.description}</p>
          </div>
        </div>

        {/* Images (if any uploaded) */}
        <ChdImageGrid
          chdId={view.id}
          module={module}
          slots={view.imageSlots}
          chdImages={chdImages}
        />

        {/* 2D / Color / Spectral grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 2D Findings */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <SectionHeader icon={Eye} label="2D Findings" color={color} />
            <BulletList items={view.keyFindings2D} color={color} />
          </div>

          {/* Color Doppler */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <SectionHeader icon={Activity} label="Color Doppler" color={color} />
            <BulletList items={view.colorDoppler} color={color} />
          </div>

          {/* Spectral Doppler */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <SectionHeader icon={Stethoscope} label="Spectral Doppler" color={color} />
            <BulletList items={view.spectralDoppler} color={color} />
          </div>
        </div>

        {/* Fetal Echo Views + Pitfalls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Key fetal echo views */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <SectionHeader icon={Layers} label="Key Fetal Echo Views" color={color} />
            <BulletList items={view.fetalEchoViews} color={color} />
          </div>

          {/* Pitfalls */}
          <div className="bg-white rounded-xl border border-amber-50 shadow-sm p-4">
            <SectionHeader icon={AlertTriangle} label="Common Pitfalls" color="#d97706" />
            <ul className="space-y-1.5">
              {view.pitfalls.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Associated Anomalies + Prognosis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Associated anomalies */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <SectionHeader icon={Info} label="Associated Anomalies" color={color} />
            <BulletList items={view.associatedAnomalies} color={color} />
          </div>

          {/* Prognosis */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <SectionHeader icon={Heart} label="Prognosis & Management" color={color} />
            <p className="text-sm text-gray-700 leading-relaxed">{view.prognosis}</p>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-xs text-gray-400 text-center py-2">
          CHD content © All About Ultrasound, Inc. / iHeartEcho™. Educational use only.
        </div>
      </div>
    </div>
  );
}
