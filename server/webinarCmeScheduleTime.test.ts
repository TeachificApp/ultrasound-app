import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatDate, formatTime } from "../client/src/pages/WebinarLanding";

const webinarAdminSource = readFileSync(new URL("../client/src/pages/admin/WebinarsAdmin.tsx", import.meta.url), "utf8");
const webinarLandingSource = readFileSync(new URL("../client/src/pages/WebinarLanding.tsx", import.meta.url), "utf8");
const cmeExpirySource = readFileSync(new URL("./scheduled/cmeExpiryCheck.ts", import.meta.url), "utf8");

describe("webinar and CME timestamp policy", () => {
  it("hydrates and persists webinar scheduled values through the shared Eastern wall-clock helpers", () => {
    expect(webinarAdminSource).toContain('formatScheduledInput(webinar.scheduledAt, PLATFORM_TIMEZONE)');
    expect(webinarAdminSource).toContain('parseScheduledTimestamp(scheduledAt, PLATFORM_TIMEZONE, "start").getTime()');
    expect(webinarAdminSource).toContain('formatInTimeZone(ts, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }, PLATFORM_TIMEZONE)');
  });

  it("renders CME expiry notification dates in the configured Eastern timezone", () => {
    expect(cmeExpirySource).toContain('formatInTimeZone(expiresAt, { year: "numeric", month: "long", day: "numeric" }, PLATFORM_TIMEZONE)');
  });

  it("uses the shared formatter for public webinar date and time presentation", () => {
    expect(webinarLandingSource).toContain('formatInTimeZone(ts, { weekday: "long", year: "numeric", month: "long", day: "numeric" }, timeZone)');
    expect(webinarLandingSource).toContain('formatInTimeZone(ts, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }, tz ?? PLATFORM_TIMEZONE)');
    const scheduledAt = Date.parse("2026-08-18T00:30:00.000Z");
    expect(formatDate(scheduledAt)).toBe("Monday, August 17, 2026");
    expect(formatTime(scheduledAt)).toContain("8:30 PM EDT");
  });
});
