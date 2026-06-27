import { describe, it, expect, vi } from "vitest";
import { emailOpenId, ensureUserOpenId } from "./lib/ensureUserOpenId";

describe("ensureUserOpenId", () => {
  it("emailOpenId normalizes email", () => {
    expect(emailOpenId("  User@Example.COM ")).toBe("email:user@example.com");
  });

  it("returns existing openId without DB update", async () => {
    const update = vi.fn();
    const db = { update: vi.fn(() => ({ set: vi.fn(() => ({ where: update })) })) };
    const openId = await ensureUserOpenId(db as any, {
      id: 1,
      openId: "email:existing@example.com",
      email: "existing@example.com",
    });
    expect(openId).toBe("email:existing@example.com");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("persists email-based openId when missing", async () => {
    const where = vi.fn();
    const set = vi.fn(() => ({ where }));
    const db = { update: vi.fn(() => ({ set })) };
    const openId = await ensureUserOpenId(db as any, {
      id: 42,
      openId: null,
      email: "new@example.com",
    });
    expect(openId).toBe("email:new@example.com");
    expect(set).toHaveBeenCalledWith({ openId: "email:new@example.com" });
    expect(where).toHaveBeenCalled();
  });

  it("falls back to user:id when email is null", async () => {
    const where = vi.fn();
    const set = vi.fn(() => ({ where }));
    const db = { update: vi.fn(() => ({ set })) };
    const openId = await ensureUserOpenId(db as any, {
      id: 7,
      openId: null,
      email: null,
    });
    expect(openId).toBe("user:7");
    expect(set).toHaveBeenCalledWith({ openId: "user:7" });
  });
});
