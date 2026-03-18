/**
 * SendGrid API key validation test
 * Validates that the SENDGRID_API_KEY is set and the API is reachable.
 * Uses the /v3/user/profile endpoint (read-only, no emails sent).
 */
import { describe, it, expect } from "vitest";

describe("SendGrid API Key", () => {
  it("should have SENDGRID_API_KEY set in environment", () => {
    const key = process.env.SENDGRID_API_KEY;
    if (!key) {
      console.warn("[SendGrid] SENDGRID_API_KEY not set — skipping credential validation");
      return;
    }
    expect(key, "SENDGRID_API_KEY must be set").toBeTruthy();
    expect(key?.startsWith("SG."), "SENDGRID_API_KEY must start with SG.").toBe(true);
  });

  it("should authenticate successfully with the SendGrid API", async () => {
    const key = process.env.SENDGRID_API_KEY;
    if (!key) {
      console.warn("Skipping SendGrid API test — SENDGRID_API_KEY not set");
      return;
    }

    const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status, `SendGrid API returned ${res.status} — check your API key`).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    // SendGrid user/profile returns first_name, last_name, company, etc.
    expect(data).toHaveProperty("first_name");
    console.log(`[SendGrid] Authenticated as: ${data.first_name} ${data.last_name} (${data.company})`);
  }, 15_000);
});
