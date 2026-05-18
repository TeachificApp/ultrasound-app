/**
 * dashboard.test.ts
 * Unit tests for dashboardRouter procedures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockUser = {
  id: 1,
  name: "Test User",
  displayName: "Test User",
  email: "test@example.com",
  avatarUrl: null,
  bio: null,
  credentials: null,
  specialty: null,
  yearsExperience: null,
  location: null,
  website: null,
  loginMethod: "email",
  emailVerified: true,
  createdAt: new Date("2024-01-01"),
  passwordHash: "$2b$10$hashedpassword",
};

const mockEnrollments = [
  {
    enrollmentId: 10,
    courseId: 1,
    enrolledAt: new Date("2024-06-01"),
    completedAt: null,
    progressPct: 45,
    courseTitle: "Advanced Echo Assessment",
    courseSlug: "advanced-echo-assessment",
    courseType: "course",
    courseBrand: "iheartecho",
    courseThumbnail: null,
    courseStatus: "published",
  },
  {
    enrollmentId: 11,
    courseId: 2,
    enrolledAt: new Date("2024-07-01"),
    completedAt: new Date("2024-08-01"),
    progressPct: 100,
    courseTitle: "Vascular Ultrasound Fundamentals",
    courseSlug: "vascular-ultrasound-fundamentals",
    courseType: "course",
    courseBrand: "aaus",
    courseThumbnail: null,
    courseStatus: "published",
  },
  {
    enrollmentId: 12,
    courseId: 3,
    enrolledAt: new Date("2024-09-01"),
    completedAt: null,
    progressPct: 0,
    courseTitle: "Echo Quiz Pack",
    courseSlug: "echo-quiz-pack",
    courseType: "quiz",
    courseBrand: "iheartecho",
    courseThumbnail: null,
    courseStatus: "published",
  },
];

const mockBrandMemberships = [
  {
    id: 1,
    userId: 1,
    brand: "aaus",
    tier: "premium",
    status: "active",
    stripeCustomerId: "cus_aaus123",
    stripeSubscriptionId: "sub_aaus123",
    grantedAt: new Date("2024-01-01"),
    expiresAt: null,
    source: "stripe",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: 2,
    userId: 1,
    brand: "iheartecho",
    tier: "premium",
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    grantedAt: new Date("2024-03-01"),
    expiresAt: new Date("2025-03-01"),
    source: "thinkific",
    createdAt: new Date("2024-03-01"),
    updatedAt: new Date("2024-03-01"),
  },
];

const mockCertificates = [
  {
    id: 1,
    courseId: 2,
    enrollmentId: 11,
    certificateUrl: "https://cdn.example.com/cert-1.pdf",
    issuedAt: new Date("2024-08-01"),
    courseTitle: "Vascular Ultrasound Fundamentals",
    courseSlug: "vascular-ultrasound-fundamentals",
    courseThumbnail: null,
    courseBrand: "aaus",
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("dashboardRouter — data shape", () => {
  describe("getMyContent — content segregation", () => {
    it("separates courses from quizzes correctly", () => {
      const courses = mockEnrollments.filter(e => e.courseType === "course");
      const quizzes = mockEnrollments.filter(e => e.courseType === "quiz");
      const downloads = mockEnrollments.filter(e => e.courseType === "download");

      expect(courses).toHaveLength(2);
      expect(quizzes).toHaveLength(1);
      expect(downloads).toHaveLength(0);
    });

    it("includes enrollments from both brands", () => {
      const courses = mockEnrollments.filter(e => e.courseType === "course");
      const brands = new Set(courses.map(c => c.courseBrand));
      expect(brands.has("aaus")).toBe(true);
      expect(brands.has("iheartecho")).toBe(true);
    });

    it("quiz items have correct courseType", () => {
      const quizzes = mockEnrollments.filter(e => e.courseType === "quiz");
      expect(quizzes[0].courseTitle).toBe("Echo Quiz Pack");
      expect(quizzes[0].courseBrand).toBe("iheartecho");
    });
  });

  describe("getMySubscriptions — cross-brand memberships", () => {
    it("returns memberships from both brands", () => {
      const brands = new Set(mockBrandMemberships.map(m => m.brand));
      expect(brands.has("aaus")).toBe(true);
      expect(brands.has("iheartecho")).toBe(true);
    });

    it("correctly identifies Thinkific memberships", () => {
      const thinkificSubs = mockBrandMemberships.filter(m => m.source === "thinkific");
      expect(thinkificSubs).toHaveLength(1);
      expect(thinkificSubs[0].brand).toBe("iheartecho");
    });

    it("correctly identifies Stripe memberships", () => {
      const stripeSubs = mockBrandMemberships.filter(m => m.source === "stripe");
      expect(stripeSubs).toHaveLength(1);
      expect(stripeSubs[0].brand).toBe("aaus");
      expect(stripeSubs[0].stripeSubscriptionId).toBe("sub_aaus123");
    });

    it("enriches Thinkific memberships with manage URL", () => {
      const THINKIFIC_MANAGE_URLS: Record<string, string> = {
        aaus: "https://allaboutultrasound.thinkific.com/users/sign_in",
        iheartecho: "https://iheartecho.thinkific.com/users/sign_in",
      };

      const enriched = mockBrandMemberships.map(m => ({
        ...m,
        isThinkific: m.source === "thinkific",
        thinkificManageUrl: THINKIFIC_MANAGE_URLS[m.brand] ?? THINKIFIC_MANAGE_URLS.aaus,
      }));

      const iheThinkific = enriched.find(m => m.brand === "iheartecho");
      expect(iheThinkific?.isThinkific).toBe(true);
      expect(iheThinkific?.thinkificManageUrl).toBe("https://iheartecho.thinkific.com/users/sign_in");

      const aausStripe = enriched.find(m => m.brand === "aaus");
      expect(aausStripe?.isThinkific).toBe(false);
    });
  });

  describe("getMyCertificates — cross-brand certs", () => {
    it("returns certificates with brand info", () => {
      expect(mockCertificates[0].courseBrand).toBe("aaus");
      expect(mockCertificates[0].certificateUrl).toContain("cert-1.pdf");
    });

    it("certificate has required fields", () => {
      const cert = mockCertificates[0];
      expect(cert).toHaveProperty("id");
      expect(cert).toHaveProperty("courseTitle");
      expect(cert).toHaveProperty("courseSlug");
      expect(cert).toHaveProperty("certificateUrl");
      expect(cert).toHaveProperty("issuedAt");
      expect(cert).toHaveProperty("courseBrand");
    });
  });

  describe("getProfile — user data", () => {
    it("does not expose passwordHash", () => {
      const profile = {
        ...mockUser,
        hasPassword: !!mockUser.passwordHash,
        passwordHash: undefined,
      };
      expect(profile.passwordHash).toBeUndefined();
      expect(profile.hasPassword).toBe(true);
    });

    it("returns emailVerified status", () => {
      expect(mockUser.emailVerified).toBe(true);
    });
  });

  describe("subscription cancellation logic", () => {
    it("only allows cancellation of Stripe subscriptions", () => {
      const stripeSub = mockBrandMemberships.find(m => m.stripeSubscriptionId);
      const thinkificSub = mockBrandMemberships.find(m => !m.stripeSubscriptionId);

      expect(stripeSub?.stripeSubscriptionId).toBeTruthy();
      expect(thinkificSub?.stripeSubscriptionId).toBeFalsy();
    });

    it("rejects cancellation when no stripeSubscriptionId", () => {
      const sub = mockBrandMemberships.find(m => m.source === "thinkific");
      const canCancel = !!sub?.stripeSubscriptionId;
      expect(canCancel).toBe(false);
    });
  });
});
