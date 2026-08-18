import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webinarAdminSource = readFileSync(new URL("../client/src/pages/admin/WebinarsAdmin.tsx", import.meta.url), "utf8");
const cmeExpirySource = readFileSync(new URL("./scheduled/cmeExpiryCheck.ts", import.meta.url), "utf8");

describe("webinar and CME timestamp policy", () => {
  it("hydrates and persists webinar scheduled values through the shared Eastern wall-clock helpers", () => {
    expect(webinarAdminSource).toContain('formatScheduledInput(webinar.scheduledAt, PLATFORM_TIMEZONE)');
    expect(webinarAdminSource).toContain('parseScheduledTimestamp(scheduledAt, PLATFORM_TIMEZONE, "start").getTime()');
  });

  it("renders CME expiry notification dates in the configured Eastern timezone", () => {
    expect(cmeExpirySource).toContain('formatInTimeZone(expiresAt, { year: "numeric", month: "long", day: "numeric" }, PLATFORM_TIMEZONE)');
  });
});
