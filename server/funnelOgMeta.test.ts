import { describe, expect, it } from "vitest";
import { injectPageSeoIntoHtml } from "./routes/funnelOgMeta";

const TEMPLATE = `<!doctype html>
<html>
<head>
  <title>Default page</title>
  <meta name="description" content="Default description" />
  <meta property="og:title" content="Default page" />
  <meta property="og:description" content="Default description" />
  <meta property="og:url" content="https://old.example/page" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://old.example/image.jpg" />
  <meta name="twitter:title" content="Default page" />
  <meta name="twitter:description" content="Default description" />
  <meta name="twitter:image" content="https://old.example/image.jpg" />
</head>
<body><div id="root"></div></body>
</html>`;

const request = {
  protocol: "https",
  originalUrl: "/courses/fetal-echo",
  path: "/courses/fetal-echo",
  headers: {
    host: "learn.allaboutultrasound.com",
    "x-canonical-host": "learn.allaboutultrasound.com",
  },
  get: (name: string) => (name.toLowerCase() === "host" ? "learn.allaboutultrasound.com" : undefined),
} as any;

function count(html: string, needle: string) {
  return (html.match(new RegExp(needle, "g")) ?? []).length;
}

describe("injectPageSeoIntoHtml", () => {
  it("renders saved title, description, keywords, and an absolute uploaded image for crawlers", () => {
    const html = injectPageSeoIntoHtml(
      TEMPLATE,
      {
        title: "Fetal Echo Essentials",
        description: "Practical fetal echocardiography education.",
        keywords: "fetal echo, ultrasound CME",
        image: "/manus-storage/page-builder/courses/fetal-echo.png",
      },
      request,
    );

    expect(html).toContain("<title>Fetal Echo Essentials</title>");
    expect(html).toContain('name="description" content="Practical fetal echocardiography education."');
    expect(html).toContain('name="keywords" content="fetal echo, ultrasound CME"');
    expect(html).toContain('property="og:image" content="https://learn.allaboutultrasound.com/manus-storage/page-builder/courses/fetal-echo.png"');
    expect(html).toContain('name="twitter:image" content="https://learn.allaboutultrasound.com/manus-storage/page-builder/courses/fetal-echo.png"');
    expect(html).toContain('rel="canonical" href="https://learn.allaboutultrasound.com/courses/fetal-echo"');
  });

  it("keeps one canonical set of metadata tags when host defaults already exist", () => {
    const html = injectPageSeoIntoHtml(
      TEMPLATE,
      {
        title: "Event detail",
        description: "Event description",
        keywords: "ultrasound event",
        image: "https://cdn.example.com/event-preview.jpg",
      },
      request,
    );

    expect(count(html, 'property="og:title"')).toBe(1);
    expect(count(html, 'property="og:description"')).toBe(1);
    expect(count(html, 'property="og:type"')).toBe(1);
    expect(count(html, 'property="og:image"')).toBe(1);
    expect(count(html, 'name="twitter:image"')).toBe(1);
    expect(count(html, 'name="keywords"')).toBe(1);
    expect(count(html, 'rel="canonical"')).toBe(1);
  });
});
