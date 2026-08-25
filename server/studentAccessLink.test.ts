import { describe, expect, it } from "vitest";
import { buildPersistentAccessUrl } from "./lib/enrollmentEmail";

describe("student access link fixes", () => {
  it("builds learn-domain /auth/access URLs for persistent tokens", () => {
    const url = buildPersistentAccessUrl(
      "https://learn.allaboutultrasound.com/courses/fetal-echo/player",
      "abc123",
    );
    expect(url).toContain("https://learn.allaboutultrasound.com/auth/access?token=abc123");
    expect(url).toContain(encodeURIComponent("https://learn.allaboutultrasound.com/courses/fetal-echo/player"));
  });

  it("auto-login route accepts persistent users.accessToken as fallback", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routes/autoLogin.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("persistent accessToken fallback");
    expect(source).toContain("users.accessToken");
  });

  it("stripe membership emails use /auth/access instead of auto-login with accessToken", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./webhooks/stripe.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("buildPersistentAccessUrl");
    expect(source).not.toContain("/api/auth/auto-login?token=${accessToken}");
    expect(source).not.toContain("/api/auth/auto-login?token=${accessTokenForEmail}");
  });

  it("exposes repair-user-access debug endpoint", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./_core/index.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("/api/debug/repair-user-access");
    expect(source).toContain("regenerateAccessToken");
  });
});
