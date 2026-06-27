import { describe, it, expect, vi } from "vitest";
import { backfillUserOpenIds } from "./lib/backfillUserOpenIds";
import { emailOpenId } from "./lib/ensureUserOpenId";

type UserRow = { id: number; email: string | null; openId: string | null };

function mockDb(initial: UserRow[]) {
  const users = initial.map((u) => ({ ...u }));
  let whereCall = 0;

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          whereCall++;
          if (whereCall === 1) {
            return Promise.resolve(
              users.filter((u) => u.openId == null || u.openId === ""),
            );
          }
          return {
            limit: vi.fn(async () => {
              const missing = users.find((u) => u.openId == null || u.openId === "");
              if (!missing) return [];
              const target = missing.email?.trim()
                ? emailOpenId(missing.email)
                : `user:${missing.id}`;
              const hit = users.find((u) => u.openId === target);
              return hit ? [{ id: hit.id }] : [];
            }),
          };
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((data: { openId: string }) => ({
        where: vi.fn(async () => {
          const row = users.find((u) => u.openId == null || u.openId === "");
          if (row) row.openId = data.openId;
        }),
      })),
    })),
    _users: users,
  };
}

describe("backfillUserOpenIds", () => {
  it("assigns email-based openId to users missing openId", async () => {
    const db = mockDb([
      { id: 1, email: "User@Example.com", openId: null },
      { id: 2, email: "other@test.com", openId: "email:other@test.com" },
    ]);

    const result = await backfillUserOpenIds(db as any);

    expect(result.updated).toBe(1);
    expect(db._users[0].openId).toBe("email:user@example.com");
  });

  it("skips when target openId is already taken", async () => {
    const db = mockDb([
      { id: 10, email: "dup@example.com", openId: null },
      { id: 11, email: "dup@example.com", openId: "email:dup@example.com" },
    ]);

    const result = await backfillUserOpenIds(db as any);

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(db._users[0].openId).toBeNull();
  });
});
