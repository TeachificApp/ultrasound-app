/*
  Strain ScanCoach — iHeartEcho™
  Bull's-Eye · Segmental Strain Curves · LV GLS Calculator · Tips & Tricks
  ASE 2025 Strain Guideline · Acquisition Best Practices
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useMemo, useRef, useCallback } from "react";
import { usePremium } from "@/hooks/usePremium";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import {
  Activity, ChevronDown, ChevronUp, Info, AlertCircle,
  BarChart3, CheckCircle2, Lightbulb, Target, Zap,
  Camera, Settings, Eye, BookOpen, ExternalLink, ArrowRight, FlaskConical
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { Link, useSearch } from "wouter";
import { PremiumPearlGate } from "@/components/PremiumPearlGate";
import ScanCoachNavBar from "@/components/ScanCoachNavBar";
import BillingCodesCard from "@/components/BillingCodesCard";
import { STRAIN_BILLING } from "@/lib/scanCoachBillingCodes";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";

// ─── Segment Definitions ─────────────────────────────────────────────────────

const SEGMENTS_17 = [
  { id: 1,  label: "Basal Anterior",      ring: "basal",   pos: 0, wall: "anterior" },
  { id: 2,  label: "Basal Anteroseptal",  ring: "basal",   pos: 1, wall: "septal" },
  { id: 3,  label: "Basal Inferoseptal",  ring: "basal",   pos: 2, wall: "septal" },
  { id: 4,  label: "Basal Inferior",      ring: "basal",   pos: 3, wall: "inferior" },
  { id: 5,  label: "Basal Inferolateral", ring: "basal",   pos: 4, wall: "lateral" },
  { id: 6,  label: "Basal Anterolateral", ring: "basal",   pos: 5, wall: "lateral" },
  { id: 7,  label: "Mid Anterior",        ring: "mid",     pos: 0, wall: "anterior" },
  { id: 8,  label: "Mid Anteroseptal",    ring: "mid",     pos: 1, wall: "septal" },
  { id: 9,  label: "Mid Inferoseptal",    ring: "mid",     pos: 2, wall: "septal" },
  { id: 10, label: "Mid Inferior",        ring: "mid",     pos: 3, wall: "inferior" },
  { id: 11, label: "Mid Inferolateral",   ring: "mid",     pos: 4, wall: "lateral" },
  { id: 12, label: "Mid Anterolateral",   ring: "mid",     pos: 5, wall: "lateral" },
  { id: 13, label: "Apical Anterior",     ring: "apical",  pos: 0, wall: "anterior" },
  { id: 14, label: "Apical Septal",       ring: "apical",  pos: 1, wall: "septal" },
  { id: 15, label: "Apical Inferior",     ring: "apical",  pos: 2, wall: "inferior" },
  { id: 16, label: "Apical Lateral",      ring: "apical",  pos: 3, wall: "lateral" },
  { id: 17, label: "Apex",               ring: "apex",    pos: 0, wall: "apex" },
];

const WALL_GROUPS = [
  { key: "anterior", label: "Anterior Wall",  color: "#dc2626", segIds: [1, 7, 13] },
  { key: "septal",   label: "Septal Wall",    color: "#f472b6", segIds: [2, 3, 8, 9, 14] },
  { key: "inferior", label: "Inferior Wall",  color: "#fb923c", segIds: [4, 10, 15] },
  { key: "lateral",  label: "Lateral Wall",   color: "#189aa1", segIds: [5, 6, 11, 12, 16] },
  { key: "apex",     label: "Apex",           color: "#7c3aed", segIds: [17] },
];

// ─── Strain Color ─────────────────────────────────────────────────────────────

function strainColor(val: number | null): string {
  if (val === null) return "#d1d5db";
  if (val <= -20) return "#991b1b";
  if (val <= -18) return "#ef4444";
  if (val <= -16) return "#f9a8d4";
  if (val <= -12) return "#fbcfe8";
  if (val <= -8)  return "#93c5fd";
  return "#1d4ed8";
}

// ─── Strain Curve Generator ───────────────────────────────────────────────────
//
// curveType options:
//   "normal"        — standard longitudinal shortening (default)
//   "septalFlash"   — LBBB: early shortening → rebound stretch → late re-shortening
//   "lateralDelay"  — LBBB: delayed onset, late peak strain, post-systolic shortening
//   "postSystolic"  — general post-systolic shortening (ischemia, HCM)

function generateStrainCurve(
  strainVal: number | null,
  wms: number,
  _segId: number,
  curveType: "normal" | "septalFlash" | "lateralDelay" | "postSystolic" = "normal"
): { t: number; strain: number }[] {
  const points = 50;
  const result: { t: number; strain: number }[] = [];
  let peak: number;
  if (strainVal !== null) {
    peak = strainVal;
  } else {
    const wmsDefaults: Record<number, number> = { 1: -20, 2: -12, 3: -2, 4: 3, 5: 5 };
    peak = wmsDefaults[wms] ?? -20;
  }

  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 100;
    let strain = 0;
    const amplitude = Math.abs(peak);

    if (curveType === "septalFlash") {
      // LBBB septal flash:
      // 0–15%: rapid early shortening (septal flash) reaching ~60% of amplitude
      // 15–35%: rebound stretch back toward 0 and briefly positive (paradoxical)
      // 35–60%: slow re-shortening as lateral wall activates and septum is pulled
      // 60–100%: return to baseline
      if (t <= 15) {
        strain = -(amplitude * 0.6) * Math.sin((t / 15) * Math.PI * 0.5);
      } else if (t <= 35) {
        // rebound from -60% amplitude back to +15% (paradoxical stretch)
        const reboundPeak = amplitude * 0.15;
        strain = -(amplitude * 0.6) + (amplitude * 0.6 + reboundPeak) * ((t - 15) / 20);
      } else if (t <= 60) {
        // re-shortening to ~50% of amplitude
        const startVal = amplitude * 0.15;
        const endVal = -(amplitude * 0.5);
        strain = startVal + (endVal - startVal) * ((t - 35) / 25);
      } else {
        // return to baseline
        strain = -(amplitude * 0.5) * (1 - (t - 60) / 40);
      }
    } else if (curveType === "lateralDelay") {
      // LBBB lateral wall: delayed activation, late peak, post-systolic shortening
      // 0–25%: minimal/no shortening (waiting for activation)
      // 25–65%: progressive shortening reaching full amplitude (late peak)
      // 65–80%: partial return (systole ends, but still shortening = post-systolic)
      // 80–100%: return to baseline
      if (t <= 25) {
        strain = -(amplitude * 0.05) * (t / 25); // near-flat early
      } else if (t <= 65) {
        strain = -(amplitude * 0.05) - (amplitude * 0.95) * Math.sin(((t - 25) / 40) * Math.PI * 0.5);
      } else if (t <= 80) {
        // post-systolic: still at peak or slight rebound
        strain = -amplitude + (amplitude * 0.15) * ((t - 65) / 15);
      } else {
        strain = -(amplitude * 0.85) * (1 - (t - 80) / 20);
      }
    } else if (curveType === "postSystolic") {
      // Post-systolic shortening: reduced systolic strain, peak after aortic valve closure (~35%)
      // 0–35%: minimal shortening
      // 35–60%: shortening peaks post-systole
      // 60–100%: return
      if (t <= 35) {
        strain = -(amplitude * 0.3) * Math.sin((t / 35) * Math.PI * 0.5);
      } else if (t <= 60) {
        const startVal = -(amplitude * 0.3);
        strain = startVal - (amplitude * 0.7) * Math.sin(((t - 35) / 25) * Math.PI * 0.5);
      } else {
        strain = -amplitude * (1 - (t - 60) / 40);
      }
    } else {
      // Standard normal/reduced curve
      if (wms === 1 || wms === 2) {
        if (t <= 35) {
          strain = -(amplitude * Math.sin((t / 35) * Math.PI * 0.5));
        } else if (t <= 50) {
          const psr = wms === 1 ? amplitude * 0.05 : 0;
          strain = -amplitude + (amplitude + psr) * ((t - 35) / 15);
        } else {
          const midVal = wms === 1 ? amplitude * 0.05 : 0;
          strain = midVal * (1 - (t - 50) / 50);
        }
      } else if (wms === 3) {
        strain = peak * 0.15 * Math.sin((t / 100) * Math.PI);
      } else if (wms === 4) {
        const amp = Math.abs(peak) * 0.6;
        if (t <= 35) strain = amp * Math.sin((t / 35) * Math.PI * 0.5);
        else strain = amp * (1 - (t - 35) / 65);
      } else {
        const amp = Math.abs(peak) * 0.8;
        if (t <= 40) strain = amp * Math.sin((t / 40) * Math.PI * 0.5);
        else strain = amp * (1 - (t - 40) / 60);
      }
    }
    result.push({ t: Math.round(t), strain: parseFloat(strain.toFixed(2)) });
  }
  return result;
}

// ─── LV GLS Interpretation ────────────────────────────────────────────────────

function interpretLvGls(val: number) {
  if (val <= -20) return {
    severity: "Normal LV GLS",
    color: "#15803d",
    suggests: `EchoAssist™ Suggests: LV GLS = ${val}% — within normal limits (≤ −20%). LV longitudinal function is preserved. No evidence of subclinical systolic dysfunction by strain.`,
    note: "EchoAssist™ Note: Normal GLS does not exclude diastolic dysfunction, hypertrophic cardiomyopathy, or early infiltrative disease. Correlate with clinical context, wall thickness, and diastolic parameters.",
    tip: "EchoAssist™ Tip: Serial GLS monitoring is recommended in cardio-oncology patients receiving potentially cardiotoxic therapy. A relative decrease ≥ 15% from baseline is the ASE 2022 threshold for cancer therapy-related cardiac dysfunction (CTRCD).",
  };
  if (val <= -16) return {
    severity: "Mildly Reduced LV GLS",
    color: "#ca8a04",
    suggests: `EchoAssist™ Suggests: LV GLS = ${val}% — mildly reduced (−16 to −20%). Subclinical systolic dysfunction is possible. Consider serial monitoring and clinical correlation.`,
    note: "EchoAssist™ Note: Mildly reduced GLS with preserved EF (LVEF ≥ 50%) may represent early HFpEF, hypertensive heart disease, or subclinical cardiomyopathy. Diastolic parameters and wall thickness should be assessed.",
    tip: "EchoAssist™ Tip: In cardio-oncology, GLS −16 to −20% with a relative drop ≥ 15% from baseline meets ASE 2022 CTRCD criteria even with preserved LVEF. Prompt cardiology referral is recommended.",
  };
  if (val <= -12) return {
    severity: "Moderately Reduced LV GLS",
    color: "#ea580c",
    suggests: `EchoAssist™ Suggests: LV GLS = ${val}% — moderately reduced (−12 to −16%). Significant longitudinal dysfunction is present. LVEF may still be preserved or mildly reduced.`,
    note: "EchoAssist™ Note: GLS in this range is associated with increased risk of adverse cardiovascular events. Consider evaluation for ischemic cardiomyopathy, infiltrative disease (amyloidosis, sarcoidosis), or dilated cardiomyopathy.",
    tip: "EchoAssist™ Tip: Regional patterns of reduced GLS can help differentiate ischemic (coronary territory) from non-ischemic (diffuse or apical-sparing) etiologies. Review the segmental bull's-eye for distribution.",
  };
  return {
    severity: "Severely Reduced LV GLS",
    color: "#dc2626",
    suggests: `EchoAssist™ Suggests: LV GLS = ${val}% — severely reduced (> −12%). Marked longitudinal dysfunction. LVEF is likely reduced or severely impaired. Urgent clinical evaluation is warranted.`,
    note: "EchoAssist™ Note: GLS > −12% is associated with poor prognosis in heart failure, post-MI, and cardio-oncology populations. Comprehensive evaluation including 3D volumetrics, diastolic assessment, and biomarkers is recommended.",
    tip: "EchoAssist™ Tip: In the setting of severely reduced GLS with preserved EF, consider cardiac amyloidosis (check RAS > 1.0, wall thickness, ECG voltage), HCM, or Fabry disease. Multimodality imaging may be required.",
  };
}

// ─── Bull's Eye SVG ──────────────────────────────────────────────────────────

function BullsEye({ values, onSelect, selected }: {
  values: Record<number, number | null>;
  onSelect: (id: number) => void;
  selected: number | null;
}) {
  const cx = 160, cy = 160;
  const radii = { basal: 120, mid: 80, apical: 45, apex: 18 };
  const segments: React.ReactElement[] = [];

  for (let i = 0; i < 6; i++) {
    const seg = SEGMENTS_17.find(s => s.ring === "basal" && s.pos === i)!;
    const startAngle = (i * 60 - 90) * (Math.PI / 180);
    const endAngle = ((i + 1) * 60 - 90) * (Math.PI / 180);
    const r1 = radii.mid, r2 = radii.basal;
    const x1 = cx + r1 * Math.cos(startAngle), y1 = cy + r1 * Math.sin(startAngle);
    const x2 = cx + r2 * Math.cos(startAngle), y2 = cy + r2 * Math.sin(startAngle);
    const x3 = cx + r2 * Math.cos(endAngle), y3 = cy + r2 * Math.sin(endAngle);
    const x4 = cx + r1 * Math.cos(endAngle), y4 = cy + r1 * Math.sin(endAngle);
    const d = `M ${x1} ${y1} L ${x2} ${y2} A ${r2} ${r2} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${r1} ${r1} 0 0 0 ${x1} ${y1} Z`;
    const val = values[seg.id] ?? null;
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = (r1 + r2) / 2;
    segments.push(
      <g key={seg.id} onClick={() => onSelect(seg.id)} style={{ cursor: "pointer" }}>
        <path d={d} fill={strainColor(val)} stroke={selected === seg.id ? "#0e1e2e" : "#fff"} strokeWidth={selected === seg.id ? 2.5 : 1} />
        {val !== null && (
          <text x={cx + labelR * Math.cos(midAngle)} y={cy + labelR * Math.sin(midAngle)}
            textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill="#1f2937">
            {val.toFixed(1)}
          </text>
        )}
      </g>
    );
  }

  for (let i = 0; i < 6; i++) {
    const seg = SEGMENTS_17.find(s => s.ring === "mid" && s.pos === i)!;
    const startAngle = (i * 60 - 90) * (Math.PI / 180);
    const endAngle = ((i + 1) * 60 - 90) * (Math.PI / 180);
    const r1 = radii.apical, r2 = radii.mid;
    const x1 = cx + r1 * Math.cos(startAngle), y1 = cy + r1 * Math.sin(startAngle);
    const x2 = cx + r2 * Math.cos(startAngle), y2 = cy + r2 * Math.sin(startAngle);
    const x3 = cx + r2 * Math.cos(endAngle), y3 = cy + r2 * Math.sin(endAngle);
    const x4 = cx + r1 * Math.cos(endAngle), y4 = cy + r1 * Math.sin(endAngle);
    const d = `M ${x1} ${y1} L ${x2} ${y2} A ${r2} ${r2} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${r1} ${r1} 0 0 0 ${x1} ${y1} Z`;
    const val = values[seg.id] ?? null;
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = (r1 + r2) / 2;
    segments.push(
      <g key={seg.id} onClick={() => onSelect(seg.id)} style={{ cursor: "pointer" }}>
        <path d={d} fill={strainColor(val)} stroke={selected === seg.id ? "#0e1e2e" : "#fff"} strokeWidth={selected === seg.id ? 2.5 : 1} />
        {val !== null && (
          <text x={cx + labelR * Math.cos(midAngle)} y={cy + labelR * Math.sin(midAngle)}
            textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill="#1f2937">
            {val.toFixed(1)}
          </text>
        )}
      </g>
    );
  }

  for (let i = 0; i < 4; i++) {
    const seg = SEGMENTS_17.find(s => s.ring === "apical" && s.pos === i)!;
    const startAngle = (i * 90 - 90) * (Math.PI / 180);
    const endAngle = ((i + 1) * 90 - 90) * (Math.PI / 180);
    const r1 = radii.apex, r2 = radii.apical;
    const x1 = cx + r1 * Math.cos(startAngle), y1 = cy + r1 * Math.sin(startAngle);
    const x2 = cx + r2 * Math.cos(startAngle), y2 = cy + r2 * Math.sin(startAngle);
    const x3 = cx + r2 * Math.cos(endAngle), y3 = cy + r2 * Math.sin(endAngle);
    const x4 = cx + r1 * Math.cos(endAngle), y4 = cy + r1 * Math.sin(endAngle);
    const d = `M ${x1} ${y1} L ${x2} ${y2} A ${r2} ${r2} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${r1} ${r1} 0 0 0 ${x1} ${y1} Z`;
    const val = values[seg.id] ?? null;
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = (r1 + r2) / 2;
    segments.push(
      <g key={seg.id} onClick={() => onSelect(seg.id)} style={{ cursor: "pointer" }}>
        <path d={d} fill={strainColor(val)} stroke={selected === seg.id ? "#0e1e2e" : "#fff"} strokeWidth={selected === seg.id ? 2.5 : 1} />
        {val !== null && (
          <text x={cx + labelR * Math.cos(midAngle)} y={cy + labelR * Math.sin(midAngle)}
            textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill="#1f2937">
            {val.toFixed(1)}
          </text>
        )}
      </g>
    );
  }

  const apexSeg = SEGMENTS_17.find(s => s.ring === "apex")!;
  const apexVal = values[apexSeg.id] ?? null;
  segments.push(
    <g key={apexSeg.id} onClick={() => onSelect(apexSeg.id)} style={{ cursor: "pointer" }}>
      <circle cx={cx} cy={cy} r={radii.apex} fill={strainColor(apexVal)}
        stroke={selected === apexSeg.id ? "#0e1e2e" : "#fff"} strokeWidth={selected === apexSeg.id ? 2.5 : 1} />
      {apexVal !== null && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill="#1f2937">
          {apexVal.toFixed(1)}
        </text>
      )}
    </g>
  );

  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-xs mx-auto" style={{ userSelect: "none" }}>
      {segments}
      <text x="160" y="22" textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="600">Anterior</text>
      <text x="160" y="308" textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="600">Inferior</text>
      <text x="18" y="165" textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="600" transform="rotate(-90,18,165)">Lateral</text>
      <text x="302" y="165" textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="600" transform="rotate(90,302,165)">Septal</text>
    </svg>
  );
}

// ─── Segmental Strain Curves ──────────────────────────────────────────────────

// Segment color by wall group
function segColor(wall: string): string {
  const w = WALL_GROUPS.find(g => g.key === wall);
  return w?.color ?? BRAND;
}

// Stroke style varies by ring for visual distinction
function segStroke(ring: string): string {
  if (ring === "basal") return "6 3";   // dashed
  if (ring === "mid") return "2 2";     // dotted
  return "0";                           // apical/apex = solid
}

function SegmentalStrainCurves({
  segValues,
  wallMotionScores,
  activePattern,
}: {
  segValues: Record<number, number | null>;
  wallMotionScores: Record<number, number>;
  activePattern?: string | null;
}) {
  const [activeWalls, setActiveWalls] = useState<Set<string>>(
    new Set(WALL_GROUPS.map(w => w.key))
  );
  const [hoveredSeg, setHoveredSeg] = useState<number | null>(null);

  function toggleWall(key: string) {
    setActiveWalls(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Build chart data: one key per segment ("s1" ... "s17")
  const chartData = useMemo(() => {
    const isDyssync = activePattern === "lbbb";
    const timePoints = 51;
    const data: Record<string, number | string>[] = [];
    for (let i = 0; i < timePoints; i++) {
      const t = i * 2;
      const row: Record<string, number | string> = { t };
      SEGMENTS_17.forEach(seg => {
        const wallGroup = WALL_GROUPS.find(g => g.key === seg.wall);
        if (!wallGroup || !activeWalls.has(seg.wall)) return;
        const wms = wallMotionScores[seg.id] ?? 1;
        const val = segValues[seg.id] ?? null;
        // Determine curve type based on active pattern and wall group
        let curveType: "normal" | "septalFlash" | "lateralDelay" | "postSystolic" = "normal";
        if (isDyssync) {
          if (seg.wall === "septal") curveType = "septalFlash";
          else if (seg.wall === "lateral") curveType = "lateralDelay";
        }
        const curve = generateStrainCurve(val, wms, seg.id, curveType);
        const pt = curve.find(p => p.t === t);
        row[`s${seg.id}`] = pt ? parseFloat(pt.strain.toFixed(2)) : 0;
      });
      data.push(row);
    }
    return data;
  }, [segValues, wallMotionScores, activeWalls, activePattern]);

  const scoredSegs = SEGMENTS_17.filter(s => wallMotionScores[s.id] !== undefined);
  const wmsi = scoredSegs.length > 0
    ? (scoredSegs.reduce((sum, s) => sum + (wallMotionScores[s.id] ?? 1), 0) / scoredSegs.length).toFixed(2)
    : null;
  const wmsiColor = wmsi === null ? BRAND
    : parseFloat(wmsi) <= 1.0 ? "#15803d"
    : parseFloat(wmsi) <= 1.5 ? "#ca8a04"
    : "#dc2626";

  const visibleSegs = SEGMENTS_17.filter(seg => activeWalls.has(seg.wall));

  // ── Dyssynchrony Index Calculations ──────────────────────────────────────────
  // Time-to-peak strain (TTP): the time point (0–100% RR) at which each segment
  // reaches its most negative (peak) strain value.
  // Expressed in ms assuming a typical RR of 800 ms (75 bpm).
  const RR_MS = 800; // assumed RR interval in ms
  const dyssyncMetrics = useMemo(() => {
    const isDyssync = activePattern === "lbbb";
    // Compute TTP for each segment
    const ttpMap: Record<number, number> = {};
    SEGMENTS_17.forEach(seg => {
      const wms = wallMotionScores[seg.id] ?? 1;
      const val = segValues[seg.id] ?? null;
      let curveType: "normal" | "septalFlash" | "lateralDelay" | "postSystolic" = "normal";
      if (isDyssync) {
        if (seg.wall === "septal") curveType = "septalFlash";
        else if (seg.wall === "lateral") curveType = "lateralDelay";
      }
      const curve = generateStrainCurve(val, wms, seg.id, curveType);
      // Find the time point with the most negative strain value
      let peakStrain = 0;
      let peakT = 0;
      curve.forEach(pt => {
        if (pt.strain < peakStrain) {
          peakStrain = pt.strain;
          peakT = pt.t;
        }
      });
      ttpMap[seg.id] = peakT;
    });

    // Septal segments: 2, 3, 8, 9, 14
    const septalIds = [2, 3, 8, 9, 14];
    // Lateral segments: 5, 6, 11, 12, 16
    const lateralIds = [5, 6, 11, 12, 16];

    const septalTTPs = septalIds.map(id => ttpMap[id]).filter(v => v !== undefined);
    const lateralTTPs = lateralIds.map(id => ttpMap[id]).filter(v => v !== undefined);

    const avgSeptalTTP = septalTTPs.length > 0
      ? septalTTPs.reduce((a, b) => a + b, 0) / septalTTPs.length
      : null;
    const avgLateralTTP = lateralTTPs.length > 0
      ? lateralTTPs.reduce((a, b) => a + b, 0) / lateralTTPs.length
      : null;

    // SPWMD: lateral TTP − septal TTP (positive = lateral is later = dyssynchrony)
    const spwmdPct = avgSeptalTTP !== null && avgLateralTTP !== null
      ? avgLateralTTP - avgSeptalTTP
      : null;
    const spwmdMs = spwmdPct !== null ? Math.round((spwmdPct / 100) * RR_MS) : null;

    // Dyssynchrony Index (DI): SD of TTP across all 17 segments
    const allTTPs = SEGMENTS_17.map(s => ttpMap[s.id]).filter(v => v !== undefined);
    const meanTTP = allTTPs.reduce((a, b) => a + b, 0) / allTTPs.length;
    const variance = allTTPs.reduce((sum, v) => sum + Math.pow(v - meanTTP, 2), 0) / allTTPs.length;
    const diPct = Math.sqrt(variance);
    const diMs = Math.round((diPct / 100) * RR_MS);

    // Per-segment TTP in ms for display
    const ttpMsMap: Record<number, number> = {};
    SEGMENTS_17.forEach(seg => {
      ttpMsMap[seg.id] = Math.round((ttpMap[seg.id] / 100) * RR_MS);
    });

    return { ttpMap, ttpMsMap, avgSeptalTTP, avgLateralTTP, spwmdMs, diMs };
  }, [segValues, wallMotionScores, activePattern]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>17-Segment Strain Curves</h3>
          <p className="text-xs text-gray-500 mt-0.5">Individual time-strain waveforms · Dashed = basal · Dotted = mid · Solid = apical/apex</p>
          {activePattern === "lbbb" && (
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#0369a115", color: "#0369a1", border: "1px solid #0369a130" }}>
              <span className="w-2 h-2 rounded-full bg-[#0369a1] animate-pulse inline-block" />
              Dyssynchrony mode: septal flash + lateral delay curves active
            </div>
          )}
        </div>
        {wmsi !== null && (
          <div className="text-center px-3 py-1.5 rounded-lg" style={{ background: wmsiColor + "15", border: `1px solid ${wmsiColor}30` }}>
            <div className="text-xs text-gray-500">WMSI</div>
            <div className="text-lg font-black font-mono" style={{ color: wmsiColor }}>{wmsi}</div>
          </div>
        )}
      </div>

      {/* Wall group toggles */}
      <div className="flex flex-wrap gap-2 mb-3">
        {WALL_GROUPS.map(wall => (
          <button key={wall.key} onClick={() => toggleWall(wall.key)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full border transition-all"
            style={{
              background: activeWalls.has(wall.key) ? wall.color + "20" : "#f9fafb",
              borderColor: activeWalls.has(wall.key) ? wall.color : "#e5e7eb",
              color: activeWalls.has(wall.key) ? wall.color : "#9ca3af",
            }}>
            {wall.label} ({WALL_GROUPS.find(g => g.key === wall.key)?.segIds.length})
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            onMouseLeave={() => setHoveredSeg(null)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="t"
              tickFormatter={v => v === 0 ? "ED" : v === 35 ? "ES" : v === 70 ? "" : v === 100 ? "ED" : ""}
              ticks={[0, 35, 100]}
              tick={{ fontSize: 9, fill: "#9ca3af" }} />
            <YAxis domain={[-35, 15]} tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={v => `${v}%`} />
            <Tooltip
              formatter={(val: number, name: string) => {
                const segId = parseInt(name.replace("s", ""));
                const seg = SEGMENTS_17.find(s => s.id === segId);
                return [`${val.toFixed(1)}%`, seg?.label ?? name];
              }}
              labelFormatter={t => `Time: ${t}%`}
              contentStyle={{ fontSize: 10, borderRadius: 8, border: `1px solid ${BRAND}30`, maxHeight: 200, overflowY: "auto" }}
            />
            <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
            <ReferenceLine y={-20} stroke="#dc262640" strokeDasharray="4 2" strokeWidth={1}
              label={{ value: "Normal ≤−20%", position: "right", fontSize: 8, fill: "#dc2626" }} />
            {visibleSegs.map(seg => (
              <Line
                key={`s${seg.id}`}
                type="monotone"
                dataKey={`s${seg.id}`}
                stroke={segColor(seg.wall)}
                strokeWidth={hoveredSeg === seg.id ? 3 : 1.5}
                strokeDasharray={segStroke(seg.ring)}
                dot={false}
                activeDot={{ r: 4, fill: segColor(seg.wall) }}
                opacity={hoveredSeg === null || hoveredSeg === seg.id ? 1 : 0.25}
                onMouseEnter={() => setHoveredSeg(seg.id)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Segment legend */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1">
        {visibleSegs.map(seg => (
          <div key={seg.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors"
            style={{ background: hoveredSeg === seg.id ? segColor(seg.wall) + "15" : "transparent" }}
            onMouseEnter={() => setHoveredSeg(seg.id)}
            onMouseLeave={() => setHoveredSeg(null)}>
            <div className="w-5 h-0 flex-shrink-0" style={{
              borderTop: `2px ${seg.ring === "basal" ? "dashed" : seg.ring === "mid" ? "dotted" : "solid"} ${segColor(seg.wall)}`
            }} />
            <span className="text-xs text-gray-600 truncate">{seg.id}. {seg.label}</span>
            {segValues[seg.id] !== null && segValues[seg.id] !== undefined && (
              <span className="text-xs font-mono font-bold ml-auto flex-shrink-0" style={{ color: segColor(seg.wall) }}>
                {(segValues[seg.id] as number).toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Dyssynchrony Index Readout ── */}
      <details className="mt-4" open={activePattern === "lbbb"}>
        <summary className="text-xs font-semibold cursor-pointer flex items-center gap-1.5" style={{ color: "#0369a1" }}>
          <Activity className="w-3.5 h-3.5" />
          Dyssynchrony Index Readout
          {activePattern === "lbbb" && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#0369a115", color: "#0369a1" }}>LBBB active</span>
          )}
        </summary>
        <div className="mt-3 space-y-3">
          {/* Key metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* SPWMD */}
            {(() => {
              const { spwmdMs } = dyssyncMetrics;
              const isAbnormal = spwmdMs !== null && spwmdMs >= 130;
              const color = spwmdMs === null ? "#9ca3af" : isAbnormal ? "#dc2626" : "#15803d";
              return (
                <div className="rounded-lg p-3 text-center" style={{ background: color + "10", border: `1px solid ${color}25` }}>
                  <div className="text-[10px] text-gray-500 font-medium mb-1">SPWMD</div>
                  <div className="text-xl font-black font-mono" style={{ color }}>
                    {spwmdMs !== null ? `${spwmdMs}` : "—"}
                    <span className="text-xs font-normal ml-0.5">ms</span>
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color }}>
                    {spwmdMs === null ? "" : isAbnormal ? "≥ 130 ms — Dyssynchrony" : "< 130 ms — Normal"}
                  </div>
                </div>
              );
            })()}
            {/* Dyssynchrony Index */}
            {(() => {
              const { diMs } = dyssyncMetrics;
              const isAbnormal = diMs >= 34;
              const color = isAbnormal ? "#dc2626" : "#15803d";
              return (
                <div className="rounded-lg p-3 text-center" style={{ background: color + "10", border: `1px solid ${color}25` }}>
                  <div className="text-[10px] text-gray-500 font-medium mb-1">DI (SD-TTP)</div>
                  <div className="text-xl font-black font-mono" style={{ color }}>
                    {diMs}
                    <span className="text-xs font-normal ml-0.5">ms</span>
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color }}>
                    {isAbnormal ? "≥ 34 ms — Dyssynchrony" : "< 34 ms — Normal"}
                  </div>
                </div>
              );
            })()}
            {/* Avg Septal TTP */}
            {(() => {
              const { avgSeptalTTP } = dyssyncMetrics;
              const ms = avgSeptalTTP !== null ? Math.round((avgSeptalTTP / 100) * RR_MS) : null;
              return (
                <div className="rounded-lg p-3 text-center" style={{ background: "#f472b610", border: "1px solid #f472b625" }}>
                  <div className="text-[10px] text-gray-500 font-medium mb-1">Avg Septal TTP</div>
                  <div className="text-xl font-black font-mono" style={{ color: "#db2777" }}>
                    {ms !== null ? ms : "—"}
                    <span className="text-xs font-normal ml-0.5">ms</span>
                  </div>
                  <div className="text-[9px] mt-0.5 text-gray-400">Segs 2,3,8,9,14</div>
                </div>
              );
            })()}
            {/* Avg Lateral TTP */}
            {(() => {
              const { avgLateralTTP } = dyssyncMetrics;
              const ms = avgLateralTTP !== null ? Math.round((avgLateralTTP / 100) * RR_MS) : null;
              return (
                <div className="rounded-lg p-3 text-center" style={{ background: "#189aa110", border: "1px solid #189aa125" }}>
                  <div className="text-[10px] text-gray-500 font-medium mb-1">Avg Lateral TTP</div>
                  <div className="text-xl font-black font-mono" style={{ color: BRAND }}>
                    {ms !== null ? ms : "—"}
                    <span className="text-xs font-normal ml-0.5">ms</span>
                  </div>
                  <div className="text-[9px] mt-0.5 text-gray-400">Segs 5,6,11,12,16</div>
                </div>
              );
            })()}
          </div>

          {/* Per-segment TTP table */}
          <details className="mt-1">
            <summary className="text-[10px] font-semibold cursor-pointer text-gray-400 hover:text-gray-600">Per-segment TTP (click to expand)</summary>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
              {SEGMENTS_17.map(seg => {
                const ttpMs = dyssyncMetrics.ttpMsMap[seg.id];
                const isSeptal = [2,3,8,9,14].includes(seg.id);
                const isLateral = [5,6,11,12,16].includes(seg.id);
                const dotColor = isSeptal ? "#db2777" : isLateral ? BRAND : segColor(seg.wall);
                return (
                  <div key={seg.id} className="flex items-center justify-between px-2 py-1 rounded" style={{ background: dotColor + "08" }}>
                    <span className="text-[10px] text-gray-600 truncate flex-1">{seg.id}. {seg.label}</span>
                    <span className="text-[10px] font-mono font-bold ml-2 flex-shrink-0" style={{ color: dotColor }}>{ttpMs} ms</span>
                  </div>
                );
              })}
            </div>
          </details>

          {/* Clinical thresholds note */}
          <div className="rounded-lg p-3 text-[10px] leading-relaxed" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div className="font-semibold text-gray-700 mb-1">Clinical Thresholds (ASE / PROSPECT)</div>
            <div className="text-gray-500 space-y-0.5">
              <div><span className="font-medium text-gray-700">SPWMD ≥ 130 ms</span> — Septal-to-posterior wall motion delay; predicts CRT response (sensitivity ~58%, specificity ~70%)</div>
              <div><span className="font-medium text-gray-700">DI (SD-TTP) ≥ 34 ms</span> — Standard deviation of TTP across 12 segments; predicts CRT response (PROSPECT trial)</div>
              <div><span className="font-medium text-gray-700">RR assumed:</span> 800 ms (75 bpm). Values scale linearly with actual RR interval.</div>
              <div className="mt-1 text-[9px] text-gray-400">Note: TTP values are derived from the strain curve model. In clinical practice, measure directly from vendor-generated strain curves.</div>
            </div>
          </div>
        </div>
      </details>

      {/* Wall Motion Scoring */}
      <details className="mt-4">
        <summary className="text-xs font-semibold cursor-pointer flex items-center gap-1" style={{ color: BRAND }}>
          <BarChart3 className="w-3.5 h-3.5" /> Wall Motion Scoring (click to expand)
        </summary>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SEGMENTS_17.map(seg => (
            <div key={seg.id} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-36 flex-shrink-0">{seg.label}</span>
              <select
                value={wallMotionScores[seg.id] ?? 1}
                onChange={() => {}}
                className="flex-1 text-xs border rounded px-2 py-1"
                style={{ borderColor: BRAND + "40" }}
              >
                <option value={1}>1 — Normal</option>
                <option value={2}>2 — Hypokinetic</option>
                <option value={3}>3 — Akinetic</option>
                <option value={4}>4 — Dyskinetic</option>
                <option value={5}>5 — Aneurysmal</option>
              </select>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// ─── Collapsible Section Card ─────────────────────────────────────────────────

function SectionCard({ title, subtitle, children, defaultOpen = true, icon }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND + "18" }}>{icon}</div>}
          <div>
            <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{title}</div>
            {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Tip Card ─────────────────────────────────────────────────────────────────

function TipCard({ icon, title, tip, color = BRAND }: {
  icon: React.ReactNode;
  title: string;
  tip: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg p-4 border" style={{ background: color + "08", borderColor: color + "25" }}>
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: color + "20" }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <div>
          <div className="text-xs font-bold mb-1" style={{ color }}>{title}</div>
          <p className="text-xs text-gray-600 leading-relaxed">{tip}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Checklist Item ───────────────────────────────────────────────────────────

function CheckItem({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors hover:bg-gray-50"
    >
      <div className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-all ${checked ? "border-teal-600 bg-teal-600" : "border-gray-300"}`}>
        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>
      <span className={`text-xs leading-relaxed ${checked ? "line-through text-gray-400" : "text-gray-700"}`}>{label}</span>
    </button>
  );
}

// ─── NumInput ─────────────────────────────────────────────────────────────────

function NumInput({ label, value, onChange, unit, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 block mb-1">{label}{unit && <span className="text-gray-400 ml-1">({unit})</span>}</label>
      <input
        type="number" step="0.1" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 outline-none focus:ring-2"
        style={{ borderColor: BRAND + "40" }}
      />
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const legend = [
  { color: "#991b1b", label: "≤ −20% — Normal", textColor: "#991b1b" },
  { color: "#ef4444", label: "−18 to −20% — Borderline", textColor: "#ef4444" },
  { color: "#f9a8d4", label: "−16 to −18% — Mildly Reduced", textColor: "#be185d" },
  { color: "#fbcfe8", label: "−12 to −16% — Moderately Reduced", textColor: "#9d174d" },
  { color: "#93c5fd", label: "−8 to −12% — Mod-Severely Reduced", textColor: "#1d4ed8" },
  { color: "#1d4ed8", label: "> −8% — Severely Reduced", textColor: "#1d4ed8" },
  { color: "#d1d5db", label: "Not entered", textColor: "#6b7280" },
];

// ─── Clinical Pattern Lab ────────────────────────────────────────────────

type SegPattern = Record<number, number | null>;

const CLINICAL_PATTERNS: {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  gls: string;
  glsRange: string;
  keyFeature: string;
  description: string;
  pattern: SegPattern;
}[] = [
  {
    id: "normal",
    title: "Normal",
    subtitle: "Uniform longitudinal shortening",
    color: "#15803d",
    gls: "−22%",
    glsRange: "≤ −20%",
    keyFeature: "Homogeneous dark red pattern throughout all 17 segments",
    description: "Normal LV GLS with uniform longitudinal shortening across all walls. All segments ≤ −20%. No regional variation.",
    pattern: { 1:-22,2:-22,3:-22,4:-22,5:-22,6:-22, 7:-22,8:-22,9:-22,10:-22,11:-22,12:-22, 13:-22,14:-22,15:-22,16:-22, 17:-22 },
  },
  {
    id: "dcm",
    title: "Dilated Cardiomyopathy",
    subtitle: "Diffuse global reduction",
    color: "#dc2626",
    gls: "−10%",
    glsRange: "−8 to −14%",
    keyFeature: "Diffuse global reduction — all segments similarly impaired, no regional pattern",
    description: "Diffuse global longitudinal dysfunction without regional predilection. All walls equally reduced. EF typically < 40%. No coronary territory pattern.",
    pattern: { 1:-10,2:-10,3:-10,4:-10,5:-10,6:-10, 7:-10,8:-10,9:-10,10:-10,11:-10,12:-10, 13:-11,14:-11,15:-11,16:-11, 17:-12 },
  },
  {
    id: "amyloid",
    title: "Cardiac Amyloidosis (ATTR)",
    subtitle: "Apical-sparing pattern",
    color: "#7c3aed",
    gls: "−13%",
    glsRange: "−10 to −16%",
    keyFeature: "Basal and mid segments severely reduced; apical segments relatively preserved (RAS > 1.0)",
    description: "Classic apical-sparing pattern. Basal and mid-ventricular segments severely reduced due to amyloid deposition gradient. Apical segments relatively preserved. RAS > 1.0. Sensitivity ~80%, specificity ~80% vs HCM.",
    pattern: { 1:-6,2:-6,3:-6,4:-6,5:-6,6:-6, 7:-9,8:-9,9:-9,10:-9,11:-9,12:-9, 13:-18,14:-18,15:-18,16:-18, 17:-20 },
  },
  {
    id: "hcm",
    title: "Hypertrophic Cardiomyopathy",
    subtitle: "Basal septal predominance",
    color: "#0284c7",
    gls: "−15%",
    glsRange: "−12 to −18%",
    keyFeature: "Basal and mid septal reduction despite hyperdynamic EF; apical strain relatively preserved",
    description: "LV GLS reduced despite preserved or hyperdynamic EF. Basal septal and anteroseptal segments most affected. Apical strain relatively preserved. RAS may approach but rarely exceeds 1.0 as in amyloidosis.",
    pattern: { 1:-16,2:-10,3:-10,4:-16,5:-16,6:-16, 7:-16,8:-11,9:-11,10:-16,11:-16,12:-16, 13:-18,14:-17,15:-18,16:-18, 17:-19 },
  },
  {
    id: "lad",
    title: "LAD Territory Ischemia",
    subtitle: "Anterior / anteroseptal reduction",
    color: "#b45309",
    gls: "−14%",
    glsRange: "Variable by territory",
    keyFeature: "Anterior and anteroseptal segments reduced; inferior and lateral walls preserved",
    description: "Regional strain reduction in the LAD territory: anterior, anteroseptal, and apical segments. Inferior and lateral walls preserved. Apical involvement common due to LAD wrap. Strain more sensitive than wall motion for subendocardial ischemia.",
    pattern: { 1:-8,2:-8,3:-20,4:-22,5:-22,6:-20, 7:-8,8:-8,9:-20,10:-22,11:-22,12:-20, 13:-8,14:-10,15:-20,16:-20, 17:-8 },
  },
  {
    id: "rca",
    title: "RCA Territory Ischemia",
    subtitle: "Inferior / inferoseptal reduction",
    color: "#c2410c",
    gls: "−15%",
    glsRange: "Variable by territory",
    keyFeature: "Basal and mid inferior, inferoseptal, and inferolateral segments reduced",
    description: "Regional strain reduction in the RCA territory: basal and mid inferior, inferoseptal, and inferolateral segments. Anterior and lateral walls preserved.",
    pattern: { 1:-22,2:-22,3:-8,4:-8,5:-10,6:-22, 7:-22,8:-22,9:-8,10:-8,11:-10,12:-22, 13:-20,14:-18,15:-16,16:-20, 17:-18 },
  },
  {
    id: "takotsubo",
    title: "Takotsubo Cardiomyopathy",
    subtitle: "Apical ballooning pattern",
    color: "#be185d",
    gls: "−12%",
    glsRange: "−8 to −15%",
    keyFeature: "Apical and mid segments severely reduced; basal segments hyperkinetic (preserved or supranormal)",
    description: "Apical ballooning: apical and mid-ventricular segments severely reduced or akinetic. Basal segments preserved or hyperdynamic. Does not follow coronary territory. Typically reversible within weeks.",
    pattern: { 1:-22,2:-22,3:-22,4:-22,5:-22,6:-22, 7:-8,8:-8,9:-8,10:-8,11:-8,12:-8, 13:-4,14:-4,15:-4,16:-4, 17:-3 },
  },
  {
    id: "cardiotox",
    title: "Cardiotoxicity (CTRCD)",
    subtitle: "Subclinical global reduction",
    color: "#7c3aed",
    gls: "−17%",
    glsRange: "−14 to −19% (with preserved EF)",
    keyFeature: "Mild diffuse global reduction with preserved EF — GLS decline precedes EF drop by weeks to months",
    description: "Cancer therapy-related cardiac dysfunction. Mild diffuse global reduction in GLS with preserved EF (> 50%). A relative drop of > 15% from baseline is clinically significant per ASE/ESMO 2022.",
    pattern: { 1:-17,2:-17,3:-17,4:-17,5:-17,6:-17, 7:-17,8:-17,9:-17,10:-17,11:-17,12:-17, 13:-18,14:-18,15:-18,16:-18, 17:-18 },
  },
  {
    id: "myocarditis",
    title: "Myocarditis",
    subtitle: "Lateral wall predominance",
    color: "#0891b2",
    gls: "−16%",
    glsRange: "Variable — often −14 to −18%",
    keyFeature: "Lateral and inferolateral wall reduction; may be diffuse in fulminant cases",
    description: "Lateral and inferolateral wall predominance in viral myocarditis. May be diffuse in fulminant myocarditis. RV strain often co-reduced. CMR with LGE is the gold standard for diagnosis.",
    pattern: { 1:-20,2:-20,3:-20,4:-20,5:-10,6:-10, 7:-20,8:-20,9:-20,10:-20,11:-10,12:-10, 13:-20,14:-20,15:-20,16:-12, 17:-18 },
  },
  {
    id: "lbbb",
    title: "LBBB / Dyssynchrony",
    subtitle: "Septal flash + lateral delay",
    color: "#0369a1",
    gls: "−14%",
    glsRange: "−10 to −18%",
    keyFeature: "Septal flash (early shortening → rebound stretch); lateral wall delayed activation with post-systolic shortening",
    description: "LBBB dyssynchrony: septal segments activate early (septal flash — early shortening then paradoxical rebound stretch), while lateral wall activates late with delayed peak strain and post-systolic shortening. Net GLS is reduced due to dyssynchronous timing, not intrinsic myocardial disease. CRT indicated if QRS ≥ 150 ms with LBBB morphology and LVEF ≤ 35%. The strain curves (not the bull's-eye values) show the characteristic timing abnormality.",
    pattern: { 1:-20,2:-12,3:-12,4:-20,5:-20,6:-20, 7:-20,8:-12,9:-12,10:-20,11:-20,12:-20, 13:-18,14:-14,15:-18,16:-18, 17:-16 },
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
// Named export for embedding as a tab inside ScanCoach.tsx (no Layout wrapper)
export function StrainScanCoachContent({ isPremium = false }: { isPremium?: boolean }) {
  return <StrainScanCoachInner isPremium={isPremium} />;
}

function StrainScanCoachInner({ isPremium = false }: { isPremium?: boolean }) {
  // Bull's-eye state — default to -22 (normal) per preference
  const [segValues, setSegValues] = useState<Record<number, number | null>>(
    () => Object.fromEntries(SEGMENTS_17.map(s => [s.id, -22])) as Record<number, number | null>
  );
  const [wallMotionScores, setWallMotionScores] = useState<Record<number, number>>({});
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);
  const [segInput, setSegInput] = useState("");
  const segInputRef = useRef<HTMLInputElement>(null);

  // LV GLS calculator state
  const [lvGls, setLvGls] = useState("");
  const [vendor, setVendor] = useState("");
  const [frameRate, setFrameRate] = useState("");

  const lvGlsNum = parseFloat(lvGls);
  const lvInterp = !isNaN(lvGlsNum) ? interpretLvGls(lvGlsNum) : null;

  const enteredSegs = SEGMENTS_17.filter(s => segValues[s.id] !== null && segValues[s.id] !== undefined);
  const segAvg = enteredSegs.length > 0
    ? (enteredSegs.reduce((sum, s) => sum + (segValues[s.id] as number), 0) / enteredSegs.length).toFixed(1)
    : null;

  const wmsi = (() => {
    const scored = SEGMENTS_17.filter(s => wallMotionScores[s.id] !== undefined);
    return scored.length > 0
      ? (scored.reduce((sum, s) => sum + (wallMotionScores[s.id] ?? 1), 0) / scored.length).toFixed(2)
      : null;
  })();

  const selectedSegLabel = selectedSeg !== null
    ? SEGMENTS_17.find(s => s.id === selectedSeg)?.label ?? ""
    : "";

  const handleSegSelect = useCallback((id: number) => {
    setSelectedSeg(id);
    const current = segValues[id];
    setSegInput(current !== null && current !== undefined ? String(current) : "");
    setTimeout(() => segInputRef.current?.focus(), 50);
  }, [segValues]);

  const handleSegInputChange = useCallback((val: string) => {
    setSegInput(val);
    const num = parseFloat(val);
    setSegValues(prev => ({ ...prev, [selectedSeg!]: isNaN(num) ? null : num }));
  }, [selectedSeg]);

  const clearAllSegments = useCallback(() => {
    setSegValues(Object.fromEntries(SEGMENTS_17.map(s => [s.id, null])) as Record<number, number | null>);
    setSelectedSeg(null);
    setSegInput("");
  }, []);

  // Left-column tab state
  const [leftTab, setLeftTab] = useState<"patterns" | "tips" | "acquisition">("patterns");

  // Strain acquisition views
  // PSAX views → Radial & Circumferential Strain only
  // Apical views → Longitudinal Strain only
  const STRAIN_ACQ_VIEWS = [
    {
      id: "psax_base",
      name: "PSAX — Basal Level (Mitral Valve)",
      strainTypes: ["Radial", "Circumferential"],
      probe: "Parasternal position, 3rd–4th ICS, left sternal border. Tilt probe inferiorly from PLAX until the mitral valve appears as a 'fish mouth'. Marker at 12 o'clock.",
      anatomy: "Circular LV cross-section at basal level. Mitral valve leaflets visible centrally. All 6 basal segments: basal anterior, anteroseptal, inferoseptal, inferior, inferolateral, anterolateral.",
      tips: [
        "Ensure the LV appears circular — an oval shape indicates oblique imaging and will cause tracking errors.",
        "The mitral valve should be fully visible and symmetric — if asymmetric, adjust tilt.",
        "Frame rate ≥ 40 fps (ideally 60–80 fps) for radial and circumferential strain tracking.",
        "Radial strain at this level is highest (normal ~40–50%) due to thicker myocardium.",
        "Avoid including the papillary muscles — this is the basal level only.",
      ],
    },
    {
      id: "psax_mid",
      name: "PSAX — Mid Level (Papillary Muscles)",
      strainTypes: ["Radial", "Circumferential"],
      probe: "Same parasternal window as basal PSAX. Tilt probe slightly more inferiorly until both papillary muscles are visible. Marker at 12 o'clock.",
      anatomy: "Circular LV cross-section at mid-ventricular level. Posteromedial and anterolateral papillary muscles visible. All 6 mid segments: mid anterior, anteroseptal, inferoseptal, inferior, inferolateral, anterolateral.",
      tips: [
        "Both papillary muscles must be visible and symmetric — this confirms true mid-ventricular level.",
        "If only one papillary muscle is visible, adjust tilt to find the true mid level.",
        "This is the most commonly used PSAX level for wall motion scoring and radial/circumferential strain.",
        "Circumferential strain at mid level is the most reproducible across vendors (normal ~−20 to −25%).",
        "Ensure the LV cavity appears circular — avoid oblique cuts that foreshorten the cavity.",
      ],
    },
    {
      id: "psax_apex",
      name: "PSAX — Apical Level",
      strainTypes: ["Radial", "Circumferential"],
      probe: "Same parasternal window. Tilt probe further inferiorly past the papillary muscles until the LV appears as a small circle without papillary muscles. Marker at 12 o'clock.",
      anatomy: "Small circular LV cross-section at apical level. No papillary muscles visible. Apical segments: apical anterior, apical septal, apical inferior, apical lateral.",
      tips: [
        "The LV should appear as a small, symmetric circle — no papillary muscles should be visible.",
        "Apical radial strain is lower than basal/mid due to thinner myocardium — do not over-interpret mild reductions.",
        "Frame rate is critical at this level — aim for ≥ 50 fps as the smaller cavity requires faster tracking.",
        "This view is often the most challenging to optimize — take time to find the true apical cross-section.",
        "Circumferential strain at the apex is most sensitive for apical ischemia (LAD territory).",
      ],
    },
    {
      id: "a4c",
      name: "Apical 4-Chamber (A4C)",
      strainTypes: ["Longitudinal"],
      probe: "Cardiac apex, 5th–6th ICS, mid-clavicular line. Marker at 3 o'clock (toward left shoulder).",
      anatomy: "All four chambers, MV, TV, IAS, IVS, LV lateral and septal walls. Provides 6 longitudinal segments: basal/mid/apical lateral and basal/mid/apical septal.",
      tips: [
        "True apex: rotate probe slightly counterclockwise to avoid foreshortening.",
        "Align the septum vertically — a tilted septum causes asymmetric longitudinal strain.",
        "Avoid apical rocking artifact by centering the apex.",
        "Confirm all 6 segments are tracked before accepting — foreshortening reduces apparent GLS.",
      ],
    },
    {
      id: "a2c",
      name: "Apical 2-Chamber (A2C)",
      strainTypes: ["Longitudinal"],
      probe: "Same apical window as A4C. Rotate ~60° counterclockwise from A4C.",
      anatomy: "LV anterior and inferior walls, LA, MV. No RV or septum visible. Provides 6 longitudinal segments: basal/mid/apical anterior and basal/mid/apical inferior.",
      tips: [
        "Rotate until the RV and septum disappear completely.",
        "Anterior wall foreshortening is common — adjust tilt.",
        "Ensure the MV annulus is visible at the base.",
        "Frame rate ≥ 40 fps for longitudinal strain.",
      ],
    },
    {
      id: "a3c",
      name: "Apical 3-Chamber (A3C / APLAX)",
      strainTypes: ["Longitudinal"],
      probe: "Same apical window. Rotate ~120° counterclockwise from A4C (or ~60° from A2C).",
      anatomy: "LV anteroseptal and inferolateral walls, LVOT, AV, aortic root, LA. Provides 6 longitudinal segments: basal/mid/apical anteroseptal and basal/mid/apical inferolateral.",
      tips: [
        "This view provides LVOT for VTI measurement — optimize for both strain and Doppler.",
        "Ensure the AV is fully open and the LVOT is parallel to the beam for Doppler.",
        "Foreshortening is common — tilt probe toward the sternum if needed.",
        "Together with A4C and A2C, this view completes the 17-segment GLS assessment.",
      ],
    },
  ];
  const search = useSearch();
  const _viewParam = new URLSearchParams(search).get("view");
  const [selectedAcqView, setSelectedAcqView] = useState(() => STRAIN_ACQ_VIEWS.find(v => v.id === _viewParam) ?? STRAIN_ACQ_VIEWS[0]);
  const { mergeView: mergeStrainView } = useScanCoachOverrides("strain");
  const selectedAcqViewMerged = useMemo(() => mergeStrainView({ ...selectedAcqView, id: selectedAcqView.id } as any), [selectedAcqView, mergeStrainView]);

  // Active clinical pattern
  const [activePattern, setActivePattern] = useState<string | null>(null);

  function loadPattern(patternId: string) {
    const p = CLINICAL_PATTERNS.find(x => x.id === patternId);
    if (!p) return;
    setSegValues({ ...p.pattern });
    setActivePattern(patternId);
    setSelectedSeg(null);
    setSegInput("");
    setTimeout(() => {
      document.getElementById("bullseye-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }

  return (
    <div>
      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Left Column ── */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* ── Tab Bar ── */}
            <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1">
              <button
                onClick={() => setLeftTab("patterns")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={leftTab === "patterns"
                  ? { background: BRAND, color: "#fff" }
                  : { color: "#6b7280" }}
              >
                <FlaskConical className="w-4 h-4" />
                Clinical Pattern Lab
              </button>
              <button
                onClick={() => setLeftTab("tips")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={leftTab === "tips"
                  ? { background: BRAND, color: "#fff" }
                  : { color: "#6b7280" }}
              >
                <Lightbulb className="w-4 h-4" />
                Tips & Tricks
              </button>
              <button
                onClick={() => setLeftTab("acquisition")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={leftTab === "acquisition"
                  ? { background: BRAND, color: "#fff" }
                  : { color: "#6b7280" }}
              >
                <Camera className="w-4 h-4" />
                Acquisition Views
              </button>
            </div>

            {/* ── Clinical Pattern Lab Tab ── */}
            {leftTab === "patterns" && (
              <>
                {/* ── Clinical Pattern Lab ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND + "18" }}>
                      <FlaskConical className="w-4 h-4" style={{ color: BRAND }} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Clinical Pattern Lab</div>
                      <div className="text-xs text-gray-500">Click a pattern to load representative segmental values into the bull's-eye</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    Each card represents a characteristic strain pattern for a specific disease. Clicking a card loads representative 17-segment values into the interactive bull's-eye. Use these as teaching references or to compare against your patient's actual data.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CLINICAL_PATTERNS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => loadPattern(p.id)}
                        className="text-left rounded-xl p-4 border-2 transition-all hover:shadow-md group"
                        style={{
                          background: activePattern === p.id ? p.color + "12" : "#f8fafc",
                          borderColor: activePattern === p.id ? p.color : "transparent",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="font-bold text-xs text-gray-800 leading-snug" style={{ fontFamily: "Merriweather, serif" }}>{p.title}</div>
                            <div className="text-xs mt-0.5" style={{ color: p.color }}>{p.subtitle}</div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1">
                            {activePattern === p.id && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: p.color }}>Active</span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: p.color }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono font-bold text-sm" style={{ color: p.color }}>{p.gls}</span>
                          <span className="text-xs text-gray-400">typical GLS</span>
                          <span className="text-xs text-gray-400">({p.glsRange})</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{p.keyFeature}</p>
                      </button>
                    ))}
                  </div>
                  {activePattern && (
                    <div className="mt-4 rounded-lg p-3 border flex items-start gap-2" style={{ background: BRAND + "08", borderColor: BRAND + "25" }}>
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                      <div>
                        <div className="text-xs font-bold mb-1" style={{ color: BRAND }}>
                          {CLINICAL_PATTERNS.find(x => x.id === activePattern)?.title} — Pattern Loaded
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {CLINICAL_PATTERNS.find(x => x.id === activePattern)?.description}
                        </p>
                        <button
                          onClick={() => {
                            setActivePattern(null);
                            setSegValues(Object.fromEntries(SEGMENTS_17.map(s => [s.id, -22])) as Record<number, number | null>);
                          }}
                          className="mt-2 text-xs font-semibold underline"
                          style={{ color: BRAND }}
                        >
                          Reset to normal (−22%)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
                {/* ── LV GLS Calculator (top of patterns tab) ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND + "18" }}>
                      <Activity className="w-4 h-4" style={{ color: BRAND }} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>LV GLS Calculator</div>
                      <div className="text-xs text-gray-500">Global value · ASE 2025 · Vendor-neutral reference ≤ −20%</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <NumInput label="LV GLS" value={lvGls} onChange={setLvGls} unit="%" placeholder="e.g. −19.5" hint="Normal ≤ −20%" />
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Vendor / Platform</label>
                      <select value={vendor} onChange={e => setVendor(e.target.value)}
                        className="w-full bg-white border rounded-lg px-3 py-2 text-sm text-gray-700" style={{ borderColor: BRAND + "40" }}>
                        <option value="">Select vendor</option>
                        <option>GE HealthCare</option>
                        <option>Philips</option>
                        <option>Siemens Healthineers</option>
                        <option>Canon Medical</option>
                        <option>Fujifilm</option>
                        <option>Samsung Medison</option>
                        <option>Mindray</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <NumInput label="Frame Rate" value={frameRate} onChange={setFrameRate} unit="fps" placeholder="≥ 40" hint="Recommended ≥ 40 fps" />
                  </div>

                  {lvInterp && (
                    <div className="rounded-lg p-4 mb-4" style={{ background: lvInterp.color + "18", borderLeft: `4px solid ${lvInterp.color}` }}>
                      <div className="font-bold text-sm mb-2" style={{ color: lvInterp.color }}>{lvInterp.severity}</div>
                      <p className="text-xs text-gray-700 leading-relaxed mb-2">{lvInterp.suggests}</p>
                      <p className="text-xs text-gray-600 leading-relaxed mb-2">{lvInterp.note}</p>
                      <p className="text-xs text-gray-500 leading-relaxed italic">{lvInterp.tip}</p>
                    </div>
                  )}

                  {/* Vendor-specific reference table */}
                  <details className="mt-2">
                    <summary className="text-xs font-semibold text-teal-700 cursor-pointer hover:underline flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Vendor-specific normal ranges (ASE/EACVI 2022)
                    </summary>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr style={{ background: BRAND + "15" }}>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700">Vendor</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700">Normal GLS (mean ± SD)</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700">Lower Limit of Normal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ["GE HealthCare (EchoPAC)", "−20.2 ± 1.9%", "−16.4%"],
                            ["Philips (QLAB)", "−20.4 ± 2.1%", "−16.2%"],
                            ["Siemens (syngo.via)", "−19.8 ± 2.0%", "−15.8%"],
                            ["Canon Medical (Aplio)", "−20.0 ± 2.0%", "−16.0%"],
                            ["Fujifilm (Arietta)", "−20.1 ± 2.0%", "−16.1%"],
                            ["Vendor-neutral consensus", "−20.0 ± 2.0%", "−16.0%"],
                          ].map(([v, mean, lln]) => (
                            <tr key={v} className="border-t border-gray-100">
                              <td className="px-3 py-2 text-gray-700 font-medium">{v}</td>
                              <td className="px-3 py-2 text-gray-600 font-mono">{mean}</td>
                              <td className="px-3 py-2 text-gray-600 font-mono">{lln}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>

                  {/* Mid-wall strain note */}
                  <div className="mt-4 rounded-lg p-3 border" style={{ background: "#7c3aed08", borderColor: "#7c3aed25" }}>
                    <div className="flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#7c3aed" }} />
                      <div>
                        <div className="text-xs font-bold mb-1" style={{ color: "#7c3aed" }}>Mid-Wall GLS</div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Normal mid-wall GLS is ≥ −17% (less negative than endocardial GLS). Mid-wall strain is more sensitive for subendocardial ischemia and early HCM. Most vendors report this automatically — check your software version for availability.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>{/* end LV GLS Calculator card */}

            {/* ── Tips & Tricks Tab ── */}
            {leftTab === "tips" && (
              <PremiumPearlGate isPremium={isPremium} label="Tips & Tricks" context="Unlock acquisition tips, ASE 2025 guideline updates, and common pitfalls for every strain view with Premium.">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND + "18" }}>
                    <Lightbulb className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Tips & Tricks</div>
                    <div className="text-xs text-gray-500">Practical acquisition guidance · ASE 2025 · Vendor-neutral</div>
                  </div>
                </div>
                <div className="space-y-4">

                  {/* Patient & Setup */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Patient & Setup</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TipCard icon={<Target className="w-3.5 h-3.5" />} title="Patient Positioning" tip="Left lateral decubitus with left arm raised above the head. Use a cardiac wedge or pillow under the right hip. This opens the intercostal spaces and brings the heart closer to the chest wall for optimal apical windows." />
                      <TipCard icon={<Activity className="w-3.5 h-3.5" />} title="Heart Rate Optimization" tip="Ideal heart rate for strain acquisition is 60–80 bpm. At higher rates, frame rate requirements increase proportionally. For HR > 100 bpm, target ≥ 60 fps. Avoid strain analysis if HR is irregular (AF) without averaging ≥ 5 cycles." />
                      <TipCard icon={<Settings className="w-3.5 h-3.5" />} title="Machine Settings First" tip="Before acquiring strain clips, set: depth (LV only), single focus at MV level, tissue harmonic imaging ON, gain optimized, sector width narrowed to maximize frame rate. Save these as a strain preset on your machine." />
                      <TipCard icon={<Eye className="w-3.5 h-3.5" />} title="Breath-Hold Technique" tip="Ask the patient to breathe out gently and hold. Acquire during end-expiration to minimize respiratory motion artifact. For patients who cannot hold their breath, use respiratory gating if available, or average multiple cycles." />
                    </div>
                  </div>

                  {/* Acquisition */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Acquisition</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TipCard icon={<Camera className="w-3.5 h-3.5" />} title="Frame Rate Is Critical" tip="ASE 2025 recommends ≥ 40 fps, ideally 60–80 fps. Low frame rate (< 40 fps) underestimates peak systolic strain. Increase frame rate by: narrowing sector width, reducing depth, turning off color Doppler, and reducing line density." color="#7c3aed" />
                      <TipCard icon={<AlertCircle className="w-3.5 h-3.5" />} title="Avoid Foreshortening" tip="The single most common error in strain acquisition. The apex must appear rounded and pointed — not flat or cut off. Move the probe one interspace lower and tilt more superiorly if the apex looks foreshortened. Confirm in both A4C and A2C." color="#dc2626" />
                      <TipCard icon={<Zap className="w-3.5 h-3.5" />} title="Three Views, Every Time" tip="GLS requires A4C, A2C, and A3C (APLAX). Acquiring only A4C underestimates GLS by up to 3–4%. Each view contributes 6 segments. The apex (segment 17) is shared across all three views — ensure it is clearly visualized in each." />
                      <TipCard icon={<BarChart3 className="w-3.5 h-3.5" />} title="ECG Gating" tip="Confirm the QRS trigger is correctly identifying the R-wave on every clip. Mis-triggering causes incorrect systolic timing and false strain values. If ECG signal is poor, use the machine's internal trigger or a limb-lead electrode repositioning." />
                    </div>
                  </div>

                  {/* ASE 2025 Updates — 3D strain card removed (not endorsed) */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#7c3aed" }}>Guideline Updates</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TipCard icon={<Info className="w-3.5 h-3.5" />} title="Mid-Wall Strain (New 2025)" tip="ASE 2025 introduces mid-wall GLS as a separate parameter. Normal mid-wall GLS is ≥ −17%. Mid-wall strain is more sensitive for detecting subendocardial ischemia and early HCM. Most vendors now report this automatically — ensure your software is updated." color="#7c3aed" />
                      <TipCard icon={<Activity className="w-3.5 h-3.5" />} title="Updated Normal Thresholds" tip="ASE 2025 updates normal GLS to ≤ −20% (unchanged from 2022 consensus). However, age- and sex-specific ranges are now recommended: women have slightly more negative GLS (−21 to −22%) than men (−19 to −21%). Adjust interpretation accordingly." color="#7c3aed" />
                      <TipCard icon={<CheckCircle2 className="w-3.5 h-3.5" />} title="Vendor Normalization" tip="ASE 2025 continues to recommend vendor-specific normal ranges due to inter-vendor variability of up to 2–3%. When comparing serial studies, always use the same vendor and software version. Document vendor and software version in every report." color="#7c3aed" />
                    </div>
                  </div>

                  {/* Common Pitfalls */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#dc2626" }}>Common Pitfalls</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TipCard icon={<AlertCircle className="w-3.5 h-3.5" />} title="Over-Gain Artifact" tip="Excessive gain causes endocardial dropout and tracking failure. The endocardium should be a clear, bright, continuous line. If the myocardium appears 'washed out' or the cavity is bright, reduce gain until the endocardium is sharp." color="#dc2626" />
                      <TipCard icon={<AlertCircle className="w-3.5 h-3.5" />} title="Pericardial Effusion Interference" tip="Even small effusions can cause the tracking algorithm to follow the pericardium instead of the endocardium. Manually review tracking quality in all segments. Exclude segments where tracking clearly fails — do not report GLS if > 3 segments are excluded." color="#dc2626" />
                      <TipCard icon={<AlertCircle className="w-3.5 h-3.5" />} title="Prosthetic Valves & Pacemakers" tip="Metallic artifacts from prosthetic valves and pacemaker leads cause shadowing that disrupts tracking in adjacent segments. Document affected segments and interpret GLS with caution." color="#dc2626" />
                      <TipCard icon={<AlertCircle className="w-3.5 h-3.5" />} title="LBBB Pattern" tip="Left bundle branch block causes paradoxical septal motion that makes GLS unreliable as a measure of intrinsic myocardial function. In LBBB, report segmental strain patterns rather than global GLS. Consider mechanical dyssynchrony analysis." color="#dc2626" />
                    </div>
                  </div>

                  {/* Contrast & Difficult Windows */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#ca8a04" }}>Contrast & Difficult Windows</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TipCard icon={<Camera className="w-3.5 h-3.5" />} title="When to Use Contrast" tip="Use ultrasound enhancing agents (UEA) when ≥ 2 contiguous segments are not visualized. Contrast improves endocardial definition and tracking quality. Most strain software supports contrast-enhanced tracking — confirm with your vendor." color="#ca8a04" />
                      <TipCard icon={<Settings className="w-3.5 h-3.5" />} title="Subcostal Window Alternative" tip="For patients with poor apical windows (COPD, obesity, post-surgical), the subcostal 4-chamber view can be used for strain if the endocardium is clearly visualized. Note the alternative window in the report as it may affect normal range applicability." color="#ca8a04" />
                    </div>
                  </div>

                  {/* Reporting */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND }}>Reporting</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <TipCard icon={<BookOpen className="w-3.5 h-3.5" />} title="What to Report" tip="Always report: (1) GLS value with vendor/software version, (2) number of segments tracked/excluded, (3) frame rate, (4) whether contrast was used, (5) clinical context (baseline vs. follow-up, cardio-oncology, etc.). Include the bull's-eye image in the report." />
                      <TipCard icon={<ArrowRight className="w-3.5 h-3.5" />} title="Serial Comparisons" tip="For serial monitoring (cardio-oncology, HF), always compare same vendor, same software version, same view, same frame rate. A relative GLS decrease ≥ 15% from baseline is the ASE 2022 CTRCD threshold. Document the baseline value in every follow-up report." />
                    </div>
                  </div>

                </div>
              </div>
              </PremiumPearlGate>
            )}{/* end tips tab */}

            {/* ── Acquisition Views Tab ── */}
            {leftTab === "acquisition" && (
              <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b" style={{ borderColor: BRAND + "30", background: BRAND + "08" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND + "18" }}>
                      <Camera className="w-4 h-4" style={{ color: BRAND }} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Strain Acquisition Views</div>
                      <div className="text-xs text-gray-500">Probe positioning · Anatomy · Acquisition tips · Reference images</div>
                    </div>
                  </div>
                </div>
                {/* View selector — grouped by strain type */}
                <div className="px-5 pt-4 space-y-3">
                  {/* Radial & Circumferential group */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#7c3aed" }}>Radial &amp; Circumferential Strain — PSAX Views</div>
                    <div className="flex flex-wrap gap-2">
                      {STRAIN_ACQ_VIEWS.filter(v => v.strainTypes.includes("Radial")).map(v => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedAcqView(v)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={selectedAcqView.id === v.id
                            ? { background: "#7c3aed", color: "white" }
                            : { background: "#f5f3ff", color: "#7c3aed", border: "1px solid #7c3aed30" }}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Longitudinal group */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>Longitudinal Strain — Apical Views</div>
                    <div className="flex flex-wrap gap-2">
                      {STRAIN_ACQ_VIEWS.filter(v => v.strainTypes.includes("Longitudinal")).map(v => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedAcqView(v)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={selectedAcqView.id === v.id
                            ? { background: BRAND, color: "white" }
                            : { background: "#f0fbfc", color: BRAND, border: "1px solid " + BRAND + "30" }}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Admin-uploaded reference images */}
                {((selectedAcqViewMerged as any).echoImageUrl || (selectedAcqViewMerged as any).anatomyImageUrl) && (
                  <div className="border-t border-gray-100 mt-4">
                    <div className={`grid gap-0 bg-gray-950 ${ (selectedAcqViewMerged as any).echoImageUrl && (selectedAcqViewMerged as any).anatomyImageUrl ? 'grid-cols-2' : 'grid-cols-1' }`}>
                      {(selectedAcqViewMerged as any).anatomyImageUrl && (
                        <div className="flex justify-center items-center p-3 border-r border-gray-800">
                          <div className="text-center">
                            <p className="text-xs text-gray-400 mb-1.5">Anatomy Diagram</p>
                            <img src={(selectedAcqViewMerged as any).anatomyImageUrl} alt={`${selectedAcqView.name} diagram`} className="max-h-64 object-contain rounded" style={{ background: "#030712" }} />
                          </div>
                        </div>
                      )}
                      {(selectedAcqViewMerged as any).echoImageUrl && (
                        <div className="flex justify-center items-center p-3">
                          <div className="text-center">
                            <p className="text-xs text-gray-400 mb-1.5">Clinical Echo Image</p>
                            <img src={(selectedAcqViewMerged as any).echoImageUrl} alt={`${selectedAcqView.name} echo`} className="max-h-64 object-contain rounded" style={{ background: "#030712" }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* View content */}
                <div className="p-5 space-y-4">
                  <h3 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{selectedAcqView.name}</h3>
                  <div className="rounded-lg p-4" style={{ background: "#f0fbfc", border: "1px solid " + BRAND + "30" }}>
                    <div className="flex items-start gap-2 mb-1">
                      <Settings className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: BRAND }}>Probe Positioning</div>
                        <p className="text-sm text-gray-700 leading-relaxed">{selectedAcqView.probe}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg p-4" style={{ background: "#f8fffe", border: "1px solid " + BRAND + "20" }}>
                    <div className="flex items-start gap-2 mb-1">
                      <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: BRAND }}>Key Anatomy</div>
                        <p className="text-sm text-gray-700 leading-relaxed">{selectedAcqView.anatomy}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-4 h-4" style={{ color: BRAND }} />
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Acquisition Tips</span>
                    </div>
                    <div className="space-y-2">
                      {selectedAcqView.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-lg" style={{ background: "#f8fffe", border: "1px solid " + BRAND + "20" }}>
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
                          <p className="text-xs text-gray-600 leading-relaxed">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Billing Codes */}
              {selectedAcqView && (
                <div className="mt-4">
                  <BillingCodesCard billing={STRAIN_BILLING} accentColor={BRAND} />
                </div>
              )}
              </>
            )}{/* end acquisition tab */}

          </div>

          {/* ── Right Column — Bull's Eye + Curves + Summary ── */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-4">

            {/* Bull's Eye */}
            <div id="bullseye-panel" className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  17-Segment Bull's-Eye
                </h3>
                <button onClick={clearAllSegments}
                  className="text-xs font-semibold px-2 py-0.5 rounded transition-colors"
                  style={{ color: "#189aa1", background: "#189aa1" + "15" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#dc262618"; (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#189aa1" + "15"; (e.currentTarget as HTMLButtonElement).style.color = "#189aa1"; }}>
                  Clear all
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Click a segment to enter its strain value. Outer ring = basal, inner ring = apical.</p>

              <BullsEye values={segValues} onSelect={handleSegSelect} selected={selectedSeg} />

              {selectedSeg !== null && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    {selectedSegLabel} Strain (%)
                  </label>
                  <input
                    ref={segInputRef}
                    type="number" step="0.1"
                    value={segInput}
                    onChange={e => handleSegInputChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Tab" || e.key === "Enter") {
                        e.preventDefault();
                        const ids = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
                        const cur = ids.indexOf(selectedSeg ?? 1);
                        handleSegSelect(ids[(cur + 1) % ids.length]);
                      }
                    }}
                    placeholder="e.g. −18.5"
                    className="w-full bg-white border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 outline-none"
                    style={{ borderColor: "#189aa1" + "60" }}
                  />
                </div>
              )}

              {segAvg !== null && (
                <div className="mt-3 p-3 rounded-lg text-center" style={{ background: BRAND + "15" }}>
                  <div className="text-xs text-gray-500 mb-0.5">Segmental Average ({enteredSegs.length} segments)</div>
                  <div className="text-xl font-black font-mono" style={{ color: BRAND }}>{segAvg}%</div>
                </div>
              )}

              {/* Legend */}
              <div className="mt-4 space-y-1">
                {legend.map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color, border: "1px solid #cbd5e1" }} />
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Segmental Strain Curves */}
            <SegmentalStrainCurves segValues={segValues} wallMotionScores={wallMotionScores} activePattern={activePattern} />

            {/* Summary Panel */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-sm text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>
                Strain Summary
              </h3>
              <div className="space-y-3">
                {/* LV GLS */}
                <div className="rounded-lg p-4 border" style={{ background: "#f0fbfc", borderColor: BRAND + "30" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND }}>LV GLS</span>
                    <span className="text-xs text-gray-400">Normal ≤ −20%</span>
                  </div>
                  <div className="text-2xl font-black font-mono" style={{ color: lvGls ? (parseFloat(lvGls) <= -20 ? "#15803d" : parseFloat(lvGls) <= -16 ? "#ca8a04" : "#dc2626") : BRAND }}>
                    {lvGls ? `${lvGls}%` : "—"}
                  </div>
                  {lvInterp && <div className="text-xs mt-1" style={{ color: lvInterp.color }}>{lvInterp.severity}</div>}
                </div>

                {segAvg !== null && (
                  <div className="rounded-lg p-4 border" style={{ background: "#f0fbfc", borderColor: BRAND + "30" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND }}>Segmental Avg</span>
                      <span className="text-xs text-gray-400">{enteredSegs.length}/17 segs</span>
                    </div>
                    <div className="text-2xl font-black font-mono" style={{ color: BRAND }}>{segAvg}%</div>
                  </div>
                )}

                {wmsi !== null && (
                  <div className="rounded-lg p-4 border" style={{ background: "#f0fbfc", borderColor: BRAND + "30" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND }}>WMSI</span>
                      <span className="text-xs text-gray-400">Normal = 1.0</span>
                    </div>
                    <div className="text-2xl font-black font-mono" style={{ color: parseFloat(wmsi) <= 1.0 ? "#15803d" : parseFloat(wmsi) <= 1.5 ? "#ca8a04" : "#dc2626" }}>{wmsi}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Reference */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-sm text-gray-800 mb-3" style={{ fontFamily: "Merriweather, serif" }}>
                Quick Reference (ASE 2025)
              </h3>
              <div className="space-y-2 text-xs">
                {[
                  ["LV GLS Normal", "≤ −20%"],
                  ["LV GLS Mildly Reduced", "−16 to −20%"],
                  ["LV GLS Mod. Reduced", "−12 to −16%"],
                  ["LV GLS Severely Reduced", "> −12%"],
                  ["Mid-Wall GLS Normal (2025)", "≥ −17%"],
                  ["RV FW Strain Normal", "≤ −29%"],
                  ["LA Reservoir Normal", "≥ 38%"],
                  ["CTRCD Threshold (relative)", ">15% drop from baseline"],
                  ["Apical Sparing RAS", "> 1.0"],
                  ["Frame Rate (minimum)", "≥ 40 fps"],
                  ["Frame Rate (ideal)", "60–80 fps"],
                  ["WMSI Normal", "1.0"],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-gray-50">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-mono font-semibold" style={{ color: BRAND }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── References & Guidelines ── */}
      <div className="mt-6">
        <SectionCard
          title="References & Guidelines"
          subtitle="Cardio-Oncology & Strain References"
          defaultOpen={false}
          icon={<BookOpen className="w-4 h-4" style={{ color: BRAND }} />}
        >
          <div className="space-y-2">
            {[
              { ref: "ASE. Recommendations for the Standardization and Interpretation of Echocardiographic Strain. JASE 2025 (August).", url: "https://www.asecho.org/wp-content/uploads/2025/08/Strain-Guideline-AIP-August-2025.pdf" },
              { ref: "ASE/WFTF. Recommendations for Cardiac Chamber Quantification by Echocardiography in Adults. 2018 Update.", url: "https://asecho.org/wp-content/uploads/2018/08/WFTF-Chamber-Quantification-Summary-Doc-Final-July-18.pdf" },
              { ref: "Plana JC et al. Expert Consensus for Multimodality Imaging Evaluation during and after Cancer Therapy. JASE 2014;27:911–39.", url: "https://www.asecho.org" },
              { ref: "Smiseth OA et al. Myocardial strain imaging: how useful is it in clinical decision making? Eur Heart J 2016;37:1196–207.", url: "https://academic.oup.com/eurheartj" },
              { ref: "Nagueh SF et al. Recommendations for the Evaluation of Left Ventricular Diastolic Function. JASE 2016;29:277–314.", url: "https://www.asecho.org/guideline/diastolic-dysfunction/" },
            ].map(({ ref, url }) => (
              <a key={ref} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-2 p-3 rounded-lg transition-colors group" style={{ background: "#f0fbfc" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#d4f5f7")}
                onMouseLeave={e => (e.currentTarget.style.background = "#f0fbfc")}>
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-800">{ref}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-400 group-hover:text-gray-600" />
              </a>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default function StrainScanCoach() {
  const { isPremium } = usePremium();
  return (
    <Layout>
      <ScanCoachNavBar navigatorPath="/strain" navigatorLabel="Strain Navigator" />
      <StrainScanCoachInner isPremium={isPremium} />
    </Layout>
  );
}
