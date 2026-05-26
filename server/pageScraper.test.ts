/**
 * pageScraper.test.ts — Unit tests for the pageScraperRouter htmlToBlocks logic.
 * Tests are written against the exported htmlToBlocks function.
 */
import { describe, it, expect } from "vitest";
import { htmlToBlocks } from "./routers/pageScraperRouter";

const BASE_URL = "https://example.com";

// ─── Hero block ───────────────────────────────────────────────────────────────

describe("htmlToBlocks — hero block", () => {
  it("extracts H1 as a hero block", () => {
    const html = `<html><body><h1>Welcome to Ultrasound</h1></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks[0].type).toBe("hero");
    expect(blocks[0].data.headline).toBe("Welcome to Ultrasound");
  });

  it("uses OG title as hero headline when no H1", () => {
    const html = `<html><head><meta property="og:title" content="OG Page Title" /></head><body><p>Some content here on the page.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const hero = blocks.find(b => b.type === "hero");
    expect(hero!.data.headline).toBe("OG Page Title");
  });

  it("uses OG description as hero subheadline", () => {
    const html = `<html><head><meta property="og:title" content="Title" /><meta property="og:description" content="A great description" /></head><body></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "hero")!.data.subheadline).toBe("A great description");
  });

  it("does not duplicate H1 as text block", () => {
    const html = `<html><body><h1>Main Title</h1><p>Paragraph content here.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textBlocks = blocks.filter(b => b.type === "text");
    expect(textBlocks.every(b => !b.data.html?.includes("Main Title"))).toBe(true);
  });
});

// ─── Text blocks ──────────────────────────────────────────────────────────────

describe("htmlToBlocks — text blocks", () => {
  it("extracts H2 as a text block with h2 HTML", () => {
    const html = `<html><body><h2>Section Title</h2></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "text")!.data.html).toContain("<h2>Section Title</h2>");
  });

  it("extracts paragraphs as text blocks", () => {
    const html = `<html><body><p>This is a long enough paragraph for testing.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "text")!.data.html).toContain("This is a long enough paragraph");
  });

  it("skips very short paragraphs (< 8 chars)", () => {
    const html = `<html><body><p>Short</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "text")).toBeUndefined();
  });

  it("deduplicates consecutive identical text blocks", () => {
    const html = `<html><body><p>Duplicate paragraph content here.</p><p>Duplicate paragraph content here.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textBlocks = blocks.filter(b => b.type === "text" && b.data.html.includes("Duplicate paragraph"));
    expect(textBlocks.length).toBe(1);
  });

  it("handles empty HTML gracefully", () => {
    expect(htmlToBlocks(`<html><body></body></html>`, BASE_URL)).toEqual([]);
  });
});

// ─── Image blocks ─────────────────────────────────────────────────────────────

describe("htmlToBlocks — image blocks", () => {
  it("extracts IMG as an image block with resolved URL", () => {
    const html = `<html><body><img src="/images/scan.jpg" alt="Ultrasound scan" /></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const img = blocks.find(b => b.type === "image");
    expect(img!.data.url).toBe("https://example.com/images/scan.jpg");
    expect(img!.data.alt).toBe("Ultrasound scan");
  });

  it("skips data: URI images", () => {
    const html = `<html><body><img src="data:image/png;base64,abc123" alt="base64" /></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "image")).toBeUndefined();
  });

  it("skips 1x1 tracking pixels", () => {
    const html = `<html><body><img src="/pixel.gif" width="1" height="1" /></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "image")).toBeUndefined();
  });
});

// ─── List blocks ──────────────────────────────────────────────────────────────

describe("htmlToBlocks — list blocks", () => {
  it("extracts plain UL as bullets block", () => {
    const html = `<html><body><ul><li>Item one</li><li>Item two</li><li>Item three</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const bulletsBlock = blocks.find(b => b.type === "bullets");
    expect(bulletsBlock!.data.items).toEqual(["Item one", "Item two", "Item three"]);
  });

  it("extracts OL as numbered_list block", () => {
    const html = `<html><body><ol><li>First step</li><li>Second step</li></ol></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "numbered_list")!.data.items).toEqual(["First step", "Second step"]);
  });
});

// ─── Checklist detection from UL ─────────────────────────────────────────────

describe("htmlToBlocks — checklist detection from UL", () => {
  it("detects ✓ checkmark UL as checklist block", () => {
    const html = `<html><body><ul><li>✓ First benefit</li><li>✓ Second benefit</li><li>✓ Third benefit</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist!.data.items).toEqual(["First benefit", "Second benefit", "Third benefit"]);
  });

  it("detects ✔ checkmark UL as checklist block", () => {
    const html = `<html><body><ul><li>✔ Benefit A</li><li>✔ Benefit B</li></ul></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "checklist")).toBeDefined();
  });

  it("detects ✅ emoji UL as checklist block", () => {
    const html = `<html><body><ul><li>✅ Feature one</li><li>✅ Feature two</li><li>✅ Feature three</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")!.data.items).toEqual(["Feature one", "Feature two", "Feature three"]);
  });

  it("strips checkmark chars from checklist items", () => {
    const html = `<html><body><ul><li>✓ Clean item text</li><li>✓ Another clean item</li></ul></body></html>`;
    const checklist = htmlToBlocks(html, BASE_URL).find(b => b.type === "checklist")!;
    for (const item of checklist.data.items) {
      expect(item).not.toMatch(/[✓✔✅☑]/u);
    }
    expect(checklist.data.items[0]).toBe("Clean item text");
  });

  it("detects fa-check icon UL as checklist", () => {
    const html = `<html><body><ul>
      <li><i class="fa fa-check"></i> Item one</li>
      <li><i class="fa fa-check"></i> Item two</li>
      <li><i class="fa fa-check"></i> Item three</li>
    </ul></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "checklist")).toBeDefined();
  });

  it("does NOT flag plain UL as checklist", () => {
    const html = `<html><body><ul><li>Item one</li><li>Item two</li></ul></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "checklist")).toBeUndefined();
  });
});

// ─── Inline list splitting from paragraphs (newline-based) ───────────────────

describe("htmlToBlocks — inline list splitting (newline-based)", () => {
  it("splits ✔ multi-line paragraph into checklist block", () => {
    const html = `<html><body><p>✔ Built for general sonographers\n✔ Live, structured, and focused\n✔ Learn vascular foundations</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items.length).toBe(3);
    expect(checklist!.data.items[0]).toBe("Built for general sonographers");
  });

  it("splits dash-prefixed multi-line paragraph into bullets block", () => {
    const html = `<html><body><p>- It's not just another modality\n- It's not something you can fake\n- And it's not from random videos</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const bullets = blocks.find(b => b.type === "bullets");
    expect(bullets).toBeDefined();
    expect(bullets!.data.items.length).toBe(3);
    expect(bullets!.data.items[0]).toBe("It's not just another modality");
  });

  it("splits ✔ lines inside a leaf div into checklist block", () => {
    const html = `<html><body><div>✔ Image optimization techniques\n✔ Standard views + probe positioning\n✔ Vascular anatomy simplified</div></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items.length).toBe(3);
  });

  it("does NOT split single-line text into a list", () => {
    const html = `<html><body><p>This is just a single paragraph of text about ultrasound.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")).toBeUndefined();
    expect(blocks.find(b => b.type === "bullets")).toBeUndefined();
    expect(blocks.find(b => b.type === "text")).toBeDefined();
  });
});

// ─── ClickFunnels-style inline checkmarks (no newlines) ──────────────────────

describe("htmlToBlocks — ClickFunnels inline checkmarks (no newlines, zero-width spaces)", () => {
  it("splits concatenated ✔ items from a paragraph with <br> tags", () => {
    // ClickFunnels uses <br> between checkmark lines — cheerio replaces them with \n
    const html = `<html><body><p>✔ Built for general sonographers<br>✔ Live, structured, and clinically focused<br>✔ Learn vascular foundations, Doppler, and pathology</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items.length).toBe(3);
    expect(checklist!.data.items[0]).toBe("Built for general sonographers");
    expect(checklist!.data.items[1]).toBe("Live, structured, and clinically focused");
  });

  it("strips zero-width spaces (U+200B) before checkmarks and splits correctly", () => {
    // Simulate ClickFunnels zero-width space injection: ​✔
    const zwsp = "\u200B";
    const html = `<html><body><p>✔ Built for general sonographers<br>${zwsp}✔ Live, structured<br>${zwsp}✔ Learn vascular</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items.length).toBe(3);
    // Items should NOT contain zero-width spaces
    for (const item of checklist!.data.items) {
      expect(item).not.toContain(zwsp);
    }
  });

  it("splits concatenated inline checkmarks with no separator", () => {
    // Worst case: all checkmarks concatenated with no whitespace
    const html = `<html><body><p>✔ Built for general sonographers✔ Live, structured and focused✔ Learn vascular foundations</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it("handles zero-width space before first checkmark in a paragraph", () => {
    const zwsp = "\u200B";
    const html = `<html><body><p>${zwsp}✔ First item<br>${zwsp}✔ Second item<br>${zwsp}✔ Third item</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items[0]).toBe("First item");
  });

  it("handles mixed zero-width spaces and regular newlines", () => {
    const zwsp = "\u200B";
    const html = `<html><body><p>✔ First benefit\n${zwsp}✔ Second benefit\n${zwsp}✔ Third benefit</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items.length).toBe(3);
  });
});

// ─── Noise filtering ──────────────────────────────────────────────────────────

describe("htmlToBlocks — noise filtering", () => {
  it("filters '100% Secure - Privacy Guaranteed' text", () => {
    const html = `<html><body><p>100% Secure - Privacy Guaranteed</p><h2>Real Section Title Here</h2></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => JSON.stringify(b.data).includes("Secure"))).toBeUndefined();
    expect(blocks.find(b => b.type === "text")).toBeDefined();
  });

  it("filters countdown timer digits", () => {
    const html = `<html><body><div class="countdown">12:11:17</div><p>Real content paragraph here.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => JSON.stringify(b.data).includes("12:11:17"))).toBeUndefined();
  });

  it("removes nav and footer elements", () => {
    const html = `<html><body><nav><a href="/">Home</a></nav><h1>Main Content</h1><footer>Footer text</footer></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks[0].type).toBe("hero");
    expect(blocks.find(b => JSON.stringify(b.data).includes("Footer text"))).toBeUndefined();
  });
});

// ─── CTA detection ────────────────────────────────────────────────────────────

describe("htmlToBlocks — CTA detection", () => {
  it("detects anchor with btn class as CTA block", () => {
    const html = `<html><body><a href="https://example.com/enroll" class="btn btn-primary">Get Started Now</a></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const cta = blocks.find(b => b.type === "cta");
    expect(cta).toBeDefined();
    expect(cta!.data.buttonText).toBe("Get Started Now");
    expect(cta!.data.buttonUrl).toBe("https://example.com/enroll");
  });

  it("detects anchor with role=button as CTA block", () => {
    const html = `<html><body><a href="/signup" role="button">Enroll Today</a></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "cta")).toBeDefined();
  });

  it("detects action-oriented short anchor text as CTA", () => {
    const html = `<html><body><a href="/course">Get Started</a></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "cta")).toBeDefined();
  });

  it("does NOT flag regular navigation links as CTA", () => {
    const html = `<html><body><a href="/about">About Us</a></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "cta")).toBeUndefined();
  });
});

// ─── Document order preservation ─────────────────────────────────────────────

describe("htmlToBlocks — document order preservation", () => {
  it("preserves image before text when image appears first in HTML", () => {
    const html = `<html><body><img src="/scan.jpg" alt="scan" /><p>This is a paragraph about the scan above.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const imgIdx = blocks.findIndex(b => b.type === "image");
    const textIdx = blocks.findIndex(b => b.type === "text");
    expect(imgIdx).toBeLessThan(textIdx);
  });

  it("preserves text before image when text appears first in HTML", () => {
    const html = `<html><body><p>This is a paragraph about the scan below.</p><img src="/scan.jpg" alt="scan" /></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textIdx = blocks.findIndex(b => b.type === "text");
    const imgIdx = blocks.findIndex(b => b.type === "image");
    expect(textIdx).toBeLessThan(imgIdx);
  });
});

// ─── Two-column layout (Bootstrap col-md-6) ───────────────────────────────────

describe("htmlToBlocks — two_column block detection", () => {
  it("detects Bootstrap col-md-6 two-column layout", () => {
    const html = `<html><body>
      <div class="row id-abc">
        <div class="col-md-6 innerContent col_left id-left">
          <p>Left column content with enough text to be meaningful here.</p>
        </div>
        <div class="col-md-6 innerContent col_right id-right">
          <p>Right column content with enough text to be meaningful here.</p>
        </div>
      </div>
    </body></html>`;
    const result = htmlToBlocks(html, BASE_URL);
    const twoCol = result.find(b => b.type === "two_column");
    expect(twoCol).toBeDefined();
    expect(twoCol!.data.leftHtml).toContain("Left column");
    expect(twoCol!.data.rightHtml).toContain("Right column");
  });

  it("sets leftRatio to 50 for equal col-md-6 columns", () => {
    const html = `<html><body>
      <div class="row">
        <div class="col-md-6 innerContent col_left">
          <p>Left content that is long enough to not be filtered as noise.</p>
        </div>
        <div class="col-md-6 innerContent col_right">
          <p>Right content that is long enough to not be filtered as noise.</p>
        </div>
      </div>
    </body></html>`;
    const result = htmlToBlocks(html, BASE_URL);
    const twoCol = result.find(b => b.type === "two_column");
    expect(twoCol!.data.leftRatio).toBe(50);
  });

  it("detects image+content as column_layout when one column is an image", () => {
    const html = `<html><body>
      <div class="row">
        <div class="col-md-6 innerContent col_left">
          <img src="https://example.com/course.jpg" alt="Course" />
        </div>
        <div class="col-md-6 innerContent col_right">
          <h2>Course Title</h2>
          <ul><li>✔ Feature one</li><li>✔ Feature two</li></ul>
        </div>
      </div>
    </body></html>`;
    const result = htmlToBlocks(html, BASE_URL);
    const colLayout = result.find(b => b.type === "column_layout");
    expect(colLayout).toBeDefined();
    const leftBlocks = colLayout!.data.leftBlocks as any[];
    expect(leftBlocks.some((b: any) => b.type === "image")).toBe(true);
  });
});

// ─── Three-column layout (Bootstrap col-md-4) ────────────────────────────────

describe("htmlToBlocks — three_column block detection", () => {
  it("detects Bootstrap col-md-4 three-column layout", () => {
    const html = `<html><body>
      <div class="row id-G86EmV-332">
        <div class="col-md-4 innerContent col_left id-G86EmV-333">
          <h2>WHAT</h2>
          <p>Exclusive 12-Week Vascular Ultrasound Course for advancing vascular insights.</p>
        </div>
        <div class="col-md-4 innerContent col_right id-G86EmV-334">
          <h2>WHEN</h2>
          <p>Classes start June 1st! Register now, spaces are limited for enrollment.</p>
        </div>
        <div class="col-md-4 innerContent col_right id-G86EmV-335">
          <h2>WHY</h2>
          <p>So you can finally learn Vascular Ultrasound and hemodynamics effectively.</p>
        </div>
      </div>
    </body></html>`;
    const result = htmlToBlocks(html, BASE_URL);
    const threeCol = result.find(b => b.type === "three_column");
    expect(threeCol).toBeDefined();
    expect(threeCol!.data.col1Html).toContain("WHAT");
    expect(threeCol!.data.col2Html).toContain("WHEN");
    expect(threeCol!.data.col3Html).toContain("WHY");
  });
});
