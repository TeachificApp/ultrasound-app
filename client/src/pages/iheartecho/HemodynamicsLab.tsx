/*
  iHeartEcho™ -- Hemodynamics Lab
  Interactive Wiggers Diagram + PV Loop synchronized to hemodynamic sliders
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body, JetBrains Mono data
*/
import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Activity, TrendingUp, TrendingDown, Minus, RotateCcw } from "lucide-react";
import FrankStarlingGraph from "@/components/FrankStarlingGraph";
import {
  ResponsiveContainer, ComposedChart, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  Area, Legend
} from "recharts";

// ---- TYPES ----

interface Params {
  preload: number;      // 0-100 (maps to LVEDP ~5-25 mmHg, EDV ~80-200 mL)
  afterload: number;    // 0-100 (maps to SBP ~80-200 mmHg, SVR)
  contractility: number; // 0-100 (Emax, inotropy)
  heartRate: number;    // 40-140 bpm
  // Disease-specific modifiers (optional, only set by presets)
  lvaoGradient?: number;   // mmHg — LV-to-Ao systolic gradient (AS)
  pulseWidthFactor?: number; // multiplier for pulse pressure (AR: >1, MS: <1)
  lapMultiplier?: number;  // multiplier for LAP amplitude (MR: elevated v-wave)
  msInflow?: boolean;      // Mitral Stenosis: restrict LV filling, low LV pressure
  tamponade?: boolean;     // Tamponade: equalize pressures
  hcmGradient?: number;    // mmHg — dynamic LVOT gradient (HCM)
}

// ---- PHYSIOLOGY ENGINE ----

function computeHemodynamics(p: Params) {
  const { preload, afterload, contractility, heartRate } = p;

  // Map sliders to physiological values
  const edv   = 80  + preload       * 1.2;          // 80–200 mL
  const edp   = 4   + preload       * 0.21;          // 4–25 mmHg
  let sbp     = 80  + afterload     * 1.2;           // 80–200 mmHg
  let dbp     = 50  + afterload     * 0.5;           // 50–100 mmHg
  const emax  = 0.5 + contractility * 0.025;         // 0.5–3.0 mmHg/mL (Emax)
  // EF calibrated: c=20→EF~25%, c=50→EF~62%, c=90→EF~78%
  const efFrac = Math.min(0.78, Math.max(0.15, 0.004 + 0.0123 * contractility));
  const esv   = Math.round(edv * (1 - efFrac));
  const sv    = Math.max(15, edv - esv);
  const co    = (sv * heartRate) / 1000;             // L/min
  const ci    = co / 1.9;                            // assume BSA 1.9
  const ef    = Math.round((sv / edv) * 100);

  // Apply disease-specific modifiers to aortic pressure
  if (p.pulseWidthFactor !== undefined) {
    // AR: widen pulse pressure (high SBP, very low DBP)
    // MS: narrow pulse pressure (low SBP due to reduced SV)
    const pp = sbp - dbp;
    const newPP = pp * p.pulseWidthFactor;
    const mid = (sbp + dbp) / 2;
    sbp = mid + newPP / 2;
    dbp = Math.max(20, mid - newPP / 2);
  }
  if (p.tamponade) {
    // Tamponade: narrow pulse pressure, equalize diastolic pressures
    sbp = Math.min(sbp, 100);
    dbp = Math.max(dbp, sbp - 20); // very narrow pulse pressure
  }

  const esp   = sbp * 0.9;                           // ESP ~ 90% SBP
  const esP   = Math.max(40, esp);

  // Diastolic function surrogates
  const ee    = Math.max(5, Math.min(30, 8 + (preload - 50) * 0.22 + (afterload - 50) * 0.08));
  const lavi  = Math.max(20, Math.min(60, 28 + (preload - 50) * 0.32));
  const rvsp  = Math.max(20, Math.min(75, 25 + (preload - 50) * 0.35));
  const tapse = Math.max(10, Math.min(28, 22 - (preload - 50) * 0.1));

  return { edv, edp, sbp, dbp, esv, sv, co, ci, ef, esp: esP, emax, ee, lavi, rvsp, tapse, heartRate };
}

// ---- WIGGERS DIAGRAM GENERATOR ----
// Returns N time-points across one cardiac cycle with:
//   lvp  = LV pressure
//   aop  = Aortic pressure
//   lvv  = LV volume
//   ecg  = simplified ECG trace
// Valve events: MVO, MVC, AVO, AVC as time indices

function generateWiggers(p: Params, N = 200) {
  const h = computeHemodynamics(p);
  const { edv, edp, sbp, dbp, esv, sv, esp, heartRate } = h;

  // Cycle timing (fraction of RR interval)
  const rr = 60 / heartRate;            // seconds
  const isocVol  = 0.05;               // isovolumic contraction
  const ejection = 0.30;               // ejection
  const isocRel  = 0.05;               // isovolumic relaxation
  const filling   = 1 - isocVol - ejection - isocRel;  // diastolic filling

  // Phase boundaries (0–1)
  const t_mvc = 0.0;
  const t_avo = t_mvc + isocVol;
  const t_avc = t_avo + ejection;
  const t_mvo = t_avc + isocRel;
  const t_end = 1.0;

  // LAP baseline: mean LAP ~ 0.7 × LVEDP (preload-driven)
  // lapMultiplier: MR elevates v-wave (>1.5), MS elevates overall LAP (>2.0)
  const lapMult = p.lapMultiplier ?? 1.0;
  const lap_mean = Math.max(4, edp * 0.75 * Math.max(1.0, lapMult * 0.7));
  // a-wave peak ~ 1.4× mean LAP; v-wave peak ~ 1.6× mean LAP (amplified by lapMultiplier for MR)
  const lap_a_peak = lap_mean * 1.45;
  const lap_v_peak = lap_mean * (1.65 * lapMult);  // MR: giant v-wave

  const data: {
    t: number; time: number;
    lvp: number; aop: number; lvv: number; ecg: number; lap: number;
  }[] = [];

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);             // 0..1
    const time = parseFloat((t * rr * 1000).toFixed(1)); // ms

    let lvp = 0, aop = 0, lvv = 0, ecg = 0;

    // ---- LV PRESSURE ----
    // Disease modifiers applied below:
    // AS: LV pressure elevated above aortic by lvaoGradient during ejection
    // HCM: dynamic LVOT gradient added in mid-to-late ejection
    // MS: LV filling restricted, diastolic LV pressure lower than normal
    const lvaoGrad = p.lvaoGradient ?? 0;
    const hcmGrad  = p.hcmGradient  ?? 0;
    const msInflow = p.msInflow     ?? false;

    if (t < t_mvc) {
      // Late diastole / atrial kick
      const frac = t / t_mvc;
      // MS: LV fills less, so diastolic pressure is lower
      const dipFactor = msInflow ? 0.6 : 1.0;
      lvp = edp * dipFactor * (0.7 + 0.3 * Math.sin(frac * Math.PI));
    } else if (t < t_avo) {
      // Isovolumic contraction
      const frac = (t - t_mvc) / isocVol;
      // AS: LV must build higher pressure to overcome gradient before AVO
      const targetEsp = esp + lvaoGrad * 0.8;
      lvp = edp + (targetEsp - edp) * (frac * frac);
    } else if (t < t_avc) {
      // Ejection
      const frac = (t - t_avo) / ejection;
      // Base LV pressure during ejection
      const peak = (esp + lvaoGrad) * 1.05;
      lvp = (esp + lvaoGrad) + (peak - (esp + lvaoGrad)) * Math.sin(frac * Math.PI)
            - ((esp + lvaoGrad) - (esp + lvaoGrad) * 0.85) * frac;
      // HCM: add dynamic gradient in mid-late ejection (Venturi effect)
      if (hcmGrad > 0) {
        const hcmFrac = Math.max(0, (frac - 0.3) / 0.7); // ramps up mid-ejection
        lvp += hcmGrad * Math.sin(hcmFrac * Math.PI);
      }
      lvp = Math.max(edp, lvp);
    } else if (t < t_mvo) {
      // Isovolumic relaxation
      const frac = (t - t_avc) / isocRel;
      lvp = ((esp + lvaoGrad) * 0.85) * Math.exp(-frac * 4);
      lvp = Math.max(edp * 0.5, lvp);
    } else {
      // Diastolic filling
      const frac = (t - t_mvo) / (t_end - t_mvo);
      const rapid = 0.4;
      const dipFactor = msInflow ? 0.55 : 1.0; // MS: restricted inflow, lower LV diastolic pressure
      if (frac < rapid) {
        lvp = edp * dipFactor * (0.5 + 0.5 * (frac / rapid));
      } else if (frac < 0.85) {
        lvp = edp * dipFactor * (0.9 + 0.1 * ((frac - rapid) / 0.45));
      } else {
        // Atrial kick
        const af = (frac - 0.85) / 0.15;
        lvp = edp * dipFactor + edp * 0.25 * Math.sin(af * Math.PI);
      }
    }

    // ---- AORTIC PRESSURE ----
    if (t < t_avo) {
      // Diastolic run-off (Windkessel)
      const elapsed = t;
      aop = dbp + (sbp - dbp) * Math.exp(-elapsed * 3.5);
    } else if (t < t_avc) {
      // Systolic: rises with LV ejection
      const frac = (t - t_avo) / ejection;
      const peak = sbp;
      aop = dbp + (peak - dbp) * Math.sin(frac * Math.PI * 0.9 + 0.1);
      // Dicrotic notch at AVC
    } else {
      // Diastolic run-off after AVC
      const elapsed = (t - t_avc);
      const notchDip = sbp * 0.88;
      const notchWidth = 0.015;
      const inNotch = elapsed < notchWidth;
      if (inNotch) {
        aop = notchDip - (notchDip - sbp * 0.82) * (elapsed / notchWidth);
      } else {
        aop = dbp + (sbp * 0.87 - dbp) * Math.exp(-(elapsed - notchWidth) * 4.5);
      }
    }

    // ---- LV VOLUME ----
    if (t < t_mvc) {
      // Atrial kick adds volume
      const frac = t / t_mvc;
      lvv = edv - sv * 0.05 + sv * 0.05 * Math.sin(frac * Math.PI);
    } else if (t < t_avo) {
      // Isovolumic contraction — volume constant
      lvv = edv;
    } else if (t < t_avc) {
      // Ejection — volume falls
      const frac = (t - t_avo) / ejection;
      lvv = edv - sv * (0.5 - 0.5 * Math.cos(frac * Math.PI));
    } else if (t < t_mvo) {
      // Isovolumic relaxation — volume constant
      lvv = esv;
    } else {
      // Diastolic filling
      const frac = (t - t_mvo) / (t_end - t_mvo);
      const rapid = 0.4;
      if (frac < rapid) {
        lvv = esv + sv * 0.75 * (0.5 - 0.5 * Math.cos((frac / rapid) * Math.PI));
      } else {
        lvv = esv + sv * 0.75 + sv * 0.25 * (frac - rapid) / (1 - rapid);
      }
    }

    // ---- ECG ----
    // P wave, QRS, T wave
    const p_center = 0.88;
    const qrs_center = 0.02;
    const t_center = 0.18;
    const p_w = 0.04, qrs_w = 0.015, t_w = 0.06;
    const P = 0.15 * Math.exp(-0.5 * Math.pow((t - p_center) / p_w, 2));
    const Q = -0.1 * Math.exp(-0.5 * Math.pow((t - (qrs_center - 0.01)) / (qrs_w * 0.5), 2));
    const R = 1.0  * Math.exp(-0.5 * Math.pow((t - qrs_center) / (qrs_w * 0.4), 2));
    const S = -0.2 * Math.exp(-0.5 * Math.pow((t - (qrs_center + 0.012)) / (qrs_w * 0.5), 2));
    const T = 0.35 * Math.exp(-0.5 * Math.pow((t - t_center) / t_w, 2));
    ecg = P + Q + R + S + T;

    // ---- LAP (Left Atrial Pressure) ----
    // Waveform: a-wave (atrial contraction, just before MVC at t~0.88-0.0)
    //           c-wave (mitral valve bulge at MVC)
    //           x-descent (atrial relaxation, during isovolumic contraction)
    //           v-wave (venous filling during systole, peaks near AVC)
    //           y-descent (rapid emptying after MVO)
    //           diastasis (slow filling phase)
    let lap = lap_mean;

    // a-wave: centered at P-wave (~0.88 of cycle), width ~0.06
    const a_center = 0.90;  // slightly after P wave
    const a_w = 0.05;
    const a_wave = (lap_a_peak - lap_mean) * Math.exp(-0.5 * Math.pow((t - a_center) / a_w, 2));
    // Also handle wrap-around: a-wave also appears near t=0 (beginning of cycle)
    const a_wave2 = (lap_a_peak - lap_mean) * Math.exp(-0.5 * Math.pow((t - (a_center - 1.0)) / a_w, 2));

    // c-wave: small bump at MVC (t_mvc = 0.0)
    const c_center = t_mvc + 0.01;
    const c_w = 0.015;
    const c_wave = (lap_mean * 0.15) * Math.exp(-0.5 * Math.pow((t - c_center) / c_w, 2));

    // x-descent: fall during IVCT and early ejection (t_mvc to ~t_avo+0.05)
    const x_start = t_mvc + 0.01;
    const x_end = t_avo + 0.08;
    let x_descent = 0;
    if (t >= x_start && t <= x_end) {
      const xf = (t - x_start) / (x_end - x_start);
      x_descent = -(lap_mean * 0.35) * Math.sin(xf * Math.PI);
    }

    // v-wave: rises during systole (AVO to AVC), peaks near AVC
    const v_center = t_avc - 0.02;
    const v_w = 0.10;
    const v_wave = (lap_v_peak - lap_mean) * Math.exp(-0.5 * Math.pow((t - v_center) / v_w, 2));

    // y-descent: rapid fall after MVO
    const y_start = t_mvo;
    const y_end = t_mvo + 0.12;
    let y_descent = 0;
    if (t >= y_start && t <= y_end) {
      const yf = (t - y_start) / (y_end - y_start);
      y_descent = -(lap_mean * 0.45) * Math.sin(yf * Math.PI);
    }

    lap = lap_mean + a_wave + a_wave2 + c_wave + x_descent + v_wave + y_descent;
    lap = Math.max(1, parseFloat(lap.toFixed(1)));

    data.push({
      t: parseFloat(t.toFixed(4)),
      time,
      lvp: parseFloat(lvp.toFixed(1)),
      aop: parseFloat(aop.toFixed(1)),
      lvv: parseFloat(lvv.toFixed(1)),
      ecg: parseFloat(ecg.toFixed(3)),
      lap,
    });
  }

  // Valve event times (ms)
  const rr_ms = rr * 1000;
  const events = {
    mvc: parseFloat((t_mvc * rr_ms).toFixed(0)),
    avo: parseFloat((t_avo * rr_ms).toFixed(0)),
    avc: parseFloat((t_avc * rr_ms).toFixed(0)),
    mvo: parseFloat((t_mvo * rr_ms).toFixed(0)),
  };

  return { data, events, hemo: h };
}

// ---- PV LOOP GENERATOR ----
// Also returns key corner points for annotation
function generatePVLoop(p: Params, N = 200) {
  const { data } = generateWiggers(p, N);
  const points = data.map(d => ({ volume: parseFloat(d.lvv.toFixed(1)), pressure: parseFloat(d.lvp.toFixed(1)) }));

  // Find the 4 corner points by phase index
  const h = computeHemodynamics(p);
  const isocVol = 0.05;
  const ejection = 0.30;
  const isocRel = 0.05;
  const t_mvc = 0.0;
  const t_avo = t_mvc + isocVol;
  const t_avc = t_avo + ejection;
  const t_mvo = t_avc + isocRel;

  const idx = (t: number) => Math.min(N - 1, Math.round(t * (N - 1)));
  const corners = {
    mvc: points[idx(t_mvc)],
    avo: points[idx(t_avo)],
    avc: points[idx(t_avc)],
    mvo: points[idx(t_mvo)],
    // IVCT midpoint
    ivct_mid: points[idx((t_mvc + t_avo) / 2)],
    // IVRT midpoint
    ivrt_mid: points[idx((t_avc + t_mvo) / 2)],
    // Systole midpoint (mid ejection)
    sys_mid: points[idx((t_avo + t_avc) / 2)],
    // Diastole midpoint (mid filling)
    dia_mid: points[idx((t_mvo + 1.0) / 2)],
  };
  return { points, corners, hemo: h };
}

// ---- SLIDER CONTROL ----

function SliderControl({ label, value, min, max, step = 1, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; color?: string; unit?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  // Level logic
  let level: string;
  let isHigh = false;
  let isLow = false;
  if (unit === " bpm") {
    if (value < 60) { level = "Brady"; isLow = true; }
    else if (value > 100) { level = "Tachy"; isHigh = true; }
    else level = "Normal";
  } else {
    if (pct < 33) { level = "Low"; isLow = true; }
    else if (pct > 66) { level = "High"; isHigh = true; }
    else level = "Normal";
  }

  // Color scheme: teal base, red only when high
  const TEAL = "#189aa1";
  const RED  = "#dc2626";
  const AMBER = "#d97706";
  const trackColor = isHigh ? RED : isLow ? AMBER : TEAL;
  const badgeBg    = isHigh ? RED : isLow ? AMBER : TEAL;

  // Tick marks: 5 evenly spaced
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="select-none">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-gray-600">{label}</label>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tabular-nums"
            style={{ fontFamily: "JetBrains Mono, monospace", color: trackColor }}>
            {value}{unit}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ background: badgeBg }}>
            {level}
          </span>
        </div>
      </div>

      {/* Custom slider track + thumb */}
      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-gray-200" style={{ top: "50%", transform: "translateY(-50%)" }} />
        {/* Filled portion */}
        <div
          className="absolute h-2 rounded-full transition-all duration-75"
          style={{
            top: "50%", transform: "translateY(-50%)",
            left: 0,
            width: `${pct}%`,
            background: `linear-gradient(to right, ${trackColor}88, ${trackColor})`,
          }}
        />
        {/* Tick marks */}
        {ticks.map(t => (
          <div
            key={t}
            className="absolute w-px h-3 rounded-full"
            style={{
              left: `${t}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              background: t <= pct ? "rgba(255,255,255,0.6)" : "#d1d5db",
              zIndex: 1,
            }}
          />
        ))}
        {/* Native range input — transparent, sits on top for interaction */}
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-grab active:cursor-grabbing"
          style={{ zIndex: 2, height: "100%" }}
        />
        {/* Visible thumb */}
        <div
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md transition-all duration-75 pointer-events-none"
          style={{
            left: `calc(${pct}% - 10px)`,
            top: "50%",
            transform: "translateY(-50%)",
            background: trackColor,
            boxShadow: `0 1px 4px rgba(0,0,0,0.25), 0 0 0 3px ${trackColor}30`,
            zIndex: 3,
          }}
        />
      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{min}{unit}</span>
        <span className="text-gray-300">drag to adjust</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ---- CUSTOM TOOLTIP ----

function WiggersTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs"
      style={{ fontFamily: "JetBrains Mono, monospace" }}>
      <div className="text-gray-400 mb-1">{d.time} ms</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          {p.dataKey === "lvp" || p.dataKey === "aop" || p.dataKey === "lap" ? " mmHg" : p.dataKey === "lvv" ? " mL" : ""}
        </div>
      ))}
    </div>
  );
}

// ---- DOPPLER TRACING GENERATORS ----
// Each generator returns SVG path data for 2 cardiac cycles
// All velocities in m/s, rendered on a dark echo-style background

function generateMitralInflowPath(p: Params, W: number, H: number, cycles = 2): {
  path: string; eVel: number; aVel: number; eaRatio: number; pattern: string; decTime: number;
  ePeakX: number; ePeakY: number; aPeakX: number; aPeakY: number;
} {
  const { preload, afterload, contractility, heartRate } = p;
  const rr = 60 / heartRate; // seconds per beat

  // Derive E and A velocities from physiology
  // E wave: driven by LA-LV pressure gradient at MVO
  // Elevated preload → higher E; impaired relaxation (high afterload/age) → lower E, higher A
  let eVel = 0.5 + (preload - 50) * 0.012 + (contractility - 50) * 0.004;
  let aVel = 0.4 - (preload - 50) * 0.005 + (afterload - 50) * 0.006;

  // Disease-specific overrides
  if (p.msInflow) {
    // MS: prolonged deceleration, elevated E, absent or reduced A (often AF)
    eVel = 1.2 + (preload - 50) * 0.008;
    aVel = 0.3; // often in AF or reduced
  } else if (p.lapMultiplier && p.lapMultiplier > 2) {
    // MR / elevated LAP: high E, reduced A (pseudonormal or restrictive)
    eVel = Math.min(1.8, 0.9 + (p.lapMultiplier - 1) * 0.3);
    aVel = Math.max(0.1, 0.35 - (p.lapMultiplier - 1) * 0.08);
  } else if (p.tamponade) {
    // Tamponade: respiratory variation (simplified as reduced E)
    eVel = Math.max(0.3, eVel * 0.7);
    aVel = Math.max(0.2, aVel * 0.8);
  } else if (p.hcmGradient && p.hcmGradient > 30) {
    // HCM: impaired relaxation, high A wave
    eVel = Math.max(0.4, eVel * 0.75);
    aVel = Math.min(1.0, aVel * 1.6);
  }

  eVel = Math.max(0.3, Math.min(2.0, eVel));
  aVel = Math.max(0.1, Math.min(1.2, aVel));
  const eaRatio = eVel / aVel;

  // Deceleration time: shorter with elevated filling pressures
  const decTime = p.msInflow ? 350 : Math.max(100, 240 - (preload - 50) * 2.5);

  // Pattern classification
  let pattern = "Normal";
  if (p.msInflow) pattern = "Mitral Stenosis";
  else if (eaRatio < 0.8 && eVel < 0.7) pattern = "Grade I Diastolic Dysfunction";
  else if (eaRatio >= 0.8 && eaRatio <= 1.5 && eVel >= 0.7 && eVel <= 1.2) {
    if (preload > 65) pattern = "Grade II Diastolic Dysfunction";
    else pattern = "Normal";
  } else if (eaRatio > 1.5 || (eVel > 1.2 && decTime < 160)) pattern = "Restrictive (Grade III)";
  else if (eaRatio < 0.8) pattern = "Grade I Diastolic Dysfunction";

  // Generate SVG path for N cycles
  const maxVelDisplay = Math.max(eVel, aVel) * 1.25; // auto-scale to fill canvas
  const cycleW = W / cycles;
  const baseline = H * 0.92; // baseline near bottom
  const velScale = (H * 0.85) / maxVelDisplay; // pixels per m/s

  // Timing within cycle (as fraction of RR)
  // MVO at ~0.60 of cycle, MVC at ~0.02
  // E wave: 0.60–0.72 (rapid filling)
  // A wave: 0.85–0.97 (atrial kick)
  const eStart = 0.60, eEnd = 0.74;
  const aStart = 0.85, aEnd = 0.98;
  const ePeak = (eStart + eEnd) / 2 - 0.01;
  const aPeak = (aStart + aEnd) / 2;
  const decFrac = (decTime / 1000) / rr; // deceleration fraction of RR

  let d = `M 0 ${baseline}`;
  // Track peak pixel positions for accurate annotation placement
  let ePeakX = 0, ePeakY = baseline, aPeakX = 0, aPeakY = baseline;
  let ePeakVel = 0, aPeakVel = 0;

  for (let cycle = 0; cycle < cycles; cycle++) {
    const ox = cycle * cycleW;
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = ox + t * cycleW;
      let vel = 0;

      // E wave: Gaussian rise, exponential decay (deceleration)
      const eRiseW = 0.04;
      const eDecayW = Math.max(0.03, decFrac * 0.6);
      if (t >= eStart && t <= eEnd + decFrac * 0.8) {
        const tRel = t - ePeak;
        if (tRel < 0) {
          vel = eVel * Math.exp(-0.5 * Math.pow(tRel / eRiseW, 2));
        } else {
          vel = eVel * Math.exp(-tRel / eDecayW);
        }
      }

      // A wave: Gaussian
      if (t >= aStart && t <= aEnd) {
        const tRel = t - aPeak;
        const aW = 0.03;
        const aVelHere = aVel * Math.exp(-0.5 * Math.pow(tRel / aW, 2));
        vel = Math.max(vel, aVelHere);
      }

      const y = baseline - vel * velScale;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;

      // Track peaks on cycle 0 only
      if (cycle === 0) {
        if (t >= eStart && t <= eEnd + decFrac * 0.8 && vel > ePeakVel) {
          ePeakVel = vel; ePeakX = x; ePeakY = y;
        }
        if (t >= aStart && t <= aEnd) {
          const tRel = t - aPeak;
          const aW = 0.03;
          const aVelHere = aVel * Math.exp(-0.5 * Math.pow(tRel / aW, 2));
          if (aVelHere > aPeakVel) { aPeakVel = aVelHere; aPeakX = x; aPeakY = baseline - aVelHere * velScale; }
        }
      }
    }
  }

  return { path: d, eVel, aVel, eaRatio, pattern, decTime, ePeakX, ePeakY, aPeakX, aPeakY };
}

function generateTricuspidInflowPath(p: Params, W: number, H: number, cycles = 2): {
  path: string; eVel: number; aVel: number; pattern: string;
  ePeakX: number; ePeakY: number; aPeakX: number; aPeakY: number;
} {
  const { preload, afterload, heartRate } = p;

  // TV inflow: similar to MV but lower velocities (0.3–0.7 m/s)
  // RV filling: driven by RA-RV gradient
  let eVel = 0.35 + (preload - 50) * 0.006;
  let aVel = 0.25 + (afterload - 50) * 0.003;

  if (p.tamponade) {
    // Tamponade: exaggerated respiratory variation — show elevated E
    eVel = Math.min(0.8, eVel * 1.3);
  }
  if (p.lapMultiplier && p.lapMultiplier > 2) {
    // Elevated RA pressure: higher E, reduced A
    eVel = Math.min(0.9, eVel * 1.2);
    aVel = Math.max(0.1, aVel * 0.8);
  }

  eVel = Math.max(0.2, Math.min(1.0, eVel));
  aVel = Math.max(0.1, Math.min(0.6, aVel));
  const eaRatio = eVel / aVel;

  let pattern = "Normal";
  if (eaRatio < 0.8) pattern = "Impaired RV Relaxation";
  else if (eaRatio > 2.0) pattern = "Elevated RA Pressure";
  else if (p.tamponade) pattern = "Tamponade — Respiratory Variation";

  const maxVelDisplay = Math.max(eVel, aVel) * 1.25; // auto-scale to fill canvas
  const cycleW = W / cycles;
  const baseline = H * 0.92;
  const velScale = (H * 0.85) / maxVelDisplay;

  const eStart = 0.60, ePeak = 0.66, eDecayW = 0.04;
  const aStart = 0.85, aPeak = 0.91, aEnd = 0.98;

  let d = `M 0 ${baseline}`;
  let ePeakX = 0, ePeakY = baseline, aPeakX = 0, aPeakY = baseline;
  let ePeakVel = 0, aPeakVel = 0;

  for (let cycle = 0; cycle < cycles; cycle++) {
    const ox = cycle * cycleW;
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = ox + t * cycleW;
      let vel = 0;

      if (t >= eStart && t <= eStart + 0.18) {
        const tRel = t - ePeak;
        if (tRel < 0) vel = eVel * Math.exp(-0.5 * Math.pow(tRel / 0.03, 2));
        else vel = eVel * Math.exp(-tRel / eDecayW);
      }
      if (t >= aStart && t <= aEnd) {
        const tRel = t - aPeak;
        vel = Math.max(vel, aVel * Math.exp(-0.5 * Math.pow(tRel / 0.03, 2)));
      }

      const y = baseline - vel * velScale;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;

      if (cycle === 0) {
        if (t >= eStart && t <= eStart + 0.18 && vel > ePeakVel) { ePeakVel = vel; ePeakX = x; ePeakY = y; }
        if (t >= aStart && t <= aEnd) {
          const aVelHere = aVel * Math.exp(-0.5 * Math.pow((t - aPeak) / 0.03, 2));
          if (aVelHere > aPeakVel) { aPeakVel = aVelHere; aPeakX = x; aPeakY = baseline - aVelHere * velScale; }
        }
      }
    }
  }

  return { path: d, eVel, aVel, pattern, ePeakX, ePeakY, aPeakX, aPeakY };
}

function generateAVOutflowPath(p: Params, W: number, H: number, cycles = 2): {
  path: string; vmax: number; vti: number; pattern: string; shape: string;
  vmaxPeakX: number; vmaxPeakY: number;
} {
  const { preload, afterload, contractility, heartRate } = p;
  const rr = 60 / heartRate;

  // AV outflow: systolic envelope
  // Vmax driven by SV and LVOT area (simplified)
  const sv = Math.max(15, (80 + preload * 1.2) - Math.max(20, (80 + preload * 1.2) - ((80 + preload * 1.2) - 20) * (contractility / 100) * 0.75));
  let vmax = 0.8 + (sv - 50) * 0.012 + (contractility - 50) * 0.008;

  // AS: elevated Vmax, late-peaking (tardus parvus)
  let shape = "normal"; // "normal" | "tardus" | "dynamic"
  if (p.lvaoGradient && p.lvaoGradient > 20) {
    vmax = Math.min(5.5, 1.5 + p.lvaoGradient * 0.065);
    shape = "tardus"; // late-peaking, rounded
  } else if (p.hcmGradient && p.hcmGradient > 30) {
    // HCM: dagger-shaped (early peak, mid-systolic notch, late spike)
    shape = "dynamic";
    vmax = Math.min(4.5, 1.2 + p.hcmGradient * 0.055);
  } else if (p.pulseWidthFactor && p.pulseWidthFactor > 1.5) {
    // AR: increased SV → higher Vmax
    vmax = Math.min(2.5, vmax * 1.3);
  }

  vmax = Math.max(0.6, Math.min(5.5, vmax));

  // VTI approximation: area under the envelope
  const ejectionFrac = 0.30;
  const vti = vmax * ejectionFrac * rr * 0.6 * 100; // rough cm

  let pattern = "Normal";
  if (shape === "tardus") pattern = `Aortic Stenosis — Vmax ${vmax.toFixed(1)} m/s`;
  else if (shape === "dynamic") pattern = "HCM — Dynamic Outflow Obstruction";
  else if (vmax > 2.0) pattern = "Elevated Velocity";

  const maxVelDisplay = vmax * 1.2; // auto-scale so Vmax fills ~83% of canvas
  const cycleW = W / cycles;
  // AV outflow is BELOW baseline — baseline at top (8% from top), waveform goes downward
  const baseline = H * 0.08;
  const velScale = (H * 0.88) / maxVelDisplay;

  // Systolic ejection: AVO at ~0.05, AVC at ~0.35 of cycle
  const avoT = 0.05, avcT = 0.35;
  const ejW = avcT - avoT;

  let d = `M 0 ${baseline}`;
  let vmaxPeakX = 0, vmaxPeakY = baseline, vmaxPeakVel = 0;

  for (let cycle = 0; cycle < cycles; cycle++) {
    const ox = cycle * cycleW;
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = ox + t * cycleW;
      let vel = 0;

      if (t >= avoT && t <= avcT) {
        const frac = (t - avoT) / ejW;
        if (shape === "normal") {
          vel = vmax * Math.sin(frac * Math.PI);
        } else if (shape === "tardus") {
          const peakFrac = 0.65;
          if (frac < peakFrac) vel = vmax * Math.pow(frac / peakFrac, 1.5);
          else vel = vmax * Math.pow((1 - frac) / (1 - peakFrac), 1.2);
        } else if (shape === "dynamic") {
          // True dagger shape: slow initial rise, accelerates sharply in late systole,
          // peaks very late (~75-80% of ejection), then drops steeply.
          // This mimics the Venturi / SAM-induced late obstruction in HCM-LVOTO.
          const peakFrac = 0.78; // late peak
          if (frac < 0.15) {
            // Early gentle rise (pre-obstruction flow)
            vel = vmax * 0.25 * (frac / 0.15);
          } else if (frac < peakFrac) {
            // Accelerating rise — concave upward (dagger blade)
            const progress = (frac - 0.15) / (peakFrac - 0.15);
            vel = vmax * (0.25 + 0.75 * Math.pow(progress, 2.2));
          } else {
            // Steep fall after late peak
            const fallFrac = (frac - peakFrac) / (1 - peakFrac);
            vel = vmax * Math.pow(1 - fallFrac, 1.8);
          }
        }
        vel = Math.max(0, vel);
      }

      // Below baseline: y increases downward from baseline
      const y = baseline + vel * velScale;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;

      if (cycle === 0 && vel > vmaxPeakVel) { vmaxPeakVel = vel; vmaxPeakX = x; vmaxPeakY = y; }
    }
  }

  return { path: d, vmax, vti: Math.round(vti), pattern, shape, vmaxPeakX, vmaxPeakY };
}

// ---- TDI MITRAL ANNULAR PATH GENERATOR ----
// Generates septal or lateral mitral annular TDI (tissue Doppler) waveform
// Shows s', e', a' waves. Velocities in cm/s, rendered above baseline.
// Septal: e' 7-10 cm/s normal; Lateral: e' 10-15 cm/s normal
function generateTDIPath(p: Params, W: number, H: number, site: "septal" | "lateral", cycles = 2): {
  path: string;
  ePrime: number;   // cm/s
  aPrime: number;   // cm/s
  sPrime: number;   // cm/s
  eeRatio: number;  // E/e' (using mitral E)
  pattern: string;
  ePeakX: number; ePeakY: number;
  aPeakX: number; aPeakY: number;
  sPeakX: number; sPeakY: number;
} {
  const { preload, afterload, contractility, heartRate } = p;

  // Lateral annulus moves faster than septal
  const latFactor = site === "lateral" ? 1.35 : 1.0;

  // e' (early diastolic): reflects myocardial relaxation
  // Decreases with impaired relaxation (high afterload, low contractility, HCM)
  // Normal septal e' ≥ 7 cm/s, lateral e' ≥ 10 cm/s
  let ePrime = (9.0 + (contractility - 50) * 0.10 - (afterload - 50) * 0.06 - (preload - 50) * 0.02) * latFactor;
  if (p.hcmGradient && p.hcmGradient > 30) ePrime *= 0.55;  // HCM: severely impaired relaxation
  if (p.msInflow) ePrime *= 0.70;                            // MS: restricted annular motion
  if (p.tamponade) ePrime *= 0.80;
  ePrime = Math.max(2.0, Math.min(20.0, ePrime));

  // a' (late diastolic / atrial kick): increases with impaired relaxation
  let aPrime = (7.0 - (contractility - 50) * 0.04 + (afterload - 50) * 0.04 + (preload - 50) * 0.03) * latFactor;
  if (p.hcmGradient && p.hcmGradient > 30) aPrime *= 1.3;
  aPrime = Math.max(2.0, Math.min(16.0, aPrime));

  // s' (systolic): reflects LV longitudinal systolic function
  // Normal ≥ 8 cm/s; reduced with systolic dysfunction
  let sPrime = (8.0 + (contractility - 50) * 0.10 - (afterload - 50) * 0.04) * latFactor;
  if (p.hcmGradient && p.hcmGradient > 30) sPrime *= 0.75;
  sPrime = Math.max(2.0, Math.min(18.0, sPrime));

  // E/e' ratio (use mitral E from physiology engine)
  const mitralE = Math.max(0.3, Math.min(2.0, 0.5 + (p.preload - 50) * 0.012 + (p.contractility - 50) * 0.004));
  const eeRatio = (mitralE * 100) / ePrime; // E in cm/s = m/s * 100

  // Pattern interpretation
  const normalEPrime = site === "septal" ? 7.0 : 10.0;
  let pattern = "Normal";
  if (ePrime < normalEPrime) {
    if (eeRatio > 14) pattern = "Elevated Filling Pressures";
    else pattern = "Impaired Relaxation";
  } else if (eeRatio > 14) {
    pattern = "Elevated Filling Pressures";
  }

  // SVG path generation
  const maxVel = Math.max(ePrime, aPrime, sPrime) * 1.2; // cm/s, auto-scale
  const cycleW = W / cycles;
  const baseline = H * 0.50; // baseline in middle — s' above, e'/a' below
  const velScale = (H * 0.42) / maxVel; // pixels per cm/s

  // Timing (as fraction of RR):
  // s' wave: systolic, 0.05–0.35 (AVO to AVC)
  // e' wave: early diastolic, 0.40–0.58 (just after AVC, IVRT + early filling)
  // a' wave: late diastolic, 0.85–0.97 (atrial kick, just before MVC)
  const sStart = 0.05, sEnd = 0.35;
  const eStart = 0.42, eEnd = 0.60;
  const aStart = 0.85, aEnd = 0.98;
  const sPeakT = 0.20, ePeakT = 0.50, aPeakT = 0.91;

  let d = `M 0 ${baseline}`;
  let ePeakX = 0, ePeakY = baseline;
  let aPeakX = 0, aPeakY = baseline;
  let sPeakX = 0, sPeakY = baseline;
  let ePeakVel = 0, aPeakVel = 0, sPeakVel = 0;

  for (let cycle = 0; cycle < cycles; cycle++) {
    const ox = cycle * cycleW;
    const N = 300;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = ox + t * cycleW;
      let velAbove = 0; // s' (above baseline)
      let velBelow = 0; // e', a' (below baseline)

      // s' wave: Gaussian, above baseline
      if (t >= sStart && t <= sEnd) {
        const w = 0.06;
        velAbove = sPrime * Math.exp(-0.5 * Math.pow((t - sPeakT) / w, 2));
      }

      // e' wave: Gaussian, below baseline
      if (t >= eStart && t <= eEnd) {
        const w = 0.05;
        velBelow = ePrime * Math.exp(-0.5 * Math.pow((t - ePeakT) / w, 2));
      }

      // a' wave: Gaussian, below baseline
      if (t >= aStart && t <= aEnd) {
        const w = 0.025;
        const aV = aPrime * Math.exp(-0.5 * Math.pow((t - aPeakT) / w, 2));
        velBelow = Math.max(velBelow, aV);
      }

      // Net Y: above baseline = baseline - velAbove*scale; below = baseline + velBelow*scale
      const y = baseline - velAbove * velScale + velBelow * velScale;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;

      if (cycle === 0) {
        if (t >= sStart && t <= sEnd) {
          const w = 0.06;
          const v = sPrime * Math.exp(-0.5 * Math.pow((t - sPeakT) / w, 2));
          if (v > sPeakVel) { sPeakVel = v; sPeakX = x; sPeakY = baseline - v * velScale; }
        }
        if (t >= eStart && t <= eEnd) {
          const w = 0.05;
          const v = ePrime * Math.exp(-0.5 * Math.pow((t - ePeakT) / w, 2));
          if (v > ePeakVel) { ePeakVel = v; ePeakX = x; ePeakY = baseline + v * velScale; }
        }
        if (t >= aStart && t <= aEnd) {
          const w = 0.025;
          const v = aPrime * Math.exp(-0.5 * Math.pow((t - aPeakT) / w, 2));
          if (v > aPeakVel) { aPeakVel = v; aPeakX = x; aPeakY = baseline + v * velScale; }
        }
      }
    }
  }

  return { path: d, ePrime, aPrime, sPrime, eeRatio, pattern, ePeakX, ePeakY, aPeakX, aPeakY, sPeakX, sPeakY };
}

// ---- DOPPLER DISPLAY COMPONENT ----

function DopplerTracing({
  title, subtitle, pathData, color, annotations, W = 520, H = 240, belowBaseline = false, scaleMax = 2.0, cycles = 2, noFill = false, baselineRatio, yAxisLabel = "m/s"
}: {
  title: string;
  subtitle: string;
  pathData: string;
  color: string;
  annotations: { x: number; y: number; label: string; sub?: string }[];
  W?: number;
  H?: number;
  belowBaseline?: boolean;
  scaleMax?: number; // m/s full-scale
  cycles?: number;
  noFill?: boolean;
  baselineRatio?: number; // override baseline Y position as fraction of H (e.g. 0.5 for TDI)
  yAxisLabel?: string;
}) {
  // Layout constants — left margin for Y-axis labels
  const MARGIN_LEFT = 38;
  const plotW = W - MARGIN_LEFT;
  const baselineY = baselineRatio !== undefined ? H * baselineRatio : (belowBaseline ? H * 0.07 : H * 0.93);
  const fillClose = belowBaseline
    ? ` L ${MARGIN_LEFT + plotW} ${baselineY} L ${MARGIN_LEFT} ${baselineY} Z`
    : ` L ${MARGIN_LEFT + plotW} ${baselineY} L ${MARGIN_LEFT} ${baselineY} Z`;

  // Y-axis scale ticks: 0, 0.5, 1.0, 1.5, 2.0 (or up to scaleMax)
  const tickStep = scaleMax <= 2.0 ? 0.5 : scaleMax <= 4.0 ? 1.0 : 1.0;
  const ticks: number[] = [];
  for (let v = tickStep; v <= scaleMax + 0.01; v += tickStep) ticks.push(parseFloat(v.toFixed(1)));

  // Map velocity (m/s) to Y coordinate
  const velToY = (v: number) => {
    const plotH = H * 0.86;
    if (belowBaseline) {
      // baseline near top, waveform goes downward
      return baselineY + (v / scaleMax) * plotH;
    } else {
      // baseline near bottom, waveform goes upward
      return baselineY - (v / scaleMax) * plotH;
    }
  };

  return (
    <div className="bg-[#060e1f] rounded-xl overflow-hidden border border-[#1a3a5c]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a3a5c] gap-2">
        <span className="text-xs font-bold text-white whitespace-nowrap" style={{ fontFamily: "Merriweather, serif" }}>{title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: color + "40", color }}>{subtitle}</span>
      </div>
      {/* SVG canvas */}
      <div className="relative" style={{ background: "#060e1f" }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
          <defs>
            <linearGradient id={`wfill-${title.replace(/\s/g,"")}`} x1="0" y1="0" x2="0" y2="1">
              {belowBaseline
                ? <>
                    <stop offset="0%" stopColor={color} stopOpacity={0} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.35} />
                  </>
                : <>
                    <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                  </>
              }
            </linearGradient>
          </defs>

          {/* ── Y-axis background panel ── */}
          <rect x={0} y={0} width={MARGIN_LEFT} height={H} fill="#040b18" />
          {/* Y-axis label */}
          <text
            x={10} y={H / 2}
            fill="#4ad9e0" fontSize={8} fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
            transform={`rotate(-90, 10, ${H / 2})`}
          >{yAxisLabel}</text>

          {/* ── Velocity tick marks and grid lines ── */}
          {ticks.map(v => {
            const y = velToY(v);
            return (
              <g key={v}>
                {/* Horizontal grid line across plot area */}
                <line x1={MARGIN_LEFT} y1={y} x2={W} y2={y}
                  stroke="#1e3f6a" strokeWidth={0.8} strokeDasharray="5 4" />
                {/* Tick mark on Y-axis */}
                <line x1={MARGIN_LEFT - 4} y1={y} x2={MARGIN_LEFT} y2={y}
                  stroke="#3a6fa8" strokeWidth={1} />
                {/* Velocity label */}
                <text x={MARGIN_LEFT - 6} y={y + 3.5}
                  fill="#5a8fbf" fontSize={9} fontFamily="JetBrains Mono, monospace"
                  textAnchor="end">{v.toFixed(1)}</text>
              </g>
            );
          })}

          {/* ── Background scan lines ── */}
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1={MARGIN_LEFT} y1={H * (i / 10)} x2={W} y2={H * (i / 10)}
              stroke="#0d1f3c" strokeWidth={0.4} />
          ))}

          {/* ── Cycle dividers ── */}
          {Array.from({ length: cycles - 1 }, (_, i) => (
            <line key={i}
              x1={MARGIN_LEFT + plotW * ((i + 1) / cycles)} y1={0}
              x2={MARGIN_LEFT + plotW * ((i + 1) / cycles)} y2={H}
              stroke="#1e3f6a" strokeWidth={1} strokeDasharray="3 5" />
          ))}

          {/* ── Baseline ── */}
          <line x1={MARGIN_LEFT} y1={baselineY} x2={W} y2={baselineY}
            stroke="#6ab0d4" strokeWidth={2} />
          {/* Baseline "0" label */}
          <text x={MARGIN_LEFT - 6} y={baselineY + 3.5}
            fill="#6ab0d4" fontSize={9} fontFamily="JetBrains Mono, monospace"
            textAnchor="end">0</text>

          {/* ── Y-axis vertical line ── */}
          <line x1={MARGIN_LEFT} y1={0} x2={MARGIN_LEFT} y2={H}
            stroke="#2a4f7a" strokeWidth={1} />

          {/* ── Waveform fill ── */}
          {!noFill && (
            <path d={pathData + fillClose}
              fill={`url(#wfill-${title.replace(/\s/g,"")})`} stroke="none" />
          )}
          {/* ── Waveform stroke ── */}
          <path d={pathData} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

          {/* ── Annotations ── */}
          {annotations.map((a, i) => (
            <g key={i}>
              <line x1={a.x} y1={a.y}
                x2={a.x} y2={baselineY}
                stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
              <circle cx={a.x} cy={a.y} r={4} fill={color} opacity={1} />
              <circle cx={a.x} cy={a.y} r={6.5} fill={color} opacity={0.2} />
              <text x={a.x + 7} y={belowBaseline ? a.y + 13 : a.y - 7}
                fill="white" fontSize={10} fontFamily="JetBrains Mono, monospace" fontWeight="bold">{a.label}</text>
              {a.sub && <text x={a.x + 7} y={belowBaseline ? a.y + 24 : a.y + 6}
                fill={color} fontSize={9} fontFamily="JetBrains Mono, monospace">{a.sub}</text>}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ---- MAIN COMPONENT ----

const PRESETS: { label: string; values: Params; color: string }[] = [
  { label: "Normal",
    values: { preload: 50, afterload: 50, contractility: 50, heartRate: 70 },
    color: "#16a34a" },       // green — normal only
  { label: "HTN / Pressure Overload",
    values: { preload: 50, afterload: 80, contractility: 60, heartRate: 72 },
    color: "#0e9aa7" },       // teal
  { label: "Dilated CMP (DCM)",
    values: { preload: 70, afterload: 55, contractility: 20, heartRate: 95 },
    color: "#dc2626" },       // red — critical/severe dysfunction
  { label: "Volume Overload",
    values: { preload: 82, afterload: 40, contractility: 65, heartRate: 78, pulseWidthFactor: 1.3 },
    color: "#189aa1" },       // teal-mid
  { label: "Hypovolemic Shock",
    values: { preload: 15, afterload: 75, contractility: 55, heartRate: 118 },
    color: "#dc2626" },       // red — shock
  { label: "Tamponade",
    values: { preload: 25, afterload: 60, contractility: 45, heartRate: 110, tamponade: true },
    color: "#dc2626" },       // red — critical
  { label: "HCM (Obstructive)",
    values: { preload: 40, afterload: 80, contractility: 90, heartRate: 80, hcmGradient: 60 },
    color: "#0e9aa7" },       // teal
  { label: "Septic Shock",
    values: { preload: 30, afterload: 20, contractility: 55, heartRate: 120 },
    color: "#dc2626" },       // red — shock
  // Valvular disease presets
  { label: "Aortic Stenosis (Severe)",
    values: { preload: 55, afterload: 88, contractility: 65, heartRate: 68, lvaoGradient: 60 },
    color: "#0e9aa7" },       // teal
  { label: "Aortic Regurgitation",
    values: { preload: 85, afterload: 38, contractility: 62, heartRate: 75, pulseWidthFactor: 2.2 },
    color: "#22d3ee" },       // aqua
  { label: "Mitral Stenosis (Severe)",
    values: { preload: 72, afterload: 45, contractility: 58, heartRate: 85, lapMultiplier: 2.5, msInflow: true },
    color: "#189aa1" },       // teal-mid
  { label: "Mitral Regurgitation",
    values: { preload: 78, afterload: 42, contractility: 60, heartRate: 80, lapMultiplier: 2.8 },
    color: "#22d3ee" },       // aqua
];

function getClinicalContext(p: Params): { title: string; description: string; color: string } {
  const { preload, afterload, contractility, heartRate } = p;
  // Valvular disease patterns (checked before generic patterns)
  if (afterload >= 85 && preload >= 50 && preload <= 62 && contractility >= 60 && contractility <= 70 && heartRate <= 72)
    return { title: "Aortic Stenosis (Severe)", description: "Fixed high afterload from outflow obstruction. LV compensates with concentric LVH and elevated LVEDP. Slow-rising, low-amplitude pulse. Expect preserved EF until late decompensation. AVA <1.0 cm², Vmax >4 m/s.", color: "#d97706" };
  if (preload >= 82 && afterload <= 42 && contractility >= 58 && heartRate >= 72 && heartRate <= 78)
    return { title: "Aortic Regurgitation (Chronic)", description: "Volume overload from diastolic regurgitation. Eccentric LVH with large EDV and wide pulse pressure. Bounding pulse. Diastolic flow reversal in descending aorta. EF may be preserved until late.", color: "#189aa1" };
  if (preload >= 68 && preload <= 76 && afterload >= 42 && afterload <= 48 && heartRate >= 82 && heartRate <= 88)
    return { title: "Mitral Stenosis (Severe)", description: "Fixed inflow obstruction elevates LA pressure and limits LV filling. Low EDV, reduced SV. LA dilation, risk of AF and pulmonary hypertension. MVA <1.0 cm², mean gradient >10 mmHg.", color: "#189aa1" };
  if (preload >= 75 && afterload <= 45 && contractility >= 57 && contractility <= 63 && heartRate >= 77 && heartRate <= 83)
    return { title: "Mitral Regurgitation (Chronic)", description: "Volume overload from systolic regurgitation into LA. Elevated preload, reduced effective forward SV. LA and LV dilation. EF appears falsely preserved due to low-resistance regurgitant pathway.", color: "#dc2626" };
  // Generic patterns
  if (contractility < 25 && preload > 60) return { title: "Decompensated Heart Failure", description: "Severely reduced contractility with elevated filling pressures. Dilated, poorly contracting LV. Expect low EF, elevated E/e', pulmonary congestion.", color: "#dc2626" };
  if (afterload > 75 && contractility > 55) return { title: "Pressure Overload — Compensated", description: "High SVR/afterload with preserved EF. LVH present. Seen in hypertension, aortic stenosis.", color: "#d97706" };
  if (preload > 75 && contractility > 55) return { title: "Volume Overload — High Output", description: "Elevated EDV with preserved contractility. Seen in AR, MR, ASD, high-output states.", color: "#189aa1" };
  if (contractility < 30) return { title: "Cardiomyopathy Pattern", description: "Severely reduced contractility. Dilated LV, low EF, elevated filling pressures.", color: "#dc2626" };
  if (preload < 25 && heartRate > 100) return { title: "Hypovolemia / Shock", description: "Low preload with compensatory tachycardia. Reduced SV and CO. Underfilled LV.", color: "#dc2626" };
  if (afterload < 25 && heartRate > 100) return { title: "Vasodilatory / Distributive Shock", description: "Low SVR with compensatory tachycardia. High CO but poor perfusion pressure.", color: "#dc2626" };
  return { title: "Normal Hemodynamics", description: "Balanced preload, afterload, and contractility. Normal cardiac output and filling pressures.", color: "#16a34a" };
}

export default function HemodynamicsLab() {
  const [params, setParams] = useState<Params>({ preload: 50, afterload: 50, contractility: 50, heartRate: 70 });
  const set = (key: keyof Params) => (v: number) => setParams(p => ({ ...p, [key]: v }));

  const { data: wiggersData, events, hemo } = useMemo(() => generateWiggers(params), [params]);
  const pvLoopResult = useMemo(() => generatePVLoop(params), [params]);
  const pvData = pvLoopResult.points;
  const pvCorners = pvLoopResult.corners;
  const context = getClinicalContext(params);

  const rr_ms = Math.round((60 / params.heartRate) * 1000);

  // Doppler tracing data — computed once per params change
  // On desktop the Dopplers are in a narrow right column, so we use a smaller canvas
  const W_DOPPLER = 520, H_DOPPLER = 180;
  const dopplerScale = 2.0; // fixed display scale — waveforms fill the full canvas height
  const mitralData = useMemo(() => generateMitralInflowPath(params, W_DOPPLER, H_DOPPLER), [params]);
  const tricuspidData = useMemo(() => generateTricuspidInflowPath(params, W_DOPPLER, H_DOPPLER), [params]);
  const avOutflowData = useMemo(() => generateAVOutflowPath(params, W_DOPPLER, H_DOPPLER), [params]);
  const tdiSeptalData = useMemo(() => generateTDIPath(params, W_DOPPLER, H_DOPPLER, "septal"), [params]);
  const tdiLateralData = useMemo(() => generateTDIPath(params, W_DOPPLER, H_DOPPLER, "lateral"), [params]);
  const avOutflow3CycleData = useMemo(() => generateAVOutflowPath(params, W_DOPPLER * 2, H_DOPPLER, 3), [params]);

  // Annotation positions — use exact peak pixel coordinates returned by path generators
  // This guarantees dots land precisely on the waveform peaks regardless of scale
  const mitralAnnotations = [
    { x: mitralData.ePeakX, y: mitralData.ePeakY, label: `E ${mitralData.eVel.toFixed(2)} m/s` },
    { x: mitralData.aPeakX, y: mitralData.aPeakY, label: `A ${mitralData.aVel.toFixed(2)} m/s`, sub: `E/A ${mitralData.eaRatio.toFixed(1)}` },
  ];
  const tricuspidAnnotations = [
    { x: tricuspidData.ePeakX, y: tricuspidData.ePeakY, label: `E ${tricuspidData.eVel.toFixed(2)} m/s` },
    { x: tricuspidData.aPeakX, y: tricuspidData.aPeakY, label: `A ${tricuspidData.aVel.toFixed(2)} m/s` },
  ];
  const avAnnotations = [
    { x: avOutflowData.vmaxPeakX, y: avOutflowData.vmaxPeakY, label: `Vmax ${avOutflowData.vmax.toFixed(1)} m/s`, sub: `VTI ~${avOutflowData.vti} cm` },
  ];
  const tdiSeptalAnnotations = [
    { x: tdiSeptalData.sPeakX, y: tdiSeptalData.sPeakY, label: `s' ${tdiSeptalData.sPrime.toFixed(1)}` },
    { x: tdiSeptalData.ePeakX, y: tdiSeptalData.ePeakY, label: `e' ${tdiSeptalData.ePrime.toFixed(1)}` },
    { x: tdiSeptalData.aPeakX, y: tdiSeptalData.aPeakY, label: `a' ${tdiSeptalData.aPrime.toFixed(1)}` },
  ];
  const tdiLateralAnnotations = [
    { x: tdiLateralData.sPeakX, y: tdiLateralData.sPeakY, label: `s' ${tdiLateralData.sPrime.toFixed(1)}` },
    { x: tdiLateralData.ePeakX, y: tdiLateralData.ePeakY, label: `e' ${tdiLateralData.ePrime.toFixed(1)}` },
    { x: tdiLateralData.aPeakX, y: tdiLateralData.aPeakY, label: `a' ${tdiLateralData.aPrime.toFixed(1)}` },
  ];
  const eeAvg = ((tdiSeptalData.eeRatio + tdiLateralData.eeRatio) / 2);

  return (
    <Layout>
      {/* Hero Banner */}
      <div className="relative overflow-hidden" style={{ minHeight: 200 }}>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/TabletBanner_d473359b.png')`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(14,30,46,0.88) 0%, rgba(14,74,80,0.65) 55%, rgba(14,74,80,0.15) 100%)" }}
        />
        <div className="relative container py-8 md:py-10">
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-1" style={{ fontFamily: "Merriweather, serif" }}>
            Hemodynamics Lab
          </h1>
          <p className="text-[#4ad9e0] font-semibold text-sm mt-0.5">Interactive Cardiac Physiology Simulator</p>
          <p className="text-white/70 text-sm mt-2 max-w-xl leading-relaxed">
            Adjust preload, afterload, contractility, and heart rate. The Wiggers diagram and PV loop update in real time with synchronized valve events.
          </p>
        </div>
      </div>
      <div className="container py-6">
        {/* Disease States — full-width top row on desktop */}
        <div className="mb-4 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="teal-header px-4 py-2">
            <h3 className="font-bold text-xs text-white" style={{ fontFamily: "Merriweather, serif" }}>Disease States</h3>
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button key={preset.label} onClick={() => setParams(preset.values)}
                className="px-3 py-1.5 rounded-lg border text-left transition-all hover:shadow-sm active:scale-95"
                style={{ borderColor: preset.color + "40", background: preset.color + "08" }}>
                <div className="text-[11px] font-bold" style={{ color: preset.color, fontFamily: "Merriweather, serif" }}>{preset.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: 3-column layout — controls | wiggers | doppler. Mobile: single column stack */}
        <div className="grid grid-cols-1 xl:grid-cols-[420px_380px_1fr] gap-4">

          {/* ---- CONTROLS ---- */}
          <div className="xl:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
              <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                <Activity className="w-4 h-4" style={{ color: "#189aa1" }} />
                Hemodynamic Controls
              </h3>
              <SliderControl label="Preload (LVEDP / EDV)" value={params.preload} min={0} max={100}
                onChange={set("preload")} color="#189aa1" />
              <SliderControl label="Afterload (SVR / SBP)" value={params.afterload} min={0} max={100}
                onChange={set("afterload")} color="#dc2626" />
              <SliderControl label="Contractility (Emax)" value={params.contractility} min={0} max={100}
                onChange={set("contractility")} color="#16a34a" />
              <SliderControl label="Heart Rate" value={params.heartRate} min={40} max={140}
                onChange={set("heartRate")} color="#189aa1" unit=" bpm" />

              <button onClick={() => setParams({ preload: 50, afterload: 50, contractility: 50, heartRate: 70 })}
                className="w-full py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1] transition-all flex items-center justify-center gap-1.5">
                <RotateCcw className="w-3 h-3" /> Reset to Normal
              </button>

              <div className="p-3 rounded-lg border" style={{ borderColor: context.color + "40", background: context.color + "08" }}>
                <div className="font-bold text-xs mb-1" style={{ color: context.color, fontFamily: "Merriweather, serif" }}>
                  {context.title}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{context.description}</p>
              </div>
            </div>

            {/* Derived Hemodynamics */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="teal-header px-4 py-2.5">
                <h3 className="font-bold text-xs text-white" style={{ fontFamily: "Merriweather, serif" }}>Derived Values</h3>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {[
                  { label: "EDV", value: `${Math.round(hemo.edv)} mL`, normal: "80–150" },
                  { label: "ESV", value: `${Math.round(hemo.esv)} mL`, normal: "20–60" },
                  { label: "SV", value: `${Math.round(hemo.sv)} mL`, normal: "60–100" },
                  { label: "EF", value: `${hemo.ef}%`, normal: "≥55%" },
                  { label: "CO", value: `${hemo.co.toFixed(1)} L/min`, normal: "4–8" },
                  { label: "CI", value: `${hemo.ci.toFixed(1)} L/min/m²`, normal: ">2.2" },
                  { label: "SBP", value: `${Math.round(hemo.sbp)} mmHg`, normal: "100–140" },
                  { label: "DBP", value: `${Math.round(hemo.dbp)} mmHg`, normal: "60–90" },
                  { label: "E/e'", value: hemo.ee.toFixed(1), normal: "<14" },
                  { label: "LAVI", value: `${Math.round(hemo.lavi)} mL/m²`, normal: "<34" },
                  { label: "RVSP", value: `${Math.round(hemo.rvsp)} mmHg`, normal: "<35" },
                  { label: "TAPSE", value: `${Math.round(hemo.tapse)} mm`, normal: "≥17" },
                ].map(item => {
                  const isAbnormal =
                    (item.label === "EF" && hemo.ef < 55) ||
                    (item.label === "E/e'" && hemo.ee > 14) ||
                    (item.label === "LAVI" && hemo.lavi > 34) ||
                    (item.label === "RVSP" && hemo.rvsp > 35) ||
                    (item.label === "TAPSE" && hemo.tapse < 17) ||
                    (item.label === "CO" && (hemo.co < 4 || hemo.co > 8)) ||
                    (item.label === "CI" && hemo.ci < 2.2);
                  return (
                    <div key={item.label} className={`p-2 rounded-lg border text-xs ${isAbnormal ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50"}`}>
                      <div className="text-gray-400 text-[10px]">{item.label}</div>
                      <div className="font-bold" style={{ fontFamily: "JetBrains Mono, monospace", color: isAbnormal ? "#dc2626" : "#189aa1" }}>
                        {item.value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---- WIGGERS + PV LOOP ---- */}
          <div className="xl:col-span-1 space-y-3">

            {/* Valve event legend */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                <span className="font-bold text-gray-600" style={{ fontFamily: "Merriweather, serif" }}>Valve Events:</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block bg-teal-100 border-dashed border border-teal-300"></span>
                  <span className="font-semibold text-teal-600">MVC</span>
                  <span className="text-gray-400">Mitral Valve Closes ({events.mvc} ms)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block bg-red-500"></span>
                  <span className="font-semibold text-red-600">AVO</span>
                  <span className="text-gray-400">Aortic Valve Opens ({events.avo} ms)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block bg-amber-50"></span>
                  <span className="font-semibold text-amber-600">AVC</span>
                  <span className="text-gray-400">Aortic Valve Closes ({events.avc} ms)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block bg-green-500 border-dashed border border-green-500"></span>
                  <span className="font-semibold text-green-600">MVO</span>
                  <span className="text-gray-400">Mitral Valve Opens ({events.mvo} ms)</span>
                </span>
                <span className="ml-auto text-gray-400">RR: {rr_ms} ms ({params.heartRate} bpm)</span>
              </div>
            </div>

            {/* ---- Unified Wiggers Card: classic order Pressure → Volume → ECG ---- */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

              {/* 1. PRESSURE sub-panel — tallest, top */}
              <div className="px-3 pt-2 pb-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-bold text-gray-700 text-xs" style={{ fontFamily: "Merriweather, serif" }}>Pressure (mmHg)</h3>
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-[#189aa1]"></span> LV</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-[#9333ea]"></span> Ao</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-[#ec4899] opacity-80"></span> LA</span>
                  </div>
                </div>
              </div>
              <div className="px-3 pb-0">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={wiggersData} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" type="number" domain={[0, rr_ms]} hide />
                  <YAxis
                    width={50}
                    tick={{ fontSize: 9 }}
                    domain={[0, Math.max(250, Math.round(hemo.sbp + (params.lvaoGradient ?? 0) + 20))]}
                  />
                  <Tooltip content={<WiggersTooltip />} />
                  <ReferenceLine x={events.mvc} stroke="#189aa1" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "MVC", position: "top", fontSize: 8, fill: "#189aa1" }} />
                  <ReferenceLine x={events.avo} stroke="#dc2626" strokeWidth={1.5} label={{ value: "AVO", position: "top", fontSize: 8, fill: "#dc2626" }} />
                  <ReferenceLine x={events.avc} stroke="#d97706" strokeWidth={1.5} label={{ value: "AVC", position: "top", fontSize: 8, fill: "#d97706" }} />
                  <ReferenceLine x={events.mvo} stroke="#16a34a" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "MVO", position: "top", fontSize: 8, fill: "#16a34a" }} />
                  <Area type="monotone" dataKey="aop" stroke="#9333ea" fill="#e9d5ff" fillOpacity={0.25} strokeWidth={2.5} dot={false} name="Aortic Pressure" />
                  <Line type="monotone" dataKey="lvp" stroke="#189aa1" strokeWidth={2.5} dot={false} name="LV Pressure" />
                  <Line type="monotone" dataKey="lap" stroke="#ec4899" strokeWidth={1.8} strokeDasharray="5 2" dot={false} name="LA Pressure" />
                </ComposedChart>
              </ResponsiveContainer>
              </div>

              {/* 2. VOLUME sub-panel — medium */}
              <div className="px-3 pt-1 pb-0 border-t border-gray-100">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-bold text-gray-700 text-xs" style={{ fontFamily: "Merriweather, serif" }}>Volume (mL)</h3>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span>EDV <b style={{ color: "#189aa1" }}>{Math.round(hemo.edv)}</b></span>
                    <span>ESV <b style={{ color: "#189aa1" }}>{Math.round(hemo.esv)}</b></span>
                    <span>SV <b style={{ color: "#189aa1" }}>{Math.round(hemo.sv)}</b></span>
                  </div>
                </div>
              </div>
              <div className="px-3 pb-0">
              <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={wiggersData} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" type="number" domain={[0, rr_ms]} hide />
                  <YAxis width={50} tick={{ fontSize: 9 }} />
                  <Tooltip content={<WiggersTooltip />} />
                  <ReferenceLine x={events.mvc} stroke="#189aa1" strokeDasharray="4 3" strokeWidth={1.5} />
                  <ReferenceLine x={events.avo} stroke="#dc2626" strokeWidth={1.5} />
                  <ReferenceLine x={events.avc} stroke="#d97706" strokeWidth={1.5} />
                  <ReferenceLine x={events.mvo} stroke="#16a34a" strokeDasharray="4 3" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="lvv" stroke="#4ad9e0" fill="#e0f9fa" fillOpacity={0.5} strokeWidth={2.5} dot={false} name="LV Volume" />
                </ComposedChart>
              </ResponsiveContainer>
              </div>

              {/* 3. ECG sub-panel — short strip at bottom */}
              <div className="px-3 pt-1 pb-0 border-t border-gray-100">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-bold text-gray-700 text-xs" style={{ fontFamily: "Merriweather, serif" }}>ECG <span className="font-normal text-gray-400 text-[10px] ml-1">Lead II</span></h3>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span><b className="text-teal-600">P</b></span>
                    <span><b className="text-red-600">QRS</b></span>
                    <span><b className="text-amber-600">T</b></span>
                  </div>
                </div>
              </div>
              <div className="px-3 pb-2">
              <ResponsiveContainer width="100%" height={100}>
                <ComposedChart data={wiggersData} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                  <XAxis dataKey="time" type="number" domain={[0, rr_ms]} hide />
                  {/* Same YAxis width/axisLine as Pressure & Volume for pixel-perfect alignment */}
                  <YAxis domain={[-0.4, 1.4]} width={50}
                    tick={false}
                    axisLine={{ stroke: '#f0f0f0', strokeWidth: 1 }}
                    tickLine={false}
                  />
                  <ReferenceLine x={events.mvc} stroke="#189aa1" strokeDasharray="4 3" strokeWidth={1.5} />
                  <ReferenceLine x={events.avo} stroke="#dc2626" strokeWidth={1.5} />
                  <ReferenceLine x={events.avc} stroke="#d97706" strokeWidth={1.5} />
                  <ReferenceLine x={events.mvo} stroke="#16a34a" strokeDasharray="4 3" strokeWidth={1.5} />
                  <ReferenceLine x={Math.round(0.88 * rr_ms)} stroke="transparent" label={{ value: "P", position: "top", fontSize: 9, fill: "#189aa1", fontWeight: 700 }} />
                  <ReferenceLine x={Math.round(0.02 * rr_ms)} stroke="transparent" label={{ value: "QRS", position: "top", fontSize: 9, fill: "#dc2626", fontWeight: 700 }} />
                  <ReferenceLine x={Math.round(0.18 * rr_ms)} stroke="transparent" label={{ value: "T", position: "top", fontSize: 9, fill: "#d97706", fontWeight: 700 }} />
                  <Line type="monotone" dataKey="ecg" stroke="#be185d" strokeWidth={2} dot={false} name="ECG" />
                </ComposedChart>
              </ResponsiveContainer>
              {/* ECG interval summary */}
              <div className="py-1 flex flex-wrap gap-3 text-[10px] text-gray-400">
                <span><b className="text-teal-600">PR:</b> {Math.round((0.02 - 0.88 + 1) * rr_ms)} ms</span>
                <span><b className="text-red-600">QRS:</b> ~{Math.round(0.03 * rr_ms)} ms</span>
                <span><b className="text-amber-600">QT:</b> {Math.round(0.40 * rr_ms)} ms</span>
                <span><b className="text-gray-400">RR:</b> {rr_ms} ms · {params.heartRate} bpm</span>
              </div>
              </div>
            </div>{/* end unified Wiggers card */}

            {/* PV Loop */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-700 text-xs" style={{ fontFamily: "Merriweather, serif" }}>Pressure-Volume Loop</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>EF: <b style={{ color: hemo.ef < 40 ? "#dc2626" : hemo.ef < 55 ? "#d97706" : "#16a34a" }}>{hemo.ef}%</b></span>
                  <span>Emax: <b style={{ color: "#189aa1" }}>{hemo.emax.toFixed(2)} mmHg/mL</b></span>
                </div>
              </div>
              {/* PV Loop phase legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#189aa120" }}></span><span className="text-teal-600 font-semibold">IVCT</span></span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#dc262620" }}></span><span className="text-red-600 font-semibold">Systole / Ejection</span></span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#d9770620" }}></span><span className="text-amber-600 font-semibold">IVRT</span></span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#16a34a20" }}></span><span className="text-green-600 font-semibold">Diastole / Filling</span></span>
              </div>
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={pvData} margin={{ top: 20, right: 50, bottom: 20, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="volume" type="number" domain={["auto", "auto"]} tick={{ fontSize: 9 }}
                      label={{ value: "Volume (mL)", position: "insideBottom", offset: -8, fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }}
                      label={{ value: "Pressure (mmHg)", angle: -90, position: "insideLeft", fontSize: 9, offset: 10 }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}`, ""]} />
                    {/* Corner marker dots */}
                    {pvCorners.mvc && (
                      <ReferenceLine x={pvCorners.mvc.volume} stroke="#189aa1" strokeDasharray="3 3" strokeWidth={1}
                        label={{ value: "MVC", position: "insideTopLeft", fontSize: 8, fill: "#189aa1", fontWeight: 700 }} />
                    )}
                    {pvCorners.avo && (
                      <ReferenceLine x={pvCorners.avo.volume} stroke="#dc2626" strokeWidth={1.5}
                        label={{ value: "AVO", position: "insideTopLeft", fontSize: 8, fill: "#dc2626", fontWeight: 700 }} />
                    )}
                    {pvCorners.avc && (
                      <ReferenceLine x={pvCorners.avc.volume} stroke="#d97706" strokeWidth={1.5}
                        label={{ value: "AVC", position: "insideTopRight", fontSize: 8, fill: "#d97706", fontWeight: 700 }} />
                    )}
                    {pvCorners.mvo && (
                      <ReferenceLine x={pvCorners.mvo.volume} stroke="#16a34a" strokeDasharray="3 3" strokeWidth={1}
                        label={{ value: "MVO", position: "insideTopRight", fontSize: 8, fill: "#16a34a", fontWeight: 700 }} />
                    )}
                    {/* Pressure reference lines for IVCT and IVRT */}
                    {pvCorners.ivct_mid && (
                      <ReferenceLine y={pvCorners.ivct_mid.pressure} stroke="#189aa1" strokeDasharray="2 4" strokeWidth={0.8}
                        label={{ value: "IVCT", position: "right", fontSize: 8, fill: "#189aa1" }} />
                    )}
                    {pvCorners.ivrt_mid && (
                      <ReferenceLine y={pvCorners.ivrt_mid.pressure} stroke="#d97706" strokeDasharray="2 4" strokeWidth={0.8}
                        label={{ value: "IVRT", position: "right", fontSize: 8, fill: "#d97706" }} />
                    )}
                    {/* EDV and ESV reference lines */}
                    <ReferenceLine x={Math.round(hemo.edv)} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1}
                      label={{ value: `EDV ${Math.round(hemo.edv)}`, position: "insideBottomRight", fontSize: 8, fill: "#189aa1" }} />
                    <ReferenceLine x={Math.round(hemo.esv)} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1}
                      label={{ value: `ESV ${Math.round(hemo.esv)}`, position: "insideBottomLeft", fontSize: 8, fill: "#189aa1" }} />
                    {/* ESP reference */}
                    <ReferenceLine y={Math.round(hemo.esp)} stroke="#189aa1" strokeDasharray="3 3" strokeWidth={0.8}
                      label={{ value: `ESP ${Math.round(hemo.esp)} mmHg`, position: "right", fontSize: 8, fill: "#189aa1" }} />
                    {/* EDP reference */}
                    <ReferenceLine y={Math.round(hemo.edp)} stroke="#189aa1" strokeDasharray="3 3" strokeWidth={0.8}
                      label={{ value: `EDP ${Math.round(hemo.edp)} mmHg`, position: "right", fontSize: 8, fill: "#189aa1" }} />
                    <Area type="monotone" dataKey="pressure" stroke="#189aa1" fill="#e0f9fa" fillOpacity={0.4} strokeWidth={2.5} dot={false} name="PV Loop" />
                  </ComposedChart>
                </ResponsiveContainer>
                {/* Phase labels overlaid on the loop quadrants */}
                <div className="absolute inset-0 pointer-events-none" style={{ top: 20, left: 40, right: 50, bottom: 20 }}>
                  {/* These are positioned conceptually — actual pixel positions are approximated */}
                  <div className="absolute text-[9px] font-bold text-teal-500 opacity-70" style={{ left: "5%", top: "15%" }}>IVCT</div>
                  <div className="absolute text-[9px] font-bold text-red-500 opacity-70" style={{ left: "40%", top: "5%" }}>SYSTOLE</div>
                  <div className="absolute text-[9px] font-bold text-amber-600 opacity-70" style={{ right: "5%", top: "40%" }}>IVRT</div>
                  <div className="absolute text-[9px] font-bold text-green-600 opacity-70" style={{ left: "30%", bottom: "10%" }}>DIASTOLE</div>
                </div>
              </div>
              {/* PV Loop annotation summary */}
              <div className="mt-2 grid grid-cols-4 gap-2 text-[10px]">
                <div className="p-1.5 rounded bg-teal-100 border border-teal-300 text-center">
                  <div className="font-bold text-teal-600">IVCT</div>
                  <div className="text-gray-500">MVC → AVO</div>
                  <div className="font-mono text-teal-600">{Math.round((0.05) * (60 / params.heartRate) * 1000)} ms</div>
                </div>
                <div className="p-1.5 rounded bg-red-50 border border-red-100 text-center">
                  <div className="font-bold text-red-600">Ejection</div>
                  <div className="text-gray-500">AVO → AVC</div>
                  <div className="font-mono text-red-700">{Math.round((0.30) * (60 / params.heartRate) * 1000)} ms</div>
                </div>
                <div className="p-1.5 rounded bg-amber-50 border border-orange-100 text-center">
                  <div className="font-bold text-amber-600">IVRT</div>
                  <div className="text-gray-500">AVC → MVO</div>
                  <div className="font-mono text-amber-600">{Math.round((0.05) * (60 / params.heartRate) * 1000)} ms</div>
                </div>
                <div className="p-1.5 rounded bg-green-50 border border-green-100 text-center">
                  <div className="font-bold text-green-600">Filling</div>
                  <div className="text-gray-500">MVO → MVC</div>
                  <div className="font-mono text-green-700">{Math.round((0.60) * (60 / params.heartRate) * 1000)} ms</div>
                </div>
              </div>
            </div>

          </div>

          {/* ---- DOPPLER TRACINGS ---- */}
          <div className="xl:col-span-1 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Doppler Tracings</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">Live</span>
            </div>

            {/* Row 1: Aortic Outflow — full width, 3 cycles */}
            <div>
              <DopplerTracing
                title="Aortic Outflow (CW)"
                subtitle={avOutflowData.pattern}
                pathData={avOutflow3CycleData.path}
                color="#22d3ee"
                annotations={[{ x: avOutflow3CycleData.vmaxPeakX, y: avOutflow3CycleData.vmaxPeakY, label: `Vmax ${avOutflow3CycleData.vmax.toFixed(1)} m/s`, sub: `VTI ~${avOutflow3CycleData.vti} cm` }]}
                W={W_DOPPLER * 2} H={H_DOPPLER}
                belowBaseline={true}
                scaleMax={avOutflowData.vmax * 1.2}
                cycles={3}
              />
              <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
                <div className="bg-gray-50 rounded p-1.5 text-center border border-gray-100">
                  <div className="font-bold text-gray-700">Vmax</div>
                  <div className={`font-mono font-bold ${avOutflowData.vmax > 4.0 ? "text-red-600" : avOutflowData.vmax > 3.0 ? "text-amber-600" : ""}`} style={avOutflowData.vmax <= 3.0 ? {color:"#22d3ee"} : {}}>{avOutflowData.vmax.toFixed(1)} m/s</div>
                </div>
                <div className="bg-gray-50 rounded p-1.5 text-center border border-gray-100">
                  <div className="font-bold text-gray-700">VTI</div>
                  <div className="font-mono" style={{color:"#22d3ee"}}>~{avOutflowData.vti} cm</div>
                </div>
                <div className="bg-gray-50 rounded p-1.5 text-center border border-gray-100">
                  <div className="font-bold text-gray-700">Mean Gradient</div>
                  <div className={`font-mono font-bold ${4 * avOutflowData.vmax ** 2 > 40 ? "text-red-600" : 4 * avOutflowData.vmax ** 2 > 20 ? "text-amber-600" : ""}`} style={4 * avOutflowData.vmax ** 2 <= 20 ? {color:"#22d3ee"} : {}}>{Math.round(4 * avOutflowData.vmax ** 2 * 0.6)} mmHg</div>
                </div>
              </div>
            </div>

            {/* Row 2: Mitral + Tricuspid side by side */}
            <div className="grid grid-cols-2 gap-2 items-stretch">
              <div className="flex flex-col">
                <DopplerTracing
                  title="Mitral Inflow (PW)"
                  subtitle={mitralData.pattern}
                  pathData={mitralData.path}
                  color="#4ad9e0"
                  annotations={mitralAnnotations}
                  W={W_DOPPLER} H={H_DOPPLER}
                  scaleMax={Math.max(mitralData.eVel, mitralData.aVel) * 1.25}
                />
                <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">E</div>
                    <div className="font-mono" style={{color:"#0e9aa7"}}>{mitralData.eVel.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">A</div>
                    <div className="font-mono" style={{color:"#0e9aa7"}}>{mitralData.aVel.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">E/A</div>
                    <div className={`font-mono font-bold ${mitralData.eaRatio < 0.8 ? "text-amber-600" : mitralData.eaRatio > 2.0 ? "text-red-600" : ""}`} style={mitralData.eaRatio >= 0.8 && mitralData.eaRatio <= 2.0 ? {color:"#0e9aa7"} : {}}>{mitralData.eaRatio.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100 col-span-3">
                    <div className="font-bold text-gray-700">DT: <span className="font-mono text-teal-600">{mitralData.decTime} ms</span></div>
                  </div>
                </div>
              </div>
              <div>
                <DopplerTracing
                  title="Tricuspid (PW)"
                  subtitle={tricuspidData.pattern}
                  pathData={tricuspidData.path}
                  color="#189aa1"
                  annotations={tricuspidAnnotations}
                  W={W_DOPPLER} H={H_DOPPLER}
                  scaleMax={Math.max(tricuspidData.eVel, tricuspidData.aVel) * 1.25}
                />
                <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">E</div>
                    <div className="font-mono" style={{color:"#189aa1"}}>{tricuspidData.eVel.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">A</div>
                    <div className="font-mono" style={{color:"#189aa1"}}>{tricuspidData.aVel.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">E/A</div>
                    <div className={`font-mono font-bold ${(tricuspidData.eVel/tricuspidData.aVel) > 2.0 ? "text-red-600" : ""}`} style={(tricuspidData.eVel/tricuspidData.aVel) <= 2.0 ? {color:"#189aa1"} : {}}>{(tricuspidData.eVel/tricuspidData.aVel).toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100 col-span-3">
                    <div className="font-bold text-gray-700">RVSP: <span className={`font-mono font-bold ${hemo.rvsp > 40 ? "text-red-600" : "text-[#189aa1]"}`}>{Math.round(hemo.rvsp)} mmHg</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Septal TDI + Lateral TDI side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <DopplerTracing
                  title="Septal TDI"
                  subtitle={tdiSeptalData.pattern}
                  pathData={tdiSeptalData.path}
                  color="#4ad9e0"
                  annotations={tdiSeptalAnnotations}
                  W={W_DOPPLER} H={H_DOPPLER}
                  scaleMax={Math.max(tdiSeptalData.ePrime, tdiSeptalData.aPrime, tdiSeptalData.sPrime) * 1.2 / 100}
                  noFill
                  baselineRatio={0.50}
                  yAxisLabel="cm/s"
                />
                <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">s'</div>
                    <div className="font-mono text-amber-600">{tdiSeptalData.sPrime.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">e'</div>
                    <div className={`font-mono font-bold ${tdiSeptalData.ePrime < 7 ? "text-red-600" : "text-amber-600"}`}>{tdiSeptalData.ePrime.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">a'</div>
                    <div className="font-mono text-amber-600">{tdiSeptalData.aPrime.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100 col-span-3">
                    <div className="font-bold text-gray-700">E/e' sep: <span className={`font-mono font-bold ${tdiSeptalData.eeRatio > 15 ? "text-red-600" : tdiSeptalData.eeRatio > 13 ? "text-amber-600" : "text-green-700"}`}>{tdiSeptalData.eeRatio.toFixed(1)}</span></div>
                  </div>
                </div>
              </div>
              <div>
                <DopplerTracing
                  title="Lateral TDI"
                  subtitle={tdiLateralData.pattern}
                  pathData={tdiLateralData.path}
                  color="#4ad9e0"
                  annotations={tdiLateralAnnotations}
                  W={W_DOPPLER} H={H_DOPPLER}
                  scaleMax={Math.max(tdiLateralData.ePrime, tdiLateralData.aPrime, tdiLateralData.sPrime) * 1.2 / 100}
                  noFill
                  baselineRatio={0.50}
                  yAxisLabel="cm/s"
                />
                <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">s'</div>
                    <div className="font-mono text-violet-500">{tdiLateralData.sPrime.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">e'</div>
                    <div className={`font-mono font-bold ${tdiLateralData.ePrime < 10 ? "text-red-600" : "text-violet-500"}`}>{tdiLateralData.ePrime.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100">
                    <div className="font-bold text-gray-700">a'</div>
                    <div className="font-mono text-violet-500">{tdiLateralData.aPrime.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1 text-center border border-gray-100 col-span-3">
                    <div className="font-bold text-gray-700">E/e' lat: <span className={`font-mono font-bold ${tdiLateralData.eeRatio > 13 ? "text-red-600" : tdiLateralData.eeRatio > 11 ? "text-amber-600" : "text-green-700"}`}>{tdiLateralData.eeRatio.toFixed(1)}</span> &nbsp; avg: <span className={`font-mono font-bold ${eeAvg > 14 ? "text-red-600" : eeAvg > 12 ? "text-amber-600" : "text-green-700"}`}>{eeAvg.toFixed(1)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Frank-Starling Curve Section */}
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3" style={{ background: "linear-gradient(90deg, #0e4a50, #189aa1)" }}>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-white" />
              <div>
                <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>Frank-Starling Curve</h3>
                <p className="text-xs text-white/70">Synchronized with hemodynamic sliders above — adjust preload, afterload, and contractility to see real-time curve changes</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <FrankStarlingGraph
              params={{ preload: params.preload, afterload: params.afterload, contractility: params.contractility }}
              showReferenceCurves
              height={300}
            />
            <p className="text-xs text-gray-400 mt-3">
              The operating point (teal dot) moves in real time as you adjust the sliders above. The dashed green and red curves show the effect of ±30 units of contractility change. Reference: Starling EH. The Linacre Lecture on the Law of the Heart. 1918.
            </p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
