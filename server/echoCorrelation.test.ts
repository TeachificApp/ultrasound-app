import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  createEchoCorrelation: vi.fn(),
  getEchoCorrelationsByUser: vi.fn(),
  getEchoCorrelationById: vi.fn(),
  updateEchoCorrelation: vi.fn(),
  deleteEchoCorrelation: vi.fn(),
  getEchoCorrelationsByLab: vi.fn(),
}));

import {
  createEchoCorrelation,
  getEchoCorrelationsByUser,
  getEchoCorrelationById,
  updateEchoCorrelation,
  deleteEchoCorrelation,
  getEchoCorrelationsByLab,
} from "./db";

// ─── Concordance rate calculation logic (pure function tests) ─────────────────

type ConcordanceResult = "Concordant" | "Minor Variance" | "Major Variance" | "N/A";

function calcConcordanceRate(
  rows: { concordance: ConcordanceResult }[]
): number | null {
  const relevant = rows.filter(r => r.concordance !== "N/A");
  if (relevant.length === 0) return null;
  const concordant = relevant.filter(r => r.concordance === "Concordant").length;
  return Math.round((concordant / relevant.length) * 100);
}

describe("Echo Correlation — Concordance Rate Calculation", () => {
  it("returns null when all rows are N/A", () => {
    const rows = [
      { concordance: "N/A" as ConcordanceResult },
      { concordance: "N/A" as ConcordanceResult },
    ];
    expect(calcConcordanceRate(rows)).toBeNull();
  });

  it("returns 100 when all relevant rows are Concordant", () => {
    const rows = [
      { concordance: "Concordant" as ConcordanceResult },
      { concordance: "Concordant" as ConcordanceResult },
      { concordance: "N/A" as ConcordanceResult },
    ];
    expect(calcConcordanceRate(rows)).toBe(100);
  });

  it("returns 0 when all relevant rows are Major Variance", () => {
    const rows = [
      { concordance: "Major Variance" as ConcordanceResult },
      { concordance: "Major Variance" as ConcordanceResult },
    ];
    expect(calcConcordanceRate(rows)).toBe(0);
  });

  it("calculates mixed concordance correctly", () => {
    const rows = [
      { concordance: "Concordant" as ConcordanceResult },
      { concordance: "Concordant" as ConcordanceResult },
      { concordance: "Minor Variance" as ConcordanceResult },
      { concordance: "Major Variance" as ConcordanceResult },
      { concordance: "N/A" as ConcordanceResult },
    ];
    // 2 concordant out of 4 relevant = 50%
    expect(calcConcordanceRate(rows)).toBe(50);
  });

  it("rounds to nearest integer", () => {
    const rows = [
      { concordance: "Concordant" as ConcordanceResult },
      { concordance: "Concordant" as ConcordanceResult },
      { concordance: "Major Variance" as ConcordanceResult },
    ];
    // 2/3 = 66.67 → rounds to 67
    expect(calcConcordanceRate(rows)).toBe(67);
  });

  it("handles single concordant row", () => {
    const rows = [{ concordance: "Concordant" as ConcordanceResult }];
    expect(calcConcordanceRate(rows)).toBe(100);
  });

  it("handles single variance row", () => {
    const rows = [{ concordance: "Minor Variance" as ConcordanceResult }];
    expect(calcConcordanceRate(rows)).toBe(0);
  });
});

// ─── DB helper mock tests ─────────────────────────────────────────────────────

describe("Echo Correlation — DB Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createEchoCorrelation is called with correct data", async () => {
    const mockFn = vi.mocked(createEchoCorrelation);
    mockFn.mockResolvedValueOnce(undefined);

    const data = {
      userId: 42,
      organization: "Test Lab",
      examType: "Adult TTE",
      correlation1Type: "Cardiac Catheterization",
      overallConcordanceRate: 85,
    };

    await createEchoCorrelation(data as Parameters<typeof createEchoCorrelation>[0]);
    expect(mockFn).toHaveBeenCalledWith(data);
  });

  it("getEchoCorrelationsByUser returns array for valid userId", async () => {
    const mockFn = vi.mocked(getEchoCorrelationsByUser);
    const mockData = [
      { id: 1, userId: 42, organization: "Lab A", overallConcordanceRate: 90 },
      { id: 2, userId: 42, organization: "Lab A", overallConcordanceRate: 75 },
    ];
    mockFn.mockResolvedValueOnce(mockData as ReturnType<typeof getEchoCorrelationsByUser> extends Promise<infer T> ? T : never);

    const result = await getEchoCorrelationsByUser(42);
    expect(result).toHaveLength(2);
    expect(result[0].overallConcordanceRate).toBe(90);
  });

  it("getEchoCorrelationsByUser returns empty array when no records", async () => {
    vi.mocked(getEchoCorrelationsByUser).mockResolvedValueOnce([]);
    const result = await getEchoCorrelationsByUser(999);
    expect(result).toEqual([]);
  });

  it("getEchoCorrelationById returns null for non-existent record", async () => {
    vi.mocked(getEchoCorrelationById).mockResolvedValueOnce(null);
    const result = await getEchoCorrelationById(9999);
    expect(result).toBeNull();
  });

  it("getEchoCorrelationById returns record for valid id", async () => {
    const mockRecord = {
      id: 1,
      userId: 42,
      organization: "Test Lab",
      examType: "Adult TTE",
      correlation1Type: "Cardiac Catheterization",
      overallConcordanceRate: 88,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getEchoCorrelationById).mockResolvedValueOnce(mockRecord as ReturnType<typeof getEchoCorrelationById> extends Promise<infer T> ? T : never);

    const result = await getEchoCorrelationById(1);
    expect(result?.organization).toBe("Test Lab");
    expect(result?.overallConcordanceRate).toBe(88);
  });

  it("updateEchoCorrelation is called with id and partial data", async () => {
    const mockFn = vi.mocked(updateEchoCorrelation);
    mockFn.mockResolvedValueOnce(undefined);

    await updateEchoCorrelation(1, { overallConcordanceRate: 92, varianceNotes: "Minor discrepancy in EF" });
    expect(mockFn).toHaveBeenCalledWith(1, { overallConcordanceRate: 92, varianceNotes: "Minor discrepancy in EF" });
  });

  it("deleteEchoCorrelation is called with correct id", async () => {
    const mockFn = vi.mocked(deleteEchoCorrelation);
    mockFn.mockResolvedValueOnce(undefined);

    await deleteEchoCorrelation(5);
    expect(mockFn).toHaveBeenCalledWith(5);
  });

  it("getEchoCorrelationsByLab filters by labId", async () => {
    const mockFn = vi.mocked(getEchoCorrelationsByLab);
    const mockData = [
      { id: 1, userId: 10, labId: 3, organization: "Lab Corp" },
      { id: 2, userId: 11, labId: 3, organization: "Lab Corp" },
    ];
    mockFn.mockResolvedValueOnce(mockData as ReturnType<typeof getEchoCorrelationsByLab> extends Promise<infer T> ? T : never);

    const result = await getEchoCorrelationsByLab(3);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.labId === 3)).toBe(true);
  });
});

// ─── Concordance tier classification ─────────────────────────────────────────

describe("Echo Correlation — Concordance Tier Classification", () => {
  function classifyRate(rate: number | null): string {
    if (rate === null) return "N/A";
    if (rate >= 80) return "Good Concordance";
    if (rate >= 60) return "Moderate Variance";
    return "High Variance";
  }

  it("classifies null rate as N/A", () => {
    expect(classifyRate(null)).toBe("N/A");
  });

  it("classifies 100% as Good Concordance", () => {
    expect(classifyRate(100)).toBe("Good Concordance");
  });

  it("classifies 80% as Good Concordance", () => {
    expect(classifyRate(80)).toBe("Good Concordance");
  });

  it("classifies 79% as Moderate Variance", () => {
    expect(classifyRate(79)).toBe("Moderate Variance");
  });

  it("classifies 60% as Moderate Variance", () => {
    expect(classifyRate(60)).toBe("Moderate Variance");
  });

  it("classifies 59% as High Variance", () => {
    expect(classifyRate(59)).toBe("High Variance");
  });

  it("classifies 0% as High Variance", () => {
    expect(classifyRate(0)).toBe("High Variance");
  });
});
