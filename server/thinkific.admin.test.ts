/**
 * Validates that THINKIFIC_ADMIN_EMAIL and THINKIFIC_ADMIN_PASSWORD are correct
 * by attempting to sign in and confirming a session cookie is returned.
 *
 * NOTE: Thinkific returns HTML (not JSON) on successful login — the session cookie
 * is the authoritative indicator of a successful sign-in.
 */
import { describe, it, expect } from "vitest";

describe("Thinkific admin credentials", () => {
  it("should sign in and receive a _thinkific_session cookie", async () => {
    const email = process.env.THINKIFIC_ADMIN_EMAIL;
    const password = process.env.THINKIFIC_ADMIN_PASSWORD;
    const subdomain = process.env.THINKIFIC_SUBDOMAIN;

    expect(email, "THINKIFIC_ADMIN_EMAIL must be set").toBeTruthy();
    expect(password, "THINKIFIC_ADMIN_PASSWORD must be set").toBeTruthy();
    expect(subdomain, "THINKIFIC_SUBDOMAIN must be set").toBeTruthy();

    const res = await fetch(`https://${subdomain}.thinkific.com/users/sign_in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ user: { email, password } }),
    });

    expect(res.status, "Sign-in should return HTTP 200").toBe(200);

    const setCookieHeader = res.headers.get("set-cookie") ?? "";

    // If the response is JSON, check for FAILED status
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await res.text();
      expect(body, "Sign-in JSON response should not contain FAILED").not.toContain('"status":"FAILED"');
    }

    expect(
      setCookieHeader,
      "Response should include _thinkific_session cookie — check that the email and password are correct"
    ).toContain("_thinkific_session=");
  }, 15_000);
});
