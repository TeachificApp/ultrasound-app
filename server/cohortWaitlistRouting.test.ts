import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const courseLandingSource = readFileSync(
  fileURLToPath(new URL("../client/src/pages/CourseLanding.tsx", import.meta.url)),
  "utf8",
);

describe("public cohort-group Waitlist routing", () => {
  it("sends every inline, embedded, and fallback Waitlist CTA through the status-aware group detail flow", () => {
    expect(courseLandingSource).toContain('if (g.status === "waitlist") onOpenGroupDetail?.(g.id); else onCheckoutPage?.();');
    expect(courseLandingSource.match(/if \(g\.status === "waitlist"\) onOpenGroupDetail\?\.\(g\.id\); else onCheckoutPage\?\.\(\);/g)).toHaveLength(2);
    expect(courseLandingSource).toContain('onEnroll={() => onOpenGroupDetail?.(embedGroupIdP)}');
    expect(courseLandingSource).toContain('onEnroll={() => onOpenGroupDetail?.(embedGroupId)}');
    expect(courseLandingSource).toContain('soldOut.status === "waitlist" ? onOpenGroupDetail?.(soldOut.id) : onCheckoutPage?.()');
  });
});
