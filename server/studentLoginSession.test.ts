import { describe, expect, it } from "vitest";
import {
  createStudentLoginToken,
  STUDENT_LOGIN_TOKEN_TTL_MS,
  verifyStudentLoginToken,
} from "./lib/studentLoginSession";

describe("student login handoff tokens", () => {
  it("verifies a signed, short-lived handoff with the intended identities", async () => {
    const before = Date.now();
    const { token, expiresAt } = await createStudentLoginToken({
      targetUserId: 42,
      realAdminId: 7,
    });
    const claims = await verifyStudentLoginToken(token);

    expect(claims).toMatchObject({ targetUserId: 42, realAdminId: 7 });
    expect(expiresAt.getTime()).toBeGreaterThan(before);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(before + STUDENT_LOGIN_TOKEN_TTL_MS + 1_000);
  });

  it("rejects missing, malformed, and tampered tokens", async () => {
    const { token } = await createStudentLoginToken({ targetUserId: 12, realAdminId: 5 });
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(verifyStudentLoginToken(undefined)).resolves.toBeNull();
    await expect(verifyStudentLoginToken("not-a-token")).resolves.toBeNull();
    await expect(verifyStudentLoginToken(tampered)).resolves.toBeNull();
  });
});
