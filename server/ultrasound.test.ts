import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { COOKIE_NAME } from "../shared/const";

// ===== MOCK DB =====
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getFlashcards: vi.fn().mockResolvedValue([
    { id: 1, question: "What is the normal thyroid volume?", answer: "8-16 mL in women, 12-20 mL in men", category: "thyroid", difficulty: "basic", isActive: true },
    { id: 2, question: "What is the normal IVC diameter?", answer: "<2.1 cm with >50% collapse indicates normal RAP", category: "pocus", difficulty: "intermediate", isActive: true },
    { id: 3, question: "What is the NT cutoff for aneuploidy screening?", answer: "3 mm at 45-84 mm CRL", category: "obstetric_1st", difficulty: "basic", isActive: true },
  ]),
  getFlashcardsByCategory: vi.fn().mockImplementation((category: string) => {
    const all = [
      { id: 1, question: "Q1", answer: "A1", category: "thyroid", difficulty: "basic", isActive: true },
      { id: 2, question: "Q2", answer: "A2", category: "pocus", difficulty: "intermediate", isActive: true },
    ];
    return Promise.resolve(all.filter(f => f.category === category));
  }),
  getUserFlashcardCount: vi.fn().mockResolvedValue({ flashcardsToday: 0, flashcardsDate: "" }),
  updateUserFlashcardCount: vi.fn().mockResolvedValue(undefined),
  createFlashcard: vi.fn().mockResolvedValue({ success: true }),
  updateFlashcard: vi.fn().mockResolvedValue({ success: true }),
  deleteFlashcard: vi.fn().mockResolvedValue({ success: true }),
  getCases: vi.fn().mockResolvedValue([
    { id: 1, title: "POCUS Case 1", category: "pocus", caseType: "image", isPublished: true, viewCount: 10, displayViewCount: 50 },
    { id: 2, title: "Fetal Echo Case", category: "fetal_echo", caseType: "video", isPublished: true, viewCount: 5, displayViewCount: 30 },
  ]),
  getCaseById: vi.fn().mockResolvedValue({
    id: 1, title: "POCUS Case 1", category: "pocus", caseType: "image", isPublished: true,
    clinicalHistory: "Trauma patient", findings: "Free fluid in Morrison's pouch", diagnosis: "Hemoperitoneum",
    viewCount: 11, displayViewCount: 50,
  }),
  submitCase: vi.fn().mockResolvedValue({ success: true }),
  createCase: vi.fn().mockResolvedValue({ success: true }),
  updateCase: vi.fn().mockResolvedValue({ success: true }),
  publishCase: vi.fn().mockResolvedValue({ success: true }),
  deleteCase: vi.fn().mockResolvedValue({ success: true }),
  getSoundBytes: vi.fn().mockResolvedValue([
    { id: 1, title: "Abdominal Aorta Scanning Tips", category: "abdominal_vascular", isActive: true },
    { id: 2, title: "POCUS Lung Basics", category: "pocus", isActive: true },
  ]),
  createSoundByte: vi.fn().mockResolvedValue({ success: true }),
  updateSoundByte: vi.fn().mockResolvedValue({ success: true }),
  deleteSoundByte: vi.fn().mockResolvedValue({ success: true }),
  getTodayChallenge: vi.fn().mockResolvedValue({
    id: 1,
    challengeDate: new Date().toISOString().split("T")[0],
    question: "What is the normal cardiothoracic ratio in a fetal echo?",
    optionA: "< 25%",
    optionB: "< 33%",
    optionC: "< 50%",
    optionD: "< 40%",
    correctAnswer: "B",
    explanation: "Normal fetal cardiac area is less than 1/3 of thoracic area (<33%)",
    category: "fetal_echo",
    isActive: true,
  }),
  submitChallengeAnswer: vi.fn().mockResolvedValue({ isCorrect: true, pointsEarned: 10, correctAnswer: "B", explanation: "Normal fetal cardiac area is less than 1/3 of thoracic area" }),
  getUserChallengeResponse: vi.fn().mockResolvedValue(null),
  createDailyChallenge: vi.fn().mockResolvedValue({ success: true }),
  updateDailyChallenge: vi.fn().mockResolvedValue({ success: true }),
  getLeaderboard: vi.fn().mockResolvedValue([
    { id: 1, name: "Dr. Smith", totalPoints: 150, streakCount: 5 },
    { id: 2, name: "Dr. Jones", totalPoints: 120, streakCount: 3 },
  ]),
  getUserProfile: vi.fn().mockResolvedValue({ id: 1, name: "Test User", email: "test@example.com", membershipTier: "free", totalPoints: 0, streakCount: 0 }),
  updateMembershipFromThinkific: vi.fn().mockResolvedValue(undefined),
  logThinkificEvent: vi.fn().mockResolvedValue(undefined),
  getAdminStats: vi.fn().mockResolvedValue({ users: 10, flashcards: 50, cases: 20, soundbytes: 15 }),
  getAllUsers: vi.fn().mockResolvedValue([
    { id: 1, name: "Admin User", email: "admin@example.com", role: "admin", membershipTier: "premium" },
    { id: 2, name: "Free User", email: "free@example.com", role: "user", membershipTier: "free" },
  ]),
  getDb: vi.fn().mockResolvedValue(null),
}));

// ===== CONTEXT HELPERS =====
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(overrides: Partial<NonNullable<TrpcContext["user"]>> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "user-123",
      email: "user@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      membershipTier: "free",
      flashcardsToday: 0,
      flashcardsDate: "",
      totalPoints: 0,
      streakCount: 0,
      lastChallengeDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createUserContext({ role: "admin", membershipTier: "premium" });
}

function createPremiumContext(): TrpcContext {
  return createUserContext({ membershipTier: "premium" });
}

// ===== AUTH TESTS =====
describe("auth", () => {
  it("returns null user for unauthenticated request", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });

  it("returns user for authenticated request", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).not.toBeNull();
    expect(user?.email).toBe("user@example.com");
  });

  it("clears session cookie on logout", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect((ctx.res.clearCookie as any).mock.calls.length).toBeGreaterThan(0);
  });
});

// ===== FLASHCARD TESTS =====
describe("flashcards", () => {
  it("lists all flashcards publicly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const cards = await caller.flashcards.list({});
    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBeGreaterThan(0);
  });

  it("filters flashcards by category", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const cards = await caller.flashcards.list({ category: "thyroid" });
    expect(Array.isArray(cards)).toBe(true);
    cards.forEach((c: any) => expect(c.category).toBe("thyroid"));
  });

  it("returns daily flashcards with limit for free user", async () => {
    const ctx = createUserContext({ flashcardsToday: 0, flashcardsDate: "" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.flashcards.getDaily({});
    expect(result.dailyLimit).toBe(10);
    expect(result.isPremium).toBe(false);
    expect(Array.isArray(result.cards)).toBe(true);
  });

  it("returns unlimited flashcards for premium user", async () => {
    const ctx = createPremiumContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.flashcards.getDaily({});
    expect(result.dailyLimit).toBeNull();
    expect(result.isPremium).toBe(true);
  });

  it("allows admin to create a flashcard", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.flashcards.create({
      question: "What is the normal fetal heart rate?",
      answer: "120-160 bpm",
      category: "fetal_echo",
      difficulty: "basic",
    });
    expect(result.success).toBe(true);
  });

  it("blocks non-admin from creating flashcards", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.flashcards.create({
      question: "Test question",
      answer: "Test answer",
      category: "pocus",
    })).rejects.toThrow();
  });
});

// ===== CASES TESTS =====
describe("cases", () => {
  it("lists published cases publicly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const cases = await caller.cases.list({});
    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThan(0);
  });

  it("filters cases by category", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const cases = await caller.cases.list({ category: "pocus" });
    expect(Array.isArray(cases)).toBe(true);
  });

  it("gets a case by ID", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const caseData = await caller.cases.getById({ id: 1 });
    expect(caseData).not.toBeNull();
    expect(caseData?.title).toBe("POCUS Case 1");
  });

  it("allows authenticated user to submit a case", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cases.submit({
      title: "Abdominal Aortic Aneurysm",
      category: "abdominal_vascular",
      caseType: "image",
      clinicalHistory: "65-year-old male with pulsatile abdominal mass",
      findings: "Aortic diameter 5.5 cm at infrarenal level",
      diagnosis: "AAA",
    });
    expect(result.success).toBe(true);
  });

  it("allows admin to create and publish a case", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const createResult = await caller.cases.create({
      title: "Carotid Stenosis",
      category: "extracranial_carotid",
      caseType: "image",
    });
    expect(createResult.success).toBe(true);

    const publishResult = await caller.cases.publish({ id: 1, isPublished: true });
    expect(publishResult.success).toBe(true);
  });
});

// ===== SOUNDBYTES TESTS =====
describe("soundbytes", () => {
  it("lists soundbytes publicly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const bytes = await caller.soundbytes.list({});
    expect(Array.isArray(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("filters soundbytes by category", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const bytes = await caller.soundbytes.list({ category: "pocus" });
    expect(Array.isArray(bytes)).toBe(true);
  });

  it("allows admin to create a soundbyte", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.soundbytes.create({
      title: "Venous Duplex Scanning Tips",
      category: "venous",
      description: "Key tips for lower extremity venous duplex",
    });
    expect(result.success).toBe(true);
  });
});

// ===== DAILY CHALLENGE TESTS =====
describe("challenge", () => {
  it("gets today's challenge publicly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const challenge = await caller.challenge.today();
    expect(challenge).not.toBeNull();
    expect(challenge?.question).toBeTruthy();
    expect(challenge?.correctAnswer).toBeTruthy();
  });

  it("submits a correct answer and earns points", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.challenge.submit({ challengeId: 1, selectedAnswer: "B" });
    expect(result.isCorrect).toBe(true);
    expect(result.pointsEarned).toBe(10);
  });

  it("returns null for user challenge response when not answered", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const response = await caller.challenge.myResponse();
    expect(response).toBeNull();
  });

  it("allows admin to create a daily challenge", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.challenge.create({
      challengeDate: "2026-04-01",
      question: "What is the normal peak systolic velocity in the ICA?",
      optionA: "> 125 cm/s",
      optionB: "< 125 cm/s",
      optionC: "> 200 cm/s",
      optionD: "< 50 cm/s",
      correctAnswer: "B",
      explanation: "ICA PSV < 125 cm/s is considered normal; >125 cm/s suggests >50% stenosis",
      category: "extracranial_carotid",
    });
    expect(result.success).toBe(true);
  });
});

// ===== LEADERBOARD TESTS =====
describe("leaderboard", () => {
  it("returns leaderboard entries publicly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const entries = await caller.leaderboard.list();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toHaveProperty("totalPoints");
  });
});

// ===== USER PROFILE TESTS =====
describe("user", () => {
  it("returns user profile for authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const profile = await caller.user.profile();
    expect(profile).not.toBeNull();
    expect(profile?.email).toBe("test@example.com");
  });

  it("blocks unauthenticated access to profile", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.user.profile()).rejects.toThrow();
  });
});

// ===== ADMIN TESTS =====
describe("admin", () => {
  it("returns stats for admin user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.admin.stats();
    expect(stats.users).toBe(10);
    expect(stats.flashcards).toBe(50);
    expect(stats.cases).toBe(20);
    expect(stats.soundbytes).toBe(15);
  });

  it("returns all users for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const users = await caller.admin.users();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });

  it("blocks non-admin from accessing admin stats", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toThrow();
  });
});

// ===== THINKIFIC WEBHOOK TESTS =====
describe("webhook.thinkific", () => {
  it("processes premium enrollment webhook", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webhook.thinkific({
      event: "enrollment.created",
      payload: {
        user: { email: "newuser@example.com", id: 12345 },
        bundle_name: "UltrasoundAssist App Premium Membership",
        bundle_id: "3714929",
      },
    });
    expect(result.received).toBe(true);
  });

  it("processes free enrollment webhook", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webhook.thinkific({
      event: "enrollment.created",
      payload: {
        user: { email: "freeuser@example.com", id: 99999 },
        bundle_name: "UltrasoundAssist App Free Member Access",
        bundle_id: "3714918",
      },
    });
    expect(result.received).toBe(true);
  });

  it("processes enrollment expiry (downgrade) webhook", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webhook.thinkific({
      event: "enrollment.expired",
      payload: {
        user: { email: "expireduser@example.com" },
        bundle_name: "UltrasoundAssist App Premium Membership",
        bundle_id: "3714929",
      },
    });
    expect(result.received).toBe(true);
  });
});

// ===== CATEGORY CONSTANTS TESTS =====
describe("appConstants", () => {
  it("has all 16 required categories", async () => {
    const { CATEGORY_LABELS } = await import("../shared/appConstants");
    const requiredCategories = [
      "abdominal", "pelvic_gyn", "obstetric_1st", "obstetric_2nd_3rd",
      "thyroid", "scrotum", "breast", "venous", "arterial",
      "abdominal_vascular", "extracranial_carotid", "intracranial_tcd",
      "msk", "pocus", "physics", "fetal_echo",
    ];
    requiredCategories.forEach(cat => {
      expect(CATEGORY_LABELS).toHaveProperty(cat);
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    });
  });

  it("has all required Thinkific links", async () => {
    const { THINKIFIC_LINKS } = await import("../shared/appConstants");
    expect(THINKIFIC_LINKS.freeMembership).toContain("allaboutultrasound.com");
    expect(THINKIFIC_LINKS.premiumMonthly).toContain("allaboutultrasound.com");
    expect(THINKIFIC_LINKS.premiumAnnual).toContain("allaboutultrasound.com");
    expect(THINKIFIC_LINKS.freeRegister).toContain("price_id=4664963");
    expect(THINKIFIC_LINKS.premiumMonthly).toContain("price_id=4664974");
    expect(THINKIFIC_LINKS.premiumAnnual).toContain("price_id=4664977");
  });
});
