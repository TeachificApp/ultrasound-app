import { describe, expect, it, vi, beforeEach } from "vitest";
import { userHasPlatformMediaAccess } from "./lib/platformMediaAuth";

vi.mock("./db", () => ({
  getDb: vi.fn(),
  getUserRoles: vi.fn(),
}));

import { getDb, getUserRoles } from "./db";

describe("platformMediaAuth", () => {
  beforeEach(() => {
    vi.mocked(getUserRoles).mockReset();
    vi.mocked(getDb).mockReset();
    delete process.env.OWNER_OPEN_ID;
  });

  it("allows legacy admin without loading app roles when hasPlatformManagerAccess passes", async () => {
    await expect(userHasPlatformMediaAccess(1, "admin")).resolves.toBe(true);
    expect(getUserRoles).not.toHaveBeenCalled();
  });

  it("allows platform_admin via user_roles when legacy role is user", async () => {
    vi.mocked(getUserRoles).mockResolvedValue(["platform_admin"] as any);
    await expect(userHasPlatformMediaAccess(2, "user")).resolves.toBe(true);
  });

  it("allows platform_manager via user_roles", async () => {
    vi.mocked(getUserRoles).mockResolvedValue(["platform_manager"] as any);
    await expect(userHasPlatformMediaAccess(3, "user")).resolves.toBe(true);
  });

  it("denies regular learners", async () => {
    vi.mocked(getUserRoles).mockResolvedValue([] as any);
    vi.mocked(getDb).mockResolvedValue(null as any);
    await expect(userHasPlatformMediaAccess(4, "user")).resolves.toBe(false);
  });

  it("allows OWNER_OPEN_ID match", async () => {
    process.env.OWNER_OPEN_ID = "owner-open-id";
    vi.mocked(getUserRoles).mockResolvedValue([] as any);
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ openId: "owner-open-id" }],
          }),
        }),
      }),
    } as any);
    await expect(userHasPlatformMediaAccess(5, "user")).resolves.toBe(true);
  });
});
