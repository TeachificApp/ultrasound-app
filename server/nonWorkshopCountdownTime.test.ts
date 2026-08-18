import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveScheduledCountdownTarget } from "../shared/platformTime";

const downloadSource = readFileSync(new URL("../client/src/pages/DownloadLanding.tsx", import.meta.url), "utf8");
const productSource = readFileSync(new URL("../client/src/pages/ProductLanding.tsx", import.meta.url), "utf8");

describe("non-workshop event countdown scheduling", () => {
  it("uses the shared scheduled countdown resolver in download and physical-product landing timers", () => {
    expect(downloadSource).toContain("endRef.current = resolveScheduledCountdownTarget(targetDate)");
    expect(productSource).toContain("endRef.current = resolveScheduledCountdownTarget(targetDate)");
  });

  it("interprets a zone-less public event countdown target as Eastern scheduled time", () => {
    expect(new Date(resolveScheduledCountdownTarget("2026-08-17T20:00")).toISOString()).toBe("2026-08-18T00:00:00.000Z");
    expect(new Date(resolveScheduledCountdownTarget("2026-08-17T20:00Z")).toISOString()).toBe("2026-08-17T20:00:00.000Z");
  });
});
