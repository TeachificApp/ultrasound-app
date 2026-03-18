/**
 * TR Grading Logic Tests
 * Tests the ASE/AHA 2021 + Hahn 2019 tricuspid regurgitation severity grading
 * logic as pure functions (mirroring the frontend engine).
 */
import { describe, it, expect } from "vitest";

// ─── Pure grading logic (mirrors TricuspidRegurgEngine) ─────────────────────

const n = (v: string) => parseFloat(v);
const has = (...vals: string[]) => vals.every(v => v !== "" && !isNaN(parseFloat(v)));

type TrSeverity = "indeterminate" | "normal" | "mild" | "moderate" | "severe" | "critical";

interface TrInput {
  vcTr?: string;
  eroaTr?: string;
  regVolTr?: string;
  pisaRadiusTr?: string;
  trVmax?: string;
  jetArea?: string;
  hepaticVein?: "" | "normal" | "blunted" | "reversal";
}

function gradeTR(input: TrInput): { sev: TrSeverity; label: string } {
  const { vcTr = "", eroaTr = "", regVolTr = "", pisaRadiusTr = "", trVmax = "", jetArea = "", hepaticVein = "" } = input;

  const pisaEroaTr = has(pisaRadiusTr, trVmax)
    ? (2 * Math.PI * Math.pow(n(pisaRadiusTr), 2) * 28) / (n(trVmax) * 100)
    : null;

  const anyData = has(vcTr) || has(eroaTr) || has(regVolTr) || has(pisaRadiusTr) || has(jetArea) || hepaticVein !== "";
  if (!anyData) return { sev: "indeterminate", label: "Insufficient data" };

  let sevScore = 0;

  if (has(vcTr)) {
    const vc = n(vcTr);
    if (vc >= 21) sevScore = Math.max(sevScore, 4);
    else if (vc >= 14) sevScore = Math.max(sevScore, 3);
    else if (vc >= 7) sevScore = Math.max(sevScore, 2);
    else sevScore = Math.max(sevScore, 1);
  }

  const effectiveEroa = n(eroaTr) || pisaEroaTr || 0;
  if (effectiveEroa > 0) {
    if (effectiveEroa >= 0.75) sevScore = Math.max(sevScore, 4);
    else if (effectiveEroa >= 0.40) sevScore = Math.max(sevScore, 3);
    else if (effectiveEroa >= 0.20) sevScore = Math.max(sevScore, 2);
    else sevScore = Math.max(sevScore, 1);
  }

  if (has(regVolTr)) {
    const rv = n(regVolTr);
    if (rv >= 45) sevScore = Math.max(sevScore, 3);
    else if (rv >= 30) sevScore = Math.max(sevScore, 2);
    else sevScore = Math.max(sevScore, 1);
  }

  if (has(jetArea)) {
    const ja = n(jetArea);
    if (ja >= 10) sevScore = Math.max(sevScore, 3);
    else if (ja >= 5) sevScore = Math.max(sevScore, 2);
  }

  if (hepaticVein === "reversal") sevScore = Math.max(sevScore, 3);
  else if (hepaticVein === "blunted") sevScore = Math.max(sevScore, 2);

  let sev: TrSeverity;
  let label: string;
  if (sevScore === 0) { sev = "normal"; label = "Trace / No Significant Tricuspid Regurgitation"; }
  else if (sevScore === 1) { sev = "mild"; label = "Mild Tricuspid Regurgitation"; }
  else if (sevScore === 2) { sev = "moderate"; label = "Moderate Tricuspid Regurgitation"; }
  else if (sevScore === 3) { sev = "severe"; label = "Severe Tricuspid Regurgitation"; }
  else { sev = "critical"; label = "Massive / Torrential Tricuspid Regurgitation"; }

  return { sev, label };
}

function estimateRAP(ivcDiam: string, ivcCollapse: string): number | null {
  if (!has(ivcDiam)) return null;
  const d = n(ivcDiam);
  if (d <= 21 && ivcCollapse === "normal") return 3;
  if (d <= 21 && ivcCollapse === "blunted") return 8;
  if (d > 21 && ivcCollapse === "normal") return 8;
  if (d > 21 && ivcCollapse === "blunted") return 15;
  return null;
}

function calcRVSP(trVmax: string): number | null {
  return has(trVmax) ? 4 * Math.pow(n(trVmax), 2) : null;
}

function calcPisaEROA(pisaRadius: string, trVmax: string): number | null {
  return has(pisaRadius, trVmax)
    ? (2 * Math.PI * Math.pow(n(pisaRadius), 2) * 28) / (n(trVmax) * 100)
    : null;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("TR Severity Grading — Vena Contracta", () => {
  it("returns indeterminate with no data", () => {
    expect(gradeTR({}).sev).toBe("indeterminate");
  });

  it("grades trace TR with VC 3 mm", () => {
    const r = gradeTR({ vcTr: "3" });
    expect(r.sev).toBe("mild");
  });

  it("grades mild TR with VC 5 mm", () => {
    const r = gradeTR({ vcTr: "5" });
    expect(r.sev).toBe("mild");
  });

  it("grades moderate TR with VC 7 mm (lower boundary)", () => {
    const r = gradeTR({ vcTr: "7" });
    expect(r.sev).toBe("moderate");
  });

  it("grades moderate TR with VC 10 mm", () => {
    const r = gradeTR({ vcTr: "10" });
    expect(r.sev).toBe("moderate");
  });

  it("grades severe TR with VC 14 mm (lower boundary)", () => {
    const r = gradeTR({ vcTr: "14" });
    expect(r.sev).toBe("severe");
  });

  it("grades severe TR with VC 18 mm", () => {
    const r = gradeTR({ vcTr: "18" });
    expect(r.sev).toBe("severe");
  });

  it("grades massive TR with VC 21 mm (lower boundary)", () => {
    const r = gradeTR({ vcTr: "21" });
    expect(r.sev).toBe("critical");
    expect(r.label).toContain("Massive");
  });

  it("grades massive TR with VC 25 mm", () => {
    const r = gradeTR({ vcTr: "25" });
    expect(r.sev).toBe("critical");
  });
});

describe("TR Severity Grading — EROA", () => {
  it("grades mild TR with EROA 0.15 cm²", () => {
    const r = gradeTR({ eroaTr: "0.15" });
    expect(r.sev).toBe("mild");
  });

  it("grades moderate TR with EROA 0.20 cm² (lower boundary)", () => {
    const r = gradeTR({ eroaTr: "0.20" });
    expect(r.sev).toBe("moderate");
  });

  it("grades moderate TR with EROA 0.35 cm²", () => {
    const r = gradeTR({ eroaTr: "0.35" });
    expect(r.sev).toBe("moderate");
  });

  it("grades severe TR with EROA 0.40 cm² (lower boundary)", () => {
    const r = gradeTR({ eroaTr: "0.40" });
    expect(r.sev).toBe("severe");
  });

  it("grades severe TR with EROA 0.60 cm²", () => {
    const r = gradeTR({ eroaTr: "0.60" });
    expect(r.sev).toBe("severe");
  });

  it("grades massive TR with EROA 0.75 cm² (lower boundary)", () => {
    const r = gradeTR({ eroaTr: "0.75" });
    expect(r.sev).toBe("critical");
  });
});

describe("TR Severity Grading — Regurgitant Volume", () => {
  it("grades mild TR with RVol 20 mL", () => {
    const r = gradeTR({ regVolTr: "20" });
    expect(r.sev).toBe("mild");
  });

  it("grades moderate TR with RVol 30 mL (lower boundary)", () => {
    const r = gradeTR({ regVolTr: "30" });
    expect(r.sev).toBe("moderate");
  });

  it("grades severe TR with RVol 45 mL (lower boundary)", () => {
    const r = gradeTR({ regVolTr: "45" });
    expect(r.sev).toBe("severe");
  });

  it("grades severe TR with RVol 60 mL", () => {
    const r = gradeTR({ regVolTr: "60" });
    expect(r.sev).toBe("severe");
  });
});

describe("TR Severity Grading — Hepatic Vein Flow", () => {
  it("normal hepatic vein flow alone does not upgrade severity", () => {
    const r = gradeTR({ hepaticVein: "normal" });
    expect(r.sev).toBe("normal");
  });

  it("hepatic vein systolic blunting → at least moderate", () => {
    const r = gradeTR({ hepaticVein: "blunted" });
    expect(r.sev).toBe("moderate");
  });

  it("hepatic vein systolic reversal → at least severe", () => {
    const r = gradeTR({ hepaticVein: "reversal" });
    expect(r.sev).toBe("severe");
  });

  it("reversal upgrades mild VC to severe", () => {
    const r = gradeTR({ vcTr: "5", hepaticVein: "reversal" });
    expect(r.sev).toBe("severe");
  });
});

describe("TR Severity Grading — Jet Area (supportive)", () => {
  it("jet area <5 cm² alone → normal/trace (supportive only, does not upgrade)", () => {
    const r = gradeTR({ jetArea: "3" });
    // Jet area <5 cm² is labeled 'mild' in criteria text but does not set sevScore
    // so with no other parameters the result remains normal/trace
    expect(r.sev).toBe("normal");
  });

  it("jet area 5–9 cm² → moderate", () => {
    const r = gradeTR({ jetArea: "7" });
    expect(r.sev).toBe("moderate");
  });

  it("jet area ≥10 cm² → severe", () => {
    const r = gradeTR({ jetArea: "12" });
    expect(r.sev).toBe("severe");
  });
});

describe("TR Severity Grading — Multi-parameter (highest severity wins)", () => {
  it("moderate VC + severe hepatic vein reversal → severe", () => {
    const r = gradeTR({ vcTr: "10", hepaticVein: "reversal" });
    expect(r.sev).toBe("severe");
  });

  it("mild VC + moderate EROA → moderate", () => {
    const r = gradeTR({ vcTr: "5", eroaTr: "0.25" });
    expect(r.sev).toBe("moderate");
  });

  it("severe VC + massive EROA → massive", () => {
    const r = gradeTR({ vcTr: "16", eroaTr: "0.80" });
    expect(r.sev).toBe("critical");
  });
});

describe("RVSP Calculation from TR Vmax", () => {
  it("calculates RVSP from TR Vmax 2.8 m/s → ~31 mmHg", () => {
    const rvsp = calcRVSP("2.8");
    expect(rvsp).toBeCloseTo(31.36, 1);
  });

  it("calculates RVSP from TR Vmax 4.0 m/s → 64 mmHg", () => {
    const rvsp = calcRVSP("4.0");
    expect(rvsp).toBe(64);
  });

  it("returns null for empty TR Vmax", () => {
    expect(calcRVSP("")).toBeNull();
  });
});

describe("RAP Estimation from IVC", () => {
  it("IVC ≤21 mm + >50% collapse → RAP 3 mmHg", () => {
    expect(estimateRAP("18", "normal")).toBe(3);
  });

  it("IVC ≤21 mm + <50% collapse → RAP 8 mmHg", () => {
    expect(estimateRAP("20", "blunted")).toBe(8);
  });

  it("IVC >21 mm + >50% collapse → RAP 8 mmHg", () => {
    expect(estimateRAP("25", "normal")).toBe(8);
  });

  it("IVC >21 mm + <50% collapse → RAP 15 mmHg", () => {
    expect(estimateRAP("28", "blunted")).toBe(15);
  });

  it("returns null when IVC diameter not entered", () => {
    expect(estimateRAP("", "normal")).toBeNull();
  });
});

describe("PISA EROA Calculation (28 cm/s aliasing)", () => {
  it("calculates PISA EROA correctly for radius 0.8 cm, TR Vmax 4.0 m/s", () => {
    // EROA = 2π × r² × Va / Vmax
    // = 2π × 0.64 × 28 / 400 = 0.2814 cm²
    const eroa = calcPisaEROA("0.8", "4.0");
    expect(eroa).toBeCloseTo(0.281, 2);
  });

  it("calculates PISA EROA for radius 1.0 cm, TR Vmax 3.5 m/s → ~0.503 cm²", () => {
    const eroa = calcPisaEROA("1.0", "3.5");
    expect(eroa).toBeCloseTo(0.503, 2);
  });

  it("returns null when PISA radius is missing", () => {
    expect(calcPisaEROA("", "4.0")).toBeNull();
  });

  it("returns null when TR Vmax is missing", () => {
    expect(calcPisaEROA("0.8", "")).toBeNull();
  });
});
