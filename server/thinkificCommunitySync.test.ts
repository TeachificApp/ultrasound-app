/**
 * thinkificCommunitySync.test.ts
 * Validates that THINKIFIC_GRAPHQL_JWT is set and can authenticate
 * against the Thinkific GraphQL API.
 */
import { describe, it, expect } from "vitest";

describe("Thinkific GraphQL JWT", () => {
  it("should have THINKIFIC_GRAPHQL_JWT set in environment", () => {
    const token = process.env.THINKIFIC_GRAPHQL_JWT;
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect((token as string).length).toBeGreaterThan(50);
  });

  it("should authenticate against Thinkific GraphQL API", async () => {
    const token = process.env.THINKIFIC_GRAPHQL_JWT;
    if (!token) {
      throw new Error("THINKIFIC_GRAPHQL_JWT not set");
    }

    const res = await fetch("https://api.thinkific.com/stable/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query { site { name } }`,
      }),
    });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.errors).toBeUndefined();
    expect(json.data?.site?.name).toBeTruthy();
  }, 15000);
});
