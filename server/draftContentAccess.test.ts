import { describe, expect, it, vi } from "vitest";

const { isPlatformAdminUser } = vi.hoisted(() => ({
  isPlatformAdminUser: vi.fn(),
}));
vi.mock("./lib/singleDeviceSession", () => ({ isPlatformAdminUser }));

import { canPreviewDraftContent, throwUnavailableDraftContent } from "./lib/draftContentAccess";

describe("draft landing content access", () => {
  it("never grants preview access without an authenticated viewer", async () => {
    await expect(canPreviewDraftContent({} as any, undefined)).resolves.toBe(false);
    expect(isPlatformAdminUser).not.toHaveBeenCalled();
  });

  it("delegates authenticated preview permission to the Platform Admin guard", async () => {
    isPlatformAdminUser.mockResolvedValueOnce(true);
    await expect(canPreviewDraftContent({} as any, { id: 7, role: "user" })).resolves.toBe(true);
    expect(isPlatformAdminUser).toHaveBeenCalledWith({}, { id: 7, role: "user" });
  });

  it("uses an intentionally non-enumerating unavailable response", () => {
    try {
      throwUnavailableDraftContent();
      throw new Error("Expected draft guard to throw");
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("This content is currently unavailable.");
    }
  });
});
