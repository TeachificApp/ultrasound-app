/*
  TEE ScanCoach — iHeartEcho™
  Interactive view-by-view TEE acquisition guide
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo } from "react";
import { TEE_VIEWS, TEE_GROUPS } from "@/lib/teeViewData";
import { useSearch } from "wouter";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import { ScanCoachViewMediaCard } from "@/components/ScanCoachViewMediaPanel";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import ScanCoachNavBar from "@/components/ScanCoachNavBar";
import {
  Microscope, ChevronRight, ChevronDown, ChevronUp,
  Stethoscope, Zap, Info, AlertTriangle,
  CheckCircle, Target, RotateCcw, ArrowRight, BookOpen
} from "lucide-react";

const BRAND = "#189aa1";
const AQUA  = "#4ad9e0";
// TEE_VIEWS imported from @/lib/teeViewData
const GROUPS = TEE_GROUPS;
// ─── VIEW DETAIL PANEL ────────────────────────────────────────────────────────
function ViewDetail({ view }: { view: typeof TEE_VIEWS[0] }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    howToGet: true, structures: true, doppler: false, tips: false, measurements: false,
  });
  function toggle(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-5" style={{ background: `linear-gradient(135deg, ${view.groupColor}, ${view.groupColor}cc)` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {view.aseNumber && view.aseNumber !== "0" && (
                <span className="inline-flex items-center bg-white/20 rounded-full px-2.5 py-0.5">
                  <span className="text-[10px] font-bold text-white">ASE #{view.aseNumber}</span>
                </span>
              )}
              <span className="inline-flex items-center bg-white/15 rounded-full px-2.5 py-0.5">
                <span className="text-[10px] font-semibold text-white/80">{view.group}</span>
              </span>
            </div>
            <h2 className="text-xl font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
              {view.name}
            </h2>
            <p className="text-white/70 text-xs mt-1 leading-relaxed max-w-lg">{view.description}</p>
          </div>
        </div>
        {/* Quick specs — hide any box whose value is N/A or empty */}
        {(() => {
          const specs = [
            { label: "Angle", value: view.angle },
            { label: "Depth", value: view.depth },
            { label: "Flexion", value: view.flexion },
            { label: "Patient Position", value: view.patientPosition },
          ].filter(({ value }) => value && value !== "N/A" && value !== "n/a");
          if (specs.length === 0) return null;
          return (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {specs.map(({ label, value }) => (
                <div key={label} className="bg-white/10 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-white/60 font-medium">{label}</div>
                  <div className="text-xs text-white font-semibold mt-0.5 leading-snug">{value}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <ScanCoachViewMediaCard
        viewId={(view as any).id}
        view={view as any}
        mediaPairs={(view as any).id === "ueaorticarch" ? 2 : 1}
        hideColumnLabels={(view as any).id === "tee_overview"}
        hideEmptyColumns={(view as any).id === "tee_overview"}
      />
      {/* How to Get This View */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("howToGet")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">{(view as any).id === "tee_overview" ? "TEE Procedure" : "How to Get This View"}</span>
          </div>
          {openSections.howToGet ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.howToGet && (
          <div className="px-5 pb-4">
            <ol className="space-y-2">
              {view.howToGet.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ background: view.groupColor }}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700 leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Structures Visualised */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("structures")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Structures Visualised</span>
          </div>
          {openSections.structures ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.structures && (
          <div className="px-5 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {view.structures.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: view.groupColor }} />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Doppler Assessment */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("doppler")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Doppler Assessment</span>
          </div>
          {openSections.doppler ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.doppler && (
          <div className="px-5 pb-4 space-y-2">
            {view.doppler.map((d, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: view.groupColor + "08", border: `1px solid ${view.groupColor}20` }}>
                <p className="text-xs font-bold" style={{ color: view.groupColor }}>{d.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{d.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips & Pitfalls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("tips")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Tips & Pitfalls</span>
          </div>
          {openSections.tips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.tips && (
          <div className="px-5 pb-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Scanning Tips
              </p>
              <ul className="space-y-1">
                {view.tips.map((t, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Common Pitfalls
              </p>
              <ul className="space-y-1">
                {view.pitfalls.map((p, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Key Measurements */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => toggle("measurements")} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4" style={{ color: view.groupColor }} />
            <span className="text-sm font-bold text-gray-800">Key Measurements</span>
          </div>
          {openSections.measurements ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.measurements && (
          <div className="px-5 pb-4">
            <div className="flex flex-wrap gap-2">
              {view.measurements.map((m, i) => (
                <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: view.groupColor + "12", color: view.groupColor }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Critical Findings */}
      {view.criticalFindings.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <p className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Critical Findings — Do Not Miss
          </p>
          <ul className="space-y-1">
            {view.criticalFindings.map((f, i) => (
              <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function TEEScanCoach() {
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const [selectedViewId, setSelectedViewId] = useState<string>(
    TEE_VIEWS.find(v => v.id === _viewParam)?.id ?? TEE_VIEWS[0].id
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(GROUPS.map(g => g.key))
  );

  const _selectedViewRaw = TEE_VIEWS.find(v => v.id === selectedViewId) ?? TEE_VIEWS[0];
  const { mergeView: mergeTEEView } = useScanCoachOverrides("tee");
  const selectedView = useMemo(() => mergeTEEView(_selectedViewRaw as any), [_selectedViewRaw, mergeTEEView]);

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <Layout>
      <ScanCoachNavBar navigatorPath="/tee" navigatorLabel="TEE Navigator" />
{/* Main Layout */}
      <PremiumOverlay featureName="TEE ScanCoach™">
      <div className="container py-6">
        <div className="flex gap-5">
          {/* View Selector Sidebar */}
          <div className="w-64 flex-shrink-0 hidden md:block">
            <div className="sticky top-4 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">Select View</p>
              {GROUPS.map(group => (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors hover:bg-gray-100"
                    style={{ color: group.color }}
                  >
                    <span>{group.label}</span>
                    {expandedGroups.has(group.key)
                      ? <ChevronUp className="w-3.5 h-3.5" />
                      : <ChevronDown className="w-3.5 h-3.5" />
                    }
                  </button>
                  {expandedGroups.has(group.key) && (
                    <div className="ml-2 mt-1 space-y-0.5">
                      {TEE_VIEWS.filter(v => v.group === group.key).map(view => (
                        <button
                          key={view.id}
                          onClick={() => setSelectedViewId(view.id)}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2"
                          style={{
                            background: selectedViewId === view.id ? group.color + "15" : "transparent",
                            color: selectedViewId === view.id ? group.color : "#374151",
                            fontWeight: selectedViewId === view.id ? 700 : 400,
                            borderLeft: selectedViewId === view.id ? `3px solid ${group.color}` : "3px solid transparent",
                          }}
                        >
                          <ArrowRight className="w-3 h-3 flex-shrink-0" />
                          <span className="flex-1">
                            {view.aseNumber && view.aseNumber !== "0" && (
                              <span className="text-[9px] opacity-50 mr-1">#{view.aseNumber}</span>
                            )}
                            {view.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile view selector */}
          <div className="md:hidden w-full mb-4">
            <select
              value={selectedViewId}
              onChange={e => setSelectedViewId(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2"
              style={{ borderColor: BRAND + "40" }}
            >
              {GROUPS.map(group => (
                <optgroup key={group.key} label={group.label}>
                  {TEE_VIEWS.filter(v => v.group === group.key).map(view => (
                    <option key={view.id} value={view.id}>{view.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* View Detail Panel */}
          <div className="flex-1 min-w-0">
            <ViewDetail view={selectedView} />
          </div>
        </div>
      </div>
      </PremiumOverlay>
    </Layout>
  );
}
