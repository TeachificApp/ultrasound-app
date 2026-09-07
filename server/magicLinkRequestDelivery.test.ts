import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("magic-link delivery status", () => {
  it("surfaces a short resend cooldown rather than claiming an unsent email is on its way", () => {
    const router = source("server/routers.ts");
    const login = source("client/src/pages/Login.tsx");
    const requestPage = source("client/src/pages/MagicLinkRequest.tsx");

    expect(router).toContain('deliveryStatus: "cooldown"');
    expect(router).toContain('deliveryStatus: "sent"');
    expect(login).toContain("magicLinkDeliveryStatus === \"cooldown\"");
    expect(requestPage).toContain('deliveryStatus === "cooldown"');
  });

  it("keeps device replacement at verification rather than request delivery", () => {
    const router = source("server/routers.ts");
    const requestStart = router.indexOf("requestMagicLink: publicProcedure");
    const requestEnd = router.indexOf("loginWithPassword: publicProcedure", requestStart);
    expect(router.slice(requestStart, requestEnd)).not.toContain("prepareUserSession");
  });
});
