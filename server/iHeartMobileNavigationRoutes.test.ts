import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBrandNavConfig } from "../client/src/config/brandNav";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/Layout.tsx"), "utf8");

describe("iHeartEcho mobile navigation", () => {
  it("returns a brand marker so the mobile menu selects iHeartEcho destinations", () => {
    expect(getBrandNavConfig("iheartecho").brand).toBe("iheartecho");
    expect(getBrandNavConfig("aaus").brand).toBe("aaus");
    expect(layoutSource).toContain('const brand = brandNav?.brand ?? "aaus"');
  });

  it("keeps legacy Clinical, Clinical Intel, and Calculators paths usable on iHeartEcho", () => {
    for (const route of ["/clinical", "/ultrasound-assist", "/calculators", "/clinical-intelligence", "/clinical-intel"]) {
      expect(appSource).toContain(`<Route path="${route}"`);
    }

    expect(appSource).toContain('<Route path="/calculators" component={EchoAssist} />');
    expect(appSource).toContain('<Route path="/clinical-intelligence" component={GuidelinesAssist} />');
  });
});
