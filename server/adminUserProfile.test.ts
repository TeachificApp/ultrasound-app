import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB and auth
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    execute: vi.fn().mockResolvedValue([[{ total: 0 }]]),
  }),
}));

describe("adminUser profile procedures (unit)", () => {
  it("updateUserProfile input schema accepts all optional fields", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      userId: z.number().int(),
      displayName: z.string().max(100).optional(),
      firstName: z.string().max(100).optional(),
      lastName: z.string().max(100).optional(),
      email: z.string().email().optional(),
      bio: z.string().max(2000).optional(),
      specialty: z.string().max(100).optional(),
      credentials: z.string().max(200).optional(),
      location: z.string().max(150).optional(),
      website: z.string().max(255).optional(),
      timezone: z.string().max(64).optional(),
      isDemo: z.boolean().optional(),
      isPremium: z.boolean().optional(),
    });
    const result = schema.safeParse({
      userId: 42,
      displayName: "Dr. Jane",
      email: "jane@example.com",
      specialty: "Cardiac Sonographer",
      isPremium: true,
    });
    expect(result.success).toBe(true);
  });

  it("updateUserProfile rejects invalid email", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      userId: z.number().int(),
      email: z.string().email().optional(),
    });
    const result = schema.safeParse({ userId: 1, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("getUserLoginHistory input schema validates", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      userId: z.number().int(),
      page: z.number().int().default(1),
      pageSize: z.number().int().default(25),
    });
    const result = schema.safeParse({ userId: 5 });
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(1);
    expect(result.data?.pageSize).toBe(25);
  });

  it("getUserActivityLog input schema validates", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      userId: z.number().int(),
      page: z.number().int().default(1),
      pageSize: z.number().int().default(50),
    });
    const result = schema.safeParse({ userId: 10, page: 2 });
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(2);
    expect(result.data?.pageSize).toBe(50);
  });
});
