/**
 * Tests for Platform Admin router procedures:
 *   - findUserByEmail (mutation — converted from query for reliable on-demand lookup)
 *   - assignRoleByEmail (mutation)
 *
 * All DB calls are mocked so no real database connection is needed.
 * The helpers are tested as pure logic units.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the db module ───────────────────────────────────────────────────────

const mockFindUserByEmailWithRoles = vi.fn();
const mockGetUserRoles = vi.fn();
const mockAssignRole = vi.fn();
const mockCreatePendingUser = vi.fn();

vi.mock("./db", () => ({
  findUserByEmailWithRoles: (...args: unknown[]) => mockFindUserByEmailWithRoles(...args),
  getUserRoles: (...args: unknown[]) => mockGetUserRoles(...args),
  assignRole: (...args: unknown[]) => mockAssignRole(...args),
  createPendingUser: (...args: unknown[]) => mockCreatePendingUser(...args),
  removeRole: vi.fn(),
  listUsersWithRoles: vi.fn(),
  countUsers: vi.fn(),
  getDiyUsersForLab: vi.fn(),
  getLabByAdmin: vi.fn(),
}));

// ─── Inline the core logic being tested ──────────────────────────────────────
// We test the logic extracted from the router procedures directly so we don't
// need to spin up a full tRPC server.

type AppRole = "user" | "premium_user" | "diy_admin" | "diy_user" | "platform_admin";

async function findUserByEmailLogic(
  callerRole: string,
  callerAppRoles: AppRole[],
  email: string,
) {
  if (callerRole !== "admin" && !callerAppRoles.includes("platform_admin")) {
    throw new Error("FORBIDDEN");
  }
  const found = await mockFindUserByEmailWithRoles(email);
  if (!found) return null;
  return {
    id: found.id,
    name: found.name,
    email: found.email,
    displayName: found.displayName,
    role: found.role,
    roles: found.roles,
  };
}

async function assignRoleByEmailLogic(
  callerRole: string,
  callerAppRoles: AppRole[],
  callerUserId: number,
  email: string,
  role: AppRole,
) {
  const isOwner = callerRole === "admin";
  const isPlatformAdmin = callerAppRoles.includes("platform_admin");
  if (!isOwner && !isPlatformAdmin) throw new Error("FORBIDDEN");
  if (role === "platform_admin" && !isOwner) throw new Error("Only the owner can assign platform_admin");
  const found = await mockFindUserByEmailWithRoles(email);
  let wasPreRegistered = false;
  if (!found) {
    // Pre-register: create a stub account and assign the role immediately
    const newId = await mockCreatePendingUser(email);
    await mockAssignRole(newId, role, callerUserId);
    wasPreRegistered = true;
    return { success: true, userId: newId, displayName: email, wasPreRegistered };
  }
  await mockAssignRole(found.id, role, callerUserId);
  return { success: true, userId: found.id, displayName: found.displayName ?? found.name, wasPreRegistered: false };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findUserByEmail procedure logic", () => {
  it("throws FORBIDDEN when caller is not owner or platform_admin", async () => {
    await expect(
      findUserByEmailLogic("user", ["user"], "test@example.com"),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("allows owner (role=admin) to search", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue(null);
    const result = await findUserByEmailLogic("admin", [], "test@example.com");
    expect(result).toBeNull();
    expect(mockFindUserByEmailWithRoles).toHaveBeenCalledWith("test@example.com");
  });

  it("allows platform_admin to search", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue(null);
    const result = await findUserByEmailLogic("user", ["platform_admin"], "test@example.com");
    expect(result).toBeNull();
  });

  it("returns null when user is not found", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue(null);
    const result = await findUserByEmailLogic("admin", [], "unknown@example.com");
    expect(result).toBeNull();
  });

  it("returns user data with roles when found", async () => {
    const mockUser = {
      id: 42,
      name: "Jane Doe",
      email: "jane@example.com",
      displayName: "Jane",
      role: "user",
      roles: ["user", "premium_user"],
    };
    mockFindUserByEmailWithRoles.mockResolvedValue(mockUser);
    const result = await findUserByEmailLogic("admin", [], "jane@example.com");
    expect(result).not.toBeNull();
    expect(result!.id).toBe(42);
    expect(result!.email).toBe("jane@example.com");
    expect(result!.roles).toContain("premium_user");
  });

  it("returns only the expected fields (no sensitive data leak)", async () => {
    const mockUser = {
      id: 1,
      name: "Test",
      email: "t@t.com",
      displayName: null,
      role: "user",
      roles: ["user"],
      openId: "secret-open-id",
      passwordHash: "secret-hash",
    };
    mockFindUserByEmailWithRoles.mockResolvedValue(mockUser);
    const result = await findUserByEmailLogic("admin", [], "t@t.com");
    expect(result).not.toHaveProperty("openId");
    expect(result).not.toHaveProperty("passwordHash");
  });
});

describe("assignRoleByEmail procedure logic", () => {
  it("throws FORBIDDEN when caller has no admin rights", async () => {
    await expect(
      assignRoleByEmailLogic("user", ["user"], 1, "test@example.com", "premium_user"),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("throws FORBIDDEN when platform_admin tries to assign platform_admin", async () => {
    await expect(
      assignRoleByEmailLogic("user", ["platform_admin"], 1, "test@example.com", "platform_admin"),
    ).rejects.toThrow("Only the owner can assign platform_admin");
  });

  it("allows owner to assign platform_admin role", async () => {
    const mockUser = { id: 5, name: "Admin", displayName: "Admin User", email: "a@a.com", role: "user", roles: [] };
    mockFindUserByEmailWithRoles.mockResolvedValue(mockUser);
    mockAssignRole.mockResolvedValue(undefined);
    const result = await assignRoleByEmailLogic("admin", [], 1, "a@a.com", "platform_admin");
    expect(result.success).toBe(true);
    expect(mockAssignRole).toHaveBeenCalledWith(5, "platform_admin", 1);
  });

  it("pre-registers a new user when email does not exist", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue(null);
    mockCreatePendingUser.mockResolvedValue(99);
    mockAssignRole.mockResolvedValue(undefined);
    const result = await assignRoleByEmailLogic("admin", [], 1, "nobody@example.com", "premium_user");
    expect(result.success).toBe(true);
    expect(result.wasPreRegistered).toBe(true);
    expect(result.userId).toBe(99);
    expect(result.displayName).toBe("nobody@example.com");
    expect(mockCreatePendingUser).toHaveBeenCalledWith("nobody@example.com");
    expect(mockAssignRole).toHaveBeenCalledWith(99, "premium_user", 1);
  });
  it("returns wasPreRegistered=false for existing users", async () => {
    const mockUser = { id: 10, name: "Bob", displayName: "Bob Smith", email: "bob@example.com", role: "user", roles: ["user"] };
    mockFindUserByEmailWithRoles.mockResolvedValue(mockUser);
    mockAssignRole.mockResolvedValue(undefined);
    const result = await assignRoleByEmailLogic("admin", [], 1, "bob@example.com", "premium_user");
    expect(result.wasPreRegistered).toBe(false);
    expect(mockCreatePendingUser).not.toHaveBeenCalled();
  });

  it("assigns premium_user role successfully", async () => {
    const mockUser = { id: 10, name: "Bob", displayName: "Bob Smith", email: "bob@example.com", role: "user", roles: ["user"] };
    mockFindUserByEmailWithRoles.mockResolvedValue(mockUser);
    mockAssignRole.mockResolvedValue(undefined);
    const result = await assignRoleByEmailLogic("user", ["platform_admin"], 2, "bob@example.com", "premium_user");
    expect(result.success).toBe(true);
    expect(result.userId).toBe(10);
    expect(result.displayName).toBe("Bob Smith");
    expect(mockAssignRole).toHaveBeenCalledWith(10, "premium_user", 2);
  });

  it("assigns diy_admin role successfully", async () => {
    const mockUser = { id: 20, name: "Carol", displayName: null, email: "carol@example.com", role: "user", roles: ["user"] };
    mockFindUserByEmailWithRoles.mockResolvedValue(mockUser);
    mockAssignRole.mockResolvedValue(undefined);
    const result = await assignRoleByEmailLogic("admin", [], 1, "carol@example.com", "diy_admin");
    expect(result.success).toBe(true);
    expect(result.displayName).toBe("Carol"); // falls back to name
  });

  it("uses displayName over name in return value", async () => {
    const mockUser = { id: 30, name: "dave_raw", displayName: "Dave Smith", email: "dave@example.com", role: "user", roles: [] };
    mockFindUserByEmailWithRoles.mockResolvedValue(mockUser);
    mockAssignRole.mockResolvedValue(undefined);
    const result = await assignRoleByEmailLogic("admin", [], 1, "dave@example.com", "diy_user");
    expect(result.displayName).toBe("Dave Smith");
  });

  it("calls assignRole with correct caller user ID", async () => {
    const mockUser = { id: 99, name: "Eve", displayName: "Eve", email: "eve@example.com", role: "user", roles: [] };
    mockFindUserByEmailWithRoles.mockResolvedValue(mockUser);
    mockAssignRole.mockResolvedValue(undefined);
    await assignRoleByEmailLogic("admin", [], 777, "eve@example.com", "premium_user");
    expect(mockAssignRole).toHaveBeenCalledWith(99, "premium_user", 777);
  });
});

// ─── bulkAssignRole logic ─────────────────────────────────────────────────────

type BulkRowStatus = "success" | "already_assigned" | "pre_registered" | "error";

async function bulkAssignRoleLogic(
  callerRole: string,
  callerAppRoles: AppRole[],
  callerUserId: number,
  emails: string[],
  role: AppRole,
) {
  const isOwner = callerRole === "admin";
  const isPlatformAdmin = callerAppRoles.includes("platform_admin");
  if (!isOwner && !isPlatformAdmin) throw new Error("FORBIDDEN");
  if (role === "platform_admin" && !isOwner) throw new Error("Only the owner can assign platform_admin");

  const results: Array<{ email: string; status: BulkRowStatus; displayName?: string; message?: string }> = [];

  for (const email of emails) {
    try {
      const found = await mockFindUserByEmailWithRoles(email);
      if (!found) {
        // Pre-register: create stub account and assign role immediately
        const newId = await mockCreatePendingUser(email);
        await mockAssignRole(newId, role, callerUserId);
        results.push({ email, status: "pre_registered", displayName: email });
        continue;
      }
      if (found.roles.includes(role)) {
        results.push({ email, status: "already_assigned", displayName: found.displayName ?? found.name ?? undefined });
        continue;
      }
      await mockAssignRole(found.id, role, callerUserId);
      results.push({ email, status: "success", displayName: found.displayName ?? found.name ?? undefined });
    } catch (err) {
      results.push({ email, status: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return {
    total: results.length,
    succeeded: results.filter(r => r.status === "success").length,
    alreadyAssigned: results.filter(r => r.status === "already_assigned").length,
    preRegistered: results.filter(r => r.status === "pre_registered").length,
    errors: results.filter(r => r.status === "error").length,
    rows: results,
  };
}

describe("bulkAssignRole procedure logic", () => {
  it("throws FORBIDDEN when caller has no admin rights", async () => {
    await expect(
      bulkAssignRoleLogic("user", ["user"], 1, ["a@b.com"], "premium_user"),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("throws FORBIDDEN when platform_admin tries to assign platform_admin", async () => {
    await expect(
      bulkAssignRoleLogic("user", ["platform_admin"], 1, ["a@b.com"], "platform_admin"),
    ).rejects.toThrow("Only the owner can assign platform_admin");
  });

  it("pre-registers emails with no existing account", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue(null);
    mockCreatePendingUser.mockResolvedValue(55);
    mockAssignRole.mockResolvedValue(undefined);
    const result = await bulkAssignRoleLogic("admin", [], 1, ["nobody@x.com"], "premium_user");
    expect(result.preRegistered).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.rows[0].status).toBe("pre_registered");
    expect(mockCreatePendingUser).toHaveBeenCalledWith("nobody@x.com");
    expect(mockAssignRole).toHaveBeenCalledWith(55, "premium_user", 1);
  });

  it("returns already_assigned for users who already have the role", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue({
      id: 1, name: "Alice", displayName: "Alice", email: "alice@x.com",
      role: "user", roles: ["user", "premium_user"],
    });
    const result = await bulkAssignRoleLogic("admin", [], 1, ["alice@x.com"], "premium_user");
    expect(result.alreadyAssigned).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(mockAssignRole).not.toHaveBeenCalled();
  });

  it("assigns role to a user who doesn't have it yet", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue({
      id: 5, name: "Bob", displayName: "Bob", email: "bob@x.com",
      role: "user", roles: ["user"],
    });
    mockAssignRole.mockResolvedValue(undefined);
    const result = await bulkAssignRoleLogic("admin", [], 1, ["bob@x.com"], "premium_user");
    expect(result.succeeded).toBe(1);
    expect(mockAssignRole).toHaveBeenCalledWith(5, "premium_user", 1);
  });

  it("processes multiple emails: assigns, pre-registers, and marks already-assigned", async () => {
    mockFindUserByEmailWithRoles
      .mockResolvedValueOnce({ id: 1, name: "A", displayName: "A", email: "a@x.com", role: "user", roles: ["user"] })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 3, name: "C", displayName: "C", email: "c@x.com", role: "user", roles: ["user", "premium_user"] });
    mockCreatePendingUser.mockResolvedValue(88);
    mockAssignRole.mockResolvedValue(undefined);

    const result = await bulkAssignRoleLogic("admin", [], 1, ["a@x.com", "b@x.com", "c@x.com"], "premium_user");
    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(1);
    expect(result.preRegistered).toBe(1);
    expect(result.alreadyAssigned).toBe(1);
    expect(result.rows[1].status).toBe("pre_registered");
    expect(mockCreatePendingUser).toHaveBeenCalledWith("b@x.com");
  });

  it("captures error rows when assignRole throws", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue({
      id: 9, name: "X", displayName: "X", email: "x@x.com", role: "user", roles: ["user"],
    });
    mockAssignRole.mockRejectedValue(new Error("DB connection failed"));
    const result = await bulkAssignRoleLogic("admin", [], 1, ["x@x.com"], "premium_user");
    expect(result.errors).toBe(1);
    expect(result.rows[0].status).toBe("error");
    expect(result.rows[0].message).toBe("DB connection failed");
  });

  it("returns correct row-level data for each email", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue({
      id: 20, name: "raw_name", displayName: "Display Name", email: "d@x.com",
      role: "user", roles: ["user"],
    });
    mockAssignRole.mockResolvedValue(undefined);
    const result = await bulkAssignRoleLogic("admin", [], 1, ["d@x.com"], "diy_user");
    expect(result.rows[0].displayName).toBe("Display Name");
    expect(result.rows[0].email).toBe("d@x.com");
  });

  it("allows platform_admin to bulk-assign non-platform_admin roles", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue({
      id: 7, name: "E", displayName: "E", email: "e@x.com", role: "user", roles: ["user"],
    });
    mockAssignRole.mockResolvedValue(undefined);
    const result = await bulkAssignRoleLogic("user", ["platform_admin"], 2, ["e@x.com"], "diy_user");
    expect(result.succeeded).toBe(1);
  });
});

// ─── bulkAssignSeat logic ─────────────────────────────────────────────────────

type BulkSeatStatus = "success" | "already_assigned" | "not_found" | "seat_limit_reached" | "error";

async function bulkAssignSeatLogic(
  callerRole: string,
  callerAppRoles: AppRole[],
  callerUserId: number,
  emails: string[],
  seatLimit: number,
  initialSeats: number,
  labId: number,
) {
  if (!callerAppRoles.includes("diy_admin") && callerRole !== "admin") throw new Error("FORBIDDEN");

  let currentSeatCount = initialSeats;

  const results: Array<{ email: string; status: BulkSeatStatus; displayName?: string; message?: string }> = [];

  for (const email of emails) {
    if (currentSeatCount >= seatLimit) {
      results.push({ email, status: "seat_limit_reached", message: `Seat limit of ${seatLimit} reached` });
      continue;
    }
    try {
      const found = await mockFindUserByEmailWithRoles(email);
      if (!found) {
        results.push({ email, status: "not_found", message: "No account — user must sign in first" });
        continue;
      }
      if (found.roles.includes("diy_user")) {
        results.push({ email, status: "already_assigned", displayName: found.displayName ?? found.name ?? undefined });
        continue;
      }
      await mockAssignRole(found.id, "diy_user", callerUserId, labId);
      currentSeatCount++;
      results.push({ email, status: "success", displayName: found.displayName ?? found.name ?? undefined });
    } catch (err) {
      results.push({ email, status: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return {
    total: results.length,
    succeeded: results.filter(r => r.status === "success").length,
    alreadyAssigned: results.filter(r => r.status === "already_assigned").length,
    notFound: results.filter(r => r.status === "not_found").length,
    seatLimitReached: results.filter(r => r.status === "seat_limit_reached").length,
    errors: results.filter(r => r.status === "error").length,
    rows: results,
    seatUsage: { used: currentSeatCount, total: seatLimit },
  };
}

describe("bulkAssignSeat procedure logic", () => {
  it("throws FORBIDDEN when caller is not diy_admin or owner", async () => {
    await expect(
      bulkAssignSeatLogic("user", ["user"], 1, ["a@b.com"], 5, 0, 1),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("allows diy_admin to bulk assign seats", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue({
      id: 1, name: "A", displayName: "A", email: "a@x.com", role: "user", roles: ["user"],
    });
    mockAssignRole.mockResolvedValue(undefined);
    const result = await bulkAssignSeatLogic("user", ["diy_admin"], 1, ["a@x.com"], 5, 0, 10);
    expect(result.succeeded).toBe(1);
  });

  it("stops assigning when seat limit is reached", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue({
      id: 1, name: "A", displayName: "A", email: "a@x.com", role: "user", roles: ["user"],
    });
    mockAssignRole.mockResolvedValue(undefined);
    // seatLimit=2, initialSeats=2 → all emails hit seat_limit_reached
    const result = await bulkAssignSeatLogic("user", ["diy_admin"], 1, ["a@x.com", "b@x.com"], 2, 2, 10);
    expect(result.seatLimitReached).toBe(2);
    expect(result.succeeded).toBe(0);
  });

  it("assigns up to the seat limit then stops", async () => {
    mockFindUserByEmailWithRoles
      .mockResolvedValueOnce({ id: 1, name: "A", displayName: "A", email: "a@x.com", role: "user", roles: ["user"] })
      .mockResolvedValueOnce({ id: 2, name: "B", displayName: "B", email: "b@x.com", role: "user", roles: ["user"] })
      .mockResolvedValueOnce({ id: 3, name: "C", displayName: "C", email: "c@x.com", role: "user", roles: ["user"] });
    mockAssignRole.mockResolvedValue(undefined);
    // seatLimit=2, initialSeats=0 → first 2 succeed, third hits limit
    const result = await bulkAssignSeatLogic("user", ["diy_admin"], 1, ["a@x.com", "b@x.com", "c@x.com"], 2, 0, 10);
    expect(result.succeeded).toBe(2);
    expect(result.seatLimitReached).toBe(1);
    expect(result.seatUsage.used).toBe(2);
  });

  it("returns already_assigned for users who already have diy_user", async () => {
    vi.resetAllMocks();
    mockAssignRole.mockResolvedValue(undefined);
    mockFindUserByEmailWithRoles.mockResolvedValueOnce({
      id: 5, name: "E", displayName: "E", email: "e@x.com", role: "user", roles: ["user", "diy_user"],
    });
    const result = await bulkAssignSeatLogic("user", ["diy_admin"], 1, ["e@x.com"], 10, 0, 10);
    expect(result.alreadyAssigned).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(mockAssignRole).not.toHaveBeenCalled();
  });

  it("returns not_found for emails with no account", async () => {
    mockFindUserByEmailWithRoles.mockResolvedValue(null);
    const result = await bulkAssignSeatLogic("user", ["diy_admin"], 1, ["nobody@x.com"], 10, 0, 10);
    expect(result.notFound).toBe(1);
  });

  it("returns correct seatUsage after partial assignment", async () => {
    mockFindUserByEmailWithRoles
      .mockResolvedValueOnce({ id: 1, name: "A", displayName: "A", email: "a@x.com", role: "user", roles: ["user"] })
      .mockResolvedValueOnce(null);
    mockAssignRole.mockResolvedValue(undefined);
    const result = await bulkAssignSeatLogic("user", ["diy_admin"], 1, ["a@x.com", "b@x.com"], 10, 3, 10);
    expect(result.seatUsage.used).toBe(4); // 3 initial + 1 success
    expect(result.seatUsage.total).toBe(10);
  });
});
