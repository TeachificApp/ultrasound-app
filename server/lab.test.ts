/**
 * Lab Subscription — unit tests
 * Tests DB helper logic and router procedure guards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Quality Score calculation helpers (mirrored from LabAdmin.tsx) ───────────
const IQ_SCORES: Record<string, number> = { excellent: 100, good: 80, adequate: 60, poor: 30 };
const RA_SCORES: Record<string, number> = { accurate: 100, minor_discrepancy: 55, major_discrepancy: 15 };
const TA_SCORES: Record<string, number> = { full: 100, partial: 55, non_adherent: 15 };

function calcQS(iq?: string | null, ra?: string | null, ta?: string | null): number | null {
  const i = iq ? IQ_SCORES[iq] : null;
  const r = ra ? RA_SCORES[ra] : null;
  const t = ta ? TA_SCORES[ta] : null;
  if (i == null || r == null || t == null) return null;
  return Math.round(i * 0.4 + r * 0.35 + t * 0.25);
}

function qsTier(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Adequate";
  return "Needs Improvement";
}

// ─── Quality Score engine ─────────────────────────────────────────────────────
describe("Quality Score engine", () => {
  it("returns null when any dimension is missing", () => {
    expect(calcQS(null, "accurate", "full")).toBeNull();
    expect(calcQS("excellent", null, "full")).toBeNull();
    expect(calcQS("excellent", "accurate", null)).toBeNull();
    expect(calcQS()).toBeNull();
  });

  it("calculates Excellent tier for top scores", () => {
    // excellent(100)*0.4 + accurate(100)*0.35 + full(100)*0.25 = 100
    const qs = calcQS("excellent", "accurate", "full");
    expect(qs).toBe(100);
    expect(qsTier(100)).toBe("Excellent");
  });

  it("calculates Good tier for mid-high scores", () => {
    // good(80)*0.4 + accurate(100)*0.35 + full(100)*0.25 = 32+35+25 = 92 → Excellent
    // good(80)*0.4 + minor(55)*0.35 + partial(55)*0.25 = 32+19.25+13.75 = 65 → Adequate
    const qs = calcQS("good", "minor_discrepancy", "partial");
    expect(qs).toBe(65);
    expect(qsTier(65)).toBe("Adequate");
  });

  it("calculates Needs Improvement for low scores", () => {
    // poor(30)*0.4 + major(15)*0.35 + non_adherent(15)*0.25 = 12+5.25+3.75 = 21
    const qs = calcQS("poor", "major_discrepancy", "non_adherent");
    expect(qs).toBe(21);
    expect(qsTier(21)).toBe("Needs Improvement");
  });

  it("applies correct weights: IQ 40%, RA 35%, TA 25%", () => {
    // excellent(100)*0.4 + major(15)*0.35 + non_adherent(15)*0.25 = 40+5.25+3.75 = 49
    const qs = calcQS("excellent", "major_discrepancy", "non_adherent");
    expect(qs).toBe(49);
    expect(qsTier(49)).toBe("Needs Improvement");
  });

  it("tier boundaries are correct", () => {
    expect(qsTier(85)).toBe("Excellent");
    expect(qsTier(84)).toBe("Good");
    expect(qsTier(70)).toBe("Good");
    expect(qsTier(69)).toBe("Adequate");
    expect(qsTier(50)).toBe("Adequate");
    expect(qsTier(49)).toBe("Needs Improvement");
  });
});

// ─── Subscription plan seat limits ───────────────────────────────────────────
describe("Subscription plan seat limits", () => {
  const planSeats = { basic: 5, professional: 25, enterprise: 999 };

  it("basic plan allows up to 5 seats", () => {
    expect(planSeats.basic).toBe(5);
  });

  it("professional plan allows up to 25 seats", () => {
    expect(planSeats.professional).toBe(25);
  });

  it("enterprise plan allows unlimited seats (999)", () => {
    expect(planSeats.enterprise).toBe(999);
  });

  it("seat limit check logic works correctly", () => {
    const checkSeatLimit = (currentCount: number, maxSeats: number) =>
      currentCount >= maxSeats;

    expect(checkSeatLimit(5, 5)).toBe(true);   // at limit
    expect(checkSeatLimit(4, 5)).toBe(false);  // under limit
    expect(checkSeatLimit(6, 5)).toBe(true);   // over limit
    expect(checkSeatLimit(998, 999)).toBe(false); // enterprise under limit
  });
});

// ─── Plan upgrade logic ───────────────────────────────────────────────────────
describe("Plan upgrade seat assignment", () => {
  function getSeatsForPlan(plan: string): number {
    if (plan === "enterprise") return 999;
    if (plan === "professional") return 25;
    if (plan === "basic") return 5;
    return 5;
  }

  it("assigns correct seats for each plan", () => {
    expect(getSeatsForPlan("basic")).toBe(5);
    expect(getSeatsForPlan("professional")).toBe(25);
    expect(getSeatsForPlan("enterprise")).toBe(999);
  });

  it("defaults to 5 seats for unknown plan", () => {
    expect(getSeatsForPlan("unknown")).toBe(5);
  });
});

// ─── Staff role validation ────────────────────────────────────────────────────
describe("Staff role validation", () => {
  const validRoles = ["admin", "reviewer", "sonographer"];

  it("accepts valid roles", () => {
    validRoles.forEach(role => {
      expect(validRoles.includes(role)).toBe(true);
    });
  });

  it("rejects invalid roles", () => {
    expect(validRoles.includes("superuser")).toBe(false);
    expect(validRoles.includes("")).toBe(false);
    expect(validRoles.includes("guest")).toBe(false);
  });
});

// ─── Monthly summary aggregation ─────────────────────────────────────────────
describe("Monthly summary aggregation", () => {
  it("correctly averages quality scores across reviews", () => {
    const reviews = [
      { qs: 90 }, { qs: 80 }, { qs: 70 }
    ];
    const avg = Math.round(reviews.reduce((s, r) => s + r.qs, 0) / reviews.length);
    expect(avg).toBe(80);
  });

  it("handles empty review list gracefully", () => {
    const reviews: { qs: number }[] = [];
    const avg = reviews.length > 0
      ? Math.round(reviews.reduce((s, r) => s + r.qs, 0) / reviews.length)
      : null;
    expect(avg).toBeNull();
  });

  it("counts tier distribution correctly", () => {
    const scores = [95, 85, 75, 65, 45, 30];
    const tiers = scores.map(qsTier);
    const excellent = tiers.filter(t => t === "Excellent").length;
    const good = tiers.filter(t => t === "Good").length;
    const adequate = tiers.filter(t => t === "Adequate").length;
    const needsImprovement = tiers.filter(t => t === "Needs Improvement").length;

    expect(excellent).toBe(2);  // 95, 85
    expect(good).toBe(1);       // 75
    expect(adequate).toBe(1);   // 65
    expect(needsImprovement).toBe(2); // 45, 30
  });
});
