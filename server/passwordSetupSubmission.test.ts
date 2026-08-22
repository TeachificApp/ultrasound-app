import { describe, expect, it } from "vitest";
import { buildPasswordSetupSubmission } from "../shared/passwordSetupSubmission";

describe("password setup submission", () => {
  it("builds the real valid-token completion payload", () => {
    expect(buildPasswordSetupSubmission("valid-token", "SecurePass9", "SecurePass9"))
      .toEqual({ token: "valid-token", newPassword: "SecurePass9" });
  });

  it("rejects missing tokens, short passwords, and mismatched confirmations", () => {
    expect(buildPasswordSetupSubmission("", "SecurePass9", "SecurePass9")).toEqual({ error: "Invalid reset link. Please request a new one." });
    expect(buildPasswordSetupSubmission("token", "short", "short")).toEqual({ error: "Password must be at least 8 characters" });
    expect(buildPasswordSetupSubmission("token", "SecurePass9", "DifferentPass9")).toEqual({ error: "Passwords do not match" });
  });
});
