import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    // clearSessionCookies tries every known domain × sameSite variant so stale cookies are removed.
    expect(clearedCookies.length).toBeGreaterThanOrEqual(4);
    // All calls should clear the session cookie
    expect(clearedCookies.every(c => c.name === COOKIE_NAME)).toBe(true);
    // All calls should have httpOnly and path set
    expect(clearedCookies.every(c => c.options.httpOnly === true)).toBe(true);
    expect(clearedCookies.every(c => c.options.path === "/")).toBe(true);
    // maxAge: 0 signals immediate expiry (browser-compatible; -1 is not a valid maxAge)
    expect(clearedCookies.every(c => c.options.maxAge === 0)).toBe(true);
  });
});
