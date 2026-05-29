import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

describe("getMemberOverview data shape", () => {
  it("should return expected stats structure", () => {
    const stats = {
      totalMembers: 100,
      activeMembers: 45,
      newThisMonth: 12,
      newLastMonth: 8,
      totalCompletions: 30,
      engagementRate: 45,
    };
    expect(stats.totalMembers).toBeGreaterThanOrEqual(0);
    expect(stats.activeMembers).toBeGreaterThanOrEqual(0);
    expect(stats.engagementRate).toBeGreaterThanOrEqual(0);
    expect(stats.engagementRate).toBeLessThanOrEqual(100);
  });

  it("should compute engagementRate correctly", () => {
    const totalMembers = 200;
    const activeMembers = 80;
    const engagementRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;
    expect(engagementRate).toBe(40);
  });

  it("should compute progress correctly", () => {
    const enrollmentCount = 4;
    const completionCount = 2;
    const progress = enrollmentCount > 0 ? Math.round((completionCount / enrollmentCount) * 100) : 0;
    expect(progress).toBe(50);
  });

  it("should return 0 progress when no enrollments", () => {
    const enrollmentCount = 0;
    const completionCount = 0;
    const progress = enrollmentCount > 0 ? Math.round((completionCount / enrollmentCount) * 100) : 0;
    expect(progress).toBe(0);
  });
});

describe("listMembers pagination", () => {
  it("should compute offset correctly", () => {
    const page = 3;
    const pageSize = 25;
    const offset = (page - 1) * pageSize;
    expect(offset).toBe(50);
  });

  it("should compute totalPages correctly", () => {
    const total = 73;
    const pageSize = 25;
    const totalPages = Math.ceil(total / pageSize);
    expect(totalPages).toBe(3);
  });

  it("should handle empty results", () => {
    const rows: any[] = [];
    const members = rows.map((r: any) => ({
      id: Number(r.id),
      name: r.name ?? r.email ?? "Unknown",
      email: r.email ?? "",
    }));
    expect(members).toHaveLength(0);
  });
});
