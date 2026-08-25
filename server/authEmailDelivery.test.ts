import { describe, expect, it } from "vitest";
import { resolveAuthDeliveryEmail } from "./lib/authEmailDelivery";

describe("resolveAuthDeliveryEmail", () => {
  it("delivers to the typed email when it differs from the account primary", () => {
    expect(resolveAuthDeliveryEmail({ email: "larawilliams0501@gmail.com" }, "student@example.com")).toBe(
      "student@example.com",
    );
  });

  it("normalizes the typed email", () => {
    expect(resolveAuthDeliveryEmail({ email: "Lara@Example.com" }, "Other@Example.com")).toBe(
      "other@example.com",
    );
  });

  it("falls back to the account primary when no typed email is provided", () => {
    expect(resolveAuthDeliveryEmail({ email: "Lara@Example.com" }, "")).toBe("lara@example.com");
  });

  it("falls back to the typed email when user.email is empty", () => {
    expect(resolveAuthDeliveryEmail({ email: null }, "larawilliams0501@gmail.com")).toBe(
      "larawilliams0501@gmail.com",
    );
  });
});
