import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("LMSRouter my-quizzes route", () => {
  it("registers /my-quizzes inside LMSRouter before funnel catch-alls", () => {
    const lmsRouterStart = appSource.indexOf("function LMSRouter()");
    const lmsRouterEnd = appSource.indexOf("function IHeartEchoRouter()");
    expect(lmsRouterStart).toBeGreaterThan(-1);
    expect(lmsRouterEnd).toBeGreaterThan(lmsRouterStart);

    const lmsRouter = appSource.slice(lmsRouterStart, lmsRouterEnd);
    const myQuizzesIdx = lmsRouter.indexOf('path="/my-quizzes"');
    const funnelCatchAllIdx = lmsRouter.indexOf('path="/:slug"><FunnelRootRedirect />');

    expect(myQuizzesIdx).toBeGreaterThan(-1);
    expect(funnelCatchAllIdx).toBeGreaterThan(-1);
    expect(myQuizzesIdx).toBeLessThan(funnelCatchAllIdx);
  });

  it("reserves my-quizzes from funnel slug catch-all", () => {
    expect(appSource).toContain('"my-quizzes"');
  });
});
