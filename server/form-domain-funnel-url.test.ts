/**
 * Tests for:
 * 1. generalFormRouter.updateForm — hostDomain accepted and nullable
 * 2. Funnel URL preview logic — customDomain drives the external link base
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Form updateForm input schema (mirror from generalFormRouter.ts) ──────────
const updateFormInput = z.object({
  id: z.number(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  formType: z.string().optional(),
  status: z.enum(["open", "closed", "draft"]).optional(),
  isPublic: z.boolean().optional(),
  scoreEnabled: z.boolean().optional(),
  scoreLabel: z.string().optional(),
  successMessage: z.string().optional(),
  successRedirectUrl: z.string().optional(),
  notifyEmail: z.string().optional(),
  maxSubmissions: z.number().optional(),
  openAt: z.string().optional(),
  closeAt: z.string().optional(),
  hostDomain: z.string().optional(),
});

describe("generalForm.updateForm input schema — hostDomain", () => {
  it("accepts a custom hostDomain", () => {
    const result = updateFormInput.safeParse({
      id: 1,
      hostDomain: "app.allaboutultrasound.com",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hostDomain).toBe("app.allaboutultrasound.com");
  });

  it("accepts hostDomain as undefined (no change)", () => {
    const result = updateFormInput.safeParse({ id: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hostDomain).toBeUndefined();
  });

  it("accepts empty string hostDomain (reset to default)", () => {
    const result = updateFormInput.safeParse({ id: 1, hostDomain: "" });
    expect(result.success).toBe(true);
  });

  it("accepts all fields including hostDomain together", () => {
    const result = updateFormInput.safeParse({
      id: 42,
      name: "Vascular Quiz",
      status: "open",
      hostDomain: "learn.allaboutultrasound.com",
      scoreEnabled: true,
      scoreLabel: "Score",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hostDomain).toBe("learn.allaboutultrasound.com");
      expect(result.data.status).toBe("open");
    }
  });
});

// ─── Funnel URL preview logic ─────────────────────────────────────────────────
// Mirror the URL construction logic from FunnelBuilder.tsx
function buildFunnelUrl(slug: string, customDomain: string | null | undefined, origin: string): string {
  const base = customDomain ? `https://${customDomain}` : origin;
  return `${base}/${slug}`;
}

describe("Funnel card URL preview — customDomain override", () => {
  const ORIGIN = "https://ultrasound-urcfdrve.manus.space";

  it("uses app origin when customDomain is null", () => {
    const url = buildFunnelUrl("vascular-course", null, ORIGIN);
    expect(url).toBe(`${ORIGIN}/vascular-course`);
  });

  it("uses app origin when customDomain is undefined", () => {
    const url = buildFunnelUrl("vascular-course", undefined, ORIGIN);
    expect(url).toBe(`${ORIGIN}/vascular-course`);
  });

  it("uses customDomain when set", () => {
    const url = buildFunnelUrl("vascular-course", "app.allaboutultrasound.com", ORIGIN);
    expect(url).toBe("https://app.allaboutultrasound.com/vascular-course");
  });

  it("uses customDomain for learn subdomain", () => {
    const url = buildFunnelUrl("echo-masterclass", "learn.allaboutultrasound.com", ORIGIN);
    expect(url).toBe("https://learn.allaboutultrasound.com/echo-masterclass");
  });

  it("falls back to origin for empty string customDomain", () => {
    const url = buildFunnelUrl("echo-masterclass", "", ORIGIN);
    expect(url).toBe(`${ORIGIN}/echo-masterclass`);
  });
});
