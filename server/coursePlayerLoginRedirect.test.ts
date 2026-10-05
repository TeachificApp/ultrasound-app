import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("CoursePlayer login redirect", () => {
  it("redirects unauthenticated learners from an effect rather than during render", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"),
      "utf8",
    );

    const effectMarker = "Route authenticated learning pages to Login only after the auth state has";
    const effectIndex = source.indexOf(effectMarker);
    const renderGuard = "if (!user) return null;";
    const guardIndex = source.indexOf(renderGuard);

    expect(effectIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(effectIndex);
    expect(source).toContain("if (authLoading || user) return;");
    expect(source).toContain("navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });");
    expect(source).not.toContain("if (!user) { navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return null; }");
  });
});
