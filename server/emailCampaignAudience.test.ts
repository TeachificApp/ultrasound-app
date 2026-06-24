import { describe, it, expect } from "vitest";
import {
  AudienceFilterSchema,
  abBucketForEmail,
  pickAbVariant,
  buildRecipientTrackingKey,
  parseRecipientTrackingKey,
} from "../shared/emailCampaignAudience";

describe("emailCampaignAudience", () => {
  it("parses extended audience filter with defaults", () => {
    const filter = AudienceFilterSchema.parse({
      interests: ["pocus"],
      listIds: [1, 2],
      interestIds: [3],
    });
    expect(filter.listIds).toEqual([1, 2]);
    expect(filter.listMode).toBe("intersect");
    expect(filter.interestIds).toEqual([3]);
    expect(filter.logic).toBe("and");
    expect(filter.workshopInstanceIds).toEqual([]);
    expect(filter.purchasedPhysicalProductIds).toEqual([]);
    expect(filter.webinarIds).toEqual([]);
    expect(filter.purchasedDigitalBundleIds).toEqual([]);
    expect(filter.enrolledInQuizIds).toEqual([]);
  });

  it("assigns stable A/B buckets", () => {
    const a = abBucketForEmail("test@example.com", 42);
    const b = abBucketForEmail("test@example.com", 42);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });

  it("picks A/B variant by weight", () => {
    const variant = pickAbVariant("user@example.com", {
      enabled: true,
      variants: [
        { key: "A", weight: 100 },
        { key: "B", weight: 0 },
      ],
    });
    expect(variant?.key).toBe("A");
  });

  it("round-trips recipient tracking keys", () => {
    const key = buildRecipientTrackingKey({ userId: 12, email: "a@b.com" });
    expect(parseRecipientTrackingKey(key)).toEqual({ userId: 12, email: null });

    const emailKey = buildRecipientTrackingKey({ userId: null, email: "list@example.com" });
    const parsed = parseRecipientTrackingKey(emailKey);
    expect(parsed.userId).toBeNull();
    expect(parsed.email).toBe("list@example.com");
  });
});
