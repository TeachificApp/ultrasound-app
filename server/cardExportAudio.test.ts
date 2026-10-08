import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("card export audio proxy", () => {
  it("keeps Media Repository audio authenticated and same-origin for MP4 encoding", () => {
    const route = readProjectFile("server/routes/cardExportAudio.ts");
    const index = readProjectFile("server/_core/index.ts");

    expect(route).toContain('router.get("/api/card-export-audio/:assetId"');
    expect(route).toContain("authenticatePlatformMediaAdmin(req)");
    expect(route).toContain('asset.mediaType !== "audio"');
    expect(route).toContain('headers.set("Range", req.headers.range)');
    expect(route).toContain("Readable.fromWeb(upstream.body");
    expect(route).toContain("new GetObjectCommand");
    expect(route).toContain('"Cache-Control", "private, no-store, max-age=0"');
    expect(route).toContain('"Cross-Origin-Resource-Policy", "same-origin"');
    expect(index).toContain('import { registerCardExportAudioRoute } from "../routes/cardExportAudio"');
    expect(index).toContain("registerCardExportAudioRoute(app)");
  });

  it("uses the proxy for defaults, repository music, uploads, and every card generator", () => {
    const exporter = readProjectFile("client/src/components/social/SocialCardExport.tsx");
    const settings = readProjectFile("server/routers/siteSettingsRouter.ts");
    const social = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    const challenge = readProjectFile("client/src/pages/ChallengeCardGenerator.tsx");
    const quiz = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");

    expect(exporter).toContain("export function getCardExportAudioUrl(assetId: number)");
    expect(exporter).toContain("url: getCardExportAudioUrl(defaultAudio.data.assetId)");
    expect(exporter).toContain("url: getCardExportAudioUrl(uploaded.assetId)");
    expect(exporter).toContain("authenticated same-origin audio stream");
    expect(settings).toContain("url: `/api/card-export-audio/${asset.id}`");
    for (const page of [social, challenge, quiz]) {
      expect(page).toContain("getCardExportAudioUrl");
      expect(page).toContain("url: getCardExportAudioUrl(asset.id)");
    }
  });

  it("uses a trusted asset ID for AAC muxing when the browser cannot encode AAC", () => {
    const route = readProjectFile("server/routes/cardExportAudio.ts");
    const exporter = readProjectFile("client/src/components/social/SocialCardExport.tsx");
    const nixpacks = readProjectFile("nixpacks.toml");
    const social = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    const challenge = readProjectFile("client/src/pages/ChallengeCardGenerator.tsx");
    const quiz = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");

    expect(route).toContain('router.post("/api/card-export-audio/mux"');
    expect(route).toContain("authenticatePlatformMediaAdmin(req)");
    expect(route).toContain('uploadMuxPayload');
    expect(route).toContain('{ name: "audio", maxCount: 1 }');
    expect(route).toContain("const assetId = Number(req.body?.assetId)");
    expect(route).toContain("getStoredAudio(assetId)");
    expect(route).toContain("CARD_EXPORT_FRAME_RATE");
    expect(route).toContain('"-vf", `fps=${CARD_EXPORT_FRAME_RATE}`');
    expect(route).toContain('"-c:v", "copy", "-c:a", "aac"');
    expect(route).toContain('"-stream_loop", "-1"');
    expect(route).toContain("MAX_VIDEO_DURATION_SECONDS");
    expect(route).toContain("fs.rm(workDir, { recursive: true, force: true }");
    expect(nixpacks).toContain('nixPkgs = ["nodejs_22", "pnpm", "ffmpeg"]');

    expect(exporter).toContain("muxMp4WithServerAudio");
    expect(exporter).toContain('fetch("/api/card-export-audio/mux"');
    expect(exporter).toContain("motion.musicAssetId");
    expect(exporter).toContain("needsServerAudioMux");
    expect(exporter).toContain("normalizeMp4ExportError");
    expect(exporter).not.toContain("addMusicTrack(output");
    expect(exporter).toContain("assetId?: number");
    expect(exporter).not.toContain('formData.append("audioUrl"');
    expect(exporter).toContain('formData.append("audio"');
    expect(route).toContain("ALLOWED_MUX_AUDIO_MIMES");
    expect(route).toContain("ALLOWED_MUX_VIDEO_MIMES");
    expect(route).toContain("transcodeVideoToH264");
    expect(route).toContain("ensureH264Mp4");
    expect(route).toContain("isH264VideoCodec");
    for (const page of [social, challenge, quiz]) {
      expect(page).toContain("assetId: asset.id");
      expect(page).toContain("musicAssetId: selectedMusic?.assetId");
    }
  });
});
