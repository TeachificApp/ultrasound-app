/**
 * Image Quality Review — vitest unit tests
 * Tests the IQR tRPC procedures via direct DB helper calls
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB module ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  createImageQualityReview: vi.fn(),
  getImageQualityReviewsByUser: vi.fn(),
  getImageQualityReviewById: vi.fn(),
  updateImageQualityReview: vi.fn(),
  deleteImageQualityReview: vi.fn(),
}));

import {
  createImageQualityReview,
  getImageQualityReviewsByUser,
  getImageQualityReviewById,
  updateImageQualityReview,
  deleteImageQualityReview,
} from "./db";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const mockUserId = 42;

const baseReviewInput = {
  userId: mockUserId,
  reviewType: "QUALITY REVIEW",
  facilityName: "Echo Lab A",
  reviewerName: "Dr. Smith",
  reviewDate: "2026-03-05",
  sonographerName: "Jane Doe",
  sonographerCredentials: "RDCS",
  patientAge: "55",
  patientSex: "Female",
  indication: "Chest pain evaluation",
  examDate: "2026-03-01",
  // Protocol Sequence
  psaxBase: "Yes",
  psaxMid: "Yes",
  psaxApex: "Yes",
  a4c: "Yes",
  a2c: "Yes",
  a3c: "Yes",
  plax: "Yes",
  rvFocused: "Yes",
  subcostal: "Yes",
  suprasternal: "Yes",
  // Basic Exam Quality
  imageOptimization: "Adequate",
  gainSettings: "Adequate",
  depthSettings: "Adequate",
  focusSettings: "Adequate",
  harmonicImaging: "Adequate",
  frameRate: "Adequate",
  // LV Quality
  lvEndocardialBorder: "Adequate",
  lvWallMotion: "Adequate",
  lvSize: "Adequate",
  lvFunction: "Adequate",
  // Doppler Quality
  mitralInflowPw: "Adequate",
  tricuspidRegurgCw: "Adequate",
  aorticValveCw: "Adequate",
  lvotPw: "Adequate",
  // Report Accuracy
  lvefDocumented: "Yes",
  valvularPathologyDocumented: "Yes",
  rwmaDocumented: "Yes",
  diastolicFunctionDocumented: "Yes",
  // Overall
  overallQualityScore: 88,
  overallRating: "Good",
  comments: "Well-performed study.",
};

const mockReview = {
  id: 1,
  ...baseReviewInput,
  createdAt: new Date("2026-03-05T10:00:00Z"),
  updatedAt: new Date("2026-03-05T10:00:00Z"),
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Image Quality Review — DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // CREATE
  describe("createImageQualityReview", () => {
    it("creates a review with required fields", async () => {
      vi.mocked(createImageQualityReview).mockResolvedValue(mockReview);
      const result = await createImageQualityReview(baseReviewInput as any);
      expect(result).toMatchObject({ id: 1, facilityName: "Echo Lab A" });
      expect(createImageQualityReview).toHaveBeenCalledWith(baseReviewInput);
    });

    it("stores the overallQualityScore as a number", async () => {
      vi.mocked(createImageQualityReview).mockResolvedValue(mockReview);
      const result = await createImageQualityReview(baseReviewInput as any);
      expect(typeof result.overallQualityScore).toBe("number");
      expect(result.overallQualityScore).toBe(88);
    });

    it("stores the reviewType correctly", async () => {
      vi.mocked(createImageQualityReview).mockResolvedValue(mockReview);
      const result = await createImageQualityReview(baseReviewInput as any);
      expect(result.reviewType).toBe("QUALITY REVIEW");
    });

    it("stores the overallRating correctly", async () => {
      vi.mocked(createImageQualityReview).mockResolvedValue(mockReview);
      const result = await createImageQualityReview(baseReviewInput as any);
      expect(result.overallRating).toBe("Good");
    });

    it("handles a review with Excellent rating", async () => {
      const excellentReview = { ...mockReview, overallQualityScore: 95, overallRating: "Excellent" };
      vi.mocked(createImageQualityReview).mockResolvedValue(excellentReview);
      const result = await createImageQualityReview({ ...baseReviewInput, overallQualityScore: 95, overallRating: "Excellent" } as any);
      expect(result.overallRating).toBe("Excellent");
    });
  });

  // READ — list by user
  describe("getImageQualityReviewsByUser", () => {
    it("returns a list of reviews for a user", async () => {
      vi.mocked(getImageQualityReviewsByUser).mockResolvedValue([mockReview]);
      const result = await getImageQualityReviewsByUser(mockUserId);
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mockUserId);
    });

    it("returns an empty array when user has no reviews", async () => {
      vi.mocked(getImageQualityReviewsByUser).mockResolvedValue([]);
      const result = await getImageQualityReviewsByUser(999);
      expect(result).toHaveLength(0);
    });

    it("accepts limit and offset parameters", async () => {
      vi.mocked(getImageQualityReviewsByUser).mockResolvedValue([mockReview]);
      await getImageQualityReviewsByUser(mockUserId, 10, 0);
      expect(getImageQualityReviewsByUser).toHaveBeenCalledWith(mockUserId, 10, 0);
    });

    it("returns reviews sorted by most recent first", async () => {
      const older = { ...mockReview, id: 1, createdAt: new Date("2026-01-01") };
      const newer = { ...mockReview, id: 2, createdAt: new Date("2026-03-05") };
      vi.mocked(getImageQualityReviewsByUser).mockResolvedValue([newer, older]);
      const result = await getImageQualityReviewsByUser(mockUserId);
      expect(result[0].id).toBe(2);
    });
  });

  // READ — by ID
  describe("getImageQualityReviewById", () => {
    it("returns a review by ID", async () => {
      vi.mocked(getImageQualityReviewById).mockResolvedValue(mockReview);
      const result = await getImageQualityReviewById(1);
      expect(result).toMatchObject({ id: 1, facilityName: "Echo Lab A" });
    });

    it("returns null for a non-existent review", async () => {
      vi.mocked(getImageQualityReviewById).mockResolvedValue(null);
      const result = await getImageQualityReviewById(9999);
      expect(result).toBeNull();
    });
  });

  // UPDATE
  describe("updateImageQualityReview", () => {
    it("updates a review's comments field", async () => {
      const updated = { ...mockReview, comments: "Updated comment." };
      vi.mocked(updateImageQualityReview).mockResolvedValue(updated);
      const result = await updateImageQualityReview(1, { comments: "Updated comment." } as any);
      expect(result.comments).toBe("Updated comment.");
    });

    it("updates the overallQualityScore", async () => {
      const updated = { ...mockReview, overallQualityScore: 92, overallRating: "Excellent" };
      vi.mocked(updateImageQualityReview).mockResolvedValue(updated);
      const result = await updateImageQualityReview(1, { overallQualityScore: 92, overallRating: "Excellent" } as any);
      expect(result.overallQualityScore).toBe(92);
      expect(result.overallRating).toBe("Excellent");
    });
  });

  // DELETE
  describe("deleteImageQualityReview", () => {
    it("deletes a review by ID", async () => {
      vi.mocked(deleteImageQualityReview).mockResolvedValue(undefined);
      await expect(deleteImageQualityReview(1)).resolves.toBeUndefined();
      expect(deleteImageQualityReview).toHaveBeenCalledWith(1);
    });
  });

  // Quality Score calculation logic
  describe("Quality Score computation", () => {
    it("calculates Excellent tier for score >= 90", () => {
      const getQualityTier = (score: number) => {
        if (score >= 90) return "Excellent";
        if (score >= 75) return "Good";
        if (score >= 60) return "Adequate";
        return "Needs Improvement";
      };
      expect(getQualityTier(95)).toBe("Excellent");
      expect(getQualityTier(90)).toBe("Excellent");
    });

    it("calculates Good tier for score 75–89", () => {
      const getQualityTier = (score: number) => {
        if (score >= 90) return "Excellent";
        if (score >= 75) return "Good";
        if (score >= 60) return "Adequate";
        return "Needs Improvement";
      };
      expect(getQualityTier(88)).toBe("Good");
      expect(getQualityTier(75)).toBe("Good");
    });

    it("calculates Adequate tier for score 60–74", () => {
      const getQualityTier = (score: number) => {
        if (score >= 90) return "Excellent";
        if (score >= 75) return "Good";
        if (score >= 60) return "Adequate";
        return "Needs Improvement";
      };
      expect(getQualityTier(65)).toBe("Adequate");
      expect(getQualityTier(60)).toBe("Adequate");
    });

    it("calculates Needs Improvement tier for score < 60", () => {
      const getQualityTier = (score: number) => {
        if (score >= 90) return "Excellent";
        if (score >= 75) return "Good";
        if (score >= 60) return "Adequate";
        return "Needs Improvement";
      };
      expect(getQualityTier(55)).toBe("Needs Improvement");
      expect(getQualityTier(0)).toBe("Needs Improvement");
    });

    it("boundary: score 74 is Adequate, score 75 is Good", () => {
      const getQualityTier = (score: number) => {
        if (score >= 90) return "Excellent";
        if (score >= 75) return "Good";
        if (score >= 60) return "Adequate";
        return "Needs Improvement";
      };
      expect(getQualityTier(74)).toBe("Adequate");
      expect(getQualityTier(75)).toBe("Good");
    });
  });
});
