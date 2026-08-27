import { describe, it, expect, vi } from "vitest";
import { sendAuthRedirectHtml, withAuthPending } from "./lib/sendAuthRedirectHtml";

describe("withAuthPending", () => {
  it("appends auth_pending=1 to paths without query", () => {
    expect(withAuthPending("/platform-admin")).toBe("/platform-admin?auth_pending=1");
  });

  it("appends auth_pending=1 with & when query exists", () => {
    expect(withAuthPending("/dashboard?tab=courses")).toBe(
      "/dashboard?tab=courses&auth_pending=1",
    );
  });
});

describe("sendAuthRedirectHtml", () => {
  it("returns 200 HTML with escaped redirect and JS navigation", () => {
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    sendAuthRedirectHtml(res as any, "/platform-admin?auth_pending=1");

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain("Signing you in");
    expect(html).toContain('window.location.replace("/platform-admin?auth_pending=1")');
    expect(html).not.toContain("<script>alert");
  });
});
