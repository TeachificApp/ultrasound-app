/**
 * Accreditation Tool — unit tests for business logic
 * Tests policy category validation, peer review grading, and appropriate use classification
 */
import { describe, it, expect } from "vitest";

// ── Policy category validation ─────────────────────────────────────────────
const VALID_POLICY_CATEGORIES = [
  "quality",
  "safety",
  "infection_control",
  "equipment",
  "staff",
  "reporting",
  "other",
] as const;

type PolicyCategory = (typeof VALID_POLICY_CATEGORIES)[number];

function isValidPolicyCategory(cat: string): cat is PolicyCategory {
  return (VALID_POLICY_CATEGORIES as readonly string[]).includes(cat);
}

describe("Policy category validation", () => {
  it("accepts all valid categories", () => {
    for (const cat of VALID_POLICY_CATEGORIES) {
      expect(isValidPolicyCategory(cat)).toBe(true);
    }
  });

  it("rejects unknown categories", () => {
    expect(isValidPolicyCategory("billing")).toBe(false);
    expect(isValidPolicyCategory("")).toBe(false);
    expect(isValidPolicyCategory("QUALITY")).toBe(false); // case-sensitive
  });
});

// ── Peer review grading ────────────────────────────────────────────────────
type PeerReviewGrade = "acceptable" | "needs_improvement" | "unacceptable";

interface PeerReviewScores {
  imageQuality: number;   // 1–5
  reportAccuracy: number; // 1–5
  protocol: number;       // 1–5
}

function gradePeerReview(scores: PeerReviewScores): PeerReviewGrade {
  const avg = (scores.imageQuality + scores.reportAccuracy + scores.protocol) / 3;
  if (avg >= 4.0) return "acceptable";
  if (avg >= 2.5) return "needs_improvement";
  return "unacceptable";
}

describe("Peer review grading", () => {
  it("grades 5/5/5 as acceptable", () => {
    expect(gradePeerReview({ imageQuality: 5, reportAccuracy: 5, protocol: 5 })).toBe("acceptable");
  });

  it("grades 4/4/4 as acceptable", () => {
    expect(gradePeerReview({ imageQuality: 4, reportAccuracy: 4, protocol: 4 })).toBe("acceptable");
  });

  it("grades 3/3/3 as needs_improvement", () => {
    expect(gradePeerReview({ imageQuality: 3, reportAccuracy: 3, protocol: 3 })).toBe("needs_improvement");
  });

  it("grades 2/2/2 as unacceptable", () => {
    expect(gradePeerReview({ imageQuality: 2, reportAccuracy: 2, protocol: 2 })).toBe("unacceptable");
  });

  it("grades 1/1/1 as unacceptable", () => {
    expect(gradePeerReview({ imageQuality: 1, reportAccuracy: 1, protocol: 1 })).toBe("unacceptable");
  });

  it("handles mixed scores at the acceptable boundary (4.0 avg)", () => {
    // 3 + 5 + 4 = 12 / 3 = 4.0 → acceptable
    expect(gradePeerReview({ imageQuality: 3, reportAccuracy: 5, protocol: 4 })).toBe("acceptable");
  });

  it("handles mixed scores just below acceptable (3.9 avg)", () => {
    // 3 + 4 + 4 = 11 / 3 = 3.67 → needs_improvement
    expect(gradePeerReview({ imageQuality: 3, reportAccuracy: 4, protocol: 4 })).toBe("needs_improvement");
  });
});

// ── Appropriate use classification ────────────────────────────────────────
type AUCRating = "appropriate" | "may_be_appropriate" | "rarely_appropriate";

interface AUCCase {
  indication: string;
  modality: string;
  clinicalScenario: string;
}

// Simplified AUC logic for testing (mirrors the real classification logic)
function classifyAppropriateUse(c: AUCCase): AUCRating {
  const ind = c.indication.toLowerCase();
  const mod = c.modality.toLowerCase();

  // Routine screening without symptoms/risk factors → rarely appropriate
  if (ind.includes("routine") && ind.includes("screen") && !ind.includes("risk")) {
    return "rarely_appropriate";
  }
  // Symptomatic evaluation → appropriate
  if (ind.includes("symptom") || ind.includes("chest pain") || ind.includes("dyspnea")) {
    return "appropriate";
  }
  // Known disease follow-up → appropriate
  if (ind.includes("known") || ind.includes("follow-up") || ind.includes("surveillance")) {
    return "appropriate";
  }
  // Pre-op low-risk surgery → rarely appropriate
  if (ind.includes("pre-op") && ind.includes("low-risk")) {
    return "rarely_appropriate";
  }
  // Default
  return "may_be_appropriate";
}

describe("Appropriate use classification", () => {
  it("classifies symptomatic evaluation as appropriate", () => {
    expect(classifyAppropriateUse({
      indication: "dyspnea evaluation",
      modality: "TTE",
      clinicalScenario: "new onset dyspnea",
    })).toBe("appropriate");
  });

  it("classifies chest pain evaluation as appropriate", () => {
    expect(classifyAppropriateUse({
      indication: "chest pain workup",
      modality: "TTE",
      clinicalScenario: "atypical chest pain",
    })).toBe("appropriate");
  });

  it("classifies known valve disease follow-up as appropriate", () => {
    expect(classifyAppropriateUse({
      indication: "known aortic stenosis follow-up",
      modality: "TTE",
      clinicalScenario: "annual surveillance",
    })).toBe("appropriate");
  });

  it("classifies routine screening without risk factors as rarely appropriate", () => {
    expect(classifyAppropriateUse({
      indication: "routine screen, no symptoms",
      modality: "TTE",
      clinicalScenario: "annual physical",
    })).toBe("rarely_appropriate");
  });

  it("classifies pre-op low-risk surgery as rarely appropriate", () => {
    expect(classifyAppropriateUse({
      indication: "pre-op evaluation for low-risk surgery",
      modality: "TTE",
      clinicalScenario: "elective cataract surgery",
    })).toBe("rarely_appropriate");
  });

  it("classifies ambiguous indication as may_be_appropriate", () => {
    expect(classifyAppropriateUse({
      indication: "athlete evaluation",
      modality: "TTE",
      clinicalScenario: "sports clearance",
    })).toBe("may_be_appropriate");
  });
});

// ── IAC standards search ───────────────────────────────────────────────────
interface IACStandard {
  id: string;
  modality: string;
  section: string;
  title: string;
  content: string;
}

function searchStandards(standards: IACStandard[], query: string, modality?: string): IACStandard[] {
  const q = query.toLowerCase();
  return standards.filter(s => {
    const matchesQuery =
      s.title.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q);
    const matchesModality = !modality || s.modality === modality;
    return matchesQuery && matchesModality;
  });
}

describe("IAC standards search", () => {
  const mockStandards: IACStandard[] = [
    { id: "tte-1", modality: "TTE", section: "1.1", title: "Case Volume Requirements", content: "Minimum 300 complete TTE studies per year" },
    { id: "tte-2", modality: "TTE", section: "1.2", title: "CME Requirements", content: "Sonographers must complete 30 CME hours per year" },
    { id: "tee-1", modality: "TEE", section: "2.1", title: "Case Volume Requirements", content: "Minimum 50 complete TEE studies per year" },
    { id: "stress-1", modality: "Stress", section: "3.1", title: "Staff Qualifications", content: "Physician must be present during stress echo" },
    { id: "ped-1", modality: "Pediatric", section: "4.1", title: "Case Volume Requirements", content: "Minimum 150 pediatric studies per year" },
  ];

  it("finds standards by keyword in title", () => {
    const results = searchStandards(mockStandards, "case volume");
    expect(results).toHaveLength(3);
  });

  it("finds standards by keyword in content", () => {
    const results = searchStandards(mockStandards, "300");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("tte-1");
  });

  it("filters by modality", () => {
    const results = searchStandards(mockStandards, "case volume", "TTE");
    expect(results).toHaveLength(1);
    expect(results[0].modality).toBe("TTE");
  });

  it("returns empty array when no match", () => {
    const results = searchStandards(mockStandards, "billing");
    expect(results).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    const results = searchStandards(mockStandards, "CME REQUIREMENTS");
    expect(results).toHaveLength(1);
  });
});
