/**
 * Tests for adminUpdateArchivedChallenge and adminUpdateArchivedQuestion procedures.
 *
 * These tests exercise the tRPC procedures using in-memory mocks so no real DB is required.
 * We test:
 *  - adminUpdateArchivedChallenge: rejects unauthenticated calls
 *  - adminUpdateArchivedChallenge: rejects non-admin users
 *  - adminUpdateArchivedChallenge: throws INTERNAL_SERVER_ERROR when DB is unavailable
 *  - adminUpdateArchivedQuestion: rejects unauthenticated calls
 *  - adminUpdateArchivedQuestion: rejects non-admin users
 *  - adminUpdateArchivedQuestion: throws INTERNAL_SERVER_ERROR when DB is unavailable
 */
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 42,
    openId: "test-open-id",
    email: "test@iheartecho.com",
    name: "Test User",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeAdminUser(): AuthenticatedUser {
  return makeUser({ id: 1, role: "admin", email: "admin@iheartecho.com" });
}

function makeCtx(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// Mock the DB so tests don't need a real database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ─── adminUpdateArchivedChallenge ─────────────────────────────────────────────

describe("quickfire.adminUpdateArchivedChallenge", () => {
  it("rejects unauthenticated calls", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.quickfire.adminUpdateArchivedChallenge({ id: 1, title: "Updated Title" })
    ).rejects.toThrow();
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.quickfire.adminUpdateArchivedChallenge({ id: 1, title: "Updated Title" })
    ).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB is unavailable (admin)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.adminUpdateArchivedChallenge({ id: 1, title: "Updated Title" })
    ).rejects.toThrow("DB unavailable");
  });

  it("accepts valid optional fields without throwing (DB unavailable)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.adminUpdateArchivedChallenge({
        id: 1,
        title: "Updated Title",
        description: "New description",
        category: "Adult Echo",
        difficulty: "intermediate",
      })
    ).rejects.toThrow("DB unavailable");
  });
});

// ─── adminUpdateArchivedQuestion ─────────────────────────────────────────────

describe("quickfire.adminUpdateArchivedQuestion", () => {
  it("rejects unauthenticated calls", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.quickfire.adminUpdateArchivedQuestion({ id: 1 })
    ).rejects.toThrow();
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.quickfire.adminUpdateArchivedQuestion({ id: 1 })
    ).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB is unavailable (admin)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.adminUpdateArchivedQuestion({ id: 1 })
    ).rejects.toThrow("DB unavailable");
  });

  it("accepts question text and options without throwing (DB unavailable)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.adminUpdateArchivedQuestion({
        id: 1,
        question: "<p>Updated question text</p>",
        explanation: "Updated explanation",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: 0,
        difficulty: "advanced",
        tags: ["Adult Echo"],
      })
    ).rejects.toThrow("DB unavailable");
  });

  it("accepts null fields to clear optional data (DB unavailable)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.adminUpdateArchivedQuestion({
        id: 1,
        explanation: null,
        reviewAnswer: null,
        imageUrl: null,
        correctAnswer: null,
      })
    ).rejects.toThrow("DB unavailable");
  });
});
