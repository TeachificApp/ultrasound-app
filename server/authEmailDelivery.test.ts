import { describe, expect, it } from "vitest";
import { resolveAuthDeliveryEmail } from "./lib/authEmailDelivery";

describe("resolveAuthDeliveryEmail", () => {
  it("prefers the stored user email when present", () => {
    expect(
      resolveAuthDeliveryEmail(
        { email: "Stored@Example.com" },
        "typed@example.com",
      ),
    ).toBe("stored@example.com");
  });

  it("falls back to the requested email when user email is missing", () => {
    expect(
      resolveAuthDeliveryEmail({ email: null }, "typed@example.com"),
    ).toBe("typed@example.com");
  });

  it("returns null when neither address is available", () => {
    expect(resolveAuthDeliveryEmail({ email: null }, "   ")).toBeNull();
  });
});

describe("requestPasswordReset delivery safeguards", () => {
  it("uses resolveAuthDeliveryEmail in the auth router", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routers.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("resolveAuthDeliveryEmail");
    expect(source).toContain("Password reset email was not accepted by SendGrid");
  });
});
