import { describe, expect, it } from "vitest";
import {
  EXPO_POINTS_ACTIVITY_TYPES,
  EXPO_POINTS_ELIGIBILITY_ROLES,
  EXPO_POINTS_LEADERBOARD_SCOPES,
  expoPointsPublicDisplayName,
  normalizeExpoPointsRoles,
} from "../shared/expoPoints";

describe("ExpoPoints", () => {
  it("supports single-pathway and combined leaderboards", () => {
    expect(EXPO_POINTS_LEADERBOARD_SCOPES).toEqual(["ultrasound_expo", "echo_expo", "combined"]);
    expect(EXPO_POINTS_ELIGIBILITY_ROLES).toEqual(expect.arrayContaining(["attendee", "vendor", "exhibitor", "sponsor"]));
  });

  it("recognizes the intended earning categories", () => {
    expect(EXPO_POINTS_ACTIVITY_TYPES).toEqual(expect.arrayContaining(["attendance", "cme", "booth_visit", "expo_game", "networking", "community", "reward_redemption"]));
  });

  it("keeps the live-display name safe from email exposure", () => {
    expect(expoPointsPublicDisplayName({ name: "Maya Torres", firstName: "Maya", lastName: "Torres" })).toBe("Maya T.");
    expect(expoPointsPublicDisplayName({ displayName: "Echo Champion", name: "Private Person" })).toBe("Echo Champion");
  });

  it("normalizes eligible roles without accepting unknown values", () => {
    expect(normalizeExpoPointsRoles(["attendee", "sponsor", "invalid", "attendee"])).toEqual(["attendee", "sponsor"]);
    expect(normalizeExpoPointsRoles(null)).toEqual(["attendee", "vendor", "exhibitor", "sponsor"]);
  });

  it("keeps the point ledger and public-display authorization in the dedicated router", async () => {
    const [routerSource, schemaSource] = await Promise.all([
      import("node:fs/promises").then(fs => fs.readFile("server/routers/expoPointsRouter.ts", "utf8")),
      import("node:fs/promises").then(fs => fs.readFile("drizzle/schema.ts", "utf8")),
    ]);
    expect(routerSource).toContain("publicLiveLeaderboard");
    expect(routerSource).toContain("adminAwardPoints");
    expect(routerSource).toContain("requestRedemption");
    expect(routerSource).toContain("liveDisplayEnabled");
    expect(routerSource).toContain("UltrasoundExpo leaderboard can include only");
    expect(routerSource).toContain("EchoExpo leaderboard can include only");
    expect(schemaSource).toContain("expoPointsPrograms");
    expect(schemaSource).toContain("expoPointsTransactions");
    expect(schemaSource).toContain("expoPointsRedemptions");
  });
});
