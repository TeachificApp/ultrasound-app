import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { setAuthSessionCookies } from "./lib/setAuthSessionCookies";

describe("setAuthSessionCookies", () => {
  it("clears stale cookies then sets None, domain Lax, and host-only Lax cookies", () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() };
    const req = {
      headers: { "x-forwarded-proto": "https", "x-app-hostname": "app.iheartecho.com" },
      protocol: "https",
      hostname: "internal.run.app",
      query: {},
    } as unknown as Request;

    setAuthSessionCookies(req, res as any, "jwt-token", "app.iheartecho.com");

    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledTimes(3);
    const calls = res.cookie.mock.calls as [string, string, Record<string, unknown>][];
    expect(calls[0][0]).toBe("app_session_id");
    expect(calls[0][2].sameSite).toBe("none");
    expect(calls[0][2].domain).toBe(".iheartecho.com");
    expect(calls[1][0]).toBe("app_session_lax");
    expect(calls[1][2].domain).toBe(".iheartecho.com");
    expect(calls[2][0]).toBe("app_session_lax");
    expect(calls[2][2].domain).toBeUndefined();
    expect(calls[2][2].sameSite).toBe("lax");
  });
});
