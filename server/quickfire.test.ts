/**
 * Tests for the Daily QuickFire router.
 *
 * These tests exercise the tRPC procedures using in-memory mocks so no real DB is required.
 * We test:
 *  - getTodaySet: throws INTERNAL_SERVER_ERROR when DB is unavailable
 *  - submitAnswer: rejects unauthenticated calls
 *  - submitAnswer: throws when DB unavailable (authenticated)
 *  - getMyProgress: rejects unauthenticated calls
 *  - getLeaderboard: throws when DB unavailable (public procedure)
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("quickfire.getTodaySet", () => {
  it("throws INTERNAL_SERVER_ERROR when DB is unavailable", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.quickfire.getTodaySet()).rejects.toThrow("DB unavailable");
  });
});

describe("quickfire.submitAnswer", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.quickfire.submitAnswer({ questionId: 1, selectedAnswer: 0 })
    ).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB unavailable (authenticated)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.quickfire.submitAnswer({ questionId: 999, selectedAnswer: 0 })
    ).rejects.toThrow("DB unavailable");
  });
});

describe("quickfire.getUserStats", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.quickfire.getUserStats()).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB unavailable (authenticated)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.quickfire.getUserStats()).rejects.toThrow("DB unavailable");
  });
});

describe("quickfire.getLeaderboard", () => {
  it("throws INTERNAL_SERVER_ERROR when DB is unavailable (authenticated procedure)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.quickfire.getLeaderboard()).rejects.toThrow("DB unavailable");
  });
  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.quickfire.getLeaderboard()).rejects.toThrow();
  });
});

// ── Bulk Import Procedures ──────────────────────────────────────────────────

describe("quickfire.bulkImportQuestions", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.quickfire.bulkImportQuestions({
        questions: [
          { type: "scenario", question: "What is the normal LVEF range?", options: ["40-50%", "55-70%", "70-80%", "30-40%"], correctAnswer: 1, difficulty: "beginner" },
        ],
      })
    ).rejects.toThrow();
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.quickfire.bulkImportQuestions({
        questions: [
          { type: "scenario", question: "What is the normal LVEF range?", options: ["40-50%", "55-70%", "70-80%", "30-40%"], correctAnswer: 1, difficulty: "beginner" },
        ],
      })
    ).rejects.toThrow();
  });

  it("rejects empty questions array (min 1)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.bulkImportQuestions({ questions: [] })
    ).rejects.toThrow();
  });

  it("rejects questions array exceeding 500 items", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    const questions = Array.from({ length: 501 }, (_, i) => ({
      type: "scenario" as const,
      question: `Question ${i + 1} — what is the correct answer for this clinical scenario?`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: 0,
      difficulty: "beginner" as const,
    }));
    await expect(
      caller.quickfire.bulkImportQuestions({ questions })
    ).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB unavailable (admin)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.bulkImportQuestions({
        questions: [
          { type: "scenario", question: "A patient has AVA 0.8 cm² and peak gradient 64 mmHg. What severity?", options: ["Mild AS", "Moderate AS", "Severe AS", "Critical AS"], correctAnswer: 2, difficulty: "intermediate" },
          { type: "quickReview", question: "What is the normal range for LVEF?", reviewAnswer: "55–70% by biplane Simpson's method.", difficulty: "beginner" },
        ],
      })
    ).rejects.toThrow("DB unavailable");
  });
});

// ── AI Generator Procedures ──────────────────────────────────────────────────

describe("quickfire.aiGenerateQuestions", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.quickfire.aiGenerateQuestions({ topic: "aortic stenosis", type: "scenario", difficulty: "intermediate", count: 3 })
    ).rejects.toThrow();
  });

  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.quickfire.aiGenerateQuestions({ topic: "aortic stenosis", type: "scenario", difficulty: "intermediate", count: 3 })
    ).rejects.toThrow();
  });

  it("rejects empty topic", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.aiGenerateQuestions({ topic: "", type: "scenario", difficulty: "intermediate", count: 3 })
    ).rejects.toThrow();
  });

  it("rejects count above maximum (20)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.aiGenerateQuestions({ topic: "mitral regurgitation", type: "scenario", difficulty: "intermediate", count: 50 })
    ).rejects.toThrow();
  });

  it("rejects count below minimum (1)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.aiGenerateQuestions({ topic: "mitral regurgitation", type: "scenario", difficulty: "intermediate", count: 0 })
    ).rejects.toThrow();
  });
});

// ── Notification Preferences ──────────────────────────────────────────────────

describe("quickfire.getNotificationPrefs", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.quickfire.getNotificationPrefs()).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB unavailable (authenticated)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.quickfire.getNotificationPrefs()).rejects.toThrow("DB unavailable");
  });
});

describe("quickfire.updateNotificationPrefs", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.quickfire.updateNotificationPrefs({ quickfireReminder: false, reminderTime: "09:00" })
    ).rejects.toThrow();
  });

  it("rejects invalid reminderTime format", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.quickfire.updateNotificationPrefs({ quickfireReminder: true, reminderTime: "9am" })
    ).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB unavailable (authenticated, valid input)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.quickfire.updateNotificationPrefs({ quickfireReminder: true, reminderTime: "18:00" })
    ).rejects.toThrow("DB unavailable");
  });
});

describe("quickfire.triggerStreakReminders", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.quickfire.triggerStreakReminders({})).rejects.toThrow();
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(caller.quickfire.triggerStreakReminders({})).rejects.toThrow();
  });

  it("returns zero counts when DB unavailable (graceful degradation)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    const result = await caller.quickfire.triggerStreakReminders({});
    expect(result).toHaveProperty("sent");
    expect(result).toHaveProperty("skipped");
    expect(result).toHaveProperty("total");
    expect(typeof result.sent).toBe("number");
    expect(typeof result.total).toBe("number");
  });
});


describe("quickfire.adminApproveQuestionToQueue", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.quickfire.adminApproveQuestionToQueue({ questionId: 1 })
    ).rejects.toThrow();
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.quickfire.adminApproveQuestionToQueue({ questionId: 1 })
    ).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB unavailable (admin)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.adminApproveQuestionToQueue({ questionId: 1 })
    ).rejects.toThrow("DB unavailable");
  });
});

describe("quickfire.adminBatchApproveToQueue", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.quickfire.adminBatchApproveToQueue({ questionIds: [1, 2] })
    ).rejects.toThrow();
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.quickfire.adminBatchApproveToQueue({ questionIds: [1, 2] })
    ).rejects.toThrow();
  });

  it("rejects empty questionIds array (min 1)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.adminBatchApproveToQueue({ questionIds: [] })
    ).rejects.toThrow();
  });

  it("rejects questionIds array exceeding 100 items", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);
    await expect(
      caller.quickfire.adminBatchApproveToQueue({ questionIds: ids })
    ).rejects.toThrow();
  });

  it("throws INTERNAL_SERVER_ERROR when DB unavailable (admin)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAdminUser()));
    await expect(
      caller.quickfire.adminBatchApproveToQueue({ questionIds: [1, 2] })
    ).rejects.toThrow("DB unavailable");
  });
});
