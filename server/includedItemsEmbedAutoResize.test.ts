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

  it("includes a no-scroll direct iframe helper and relays its height through saved page embeds", () => {
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
    expect(autoSizingFrame).toContain('frame.contentWindow === event.source');
    expect(autoSizingFrame).toContain("const initialHeight = Math.max(expandsToContent ? 800 : minimumHeight, minimumHeight)");
    expect(autoSizingFrame).toContain("setHeight(Math.max(minimumHeight, Math.ceil(reportedHeight) + 24))");
    expect(blockPreview).toContain("<AutoSizingHtmlEmbed");
  });
});
