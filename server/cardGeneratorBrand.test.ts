import { describe, expect, it } from "vitest";
import {
  buildChallengeSocialPost,
  getCardGeneratorBrandConfig,
} from "../shared/cardGeneratorBrand";

describe("cardGeneratorBrand", () => {
  it("returns AAUS assets and copy by default", () => {
    const cfg = getCardGeneratorBrandConfig("aaus");
    expect(cfg.displayName).toContain("All About Ultrasound");
    expect(cfg.appUrlHost).toBe("app.allaboutultrasound.com");
    expect(cfg.zipPrefix).toBe("ultrasoundassist");
    expect(cfg.socialCategories).toContain("Abdominal");
  });

  it("returns iHeartEcho assets and copy", () => {
    const cfg = getCardGeneratorBrandConfig("iheartecho");
    expect(cfg.displayName).toContain("iHeartEcho");
    expect(cfg.appUrlHost).toBe("app.iheartecho.com");
    expect(cfg.zipPrefix).toBe("echoassist");
    expect(cfg.socialCategories).toContain("Adult Echo");
  });

  it("builds brand-specific social posts", () => {
    const aaus = getCardGeneratorBrandConfig("aaus");
    const ihe = getCardGeneratorBrandConfig("iheartecho");
    const aausPost = buildChallengeSocialPost(
      aaus,
      "question",
      "Abdominal",
      "What is the normal CBD diameter?",
      null,
      null,
    );
    const ihePost = buildChallengeSocialPost(
      ihe,
      "question",
      "Adult Echo",
      "What is normal LVEF?",
      null,
      null,
    );
    expect(aausPost).toContain("app.allaboutultrasound.com");
    expect(aausPost).toContain("#UltrasoundAssist");
    expect(ihePost).toContain("app.iheartecho.com");
    expect(ihePost).toContain("#EchoAssist");
    expect(ihePost).toContain("Daily Echo Challenge");
  });
});
