/**
 * Tests for funnelRouter.updateFunnelSettings — verifies that customDomain
 * is accepted in the input schema alongside slug/SEO fields.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirror the input schema from funnelRouter.ts updateFunnelSettings
const updateFunnelSettingsInput = z.object({
  funnelId: z.number().int().positive(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  name: z.string().min(1).max(255).optional(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(500).optional(),
  status: z.enum(["draft", "active", "archived", "paused"]).optional(),
  thankYouUrl: z.string().max(500).optional(),
  customDomain: z.string().max(255).nullable().optional(),
});

describe("updateFunnelSettings input schema", () => {
  it("accepts valid input with customDomain set", () => {
    const result = updateFunnelSettingsInput.safeParse({
      funnelId: 1,
      slug: "my-funnel",
      customDomain: "app.allaboutultrasound.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customDomain).toBe("app.allaboutultrasound.com");
    }
  });

  it("accepts null customDomain (clears override)", () => {
    const result = updateFunnelSettingsInput.safeParse({
      funnelId: 1,
      slug: "my-funnel",
      customDomain: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customDomain).toBeNull();
    }
  });

  it("accepts missing customDomain (undefined = no change)", () => {
    const result = updateFunnelSettingsInput.safeParse({
      funnelId: 1,
      slug: "my-funnel",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customDomain).toBeUndefined();
    }
  });

  it("rejects slug with uppercase letters", () => {
    const result = updateFunnelSettingsInput.safeParse({
      funnelId: 1,
      slug: "My-Funnel",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = updateFunnelSettingsInput.safeParse({
      funnelId: 1,
      slug: "my funnel",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all optional SEO fields together with customDomain", () => {
    const result = updateFunnelSettingsInput.safeParse({
      funnelId: 42,
      slug: "vascular-course-funnel",
      name: "Vascular Course Funnel",
      metaTitle: "Vascular Ultrasound Course",
      metaDescription: "Learn vascular ultrasound with expert guidance.",
      thankYouUrl: "https://app.allaboutultrasound.com/thank-you",
      status: "active",
      customDomain: "learn.allaboutultrasound.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("vascular-course-funnel");
      expect(result.data.customDomain).toBe("learn.allaboutultrasound.com");
      expect(result.data.status).toBe("active");
    }
  });
});
