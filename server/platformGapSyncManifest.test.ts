import { describe, expect, it } from "vitest";
import { PLATFORM_GAP_SYNC_ORDER } from "../scripts/platformGapSyncManifest.mjs";

describe("platform insert-only synchronization manifest", () => {
  it("contains only the verified non-sensitive platform gap tables", () => {
    expect(PLATFORM_GAP_SYNC_ORDER).toHaveLength(10);
    expect(PLATFORM_GAP_SYNC_ORDER).not.toContain("ip_access_logs");
    expect(PLATFORM_GAP_SYNC_ORDER).not.toContain("access_token_uses");
    expect(PLATFORM_GAP_SYNC_ORDER.indexOf("digital_purchases")).toBeLessThan(PLATFORM_GAP_SYNC_ORDER.indexOf("digital_purchase_activity"));
    expect(PLATFORM_GAP_SYNC_ORDER.indexOf("funnel_leads")).toBeLessThan(PLATFORM_GAP_SYNC_ORDER.indexOf("funnel_purchases"));
  });
});
