import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("content widget automatic iframe sizing", () => {
  it("reports complete rendered widget height on initial render and subsequent layout changes", () => {
    const renderer = read("client/src/pages/WidgetRenderer.tsx");

    expect(renderer).toContain("const reportHeight = () => {");
    expect(renderer).toContain("document.documentElement.scrollHeight");
    expect(renderer).toContain("document.body.scrollHeight");
    expect(renderer).toContain('window.parent?.postMessage({ type: "ultrasound-widget-resize", height }, "*")');
    expect(renderer).toContain("const delayedReport = window.setTimeout(scheduleHeightReport, 150)");
  });

  it("generates a no-scroll iframe that starts tall enough and accepts only its own resize messages", () => {
    const manager = read("client/src/pages/admin/WidgetManager.tsx");

    expect(manager).toContain('height="600"');
    expect(manager).toContain('scrolling="no"');
    expect(manager).toContain('min-height:600px; overflow:hidden;');
    expect(manager).toContain("e.source === iframe.contentWindow");
    expect(manager).toContain("Math.max(200, Math.ceil(reportedHeight) + 24)");
    expect(manager).toContain("function WidgetPreviewFrame");
  });

  it("keeps the platform funnel embed wrapper responsive to a child widget height", () => {
    const funnel = read("client/src/pages/PublicFunnelPage.tsx");

    expect(funnel).toContain("function AutoSizingEmbedFrame");
    expect(funnel).toContain('"ultrasound-embed-resize"');
    expect(funnel).toContain("injectEmbedAutoResizeBridge");
    expect(funnel).toContain("scrolling=\"no\"");
  });
});
