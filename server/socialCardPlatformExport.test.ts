import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("social card platform exports", () => {
  it("defines requested feed, reel, short, and video export dimensions", () => {
    const presets = readProjectFile("client/src/lib/socialCardExportPresets.ts");
    expect(presets).toContain('id: "facebook_feed"');
    expect(presets).toContain('id: "instagram_feed"');
    expect(presets).toContain('id: "linkedin_post"');
    expect(presets).toContain('id: "x_post"');
    expect(presets).toContain('id: "instagram_reel"');
    expect(presets).toContain('id: "facebook_reel"');
    expect(presets).toContain('id: "tiktok"');
    expect(presets).toContain('id: "youtube_video"');
    expect(presets).toContain('id: "youtube_short"');
    expect(presets).toContain('width: 1080, height: 1920');
    expect(presets).toContain('width: 1920, height: 1080');
    expect(presets).toContain('width: 1200, height: 1500');
  });

  it("preserves the complete card inside target frames for PNG outputs", () => {
    const exporter = readProjectFile("client/src/components/social/SocialCardExport.tsx");
    expect(exporter).toContain("getCardPlacement");
    expect(exporter).toContain("Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight)");
    expect(exporter).toContain("renderSocialCardAsPng");
    expect(exporter).toContain('canvasToBlob(canvas, "image/png")');
    expect(exporter).toContain("socialExportFilename");
  });

  it("creates local MP4 motion with progressive text, music, branded outro, and final-card reveal", () => {
    const exporter = readProjectFile("client/src/components/social/SocialCardExport.tsx");
    expect(exporter).toContain("new Mp4OutputFormat()");
    expect(exporter).toContain('codec: "avc"');
    expect(exporter).toContain("new CanvasSource(canvas");
    expect(exporter).toContain("motion.options?.slice(0, 4).forEach");
    expect(exporter).toContain("CORRECT ANSWER");
    expect(exporter).toContain("drawMotionFrame");
    expect(exporter).toContain("MOTION_DURATION_SECONDS = 7");
    expect(exporter).toContain("AudioBufferSource");
    expect(exporter).toContain("motion.musicUrl");
    expect(exporter).toContain("outroProgress");
    expect(exporter).toContain('"question" | "answer" | "combined" | "social"');
  });

  it("surfaces platform and PNG-or-MP4 choices in every card generator", () => {
    const challenge = readProjectFile("client/src/pages/ChallengeCardGenerator.tsx");
    const social = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    const quiz = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");
    for (const page of [challenge, social, quiz]) {
      expect(page).toContain("SocialExportControls");
      expect(page).toContain("DEFAULT_SOCIAL_EXPORT_PLATFORM");
      expect(page).toContain('useState<SocialExportFormat>("png")');
    }
    expect(challenge).toContain("renderPlatform(exportPlatform, exportFormat, motion)");
    expect(social).toContain("renderPlatform(exportPlatform, exportFormat");
    expect(quiz).toContain("cardVariant === \"answer\"");
    expect(quiz).toContain('cardVariant === "combined"');
    expect(quiz).toContain('variant={cardVariant === "answer" ? "answer" : "question"}');
    for (const page of [challenge, social, quiz]) {
      expect(page).toContain("musicUploadBrand");
      expect(page).toContain("selectedMusic");
    }
  });
});
