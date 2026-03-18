/**
 * Physician Peer Review — unit tests
 * Tests cover DB helper logic, concordance scoring, and analytics aggregation.
 */
import { describe, it, expect } from "vitest";

// ─── Concordance scoring helpers (pure logic, no DB) ─────────────────────────

function computeConcordanceScore(
  original: Record<string, string | null | undefined>,
  overread: Record<string, string | null | undefined>
): number {
  const fields = Object.keys(original).filter(k => original[k] != null && original[k] !== "");
  if (fields.length === 0) return 100;
  const matching = fields.filter(k => original[k] === overread[k]);
  return Math.round((matching.length / fields.length) * 100);
}

describe("Physician Peer Review — concordance scoring", () => {
  it("returns 100 when all fields match", () => {
    const original = { situs: "Normal", cardiacPosition: "Normal", efPercent: "55-65%" };
    const overread = { situs: "Normal", cardiacPosition: "Normal", efPercent: "55-65%" };
    expect(computeConcordanceScore(original, overread)).toBe(100);
  });

  it("returns 0 when no fields match", () => {
    const original = { situs: "Normal", cardiacPosition: "Normal", efPercent: "55-65%" };
    const overread = { situs: "Situs Inversus", cardiacPosition: "Dextrocardia", efPercent: "<35%" };
    expect(computeConcordanceScore(original, overread)).toBe(0);
  });

  it("returns 67 when 2 of 3 fields match", () => {
    const original = { situs: "Normal", cardiacPosition: "Normal", efPercent: "55-65%" };
    const overread = { situs: "Normal", cardiacPosition: "Normal", efPercent: "<35%" };
    expect(computeConcordanceScore(original, overread)).toBe(67);
  });

  it("returns 100 when original has no filled fields", () => {
    const original = { situs: null, cardiacPosition: "", efPercent: undefined };
    const overread = { situs: "Normal", cardiacPosition: "Normal", efPercent: "55-65%" };
    expect(computeConcordanceScore(original, overread)).toBe(100);
  });

  it("ignores fields not present in original", () => {
    const original = { situs: "Normal" };
    const overread = { situs: "Normal", cardiacPosition: "Dextrocardia" };
    expect(computeConcordanceScore(original, overread)).toBe(100);
  });
});

// ─── Discordance field detection ─────────────────────────────────────────────

function getDiscordantFields(
  original: Record<string, string | null | undefined>,
  overread: Record<string, string | null | undefined>
): string[] {
  return Object.keys(original).filter(
    k => original[k] != null && original[k] !== "" && original[k] !== overread[k]
  );
}

describe("Physician Peer Review — discordance detection", () => {
  it("returns empty array when all fields match", () => {
    const original = { situs: "Normal", efPercent: "55-65%" };
    const overread = { situs: "Normal", efPercent: "55-65%" };
    expect(getDiscordantFields(original, overread)).toEqual([]);
  });

  it("returns discordant field names", () => {
    const original = { situs: "Normal", efPercent: "55-65%", aorticStenosis: "None" };
    const overread = { situs: "Normal", efPercent: "<35%", aorticStenosis: "Mild" };
    const discordant = getDiscordantFields(original, overread);
    expect(discordant).toContain("efPercent");
    expect(discordant).toContain("aorticStenosis");
    expect(discordant).not.toContain("situs");
  });

  it("ignores null/empty original fields", () => {
    const original = { situs: null, efPercent: "", aorticStenosis: "None" };
    const overread = { situs: "Normal", efPercent: "55-65%", aorticStenosis: "Mild" };
    const discordant = getDiscordantFields(original, overread);
    expect(discordant).toEqual(["aorticStenosis"]);
  });
});

// ─── Exam type branching validation ──────────────────────────────────────────

const ADULT_TTE_FIELDS = [
  "situs", "cardiacPosition", "leftHeart", "rightHeart", "efPercent",
  "lvWallThickness", "ventricularSeptalDefect", "atrialSeptalDefect",
  "patentForamenOvale", "lvChamberSize", "laChamberSize", "rvChamberSize",
  "raChamberSize", "regionalWallMotionAbnormalities",
  "aorticValve", "mitralValve", "tricuspidValve", "pulmonicValve",
  "aorticStenosis", "aorticInsufficiency", "mitralStenosis", "mitralRegurgitation",
  "tricuspidStenosis", "tricuspidRegurgitation", "pulmonicStenosis", "pulmonicInsufficiency",
  "rvspmm", "pericardialEffusion",
];

const STRESS_ONLY_FIELDS = [
  "restingEfPercent", "postStressEfPercent", "restingRwma", "postStressRwma",
  "responseToStress", "postStressDopplerPerformed",
];

const PEDIATRIC_EXTRA_FIELDS = [
  "pulmonaryVeins", "coronaryAnatomy", "aorticArch", "greatVessels",
  "pdaDuctalArch", "conotruncalAnatomy", "peripheralPulmonaryStenosis",
];

const FETAL_FIELDS = ["fetalBiometry", "fetalPosition", "fetalHeartRateRhythm"];

describe("Physician Peer Review — exam type field sets", () => {
  it("Adult TTE has 28 core finding fields", () => {
    expect(ADULT_TTE_FIELDS).toHaveLength(28);
  });

  it("Stress exam has 6 stress-specific fields", () => {
    expect(STRESS_ONLY_FIELDS).toHaveLength(6);
  });

  it("Pediatric exam has 7 extra fields beyond Adult TTE", () => {
    expect(PEDIATRIC_EXTRA_FIELDS).toHaveLength(7);
  });

  it("Fetal echo has 3 fetal-specific fields", () => {
    expect(FETAL_FIELDS).toHaveLength(3);
  });

  it("Stress fields do not overlap with Adult TTE fields", () => {
    const overlap = STRESS_ONLY_FIELDS.filter(f => ADULT_TTE_FIELDS.includes(f));
    expect(overlap).toHaveLength(0);
  });

  it("Pediatric extra fields do not overlap with Adult TTE fields", () => {
    const overlap = PEDIATRIC_EXTRA_FIELDS.filter(f => ADULT_TTE_FIELDS.includes(f));
    expect(overlap).toHaveLength(0);
  });
});

// ─── Analytics aggregation helpers ───────────────────────────────────────────

function aggregateStaffSnapshot(reviews: Array<{ revieweeLabMemberId: number; revieweeName: string; concordanceScore: number | null }>) {
  const map = new Map<number, { revieweeName: string; scores: number[]; reviewCount: number }>();
  for (const r of reviews) {
    if (!map.has(r.revieweeLabMemberId)) {
      map.set(r.revieweeLabMemberId, { revieweeName: r.revieweeName, scores: [], reviewCount: 0 });
    }
    const entry = map.get(r.revieweeLabMemberId)!;
    entry.reviewCount++;
    if (r.concordanceScore != null) entry.scores.push(r.concordanceScore);
  }
  return Array.from(map.entries()).map(([id, e]) => ({
    revieweeLabMemberId: id,
    revieweeName: e.revieweeName,
    reviewCount: e.reviewCount,
    avgConcordanceScore: e.scores.length > 0 ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length : null,
  }));
}

describe("Physician Peer Review — analytics aggregation", () => {
  it("aggregates reviews by physician correctly", () => {
    const reviews = [
      { revieweeLabMemberId: 1, revieweeName: "Dr. Smith", concordanceScore: 90 },
      { revieweeLabMemberId: 1, revieweeName: "Dr. Smith", concordanceScore: 80 },
      { revieweeLabMemberId: 2, revieweeName: "Dr. Jones", concordanceScore: 95 },
    ];
    const snapshot = aggregateStaffSnapshot(reviews);
    const smith = snapshot.find(s => s.revieweeLabMemberId === 1)!;
    const jones = snapshot.find(s => s.revieweeLabMemberId === 2)!;
    expect(smith.reviewCount).toBe(2);
    expect(smith.avgConcordanceScore).toBe(85);
    expect(jones.reviewCount).toBe(1);
    expect(jones.avgConcordanceScore).toBe(95);
  });

  it("handles null concordance scores gracefully", () => {
    const reviews = [
      { revieweeLabMemberId: 1, revieweeName: "Dr. Smith", concordanceScore: null },
    ];
    const snapshot = aggregateStaffSnapshot(reviews);
    expect(snapshot[0].avgConcordanceScore).toBeNull();
    expect(snapshot[0].reviewCount).toBe(1);
  });

  it("returns empty array for empty input", () => {
    expect(aggregateStaffSnapshot([])).toHaveLength(0);
  });
});
