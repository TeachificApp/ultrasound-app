import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { confirmUserSessionReplacement, reconcileExistingDeviceSession } from "./lib/singleDeviceSession";

function createDb(results: unknown[][]) {
  let resultIndex = 0;
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => results[resultIndex++] ?? [],
        }),
      }),
    }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => { inserts.push(values); },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => { updates.push(values); },
      }),
    }),
  };
  return { db, inserts, updates };
}

const ordinaryUser = { id: 4101, role: "user" } as any;
const deviceA = "A".repeat(48);
const deviceB = "B".repeat(48);
const hash = (deviceId: string) => createHash("sha256").update(deviceId).digest("hex");

describe("existing device-session reconciliation", () => {
  it("exempts Platform Admin accounts without reading or updating the active-session registry", async () => {
    const { db, inserts, updates } = createDb([]);

    await expect(reconcileExistingDeviceSession(db as any, { id: 7, role: "admin" } as any, "admin-session", deviceA))
      .resolves.toEqual({ status: "exempt" });
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("registers a legacy signed browser as the initial active session", async () => {
    // user role lookup, no active row, and no row during upsert check
    const { db, inserts } = createDb([[], [], []]);

    const state = await reconcileExistingDeviceSession(db as any, ordinaryUser, "legacy-session", deviceA);

    expect(state).toEqual({ status: "active", sessionId: "legacy-session", shouldRefreshCookie: false });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ userId: ordinaryUser.id, sessionId: "legacy-session", deviceHash: hash(deviceA) });
  });

  it("preserves the current signed session and approved first-party SSO session identifier", async () => {
    const { db, inserts, updates } = createDb([[], [{ sessionId: "shared-session", deviceHash: hash(deviceA) }]]);

    await expect(reconcileExistingDeviceSession(db as any, ordinaryUser, "shared-session", deviceB))
      .resolves.toEqual({ status: "active", sessionId: "shared-session", shouldRefreshCookie: false });
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("adopts the active opaque session only when the same browser identifier matches", async () => {
    const { db } = createDb([[], [{ sessionId: "active-session", deviceHash: hash(deviceA) }]]);

    await expect(reconcileExistingDeviceSession(db as any, ordinaryUser, "legacy-session", deviceA))
      .resolves.toEqual({ status: "active", sessionId: "active-session", shouldRefreshCookie: true });
  });

  it("requires an explicit replacement choice for a different ordinary-user device", async () => {
    const { db, inserts, updates } = createDb([[], [{ sessionId: "active-session", deviceHash: hash(deviceA) }]]);

    const state = await reconcileExistingDeviceSession(db as any, ordinaryUser, "stale-session", deviceB);

    expect(state.status).toBe("replacement_required");
    if (state.status === "replacement_required") expect(state.sessionReplacementToken).toMatch(/^eyJ/);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("replaces the recorded active session only after the user confirms the choice token", async () => {
    const { db: conflictDb } = createDb([[], [{ sessionId: "active-session", deviceHash: hash(deviceA) }]]);
    const conflict = await reconcileExistingDeviceSession(conflictDb as any, ordinaryUser, "stale-session", deviceB);
    expect(conflict.status).toBe("replacement_required");
    if (conflict.status !== "replacement_required") return;

    const { db: confirmationDb, inserts } = createDb([[]]);
    const confirmation = await confirmUserSessionReplacement(confirmationDb as any, conflict.sessionReplacementToken);

    expect(confirmation).toMatchObject({ userId: ordinaryUser.id });
    expect(confirmation?.sessionId).not.toBe("active-session");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ userId: ordinaryUser.id, sessionId: confirmation?.sessionId, deviceHash: hash(deviceB) });
  });
});
