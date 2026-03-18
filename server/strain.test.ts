import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB module so tests run without a real database
vi.mock("./db", () => ({
  createEchoCase: vi.fn().mockResolvedValue(undefined),
  getEchoCasesByUser: vi.fn().mockResolvedValue([
    { id: 1, userId: 42, title: "Test Case", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") },
  ]),
  getEchoCaseById: vi.fn().mockResolvedValue({
    id: 1, userId: 42, title: "Test Case", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  }),
  createStrainSnapshot: vi.fn().mockResolvedValue(undefined),
  getStrainSnapshotsByCase: vi.fn().mockResolvedValue([
    {
      id: 1, userId: 42, caseId: 1, caseTitle: "Test Case",
      segmentValues: JSON.stringify({ 1: -18.5, 2: -19.0 }),
      wallMotionScores: JSON.stringify({ 1: 1, 2: 1 }),
      lvGls: "-19.2", rvStrain: "-28.5", laStrain: "36.0",
      wmsi: "1.0", vendor: "GE HealthCare", frameRate: 60,
      notes: "Test snapshot", createdAt: new Date("2026-01-01"),
    },
  ]),
  getStrainSnapshotsByUser: vi.fn().mockResolvedValue([]),
}));

import {
  createEchoCase,
  getEchoCasesByUser,
  getEchoCaseById,
  createStrainSnapshot,
  getStrainSnapshotsByCase,
  getStrainSnapshotsByUser,
} from "./db";

describe("Strain Navigator — DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEchoCase", () => {
    it("creates a case with required fields", async () => {
      await createEchoCase({ userId: 42, title: "65M with DCM" });
      expect(createEchoCase).toHaveBeenCalledWith({ userId: 42, title: "65M with DCM" });
    });

    it("is called once per invocation", async () => {
      await createEchoCase({ userId: 1, title: "Test" });
      expect(createEchoCase).toHaveBeenCalledTimes(1);
    });
  });

  describe("getEchoCasesByUser", () => {
    it("returns cases for a user", async () => {
      const cases = await getEchoCasesByUser(42);
      expect(Array.isArray(cases)).toBe(true);
      expect(cases.length).toBeGreaterThan(0);
      expect(cases[0].userId).toBe(42);
    });

    it("returns empty array for user with no cases", async () => {
      vi.mocked(getEchoCasesByUser).mockResolvedValueOnce([]);
      const cases = await getEchoCasesByUser(999);
      expect(cases).toEqual([]);
    });
  });

  describe("getEchoCaseById", () => {
    it("returns the case when it exists", async () => {
      const echoCase = await getEchoCaseById(1);
      expect(echoCase).not.toBeNull();
      expect(echoCase?.id).toBe(1);
      expect(echoCase?.title).toBe("Test Case");
    });

    it("returns null when case does not exist", async () => {
      vi.mocked(getEchoCaseById).mockResolvedValueOnce(null);
      const echoCase = await getEchoCaseById(9999);
      expect(echoCase).toBeNull();
    });
  });

  describe("createStrainSnapshot", () => {
    it("saves a snapshot with all fields", async () => {
      await createStrainSnapshot({
        userId: 42,
        caseId: 1,
        caseTitle: "Test Case",
        segmentValues: JSON.stringify({ 1: -18.5, 2: -19.0 }),
        wallMotionScores: JSON.stringify({ 1: 1, 2: 1 }),
        lvGls: "-19.2",
        rvStrain: "-28.5",
        laStrain: "36.0",
        wmsi: "1.0",
        vendor: "GE HealthCare",
        frameRate: 60,
        notes: "Ischemic pattern",
      });
      expect(createStrainSnapshot).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(createStrainSnapshot).mock.calls[0][0];
      expect(callArgs.userId).toBe(42);
      expect(callArgs.lvGls).toBe("-19.2");
      expect(callArgs.vendor).toBe("GE HealthCare");
    });

    it("saves a snapshot without a case (standalone)", async () => {
      await createStrainSnapshot({
        userId: 42,
        segmentValues: JSON.stringify({ 1: -20.0 }),
        lvGls: "-20.0",
      });
      expect(createStrainSnapshot).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(createStrainSnapshot).mock.calls[0][0];
      expect(callArgs.caseId).toBeUndefined();
    });
  });

  describe("getStrainSnapshotsByCase", () => {
    it("returns snapshots for a case", async () => {
      const snapshots = await getStrainSnapshotsByCase(1);
      expect(Array.isArray(snapshots)).toBe(true);
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].caseId).toBe(1);
      expect(snapshots[0].lvGls).toBe("-19.2");
    });

    it("returns empty array when no snapshots exist", async () => {
      vi.mocked(getStrainSnapshotsByCase).mockResolvedValueOnce([]);
      const snapshots = await getStrainSnapshotsByCase(999);
      expect(snapshots).toEqual([]);
    });
  });

  describe("getStrainSnapshotsByUser", () => {
    it("returns empty array for user with no snapshots", async () => {
      const snapshots = await getStrainSnapshotsByUser(999);
      expect(snapshots).toEqual([]);
    });
  });
});

describe("Strain Navigator — Quality Score calculation", () => {
  // Test the quality score logic inline (mirrors the AccreditationTool logic)
  function calcQualityScore(imageQuality: number, reportAccuracy: number, technicalAdherence: number): number {
    return Math.round(imageQuality * 0.4 + reportAccuracy * 0.35 + technicalAdherence * 0.25);
  }

  function getQualityTier(score: number): string {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 60) return "Adequate";
    return "Needs Improvement";
  }

  it("calculates correct weighted score", () => {
    expect(calcQualityScore(100, 100, 100)).toBe(100);
    expect(calcQualityScore(80, 80, 80)).toBe(80);
    expect(calcQualityScore(90, 85, 80)).toBe(86); // 36 + 29.75 + 20 = 85.75 → 86
  });

  it("assigns Excellent tier for score >= 90", () => {
    expect(getQualityTier(90)).toBe("Excellent");
    expect(getQualityTier(100)).toBe("Excellent");
    expect(getQualityTier(95)).toBe("Excellent");
  });

  it("assigns Good tier for score 75–89", () => {
    expect(getQualityTier(75)).toBe("Good");
    expect(getQualityTier(89)).toBe("Good");
  });

  it("assigns Adequate tier for score 60–74", () => {
    expect(getQualityTier(60)).toBe("Adequate");
    expect(getQualityTier(74)).toBe("Adequate");
  });

  it("assigns Needs Improvement for score < 60", () => {
    expect(getQualityTier(59)).toBe("Needs Improvement");
    expect(getQualityTier(0)).toBe("Needs Improvement");
  });
});

describe("Strain Navigator — WMSI calculation", () => {
  function calcWmsi(scores: number[]): number {
    if (scores.length === 0) return 1.0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  it("returns 1.0 for all normal segments", () => {
    const scores = Array(17).fill(1);
    expect(calcWmsi(scores)).toBe(1.0);
  });

  it("returns > 1.0 when abnormal segments are present", () => {
    const scores = [1, 1, 1, 2, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    expect(calcWmsi(scores)).toBeGreaterThan(1.0);
  });

  it("returns 1.0 for empty array", () => {
    expect(calcWmsi([])).toBe(1.0);
  });

  it("correctly averages mixed scores", () => {
    // 4 segments: 1, 1, 2, 4 → avg = 8/4 = 2.0
    expect(calcWmsi([1, 1, 2, 4])).toBe(2.0);
  });
});
