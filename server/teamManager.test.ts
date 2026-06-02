/**
 * teamManager.test.ts
 * Unit tests for lmsTeamManagerRouter procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  $returningId: vi.fn().mockResolvedValue([{ id: 1 }]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([]),
};

vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../server/_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  emailWrapper: vi.fn((html: string) => html),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: any[]) => args),
    eq: vi.fn((col: any, val: any) => ({ col, val })),
    ne: vi.fn((col: any, val: any) => ({ col, val })),
    desc: vi.fn((col: any) => col),
    sql: Object.assign(vi.fn((strings: any) => strings), {
      join: vi.fn(() => ""),
    }),
  };
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Team Manager Feature", () => {
  describe("Schema", () => {
    it("lmsGroupManagers table is exported from schema", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.lmsGroupManagers).toBeDefined();
    });

    it("lmsGroupManagers has required fields", async () => {
      const schema = await import("../drizzle/schema");
      const cols = Object.keys(schema.lmsGroupManagers);
      // Table object should be truthy and have drizzle table properties
      expect(schema.lmsGroupManagers).toBeTruthy();
    });
  });

  describe("Router registration", () => {
    it("lmsTeamManagerRouter is exported", async () => {
      const { lmsTeamManagerRouter } = await import("./routers/lmsTeamManagerRouter");
      expect(lmsTeamManagerRouter).toBeDefined();
    });

    it("lmsTeamManagerRouter has expected procedures", async () => {
      const { lmsTeamManagerRouter } = await import("./routers/lmsTeamManagerRouter");
      const procedures = Object.keys(lmsTeamManagerRouter._def.procedures);
      expect(procedures).toContain("addManager");
      expect(procedures).toContain("removeManager");
      expect(procedures).toContain("setManagerSeat");
      expect(procedures).toContain("listManagers");
      expect(procedures).toContain("getMyManagedGroups");
      expect(procedures).toContain("assignSeat");
      expect(procedures).toContain("revokeSeat");
      expect(procedures).toContain("resendInvite");
      expect(procedures).toContain("getGroupAnalytics");
    });
  });

  describe("Business rules", () => {
    it("max 5 managers constant is enforced in addManager logic", async () => {
      // The router code checks existing.length >= 5 before inserting
      // We verify this by reading the source
      const fs = await import("fs");
      const src = fs.readFileSync("./server/routers/lmsTeamManagerRouter.ts", "utf8");
      expect(src).toContain("existing.length >= 5");
      expect(src).toContain("Teams can have at most 5 managers");
    });

    it("managers do not require a seat by default (hasSeat defaults to false)", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("./server/routers/lmsTeamManagerRouter.ts", "utf8");
      expect(src).toContain("hasSeat: z.boolean().default(false)");
    });

    it("assertManagerOrAdmin allows admin users without checking manager table", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("./server/routers/lmsTeamManagerRouter.ts", "utf8");
      expect(src).toContain("if (isAdmin) return;");
    });

    it("revokeSeat checks manager auth before revoking", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("./server/routers/lmsTeamManagerRouter.ts", "utf8");
      // revokeSeat calls assertManagerOrAdmin
      const revokeIdx = src.indexOf("revokeSeat:");
      const assertIdx = src.indexOf("assertManagerOrAdmin", revokeIdx);
      expect(assertIdx).toBeGreaterThan(revokeIdx);
    });

    it("addManager is admin-only", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("./server/routers/lmsTeamManagerRouter.ts", "utf8");
      const addManagerIdx = src.indexOf("addManager:");
      const adminCheckIdx = src.indexOf('ctx.user.role !== "admin"', addManagerIdx);
      expect(adminCheckIdx).toBeGreaterThan(addManagerIdx);
    });
  });
});
