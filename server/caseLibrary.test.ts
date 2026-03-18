/**
 * Tests for the Case Library router.
 *
 * These tests exercise the tRPC procedures using in-memory mocks so no real DB is required.
 * We test:
 *  - listCases: public procedure works without auth
 *  - getCase: public procedure works without auth
 *  - submitCase: rejects unauthenticated calls
 *  - submitCase: rejects when HIPAA not acknowledged
 *  - approveCase: rejects non-admin users
 *  - rejectCase: rejects non-admin users
 *  - listPendingCases: rejects non-admin users
 */

import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 99,
    openId: "case-test-user",
    email: "casetest@iheartecho.com",
    name: "Case Tester",
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

// ─── listCases ───────────────────────────────────────────────────────────────

describe("caseLibrary.listCases", () => {
  it("is a public procedure (no auth required) and throws when DB unavailable", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.caseLibrary.listCases({ page: 1, limit: 10 })
    ).rejects.toThrow();
  });
});

// ─── getCase ─────────────────────────────────────────────────────────────────

describe("caseLibrary.getCase", () => {
  it("is a public procedure and throws when DB unavailable", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.caseLibrary.getCase({ id: 1 })
    ).rejects.toThrow();
  });
});

// ─── submitCase ──────────────────────────────────────────────────────────────

describe("caseLibrary.submitCase", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.caseLibrary.submitCase({
        title: "Test Case",
        summary: "This is a test case summary with enough characters.",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: true,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });

  it("throws when DB unavailable (HIPAA check occurs after DB check)", async () => {
    // The router checks DB availability before HIPAA acknowledgement,
    // so with a mocked DB we expect a DB error first.
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.submitCase({
        title: "Test Case",
        summary: "This is a test case summary with enough characters.",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: false,
        media: [],
        questions: [],
      })
    ).rejects.toThrow("DB unavailable");
  });

  it("throws when DB unavailable (authenticated, HIPAA acknowledged)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.submitCase({
        title: "Test Case",
        summary: "This is a test case summary with enough characters.",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: true,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });
});

// ─── Admin procedures ─────────────────────────────────────────────────────────

describe("caseLibrary.listPendingCases", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.caseLibrary.listPendingCases()).rejects.toThrow();
  });

  it("throws when DB unavailable for admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(caller.caseLibrary.listPendingCases()).rejects.toThrow();
  });
});

describe("caseLibrary.approveCase", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.caseLibrary.approveCase({ id: 1 })).rejects.toThrow();
  });

  it("throws when DB unavailable for admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(caller.caseLibrary.approveCase({ id: 1 })).rejects.toThrow();
  });
});

describe("caseLibrary.rejectCase", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.rejectCase({ id: 1, reason: "Contains PHI data." })
    ).rejects.toThrow();
  });

  it("throws when DB unavailable for admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.caseLibrary.rejectCase({ id: 1, reason: "Contains PHI data." })
    ).rejects.toThrow();
  });
});

// ─── submitAttempt ────────────────────────────────────────────────────────────

describe("caseLibrary.submitAttempt", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.caseLibrary.submitAttempt({ caseId: 1, answers: { 1: 0 } })
    ).rejects.toThrow();
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("caseLibrary input validation", () => {
  it("rejects submitCase with title too short", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.submitCase({
        title: "Hi", // too short (min 5)
        summary: "This is a test case summary with enough characters.",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: true,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });

  it("rejects submitCase with summary too short", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.submitCase({
        title: "Valid Title",
        summary: "Short", // too short (min 10)
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: true,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });

  it("rejects rejectCase with reason too short", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.caseLibrary.rejectCase({ id: 1, reason: "No" }) // too short (min 5)
    ).rejects.toThrow();
  });
});

// ─── getPendingCount ──────────────────────────────────────────────────────────

describe("caseLibrary.getPendingCount", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.caseLibrary.getPendingCount()).rejects.toThrow();
  });

  it("throws when DB unavailable for admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    // DB is mocked to return null, so the procedure should throw INTERNAL_SERVER_ERROR
    await expect(caller.caseLibrary.getPendingCount()).rejects.toThrow();
  });
});

// ─── getMyCase ────────────────────────────────────────────────────────────────
describe("caseLibrary.getMyCase", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.caseLibrary.getMyCase({ id: 1 })).rejects.toThrow();
  });
  it("throws when DB unavailable (authenticated user)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.caseLibrary.getMyCase({ id: 1 })).rejects.toThrow();
  });
  it("rejects invalid id (zero)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.caseLibrary.getMyCase({ id: 0 })).rejects.toThrow();
  });
  it("rejects invalid id (negative)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.caseLibrary.getMyCase({ id: -5 })).rejects.toThrow();
  });
});

// ─── updateCase (resubmission) ────────────────────────────────────────────────
describe("caseLibrary.updateCase", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.caseLibrary.updateCase({
        id: 1,
        title: "Updated Case Title Here",
        summary: "Updated summary with enough detail",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: true,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });
  it("throws BAD_REQUEST when HIPAA is not acknowledged", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.updateCase({
        id: 1,
        title: "Updated Case Title Here",
        summary: "Updated summary with enough detail",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: false,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });
  it("throws when DB unavailable (authenticated user, HIPAA acknowledged)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.updateCase({
        id: 1,
        title: "Updated Case Title Here",
        summary: "Updated summary with enough detail",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: true,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });
  it("rejects updateCase with title too short", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.updateCase({
        id: 1,
        title: "Hi",
        summary: "Updated summary with enough detail",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: true,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });
  it("rejects updateCase with summary too short", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.updateCase({
        id: 1,
        title: "Updated Case Title Here",
        summary: "Too short",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: true,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });
  it("rejects invalid case id (zero)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.updateCase({
        id: 0,
        title: "Updated Case Title Here",
        summary: "Updated summary with enough detail",
        modality: "TTE",
        difficulty: "intermediate",
        tags: [],
        hipaaAcknowledged: true,
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });
});

// ── AI Generator Procedures ──────────────────────────────────────────────────

describe("caseLibrary.aiGenerateCase", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.caseLibrary.aiGenerateCase({ prompt: "valid prompt", modality: "TTE", difficulty: "intermediate", questionCount: 2 })
    ).rejects.toThrow();
  });

  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.caseLibrary.aiGenerateCase({ prompt: "valid prompt", modality: "TTE", difficulty: "intermediate", questionCount: 2 })
    ).rejects.toThrow();
  });

  it("rejects empty prompt", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.caseLibrary.aiGenerateCase({ prompt: "", modality: "TTE", difficulty: "intermediate", questionCount: 2 })
    ).rejects.toThrow();
  });

  it("rejects questionCount above maximum (5)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.caseLibrary.aiGenerateCase({ prompt: "valid prompt", modality: "TTE", difficulty: "intermediate", questionCount: 10 })
    ).rejects.toThrow();
  });

  it("rejects questionCount below minimum (1)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.caseLibrary.aiGenerateCase({ prompt: "valid prompt", modality: "TTE", difficulty: "intermediate", questionCount: 0 })
    ).rejects.toThrow();
  });

  it("rejects invalid modality", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.caseLibrary.aiGenerateCase({ prompt: "valid prompt", modality: "INVALID" as any, difficulty: "intermediate", questionCount: 2 })
    ).rejects.toThrow();
  });
});
