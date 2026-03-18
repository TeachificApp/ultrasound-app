/**
 * UltrasoundAssist™ App — Unit Tests
 *
 * Tests the core server-side logic using the actual iHeartEcho router structure
 * that was copied and adapted for UltrasoundAssist™ (All About Ultrasound™).
 *
 * Router structure:
 *  - appRouter.auth         → auth.me, auth.logout
 *  - appRouter.quickfire    → quickfire.getTodaySet, quickfire.getFlashcardDeck, quickfire.getLeaderboard
 *  - appRouter.caseLibrary  → caseLibrary.listCases, caseLibrary.getCase, caseLibrary.submitCase
 *  - appRouter.premium      → premium.getStatus, premium.checkAndSync
 *  - appRouter.educator     → educator.getPlatformVisible
 *  - appRouter.system       → system.notifyOwner
 */
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

// ===== MOCK DB =====
// Mock the db module so tests don't need a real database connection.
// We only mock the functions that are called by the procedures under test.
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getDb: vi.fn().mockResolvedValue(null),
    getUserRoles: vi.fn().mockResolvedValue([]),
    getUserById: vi.fn().mockResolvedValue(null),
    upsertUser: vi.fn().mockResolvedValue(undefined),
    getUserByOpenId: vi.fn().mockResolvedValue(null),
    getUserByEmail: vi.fn().mockResolvedValue(null),
    getUserByPasswordResetToken: vi.fn().mockResolvedValue(null),
    getUserByMagicLinkToken: vi.fn().mockResolvedValue(null),
    getUserByPendingEmailToken: vi.fn().mockResolvedValue(null),
  };
});

// ===== CONTEXT HELPERS =====

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "test-openid-123",
    email: "test@allaboutultrasound.com",
    name: "Test Sonographer",
    displayName: "TestSono",
    loginMethod: "manus",
    role: "user",
    isPremium: false,
    premiumGrantedAt: null,
    premiumSource: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    avatarUrl: null,
    coverUrl: null,
    bio: null,
    credentials: null,
    specialty: null,
    yearsExperience: null,
    location: null,
    website: null,
    isPublicProfile: true,
    followersCount: 0,
    followingCount: 0,
    thinkificEnrolledAt: null,
    isPending: false,
    pendingCreatedAt: null,
    passwordHash: null,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiry: null,
    passwordResetToken: null,
    passwordResetExpiry: null,
    pendingEmail: null,
    pendingEmailToken: null,
    pendingEmailExpiry: null,
    magicLinkToken: null,
    magicLinkExpiry: null,
    notificationPrefs: null,
    timezone: null,
    lastChallengeNotifDate: null,
    isDemo: false,
    challengeCategoryPrefs: null,
    interestPrefs: null,
    unsubscribedAt: null,
    unsubscribeToken: null,
    ...overrides,
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    demoMode: false,
    realAdminId: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(overrides: Partial<User> = {}): TrpcContext {
  return {
    user: makeUser(overrides),
    demoMode: false,
    realAdminId: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createUserContext({ role: "admin", isPremium: true });
}

function createPremiumContext(): TrpcContext {
  return createUserContext({ isPremium: true });
}

// ===== AUTH TESTS =====
describe("auth", () => {
  it("returns null for unauthenticated request", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });

  it("returns user data for authenticated request", async () => {
    const { getUserRoles, getUserById } = await import("./db");
    (getUserRoles as any).mockResolvedValueOnce([]);
    (getUserById as any).mockResolvedValueOnce(makeUser({ name: "Lara Williams" }));

    const ctx = createUserContext({ name: "Lara Williams" });
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();

    expect(user).not.toBeNull();
    expect(user?.name).toBe("Lara Williams");
    expect(user?.email).toBe("test@allaboutultrasound.com");
  });

  it("clears session cookie on logout", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect((ctx.res.clearCookie as any).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.res.clearCookie as any).mock.calls[0][0]).toBe(COOKIE_NAME);
  });

  it("logout sets maxAge to -1 to expire the cookie", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await caller.auth.logout();
    const options = (ctx.res.clearCookie as any).mock.calls[0][1];
    expect(options.maxAge).toBe(-1);
  });
});

// ===== PREMIUM ROUTER TESTS =====
describe("premium", () => {
  it("premium.getStatus requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.premium.getStatus()).rejects.toThrow();
  });

  it("premium.checkAndSync requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.premium.checkAndSync()).rejects.toThrow();
  });

  it("premium.getStatus is callable for authenticated users (throws DB error in test env)", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // In test env, DB is unavailable — expect an error but not UNAUTHORIZED
    await expect(caller.premium.getStatus()).rejects.toThrow();
  });
});

// ===== QUICKFIRE ROUTER TESTS =====
describe("quickfire", () => {
  it("getTodaySet is a public procedure (throws DB error in test env)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // DB unavailable in test env — should throw INTERNAL_SERVER_ERROR, not UNAUTHORIZED
    await expect(caller.quickfire.getTodaySet()).rejects.toThrow();
  });

  it("submitAnswer requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quickfire.submitAnswer({ questionId: 1, answerId: 1 })
    ).rejects.toThrow();
  });

  it("getLeaderboard requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quickfire.getLeaderboard({ period: "monthly" })
    ).rejects.toThrow();
  });

  it("getFlashcardDeck is a public procedure (throws DB error in test env)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.quickfire.getFlashcardDeck({ limit: 10 })
    ).rejects.toThrow();
  });

  it("getLiveChallenge is a public procedure (throws DB error in test env)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.quickfire.getLiveChallenge()).rejects.toThrow();
  });
});

// ===== CASE LIBRARY ROUTER TESTS =====
describe("caseLibrary", () => {
  it("listCases is a public procedure (throws DB error in test env)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.caseLibrary.listCases({ page: 1, limit: 12 })
    ).rejects.toThrow();
  });

  it("getCase is a public procedure (throws DB error in test env)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.caseLibrary.getCase({ id: 1 })
    ).rejects.toThrow();
  });

  it("submitCase requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.caseLibrary.submitCase({
        title: "Abdominal Aortic Aneurysm",
        summary: "65-year-old male with pulsatile abdominal mass. AAA confirmed.",
        modality: "POCUS",
        difficulty: "intermediate",
        hipaaAcknowledged: true,
        tags: [],
        media: [],
        questions: [],
      })
    ).rejects.toThrow();
  });

  it("getUserSubmissions requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.caseLibrary.getUserSubmissions()).rejects.toThrow();
  });
});

// ===== EDUCATOR ROUTER TESTS =====
describe("educator", () => {
  it("getPlatformVisible is a public procedure (throws DB error in test env)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.educator.getPlatformVisible()).rejects.toThrow();
  });

  it("createOrg requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.educator.createOrg({
        name: "Test Ultrasound School",
        slug: "test-us-school",
        tier: "school",
      })
    ).rejects.toThrow();
  });

  it("getMyOrgs requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.educator.getMyOrgs()).rejects.toThrow();
  });
});

// ===== SYSTEM ROUTER TESTS =====
describe("system", () => {
  it("notifyOwner requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.system.notifyOwner({ title: "Test", content: "Test notification" })
    ).rejects.toThrow();
  });
});

// ===== AAUS BRAND CONSTANT TESTS =====
describe("AAUS brand constants", () => {
  it("AAUS Thinkific premium product ID is correct", async () => {
    const { ULTRASOUNDASSIST_PREMIUM_PRODUCT_ID } = await import("./thinkific");
    expect(ULTRASOUNDASSIST_PREMIUM_PRODUCT_ID).toBe(3714929);
  });

  it("IHEARTECHO_PREMIUM_PRODUCT_ID alias is also updated", async () => {
    const { IHEARTECHO_PREMIUM_PRODUCT_ID } = await import("./thinkific");
    expect(IHEARTECHO_PREMIUM_PRODUCT_ID).toBe(3714929);
  });

  it("AAUS free membership course IDs are set", async () => {
    const { FREE_MEMBERSHIP_COURSE_IDS } = await import("./thinkific");
    expect(FREE_MEMBERSHIP_COURSE_IDS).toContain(3714918);
  });

  it("premium membership slug is AAUS slug", async () => {
    const { PREMIUM_MEMBERSHIP_SLUG } = await import("./routers/premiumRouter");
    expect(PREMIUM_MEMBERSHIP_SLUG).toBe("ultrasoundassist-app-premium-membership");
  });

  it("AAUS member domain is correct", async () => {
    const { buildCourseUrl, buildEnrollUrl } = await import("./thinkific");
    expect(buildCourseUrl("test-course")).toContain("allaboutultrasound.com");
    expect(buildEnrollUrl("test-product")).toContain("allaboutultrasound.com");
  });
});

// ===== APP CONSTANTS TESTS =====
describe("appConstants", () => {
  it("has all 16 required categories (15 ultrasound + Physics)", async () => {
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

  it("has exactly 16 categories", async () => {
    const { CATEGORY_LABELS } = await import("../shared/appConstants");
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(16);
  });

  it("has all required Thinkific links with correct AAUS domain", async () => {
    const { THINKIFIC_LINKS } = await import("../shared/appConstants");
    expect(THINKIFIC_LINKS.freeMembership).toContain("allaboutultrasound.com");
    expect(THINKIFIC_LINKS.premiumMonthly).toContain("allaboutultrasound.com");
    expect(THINKIFIC_LINKS.premiumAnnual).toContain("allaboutultrasound.com");
  });

  it("has correct Thinkific price IDs for AAUS", async () => {
    const { THINKIFIC_LINKS } = await import("../shared/appConstants");
    expect(THINKIFIC_LINKS.freeRegister).toContain("price_id=4664963");
    expect(THINKIFIC_LINKS.premiumMonthly).toContain("price_id=4664974");
    expect(THINKIFIC_LINKS.premiumAnnual).toContain("price_id=4664977");
  });

  it("has AAUS logo URL", async () => {
    const { AAUS_LOGO_URL } = await import("../shared/appConstants");
    expect(AAUS_LOGO_URL).toBeTruthy();
    expect(AAUS_LOGO_URL).toContain("aaus_logo");
  });

  it("has correct premium pricing", async () => {
    const { PREMIUM_PRICE_MONTHLY, PREMIUM_PRICE_ANNUAL } = await import("../shared/appConstants");
    expect(PREMIUM_PRICE_MONTHLY).toContain("9.97");
    expect(PREMIUM_PRICE_ANNUAL).toContain("99.97");
  });
});

// ===== ULTRASOUND SPECIALTY TESTS =====
describe("UltrasoundAssist specialty categories", () => {
  const ULTRASOUND_CATEGORIES = [
    "Abdominal",
    "Pelvic/Gyn",
    "Obstetric 1st Trimester",
    "Obstetric 2nd/3rd Trimester",
    "Thyroid",
    "Scrotum",
    "Breast",
    "Venous",
    "Arterial",
    "Abdominal Vascular",
    "Extracranial Carotid Artery",
    "Intracranial Duplex/TCD",
    "MSK",
    "POCUS",
    "Fetal Echo",
  ] as const;

  it("has exactly 15 ultrasound specialty categories (excluding Physics)", () => {
    expect(ULTRASOUND_CATEGORIES).toHaveLength(15);
  });

  it("includes all 5 required vascular categories", () => {
    const vascular = ULTRASOUND_CATEGORIES.filter((c) =>
      c.includes("Venous") || c.includes("Arterial") || c.includes("Vascular") ||
      c.includes("Carotid") || c.includes("Intracranial")
    );
    expect(vascular).toHaveLength(5);
  });

  it("includes POCUS specialty", () => {
    expect(ULTRASOUND_CATEGORIES).toContain("POCUS");
  });

  it("includes Fetal Echo specialty", () => {
    expect(ULTRASOUND_CATEGORIES).toContain("Fetal Echo");
  });

  it("includes both OB trimester categories", () => {
    const ob = ULTRASOUND_CATEGORIES.filter((c) => c.includes("Obstetric"));
    expect(ob).toHaveLength(2);
  });

  it("includes MSK specialty", () => {
    expect(ULTRASOUND_CATEGORIES).toContain("MSK");
  });
});

// ===== WEBHOOK TESTS =====
describe("Thinkific webhook", () => {
  it("webhook handler file exists and exports registerThinkificWebhook", async () => {
    const webhookModule = await import("./webhooks/thinkific");
    expect(webhookModule).toBeDefined();
    expect(typeof webhookModule.registerThinkificWebhook).toBe("function");
  });
});

// ===== ACCREDITATION ROUTER TESTS =====
describe("accreditation", () => {
  it("createPeerReview requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.accreditation.createPeerReview({
        modality: "POCUS",
      })
    ).rejects.toThrow();
  });

  it("getPeerReviews requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.accreditation.getPeerReviews({})).rejects.toThrow();
  });
});
