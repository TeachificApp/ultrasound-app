import { describe, it, expect, vi, beforeEach } from "vitest";
import { redeemSsoToken, setSessionCookiesForUser } from "./lib/ssoExchange";

const mockUser = {
  id: 10,
  openId: null,
  email: "user@example.com",
  name: "Test User",
};

function createMockDb(overrides: {
  tokenRow?: { id: number; userId: number; token: string; expiresAt: Date; usedAt: Date | null } | null;
  user?: typeof mockUser | null;
} = {}) {
  const tokenRow = overrides.tokenRow ?? {
    id: 1,
    userId: 10,
    token: "abc",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
  };
  const user = overrides.user ?? mockUser;

  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const selectLimit = vi
    .fn()
    .mockResolvedValueOnce(tokenRow ? [tokenRow] : [])
    .mockResolvedValueOnce(user ? [user] : []);
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  return { update, select, db: { update, select } as any };
}

describe("ssoExchange", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redeems a valid token and marks it used", async () => {
    const { db } = createMockDb();
    const result = await redeemSsoToken(db, "abc");
    expect(result).toEqual({ userId: 10, openId: "email:user@example.com" });
    expect(db.update).toHaveBeenCalled();
  });

  it("returns null for missing token row", async () => {
    const updateWhere = vi.fn();
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) }));
    const selectLimit = vi.fn().mockResolvedValue([]);
    const selectWhere = vi.fn(() => ({ limit: selectLimit }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));
    const db = { update, select } as any;

    const result = await redeemSsoToken(db, "missing");
    expect(result).toBeNull();
  });
});

describe("setSessionCookiesForUser", () => {
  it("sets both SameSite=None and Lax cookies", async () => {
    const res = { cookie: vi.fn() };
    const req = {
      headers: { "x-app-hostname": "app.iheartecho.com" },
      protocol: "https",
      hostname: "internal.run.app",
    };

    await setSessionCookiesForUser(
      req as any,
      res as any,
      "email:user@example.com",
      "Test",
      "app.iheartecho.com",
    );

    expect(res.cookie).toHaveBeenCalledTimes(3);
    const domains = res.cookie.mock.calls.map((c: unknown[]) => (c[2] as { domain?: string })?.domain);
    expect(domains).toContain(".iheartecho.com");
    expect(domains).toContain(undefined);
  });
});
