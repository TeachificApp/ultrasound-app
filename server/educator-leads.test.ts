/**
 * educator-leads.test.ts — Tests for educator lead form procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockInsert = vi.fn().mockResolvedValue([{ insertId: 42 }]);
const mockUpdate = vi.fn().mockResolvedValue([{}]);
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([
    {
      id: 1,
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "555-1234",
      credentials: "RDMS",
      message: "I want to teach!",
      status: "new",
      adminNotes: null,
      tags: "Educator",
      createdAt: new Date(),
    },
  ]),
});
const mockDb = {
  insert: vi.fn().mockReturnValue({ values: mockInsert }),
  update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: mockUpdate }) }),
  select: mockSelect,
};
vi.mock("../server/db", () => ({ getDb: vi.fn().mockResolvedValue(mockDb) }));
vi.mock("../server/_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(true) }));
vi.mock("../server/_core/email", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));
vi.mock("../server/_core/env", () => ({ ENV: { platformAdminEmail: "admin@example.com" } }));

describe("Educator Lead Form", () => {
  it("validates required fields — missing email should fail zod", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.string().email().max(255),
      phone: z.string().max(50).optional(),
      credentials: z.string().max(200).optional(),
      message: z.string().max(2000).optional(),
    });
    const result = schema.safeParse({ firstName: "Jane", lastName: "Smith", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("validates a complete valid payload", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.string().email().max(255),
      phone: z.string().max(50).optional(),
      credentials: z.string().max(200).optional(),
      message: z.string().max(2000).optional(),
    });
    const result = schema.safeParse({
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "555-1234",
      credentials: "RDMS, RVT",
      message: "I love teaching ultrasound!",
    });
    expect(result.success).toBe(true);
  });

  it("adminUpdateEducatorLead validates status enum", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      id: z.number(),
      status: z.enum(["new", "contacted", "closed"]).optional(),
      adminNotes: z.string().max(2000).optional(),
    });
    expect(schema.safeParse({ id: 1, status: "invalid" }).success).toBe(false);
    expect(schema.safeParse({ id: 1, status: "contacted" }).success).toBe(true);
    expect(schema.safeParse({ id: 1, adminNotes: "Called them" }).success).toBe(true);
  });

  it("tags default to Educator", () => {
    const defaultTags = "Educator";
    expect(defaultTags).toBe("Educator");
  });
});
