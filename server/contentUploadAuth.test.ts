import { describe, expect, it, vi, beforeEach } from "vitest";
import { canUploadCourseContent } from "./lib/contentUploadAuth";

vi.mock("./lib/teachAccess", () => ({
  getUserAppRoles: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getUserAppRoles } from "./lib/teachAccess";
import { getDb } from "./db";

describe("contentUploadAuth", () => {
  beforeEach(() => {
    vi.mocked(getUserAppRoles).mockReset();
    vi.mocked(getDb).mockReset();
  });

  it("allows legacy admin role", async () => {
    await expect(canUploadCourseContent({ id: 1, role: "admin" })).resolves.toBe(true);
    expect(getUserAppRoles).not.toHaveBeenCalled();
  });

  it("allows platform_admin app role", async () => {
    vi.mocked(getDb).mockResolvedValue(null as any);
    vi.mocked(getUserAppRoles).mockResolvedValue(["platform_admin"]);
    await expect(canUploadCourseContent({ id: 2, role: "user" })).resolves.toBe(true);
  });

  it("allows education_manager app role", async () => {
    vi.mocked(getDb).mockResolvedValue(null as any);
    vi.mocked(getUserAppRoles).mockResolvedValue(["education_manager"]);
    await expect(canUploadCourseContent({ id: 3, role: "user" })).resolves.toBe(true);
  });

  it("denies regular learners", async () => {
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ role: "user" }],
          }),
        }),
      }),
    } as any);
    vi.mocked(getUserAppRoles).mockResolvedValue([]);
    await expect(canUploadCourseContent({ id: 4, role: "user" })).resolves.toBe(false);
  });
});
