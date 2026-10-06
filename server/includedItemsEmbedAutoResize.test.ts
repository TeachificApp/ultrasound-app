import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("included-items embed automatic sizing", () => {
  it("reports complete document height before and after image and layout changes", () => {
    const route = read("server/routes/includedItemsEmbedRoutes.ts");

    expect(route).toContain("document.documentElement");
    expect(route).toContain("included-items-root");
    expect(route).toContain("content.getBoundingClientRect().height");
    expect(route).toContain("Do not use body.scrollHeight here");
    expect(route).toContain("document.addEventListener('load', scheduleHeight, true)");
    expect(route).toContain("setTimeout(scheduleHeight, 750)");
    expect(route).toContain("type: 'included-items-resize'");
  });

  it("installs its resize listener before the included-items iframe loads and starts without a scrollbar", () => {
    const route = read("server/routes/includedItemsEmbedRoutes.ts");

    expect(route).toContain("height:800px;min-height:200px;overflow:hidden;");
    expect(route).toContain("iframe.setAttribute('scrolling', 'no')");
    expect(route).toContain("Math.ceil(reportedHeight) + 24");
    expect(route.indexOf("window.addEventListener('message'")).toBeLessThan(route.indexOf("el.appendChild(iframe)"));
  });

  it("renders saved included-items snippets as one direct no-scroll iframe", () => {
    const helper = read("client/src/lib/includedItemsEmbed.ts");
    const funnel = read("client/src/pages/PublicFunnelPage.tsx");
    const autoSizingFrame = read("client/src/components/AutoSizingHtmlEmbed.tsx");
    const blockPreview = read("client/src/components/BlockPreview.tsx");

    expect(helper).toContain("buildIncludedItemsIframeSnippet");
    expect(helper).toContain('height="800"');
    expect(helper).toContain("min-height:200px");
    expect(helper).toContain('scrolling="no"');
    expect(helper).toContain('type !== "included-items-resize"');
    expect(funnel).toContain('event.data.type === "included-items-resize"');
    expect(funnel).toContain("included-items-resize|\\/widget\\/");
    expect(autoSizingFrame).toContain("included-items-resize");
    expect(autoSizingFrame).toContain("extractIncludedItemsSrc");
    expect(autoSizingFrame).toContain("DirectIncludedItemsEmbed");
    expect(autoSizingFrame).toContain('src={src}');
    expect(autoSizingFrame).toContain('event.source !== iframeRef.current?.contentWindow');
    expect(autoSizingFrame).toContain("const initialHeight = Math.max(280, Math.min(Math.max(requestedHeight, minimumHeight), 420))");
    expect(autoSizingFrame).not.toContain("expandsToContent ? 800");
    expect(blockPreview).toContain("<AutoSizingHtmlEmbed");
  });
});
