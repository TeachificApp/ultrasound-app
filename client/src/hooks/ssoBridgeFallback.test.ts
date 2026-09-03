import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bridgeSource = readFileSync(resolve(process.cwd(), "client/src/hooks/useSsoBridge.ts"), "utf8");
const consumerSource = readFileSync(resolve(process.cwd(), "client/src/hooks/useSsoConsumer.ts"), "utf8");
const routeSource = readFileSync(resolve(process.cwd(), "server/routes/ssoAuto.ts"), "utf8");

describe("cross-domain SSO bridge fallback", () => {
  it("preserves the attempted bridge index on its return URL for iHeartEcho fallback", () => {
    expect(bridgeSource).toContain("function getBridgeReturnUrlWithAttempt(tryIndex: number)");
    expect(bridgeSource).toContain('returnUrl.searchParams.set("bridge_try", String(tryIndex));');
    expect(bridgeSource).toContain("const nextTryIndex = tryIndex + 1;");
    expect(bridgeSource).toContain("getBridgeReturnUrlWithAttempt(nextTryIndex)");
    expect(bridgeSource).toContain("getBridgeReturnUrlWithAttempt(tryIndex)");
  });

  it("removes bridge routing state after a successful token exchange", () => {
    expect(consumerSource).toContain('params.delete("sso");');
    expect(consumerSource).toContain('params.delete("bridge_try");');
    expect(consumerSource.indexOf('params.delete("sso");')).toBeLessThan(consumerSource.indexOf('params.delete("bridge_try");'));
  });

  it("asks the first bridge origin to continue through the next trusted source", () => {
    expect(bridgeSource).toContain("const fallbackOrigin = bridgeOrigins[tryIndex + 1];");
    expect(bridgeSource).toContain('`&fallback=${encodeURIComponent(fallbackOrigin)}`');
  });

  it("continues an unauthenticated source lookup through only an approved server-side fallback", () => {
    expect(routeSource).toContain("const BRIDGE_FALLBACK_ORIGINS = new Set([");
    expect(routeSource).toContain('"https://learn.allaboutultrasound.com"');
    expect(routeSource).toContain('"https://app.allaboutultrasound.com"');
    expect(routeSource).toContain("if (!BRIDGE_FALLBACK_ORIGINS.has(fallbackOrigin)) return null;");
    expect(routeSource).toContain("const fallbackUrl = getFallbackBridgeUrl(req, returnUrl);");
    expect(routeSource).toContain("return res.redirect(fallbackUrl);");
  });
});
