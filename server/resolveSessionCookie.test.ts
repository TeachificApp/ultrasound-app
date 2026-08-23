import { describe, it, expect, vi } from "vitest";
import { COOKIE_NAME, LAX_COOKIE_NAME } from "@shared/const";
import { resolveSessionFromCookies } from "./lib/resolveSessionCookie";

describe("resolveSessionFromCookies", () => {
  it("prefers a valid lax cookie over a stale primary session cookie", async () => {
    const cookies = new Map<string, string>([
      [COOKIE_NAME, "stale-primary"],
      [LAX_COOKIE_NAME, "fresh-lax"],
    ]);

    const verify = vi.fn(async (value: string) => {
      if (value === "fresh-lax") {
        return { openId: "email:user@example.com", appId: "ultrasound-app", name: "User" };
      }
      return null;
    });

    const result = await resolveSessionFromCookies(cookies, verify);

    expect(result?.cookieValue).toBe("fresh-lax");
    expect(result?.session.openId).toBe("email:user@example.com");
    expect(verify.mock.calls[0]?.[0]).toBe("fresh-lax");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("returns null when every candidate fails verification", async () => {
    const cookies = new Map<string, string>([
      [COOKIE_NAME, "bad"],
      [LAX_COOKIE_NAME, "also-bad"],
    ]);

    const result = await resolveSessionFromCookies(cookies, async () => null);
    expect(result).toBeNull();
  });

  it("deduplicates when primary and lax carry the same value", async () => {
    const cookies = new Map<string, string>([
      [COOKIE_NAME, "same-token"],
      [LAX_COOKIE_NAME, "same-token"],
    ]);

    const verify = vi.fn(async () => ({
      openId: "email:a@b.com",
      appId: "ultrasound-app",
      name: "User",
    }));

    await resolveSessionFromCookies(cookies, verify);
    expect(verify).toHaveBeenCalledTimes(1);
  });
});

describe("requestHasSessionCookies", () => {
  it("detects session cookie names in the header", async () => {
    const { requestHasSessionCookies } = await import("./lib/resolveSessionCookie");
    expect(requestHasSessionCookies("app_session_id=abc")).toBe(true);
    expect(requestHasSessionCookies("app_session_lax=abc")).toBe(true);
    expect(requestHasSessionCookies("other=value")).toBe(false);
  });
});
