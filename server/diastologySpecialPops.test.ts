/**
 * Unit tests for Diastology in Special Populations algorithms
 * Tests the pure logic extracted from DiastologySpecialPopulations.tsx
 *
 * Reference: ASE 2025 LV Diastolic Function Guidelines (Nagueh et al.)
 * Figures 4, 5, 6, 7, 8
 */

import { describe, it, expect } from "vitest";

// ─── Pure algorithm functions (extracted for testability) ─────────────────────

// FIGURE 4: MAC Algorithm
function calcMAC(ea: number, ivrt?: number): string {
  if (ea < 0.8) return "normal";
  if (ea > 1.8) return "elevated";
  // 0.8–1.8 range
  if (ivrt === undefined) return "indeterminate";
  return ivrt >= 80 ? "normal" : "elevated";
}

// FIGURE 5: Heart Transplant Algorithm
function calcHTX(avgEe: number, esrIvr?: number, trVel?: number): string {
  if (avgEe < 7) return "low";
  if (avgEe > 14) return "elevated";
  // 7–14 range
  if (esrIvr !== undefined) {
    return esrIvr <= 200 ? "low" : "elevated";
  }
  if (trVel !== undefined) {
    return trVel <= 2.8 ? "low" : "elevated";
  }
  return "indeterminate";
}

// FIGURE 6: Pulmonary HTN Algorithm
function calcPH(ea: number, eVel?: number, ePrime?: number, lars?: number, latEe?: number): string {
  // Branch 1: E/A ≤ 0.8 AND E ≤ 50 → Normal
  if (ea <= 0.8 && eVel !== undefined && eVel <= 50) return "normal";
  // Branch 3: E/A ≥ 2 AND reduced e' (≤ 7)
  if (ea >= 2 && ePrime !== undefined && ePrime <= 7) return "elevated";
  // Intermediate branch
  if (lars !== undefined) {
    return lars > 18 ? "normal" : "elevated";
  }
  if (latEe !== undefined) {
    if (latEe < 8) return "normal";
    if (latEe > 13) return "elevated";
    return "indeterminate";
  }
  return "indeterminate";
}

// FIGURE 8: Atrial Fibrillation Algorithm
function calcAFib(
  eVel?: number,
  sepEe?: number,
  trAbn?: boolean,
  dt?: number,
  lars?: number,
  pvSD?: number,
  bmi?: number,
): string {
  let count = 0;
  let entered = 0;

  if (eVel !== undefined) { entered++; if (eVel >= 100) count++; }
  if (sepEe !== undefined) { entered++; if (sepEe > 11) count++; }
  if (trAbn !== undefined) { entered++; if (trAbn) count++; }
  if (dt !== undefined) { entered++; if (dt <= 160) count++; }

  if (entered === 0) return "no_data";
  if (count === 0 || count === 1) return "normal";
  if (count >= 3) return "elevated";

  // count === 2: secondary criteria
  let secCount = 0;
  let secEntered = 0;
  if (lars !== undefined) { secEntered++; if (lars < 18) secCount++; }
  if (pvSD !== undefined) { secEntered++; if (pvSD < 1) secCount++; }
  if (bmi !== undefined) { secEntered++; if (bmi > 30) secCount++; }

  if (secEntered === 0) return "indeterminate";
  if (secCount === 0) return "normal";
  if (secCount >= 2) return "elevated";
  return "indeterminate"; // 1 of available secondary
}

// FIGURE 7: Constrictive vs Restrictive Algorithm
function calcCR(
  ea: number,
  dilatedIVC: boolean,
  respirophasicVSM: boolean | null,
  medialEPrime?: number,
  annulusReversus?: boolean | null,
  hepaticVeinReversal?: boolean | null,
  svcAugmentation?: boolean | null,
): string {
  if (ea <= 0.8 || !dilatedIVC) return "unlikely";
  if (respirophasicVSM === null) return "indeterminate";
  if (!respirophasicVSM) return "unlikely";

  if (medialEPrime === undefined) return "indeterminate";

  const baseDx = medialEPrime > 8 ? "constriction" : medialEPrime >= 6 ? "mixed" : "restriction";

  if (annulusReversus === null || annulusReversus === undefined) return baseDx;
  if (annulusReversus) return "constriction";

  if (hepaticVeinReversal === null || hepaticVeinReversal === undefined) return baseDx;
  if (hepaticVeinReversal) return "constriction";

  if (svcAugmentation === null || svcAugmentation === undefined) return baseDx;
  if (svcAugmentation) return "exaggerated_intrathoracic";

  return baseDx;
}

// ─── TEST SUITES ──────────────────────────────────────────────────────────────

describe("MAC Algorithm (Figure 4)", () => {
  it("E/A < 0.8 → Normal LAP", () => {
    expect(calcMAC(0.7)).toBe("normal");
    expect(calcMAC(0.5)).toBe("normal");
    expect(calcMAC(0.79)).toBe("normal");
  });

  it("E/A > 1.8 → Elevated LAP", () => {
    expect(calcMAC(1.9)).toBe("elevated");
    expect(calcMAC(2.5)).toBe("elevated");
  });

  it("E/A 0.8–1.8, IVRT ≥ 80 ms → Normal LAP", () => {
    expect(calcMAC(1.0, 80)).toBe("normal");
    expect(calcMAC(1.5, 100)).toBe("normal");
    expect(calcMAC(0.8, 90)).toBe("normal");
    expect(calcMAC(1.8, 80)).toBe("normal");
  });

  it("E/A 0.8–1.8, IVRT < 80 ms → Elevated LAP", () => {
    expect(calcMAC(1.0, 70)).toBe("elevated");
    expect(calcMAC(1.5, 60)).toBe("elevated");
    expect(calcMAC(0.8, 79)).toBe("elevated");
  });

  it("E/A 0.8–1.8, no IVRT → Indeterminate", () => {
    expect(calcMAC(1.0)).toBe("indeterminate");
    expect(calcMAC(1.5)).toBe("indeterminate");
  });
});

describe("Heart Transplant Algorithm (Figure 5)", () => {
  it("Average E/e' < 7 → LAP < 15 mmHg", () => {
    expect(calcHTX(6)).toBe("low");
    expect(calcHTX(4)).toBe("low");
    expect(calcHTX(6.9)).toBe("low");
  });

  it("Average E/e' > 14 → LAP ≥ 15 mmHg", () => {
    expect(calcHTX(15)).toBe("elevated");
    expect(calcHTX(20)).toBe("elevated");
  });

  it("E/e' 7–14, E/SR_IVR ≤ 200 → LAP < 15 mmHg", () => {
    expect(calcHTX(10, 200)).toBe("low");
    expect(calcHTX(10, 150)).toBe("low");
    expect(calcHTX(7, 200)).toBe("low");
  });

  it("E/e' 7–14, E/SR_IVR > 200 → LAP ≥ 15 mmHg", () => {
    expect(calcHTX(10, 250)).toBe("elevated");
    expect(calcHTX(14, 201)).toBe("elevated");
  });

  it("E/e' 7–14, no E/SR_IVR, TR ≤ 2.8 m/s → LAP < 15 mmHg", () => {
    expect(calcHTX(10, undefined, 2.5)).toBe("low");
    expect(calcHTX(10, undefined, 2.8)).toBe("low");
  });

  it("E/e' 7–14, no E/SR_IVR, TR > 2.8 m/s → LAP ≥ 15 mmHg", () => {
    expect(calcHTX(10, undefined, 3.0)).toBe("elevated");
    expect(calcHTX(14, undefined, 2.9)).toBe("elevated");
  });

  it("E/e' 7–14, no secondary data → Indeterminate", () => {
    expect(calcHTX(10)).toBe("indeterminate");
    expect(calcHTX(7)).toBe("indeterminate");
  });
});

describe("Pulmonary HTN Algorithm (Figure 6)", () => {
  it("E/A ≤ 0.8 AND E ≤ 50 cm/s → Normal LAP", () => {
    expect(calcPH(0.7, 45)).toBe("normal");
    expect(calcPH(0.8, 50)).toBe("normal");
    expect(calcPH(0.5, 30)).toBe("normal");
  });

  it("E/A ≥ 2 AND e' ≤ 7 → Elevated LAP", () => {
    expect(calcPH(2.0, undefined, 6)).toBe("elevated");
    expect(calcPH(2.5, undefined, 5)).toBe("elevated");
    expect(calcPH(2.0, undefined, 7)).toBe("elevated");
  });

  it("Intermediate E/A, LARS > 18% → Normal LAP", () => {
    expect(calcPH(1.2, 60, undefined, 20)).toBe("normal");
    expect(calcPH(0.8, 60, undefined, 25)).toBe("normal");
  });

  it("Intermediate E/A, LARS ≤ 18% → Elevated LAP", () => {
    expect(calcPH(1.2, 60, undefined, 15)).toBe("elevated");
    expect(calcPH(1.5, 70, undefined, 18)).toBe("elevated");
  });

  it("No LARS, lateral E/e' < 8 → Normal LAP", () => {
    expect(calcPH(1.2, 60, undefined, undefined, 7)).toBe("normal");
    expect(calcPH(1.5, 70, undefined, undefined, 5)).toBe("normal");
  });

  it("No LARS, lateral E/e' > 13 → Elevated LAP", () => {
    expect(calcPH(1.2, 60, undefined, undefined, 14)).toBe("elevated");
    expect(calcPH(1.5, 70, undefined, undefined, 16)).toBe("elevated");
  });

  it("No LARS, lateral E/e' 8–13 → Indeterminate", () => {
    expect(calcPH(1.2, 60, undefined, undefined, 10)).toBe("indeterminate");
    expect(calcPH(1.5, 70, undefined, undefined, 13)).toBe("indeterminate");
  });
});

describe("Atrial Fibrillation Algorithm (Figure 8)", () => {
  it("0 of 4 criteria met → Normal LAP", () => {
    expect(calcAFib(80, 9, false, 200)).toBe("normal");
    expect(calcAFib(90, 8, false, 180)).toBe("normal");
  });

  it("1 of 4 criteria met → Normal LAP", () => {
    expect(calcAFib(105, 9, false, 200)).toBe("normal"); // only E vel
    expect(calcAFib(80, 12, false, 200)).toBe("normal"); // only septal E/e'
  });

  it("3 of 4 criteria met → Elevated LAP", () => {
    expect(calcAFib(105, 12, true, 200)).toBe("elevated");
    expect(calcAFib(105, 9, true, 150)).toBe("elevated");
  });

  it("4 of 4 criteria met → Elevated LAP", () => {
    expect(calcAFib(110, 13, true, 150)).toBe("elevated");
  });

  it("2 of 4, 0 secondary → Normal LAP", () => {
    expect(calcAFib(105, 12, false, 200, 20, 1.2, 25)).toBe("normal");
  });

  it("2 of 4, 2+ secondary → Elevated LAP", () => {
    expect(calcAFib(105, 12, false, 200, 15, 0.8, undefined)).toBe("elevated");
    expect(calcAFib(105, 12, false, 200, 15, 0.8, 32)).toBe("elevated");
  });

  it("2 of 4, 1 secondary → Indeterminate", () => {
    expect(calcAFib(105, 12, false, 200, 15, 1.2, undefined)).toBe("indeterminate");
    expect(calcAFib(105, 12, false, 200, 20, 0.8, undefined)).toBe("indeterminate");
  });

  it("2 of 4, no secondary data → Indeterminate", () => {
    expect(calcAFib(105, 12, false, 200)).toBe("indeterminate");
  });
});

describe("Constrictive vs Restrictive Algorithm (Figure 7)", () => {
  it("E/A ≤ 0.8 → Unlikely", () => {
    expect(calcCR(0.7, true, true, 9)).toBe("unlikely");
    expect(calcCR(0.8, true, true, 9)).toBe("unlikely");
  });

  it("No dilated IVC → Unlikely", () => {
    expect(calcCR(1.5, false, true, 9)).toBe("unlikely");
  });

  it("No respirophasic VSM → Unlikely", () => {
    expect(calcCR(1.5, true, false, 9)).toBe("unlikely");
  });

  it("Respirophasic VSM + medial e' > 8 → Constriction", () => {
    expect(calcCR(1.5, true, true, 9, null)).toBe("constriction");
    expect(calcCR(1.5, true, true, 10, null)).toBe("constriction");
  });

  it("Respirophasic VSM + medial e' 6–8 → Mixed", () => {
    expect(calcCR(1.5, true, true, 7, null)).toBe("mixed");
    expect(calcCR(1.5, true, true, 6, null)).toBe("mixed");
  });

  it("Respirophasic VSM + medial e' < 6 → Restriction", () => {
    expect(calcCR(1.5, true, true, 5, null)).toBe("restriction");
    expect(calcCR(1.5, true, true, 3, null)).toBe("restriction");
  });

  it("Annulus reversus present → Constriction (overrides medial e')", () => {
    expect(calcCR(1.5, true, true, 7, true)).toBe("constriction");
    expect(calcCR(1.5, true, true, 5, true)).toBe("constriction");
  });

  it("No annulus reversus + hepatic vein reversal → Constriction", () => {
    expect(calcCR(1.5, true, true, 9, false, true)).toBe("constriction");
  });

  it("No annulus reversus + no hepatic vein reversal + SVC augmentation → Exaggerated intrathoracic", () => {
    expect(calcCR(1.5, true, true, 9, false, false, true)).toBe("exaggerated_intrathoracic");
  });

  it("All negative → Base diagnosis from medial e'", () => {
    expect(calcCR(1.5, true, true, 9, false, false, false)).toBe("constriction");
    expect(calcCR(1.5, true, true, 5, false, false, false)).toBe("restriction");
  });
});
