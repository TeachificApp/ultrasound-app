/*
  FrankStarlingGraph — Reusable interactive Frank-Starling curve component
  Shows multiple contractility curves, current operating point, and
  the effect of preload/afterload/contractility changes.
  Uses Recharts (already in project via HemodynamicsLab).
*/
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceDot, ResponsiveContainer, Legend,
} from "recharts";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface FrankStarlingParams {
  preload: number;       // 0–100 slider (maps to LVEDP 4–25 mmHg / EDV 80–200 mL)
  afterload: number;     // 0–100 slider (maps to SVR / SBP 80–200 mmHg)
  contractility: number; // 0–100 slider (Emax / inotropy)
}

interface FrankStarlingGraphProps {
  params: FrankStarlingParams;
  /** Show additional reference curves for decreased/increased contractility */
  showReferenceCurves?: boolean;
  /** Height of the chart in px */
  height?: number;
  /** Whether to show the slider controls inside the component */
  showControls?: boolean;
  onParamsChange?: (p: FrankStarlingParams) => void;
  /** Label for the x-axis (default: "Preload (LVEDP mmHg)") */
  xLabel?: string;
  /** Label for the y-axis (default: "Stroke Volume (mL)") */
  yLabel?: string;
}

// ─── MATH ─────────────────────────────────────────────────────────────────────

/**
 * Frank-Starling curve: SV = f(LVEDP) for a given contractility and afterload.
 * Based on a sigmoid-like relationship:
 *   SV = SVmax × (LVEDP^n) / (K^n + LVEDP^n) × contractilityFactor × afterloadFactor
 */
function frankStarlingCurve(
  contractilityNorm: number, // 0–100
  afterloadNorm: number,     // 0–100
  points = 40
): { lvedp: number; sv: number }[] {
  const svMax = 120; // mL at maximum preload, normal contractility, low afterload
  const k = 10;      // half-saturation LVEDP (mmHg)
  const n = 1.8;     // Hill coefficient (steepness)

  // Contractility scales SVmax: 0.3× (severely depressed) to 1.5× (hyperdynamic)
  const cFactor = 0.3 + (contractilityNorm / 100) * 1.2;
  // Afterload reduces SV: high afterload (100) reduces by ~40%
  const aFactor = 1.0 - (afterloadNorm / 100) * 0.4;

  const result: { lvedp: number; sv: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const lvedp = (i / points) * 30; // 0–30 mmHg
    const sv = svMax * cFactor * aFactor * Math.pow(lvedp, n) / (Math.pow(k, n) + Math.pow(lvedp, n));
    result.push({ lvedp: Math.round(lvedp * 10) / 10, sv: Math.round(sv * 10) / 10 });
  }
  return result;
}

/** Map slider 0–100 to LVEDP 4–25 mmHg */
function preloadToLvedp(preload: number): number {
  return 4 + (preload / 100) * 21;
}

/** Map slider 0–100 to SV via the Frank-Starling curve */
function getOperatingPoint(params: FrankStarlingParams): { lvedp: number; sv: number } {
  const lvedp = preloadToLvedp(params.preload);
  const svMax = 120;
  const k = 10;
  const n = 1.8;
  const cFactor = 0.3 + (params.contractility / 100) * 1.2;
  const aFactor = 1.0 - (params.afterload / 100) * 0.4;
  const sv = svMax * cFactor * aFactor * Math.pow(lvedp, n) / (Math.pow(k, n) + Math.pow(lvedp, n));
  return { lvedp: Math.round(lvedp * 10) / 10, sv: Math.round(sv * 10) / 10 };
}

// ─── TOOLTIP ──────────────────────────────────────────────────────────────────

function FSTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">LVEDP: {label} mmHg</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value} mL
        </p>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function FrankStarlingGraph({
  params,
  showReferenceCurves = true,
  height = 280,
  showControls = false,
  onParamsChange,
  xLabel = "Preload (LVEDP mmHg)",
  yLabel = "Stroke Volume (mL)",
}: FrankStarlingGraphProps) {
  // Current curve (active contractility + afterload)
  const currentCurve = useMemo(
    () => frankStarlingCurve(params.contractility, params.afterload),
    [params.contractility, params.afterload]
  );

  // Reference curves: decreased contractility (−30), increased contractility (+30)
  const decreasedCurve = useMemo(
    () => showReferenceCurves ? frankStarlingCurve(Math.max(0, params.contractility - 30), params.afterload) : [],
    [params.contractility, params.afterload, showReferenceCurves]
  );
  const increasedCurve = useMemo(
    () => showReferenceCurves ? frankStarlingCurve(Math.min(100, params.contractility + 30), params.afterload) : [],
    [params.contractility, params.afterload, showReferenceCurves]
  );

  // Merge all curves into one dataset keyed by lvedp
  const chartData = useMemo(() => {
    return currentCurve.map((pt, i) => ({
      lvedp: pt.lvedp,
      current: pt.sv,
      decreased: decreasedCurve[i]?.sv,
      increased: increasedCurve[i]?.sv,
    }));
  }, [currentCurve, decreasedCurve, increasedCurve]);

  const op = useMemo(() => getOperatingPoint(params), [params]);

  // Contractility label
  const contractilityLabel =
    params.contractility >= 70 ? "Hyperdynamic"
    : params.contractility >= 45 ? "Normal"
    : params.contractility >= 25 ? "Mildly Reduced"
    : "Severely Reduced";

  const afterloadLabel =
    params.afterload >= 70 ? "High Afterload"
    : params.afterload >= 40 ? "Normal Afterload"
    : "Low Afterload";

  return (
    <div className="w-full">
      {/* Clinical state badge */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{
            background: params.contractility >= 45 ? "#f0fbfc" : params.contractility >= 25 ? "#fef3c7" : "#fee2e2",
            color: params.contractility >= 45 ? "#189aa1" : params.contractility >= 25 ? "#d97706" : "#dc2626",
          }}>
          Contractility: {contractilityLabel}
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-600">
          {afterloadLabel}
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#f0fbfc] text-[#189aa1]">
          Operating Point: LVEDP {op.lvedp} mmHg → SV {op.sv} mL
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="lvedp"
            type="number"
            domain={[0, 30]}
            tickCount={7}
            label={{ value: xLabel, position: "insideBottom", offset: -18, fontSize: 11, fill: "#6b7280" }}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
          />
          <YAxis
            domain={[0, 120]}
            tickCount={7}
            label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 15, fontSize: 11, fill: "#6b7280" }}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
          />
          <Tooltip content={<FSTooltip />} />
          <Legend
            verticalAlign="top"
            iconType="line"
            wrapperStyle={{ fontSize: "11px", paddingBottom: "4px" }}
          />

          {/* Reference curves */}
          {showReferenceCurves && (
            <Line
              dataKey="decreased"
              name="↓ Contractility"
              stroke="#dc2626"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
            />
          )}
          {showReferenceCurves && (
            <Line
              dataKey="increased"
              name="↑ Contractility"
              stroke="#16a34a"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
            />
          )}

          {/* Current curve */}
          <Line
            dataKey="current"
            name="Current State"
            stroke="#189aa1"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#189aa1" }}
          />

          {/* Operating point */}
          <ReferenceLine x={op.lvedp} stroke="#189aa1" strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceLine y={op.sv} stroke="#189aa1" strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceDot
            x={op.lvedp}
            y={op.sv}
            r={6}
            fill="#189aa1"
            stroke="white"
            strokeWidth={2}
            label={{ value: `SV ${op.sv}`, position: "right", fontSize: 10, fill: "#189aa1", fontWeight: "bold" }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Optional inline controls */}
      {showControls && onParamsChange && (
        <div className="mt-4 space-y-3">
          {[
            { key: "preload" as const, label: "Preload", color: "#189aa1", unit: `→ LVEDP ${op.lvedp.toFixed(0)} mmHg` },
            { key: "afterload" as const, label: "Afterload", color: "#dc2626", unit: "" },
            { key: "contractility" as const, label: "Contractility", color: "#16a34a", unit: `(${contractilityLabel})` },
          ].map(({ key, label, color, unit }) => (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-600">{label} {unit}</span>
                <span className="font-mono font-bold" style={{ color }}>{params[key]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={params[key]}
                onChange={e => onParamsChange({ ...params, [key]: Number(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: color }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Interpretation */}
      <div className="mt-3 p-3 rounded-lg text-xs text-gray-500 bg-gray-50 border border-gray-100 leading-relaxed">
        <span className="font-semibold text-gray-600">Frank-Starling Law: </span>
        The heart adjusts its stroke volume in response to changes in preload (ventricular filling).
        {params.contractility < 30 && " Severely depressed contractility flattens the curve — further preload loading produces minimal SV gain (Starling failure)."}
        {params.contractility >= 30 && params.contractility < 50 && " Reduced contractility shifts the curve downward — the same preload generates less stroke volume."}
        {params.contractility >= 50 && params.contractility < 70 && " Normal contractility — the ascending limb of the curve allows preload augmentation to increase SV."}
        {params.contractility >= 70 && " Hyperdynamic state — steep ascending limb. SV is highly preload-responsive. Seen in sepsis, anemia, exercise, high-output states."}
        {params.afterload >= 65 && " High afterload reduces SV at any given preload — the curve shifts downward. Afterload reduction (vasodilators) can restore SV."}
      </div>
    </div>
  );
}
