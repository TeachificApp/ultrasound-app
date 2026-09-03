import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("phone-only app shell", () => {
  it("renders a compact, branded mobile dashboard for both clinical apps", () => {
    const dashboard = source("client/src/components/MobileAppDashboard.tsx");

    expect(dashboard).toContain('brand: MobileBrand');
    expect(dashboard).toContain('appName = isIHE ? "EchoAssist™" : "UltrasoundAssist™"');
    expect(dashboard).toContain('path: "/ultrasound-assist"');
    expect(dashboard).toContain('path: "/echo-assist-hub"');
    expect(dashboard).toContain('path: "/quickfire-aaus"');
    expect(dashboard).toContain('path: "/quickfire-ihe"');
    expect(dashboard).toContain('path: "/echoassist"');
    expect(dashboard).toContain('className="md:hidden min-h-full');
  });

  it("keeps existing AAUS and EchoAssist dashboard layouts out of the phone-only experience", () => {
    const aausHome = source("client/src/pages/Home.tsx");
    const iheHome = source("client/src/pages/iheartecho/IHeartEchoHome.tsx");

    expect(aausHome).toContain('<MobileAppDashboard brand="aaus" />');
    expect(iheHome).toContain('<MobileAppDashboard brand="iheartecho" />');
    expect(aausHome).toContain('<div className="hidden md:block">');
    expect(iheHome).toContain('<div className="hidden md:block">');
  });

  it("uses phone-only app chrome while restoring the existing neutral header from tablet widths onward", () => {
    const layout = source("client/src/components/Layout.tsx");

    expect(layout).toContain("src={brandNav.logoUrl}");
    expect(layout).toContain('alt={`${brandNav.logoAlt} logo`}');
    expect(layout).toContain("object-contain p-0.5 shadow-sm md:hidden");
    expect(layout).toContain('bg-[#0e6470]');
    expect(layout).toContain('md:bg-white');
    expect(layout).toContain('md:shadow-sm');
    expect(layout).toContain('md:pb-20 lg:pb-0');
    expect(layout).toContain('const isIHE = brand === "iheartecho"');
    expect(layout).toContain('path: "/quickfire-aaus"');
    expect(layout).toContain('path: "/quickfire-ihe"');
  });
});
