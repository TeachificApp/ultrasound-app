import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const echoHub = readFileSync(resolve(process.cwd(), "client/src/pages/iheartecho/EchoAssistHub.tsx"), "utf8");
const ultrasoundHub = readFileSync(resolve(process.cwd(), "client/src/pages/UltrasoundAssistHub.tsx"), "utf8");

describe("mobile Assist topic menus", () => {
  it("uses closed, accessible mobile selectors instead of an always-visible specialty grid", () => {
    for (const [source, topicLabel] of [
      [echoHub, "EchoAssist™ topics"],
      [ultrasoundHub, "UltrasoundAssist™ topics"],
    ]) {
      expect(source).toContain("<details");
      expect(source).toContain("md:hidden");
      expect(source).toContain(topicLabel);
      expect(source).toContain('className="container hidden py-8 md:block"');
    }
  });

  it("keeps every topic represented and makes availability clear", () => {
    expect(echoHub).toContain("{specialties.map(({ path, icon: Icon, title, badge, free }) => (");
    expect(echoHub).toContain('aria-label="EchoAssist topics"');
    expect(echoHub).toContain('free ? "Free"');

    expect(ultrasoundHub).toContain("{specialties.map((spec) => {");
    expect(ultrasoundHub).toContain('aria-label="UltrasoundAssist topics"');
    expect(ultrasoundHub).toContain("const navLocked = !spec.navigatorFree && !isPremium;");
  });
});
