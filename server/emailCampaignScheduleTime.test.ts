import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseScheduledTimestamp, PLATFORM_TIMEZONE } from "../shared/platformTime";

const editorSource = readFileSync(new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url), "utf8");

describe("email campaign scheduling timezone policy", () => {
  it("interprets a zone-less campaign scheduler value as Eastern wall-clock time", () => {
    expect(parseScheduledTimestamp("2026-08-17T09:00", PLATFORM_TIMEZONE, "start").toISOString()).toBe("2026-08-17T13:00:00.000Z");
  });

  it("uses the shared parser for schedule submission and the shared formatter for confirmation", () => {
    expect(editorSource).toContain("parseScheduledTimestamp(scheduledAt, PLATFORM_TIMEZONE, \"start\")");
    expect(editorSource).toContain("formatInTimeZone(r.scheduledAt");
  });
});
