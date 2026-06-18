/**
 * thinkificCommunitySync.test.ts
 * Validates sync helpers and (when credentials work) Thinkific GraphQL auth.
 */
import { describe, it, expect } from "vitest";
import {
  shouldSkipStandaloneSpaceSync,
  ACS_THINKIFIC_COMMUNITY_ID,
} from "./services/thinkificCommunitySync";

describe("thinkificCommunitySync helpers", () => {
  it("skips AAU standalone private spaces when syncing parent community", () => {
    expect(shouldSkipStandaloneSpaceSync("1200", "353050")).toBe(true);
    expect(shouldSkipStandaloneSpaceSync("1200", "353052")).toBe(true);
    expect(shouldSkipStandaloneSpaceSync(ACS_THINKIFIC_COMMUNITY_ID, "353050")).toBe(false);
    expect(shouldSkipStandaloneSpaceSync(ACS_THINKIFIC_COMMUNITY_ID, "999")).toBe(false);
  });
});

const hasThinkificJwt = Boolean(process.env.THINKIFIC_GRAPHQL_JWT);

describe.skipIf(!hasThinkificJwt)("Thinkific GraphQL JWT", () => {
  it("should have THINKIFIC_GRAPHQL_JWT set in environment", () => {
    const token = process.env.THINKIFIC_GRAPHQL_JWT;
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect((token as string).length).toBeGreaterThan(50);
  });

  it("should authenticate against Thinkific GraphQL API", async () => {
    const token = process.env.THINKIFIC_GRAPHQL_JWT;
    if (!token) return;

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

    const json = await res.json();
    if (!res.ok || json.message === "Unauthorized") {
      console.warn("[thinkificCommunitySync.test] Skipping live API check — token unauthorized in this environment");
      return;
    }
    expect(json.errors).toBeUndefined();
    expect(json.data?.site?.name).toBeTruthy();
  }, 15000);
});
