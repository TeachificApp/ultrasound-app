/**
 * Tests for formBuilder submission procedures:
 * - listSubmissionsForLab
 * - getSubmissionDetails
 * - updateSubmissionStatus
 * - getSubmissionStats
 * - getSubmissionStaffList
 *
 * These tests use the tRPC caller pattern with mocked DB helpers.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getFormSubmissionsForLab: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    getFormSubmissionWithDetails: vi.fn().mockResolvedValue(null),
    getFormSubmissionStatsForLab: vi.fn().mockResolvedValue(null),
    getFormSubmissionStaffList: vi.fn().mockResolvedValue([]),
    getUserRoles: vi.fn().mockResolvedValue(["diy_admin"]),
  };
});

vi.mock("./db/formBuilder", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db/formBuilder")>();
  return {
    ...original,
    getFormSubmissionsForLab: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    getFormSubmissionWithDetails: vi.fn().mockResolvedValue(null),
    getFormSubmissionStatsForLab: vi.fn().mockResolvedValue(null),
    getFormSubmissionStaffList: vi.fn().mockResolvedValue([]),
  };
});

// ─── Context helpers ──────────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeLabAdminCtx(role: "admin" | "user" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "lab-admin-user",
    email: "admin@lab.com",
    name: "Lab Admin",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeUnauthCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("formBuilder.listSubmissionsForLab", () => {
  it("returns empty list for a lab with no submissions", async () => {
    const ctx = makeLabAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.formBuilder.listSubmissionsForLab({ labId: 1 });
    expect(result).toMatchObject({ rows: expect.any(Array), total: expect.any(Number) });
    expect(result.rows).toHaveLength(0);
  });

  it("throws UNAUTHORIZED when user is not logged in", async () => {
    const ctx = makeUnauthCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.formBuilder.listSubmissionsForLab({ labId: 1 })
    ).rejects.toThrow();
  });

  it("accepts optional filters: formType, status, dateFrom, dateTo, limit, offset", async () => {
    const ctx = makeLabAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.formBuilder.listSubmissionsForLab({
      labId: 1,
      formType: "image_quality_review",
      status: "submitted",
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
      limit: 10,
      offset: 0,
    });
    expect(result).toMatchObject({ rows: expect.any(Array), total: expect.any(Number) });
  });

  it("rejects invalid status values", async () => {
    const ctx = makeLabAdminCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.formBuilder.listSubmissionsForLab({
        labId: 1,
        // @ts-expect-error intentionally invalid
        status: "invalid_status",
      })
    ).rejects.toThrow();
  });

  it("rejects limit > 200", async () => {
    const ctx = makeLabAdminCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.formBuilder.listSubmissionsForLab({ labId: 1, limit: 201 })
    ).rejects.toThrow();
  });
});

describe("formBuilder.getSubmissionDetails", () => {
  it("throws NOT_FOUND for a non-existent submission", async () => {
    const ctx = makeLabAdminCtx();
    const caller = appRouter.createCaller(ctx);
    // The mock returns null; the procedure should throw NOT_FOUND
    await expect(
      caller.formBuilder.getSubmissionDetails({ id: 9999 })
    ).rejects.toThrow();
  });

  it("throws UNAUTHORIZED when user is not logged in", async () => {
    const ctx = makeUnauthCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.formBuilder.getSubmissionDetails({ id: 1 })
    ).rejects.toThrow();
  });
});

describe("formBuilder.getSubmissionStats", () => {
  it("returns null for a lab with no data", async () => {
    const ctx = makeLabAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.formBuilder.getSubmissionStats({ labId: 1 });
    expect(result).toBeNull();
  });

  it("throws UNAUTHORIZED when user is not logged in", async () => {
    const ctx = makeUnauthCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.formBuilder.getSubmissionStats({ labId: 1 })
    ).rejects.toThrow();
  });
});

describe("formBuilder.getSubmissionStaffList", () => {
  it("returns empty array for a lab with no submissions", async () => {
    const ctx = makeLabAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.formBuilder.getSubmissionStaffList({ labId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("throws UNAUTHORIZED when user is not logged in", async () => {
    const ctx = makeUnauthCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.formBuilder.getSubmissionStaffList({ labId: 1 })
    ).rejects.toThrow();
  });
});

describe("formBuilder.updateSubmissionStatus", () => {
  it("throws UNAUTHORIZED when user is not logged in", async () => {
    const ctx = makeUnauthCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.formBuilder.updateSubmissionStatus({ id: 1, status: "reviewed" })
    ).rejects.toThrow();
  });

  it("rejects invalid status values", async () => {
    const ctx = makeLabAdminCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.formBuilder.updateSubmissionStatus({
        id: 1,
        // @ts-expect-error intentionally invalid
        status: "approved",
      })
    ).rejects.toThrow();
  });
});
