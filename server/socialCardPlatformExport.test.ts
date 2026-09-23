import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("social card platform exports", () => {
  it("defines the requested exact feed, story, preview, cover, and video dimensions", () => {
    const presets = readProjectFile("client/src/lib/socialCardExportPresets.ts");
    expect(presets).toContain('id: "facebook_feed"');
    expect(presets).toContain('width: 1080, height: 1350');
    expect(presets).toContain('id: "facebook_feed_square"');
    expect(presets).toContain('id: "facebook_feed_horizontal"');
    expect(presets).toContain('width: 1200, height: 630');
    expect(presets).toContain('id: "facebook_story_reel"');
    expect(presets).toContain('id: "facebook_cover"');
    expect(presets).toContain('width: 851, height: 315');
    expect(presets).toContain('id: "instagram_feed"');
    expect(presets).toContain('id: "instagram_feed_square"');
    expect(presets).toContain('id: "instagram_feed_horizontal"');
    expect(presets).toContain('width: 1080, height: 566');
    expect(presets).toContain('id: "instagram_story_reel"');
    expect(presets).toContain('id: "linkedin_post"');
    expect(presets).toContain('id: "linkedin_feed_horizontal"');
    expect(presets).toContain('width: 1200, height: 627');
    expect(presets).toContain('id: "linkedin_profile_cover"');
    expect(presets).toContain('width: 1584, height: 396');
    expect(presets).toContain('id: "x_post"');
    expect(presets).toContain('id: "x_link_preview"');
    expect(presets).toContain('id: "instagram_reel"');
    expect(presets).toContain('id: "facebook_reel"');
    expect(presets).toContain('id: "tiktok"');
    expect(presets).toContain('id: "tiktok_profile"');
    expect(presets).toContain('width: 200, height: 200');
    expect(presets).toContain('id: "youtube_video"');
    expect(presets).toContain('id: "youtube_short"');
    expect(presets).toContain('id: "youtube_thumbnail"');
    expect(presets).toContain('width: 1280, height: 720');
    expect(presets).toContain('id: "youtube_banner"');
    expect(presets).toContain('width: 2560, height: 1440');
    expect(presets).toContain('getSocialCardFrame');
  });

  it("renders reflowed cards directly into exact target frames for PNG outputs", () => {
    const exporter = readProjectFile("client/src/components/social/SocialCardExport.tsx");
    expect(exporter).toContain("getCardPlacement");
    expect(exporter).toContain("Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight)");
    expect(exporter).toContain("Math.abs(sourceRatio - targetRatio) < 0.002");
    expect(exporter).toContain("cardElement.clientWidth || cardElement.scrollWidth");
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
    expect(exporter).toContain("MOTION_DURATION_SECONDS = 20");
    expect(exporter).toContain("AudioBufferSource");
    expect(exporter).toContain("motion.musicUrl");
    expect(exporter).toContain("outroProgress");
    expect(exporter).toContain('"question" | "answer" | "combined" | "social"');
    expect(exporter).toContain("OUTRO_HOLD_SECONDS = 10");
    expect(exporter).toContain("COMBINED_ANSWER_REVEAL_SECONDS = 7.11");
    expect(exporter).toContain("motion.outroHost");
    expect(exporter).toContain('motion.logoShape === "circle"');
    expect(exporter).toContain("context.arc(centerX, logoCenterY, logoSize / 2");
    expect(exporter).toContain("questionVideoUrl?: string | null");
    expect(exporter).toContain("loadMotionVideo(motion.questionVideoUrl)");
    expect(exporter).toContain("drawLiveCardVideo(context, card, video");
    expect(exporter).toContain("videoDurationSeconds + 6");
    expect(exporter).toContain("waitForMotionFrame");
    expect(exporter).toContain("zoomQuestionImage?: boolean");
    expect(exporter).toContain("drawZoomedCardImage");
    expect(exporter).toContain("imageZoomStartSeconds");
    expect(exporter).toContain("CLINICAL IMAGE REVIEW");
  });

  it("surfaces platform and PNG-or-MP4 choices in every card generator", () => {
    const challenge = readProjectFile("client/src/pages/ChallengeCardGenerator.tsx");
    const social = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    const quiz = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");
    const presentation = readProjectFile("client/src/lib/brandToolPresentation.ts");
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
    expect(quiz).toContain('questionVideoUrl = media.kind === "video"');
    expect(quiz).toContain("const canZoomQuestionImage");
    expect(quiz).toContain("Magnify the clinical image in the MP4");
    expect(quiz).toContain("zoomQuestionImage: canZoomQuestionImage && zoomQuestionImage");
    for (const page of [challenge, social, quiz]) {
      expect(page).toContain("musicUploadBrand");
      expect(page).toContain("selectedMusic");
    }
    expect(challenge).toContain("SocialCardFrameProvider");
    expect(social).toContain("SocialCardFrameProvider");
    expect(quiz).toContain("SocialCardFrameProvider");
    expect(presentation).toContain('outroLogoShape: isIHeartEcho ? "circle" : undefined');
    for (const page of [challenge, social, quiz]) expect(page).toContain("presentation.outroLogoUrl");
  });

  it("forces MP4 output and removes the static choice whenever selected media is video", () => {
    const exporter = readProjectFile("client/src/components/social/SocialCardExport.tsx");
    const challenge = readProjectFile("client/src/pages/ChallengeCardGenerator.tsx");
    const social = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    const quiz = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");
    expect(exporter).toContain("forceMp4?: boolean");
    expect(exporter).toContain('forceMp4 ? ["mp4"]');
    expect(challenge).toContain("forceMp4={hasVideoMedia}");
    expect(quiz).toContain("forceMp4={hasVideoMedia}");
    expect(social).toContain("forceMp4={hasVideoItem}");
    expect(quiz).toContain("Video source media is available as MP4 only.");
  });

  it("keeps Challenge and Quiz clinical media fully visible in placement-aware frames", () => {
    const challenge = readProjectFile("client/src/pages/ChallengeCardGenerator.tsx");
    const quiz = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");
    const clinicalCard = readProjectFile("client/src/components/social/ClinicalQuizCard.tsx");

    expect(challenge).toContain("<ClinicalQuizCard");
    expect(challenge).toContain('media={questionVideoUrl ? { kind: "video", url: questionVideoUrl }');
    expect(quiz).toContain("<ClinicalQuizCard");
    expect(quiz).toContain('media={cardVariant === "question" || cardVariant === "combined" ? media : { kind: "none" }}');
    expect(clinicalCard).toContain("const mediaFrameAspectRatio");
    expect(clinicalCard).toContain('aspectRatio: mediaFrameAspectRatio');
    expect(clinicalCard).toContain('objectFit: "contain"');
    expect(clinicalCard).toContain('frame.layout === "portrait"');
    expect(clinicalCard).toContain('frame.layout === "vertical"');
  });
});
