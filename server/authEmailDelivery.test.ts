import { describe, expect, it } from "vitest";
import { resolveAuthDeliveryEmail } from "./lib/authEmailDelivery";

describe("resolveAuthDeliveryEmail", () => {
  it("uses the user row email when present", () => {
    expect(resolveAuthDeliveryEmail({ email: "Lara@Example.com" }, "other@example.com")).toBe(
      "lara@example.com",
    );
  });

  it("falls back to the typed email when user.email is empty", () => {
    expect(resolveAuthDeliveryEmail({ email: null }, "larawilliams0501@gmail.com")).toBe(
      "larawilliams0501@gmail.com",
    );
  });
});
