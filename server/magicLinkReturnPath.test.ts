import { describe, expect, it } from "vitest";
import { resolveMagicLinkReturnPath } from "./lib/magicLinkReturnPath";

describe("magic-link return path", () => {
  it("keeps valid learner destinations including their query string", () => {
    expect(resolveMagicLinkReturnPath("/quizzes/123?embed=1")).toBe("/quizzes/123?embed=1");
    expect(resolveMagicLinkReturnPath("/my-dashboard")).toBe("/my-dashboard");
    expect(resolveMagicLinkReturnPath("/dashboard")).toBe("/my-dashboard?tab=content");
    expect(resolveMagicLinkReturnPath("/dashboard/subscriptions")).toBe("/my-dashboard?tab=subscriptions");
  });

  it("sends funnel, auth, missing, and external destinations to My Dashboard", () => {
    expect(resolveMagicLinkReturnPath("/funnels/retired-offer")).toBe("/my-dashboard");
    expect(resolveMagicLinkReturnPath("/auth/magic?token=old")).toBe("/my-dashboard");
    expect(resolveMagicLinkReturnPath("https://untrusted.example/login")).toBe("/my-dashboard");
    expect(resolveMagicLinkReturnPath("//untrusted.example/login")).toBe("/my-dashboard");
  });
});
