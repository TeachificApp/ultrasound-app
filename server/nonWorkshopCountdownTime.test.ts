import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveScheduledCountdownTarget } from "../shared/platformTime";

const downloadSource = readFileSync(new URL("../client/src/pages/DownloadLanding.tsx", import.meta.url), "utf8");
const productSource = readFileSync(new URL("../client/src/pages/ProductLanding.tsx", import.meta.url), "utf8");
const courseSource = readFileSync(new URL("../client/src/pages/CourseLanding.tsx", import.meta.url), "utf8");
const blockPreviewSource = readFileSync(new URL("../client/src/components/BlockPreview.tsx", import.meta.url), "utf8");

describe("non-workshop event countdown scheduling", () => {
  it("uses the shared scheduled countdown resolver in download, physical-product, course, and shared landing timers", () => {
    expect(downloadSource).toContain("endRef.current = resolveScheduledCountdownTarget(targetDate)");
    expect(productSource).toContain("endRef.current = resolveScheduledCountdownTarget(targetDate)");
    expect(courseSource).toContain("endRef.current = resolveScheduledCountdownTarget(targetDate)");
    expect(blockPreviewSource).toContain("function CountdownBlock");
    expect(blockPreviewSource).toContain("resolveScheduledCountdownTarget(targetDate)");
    expect(blockPreviewSource).toContain("return <CountdownBlock data={d} />");
    expect(blockPreviewSource).toContain("function useLiveCountdown");
  });

  it("interprets a zone-less public event countdown target as Eastern scheduled time", () => {
    expect(new Date(resolveScheduledCountdownTarget("2026-08-17T20:00")).toISOString()).toBe("2026-08-18T00:00:00.000Z");
    expect(new Date(resolveScheduledCountdownTarget("2026-08-17T20:00Z")).toISOString()).toBe("2026-08-17T20:00:00.000Z");
  });
});
