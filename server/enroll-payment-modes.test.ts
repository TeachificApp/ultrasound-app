/**
 * Tests for the enhanced enrollInCourse input schema
 * covering all three payment modes: free, link, charge
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const enrollInCourseInput = z.object({
  userId: z.number().int(),
  courseId: z.number().int(),
  paymentMode: z.enum(["free", "link", "charge"]).default("free"),
  stripePaymentIntentId: z.string().optional(),
  stripeCardToken: z.string().optional(),
  amountCents: z.number().int().min(50).optional(),
  currency: z.string().default("usd"),
  note: z.string().optional(),
});

describe("enrollInCourse input schema — free mode", () => {
  it("accepts minimal free enrollment", () => {
    const r = enrollInCourseInput.safeParse({ userId: 1, courseId: 10 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.paymentMode).toBe("free");
      expect(r.data.currency).toBe("usd");
    }
  });

  it("accepts free mode with note", () => {
    const r = enrollInCourseInput.safeParse({ userId: 1, courseId: 10, paymentMode: "free", note: "Scholarship" });
    expect(r.success).toBe(true);
  });

  it("rejects missing userId", () => {
    const r = enrollInCourseInput.safeParse({ courseId: 10 });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer userId", () => {
    const r = enrollInCourseInput.safeParse({ userId: 1.5, courseId: 10 });
    expect(r.success).toBe(false);
  });
});

describe("enrollInCourse input schema — link mode", () => {
  it("accepts link mode with PaymentIntent ID", () => {
    const r = enrollInCourseInput.safeParse({
      userId: 1, courseId: 10,
      paymentMode: "link",
      stripePaymentIntentId: "pi_3abc123",
    });
    expect(r.success).toBe(true);
  });

  it("accepts link mode without PI (optional)", () => {
    const r = enrollInCourseInput.safeParse({ userId: 1, courseId: 10, paymentMode: "link" });
    expect(r.success).toBe(true); // schema allows optional PI
  });
});

describe("enrollInCourse input schema — charge mode", () => {
  it("accepts charge mode with card token and amount", () => {
    const r = enrollInCourseInput.safeParse({
      userId: 1, courseId: 10,
      paymentMode: "charge",
      stripeCardToken: "tok_visa",
      amountCents: 9900,
      currency: "usd",
    });
    expect(r.success).toBe(true);
  });

  it("rejects amountCents below minimum (50 cents)", () => {
    const r = enrollInCourseInput.safeParse({
      userId: 1, courseId: 10,
      paymentMode: "charge",
      stripeCardToken: "tok_visa",
      amountCents: 10, // below $0.50 minimum
    });
    expect(r.success).toBe(false);
  });

  it("accepts amountCents at minimum (50 cents)", () => {
    const r = enrollInCourseInput.safeParse({
      userId: 1, courseId: 10,
      paymentMode: "charge",
      stripeCardToken: "tok_visa",
      amountCents: 50,
    });
    expect(r.success).toBe(true);
  });
});

describe("enrollInCourse input schema — invalid paymentMode", () => {
  it("rejects unknown payment mode", () => {
    const r = enrollInCourseInput.safeParse({ userId: 1, courseId: 10, paymentMode: "bitcoin" });
    expect(r.success).toBe(false);
  });
});
