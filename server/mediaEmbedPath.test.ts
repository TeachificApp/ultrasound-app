import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("media embed path routing", () => {
  it("MediaEmbedIframe uses SCORM API only for /scorm paths", () => {
    const src = readFileSync(
      new URL("../client/src/components/MediaEmbedIframe.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain('parsed?.path === "scorm"');
    expect(src).not.toContain('parsed?.path === "embed"');
  });

  it("url_embed blocks preserve /embed URLs instead of forcing /scorm", () => {
    const blockPreview = readFileSync(
      new URL("../client/src/components/BlockPreview.tsx", import.meta.url),
      "utf8",
    );
    expect(blockPreview).toContain("url.split(\"?\")[0]");
    expect(blockPreview).not.toContain("mediaRepoScormUrl(mediaRepoParsed.slug)");
  });
});
