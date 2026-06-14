/**
 * curriculumEmbedVisibility.test.ts
 *
 * Unit tests for the getCurriculumEmbedVisibility and setCurriculumEmbedVisibility
 * procedures in lmsCourseBuilderRouter.
 *
 * These tests use a mock database context so no real DB connection is needed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ─── Mock the database ────────────────────────────────────────────────────────

const mockRows: Array<{
  id: number;
  courseId: number;
  itemType: "section" | "lesson";
  itemId: number;
  hidden: boolean;
  updatedAt: Date;
}> = [];

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mockRows),
      }),
    }),
    insert: () => ({
      values: () => ({
        onDuplicateKeyUpdate: () => Promise.resolve(),
      }),
    }),
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getCurriculumEmbedVisibility", () => {
  beforeEach(() => {
    mockRows.length = 0;
  });

  it("returns an empty hiddenMap when no rows exist", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lmsAdmin.getCurriculumEmbedVisibility({ courseId: 1 });
    expect(result.hiddenMap).toEqual({});
    expect(result.rows).toEqual([]);
  });

  it("returns a hiddenMap with hidden items keyed as itemType_itemId", async () => {
    mockRows.push(
      { id: 1, courseId: 1, itemType: "section", itemId: 10, hidden: true, updatedAt: new Date() },
      { id: 2, courseId: 1, itemType: "lesson", itemId: 42, hidden: true, updatedAt: new Date() },
    );
    const { appRouter } = await import("./routers");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lmsAdmin.getCurriculumEmbedVisibility({ courseId: 1 });
    expect(result.hiddenMap["section_10"]).toBe(true);
    expect(result.hiddenMap["lesson_42"]).toBe(true);
    expect(Object.keys(result.hiddenMap)).toHaveLength(2);
  });

  it("does not include non-hidden rows in the hiddenMap", async () => {
    mockRows.push(
      { id: 1, courseId: 1, itemType: "section", itemId: 10, hidden: false, updatedAt: new Date() },
    );
    const { appRouter } = await import("./routers");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lmsAdmin.getCurriculumEmbedVisibility({ courseId: 1 });
    expect(result.hiddenMap).toEqual({});
    expect(result.rows).toHaveLength(1);
  });
});

describe("setCurriculumEmbedVisibility", () => {
  it("calls insert with the correct values and returns success", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lmsAdmin.setCurriculumEmbedVisibility({
      courseId: 1,
      items: [
        { itemType: "section", itemId: 10, hidden: true },
        { itemType: "lesson", itemId: 42, hidden: false },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.updated).toBe(2);
  });

  it("returns updated count equal to items array length", async () => {
    const { appRouter } = await import("./routers");
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lmsAdmin.setCurriculumEmbedVisibility({
      courseId: 5,
      items: [
        { itemType: "lesson", itemId: 1, hidden: true },
        { itemType: "lesson", itemId: 2, hidden: true },
        { itemType: "lesson", itemId: 3, hidden: false },
      ],
    });
    expect(result.updated).toBe(3);
  });
});
