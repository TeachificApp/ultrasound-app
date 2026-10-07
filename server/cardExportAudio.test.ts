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
});
