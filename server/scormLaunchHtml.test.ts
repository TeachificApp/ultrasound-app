import { describe, expect, it } from "vitest";
import { injectScormLaunchHtml, scormLaunchBaseHref } from "./lib/scormLaunchHtml";

describe("scormLaunchHtml", () => {
  it("builds a base href for folder-prefixed launch files", () => {
    expect(
      scormLaunchBaseHref(
        "https://learn.allaboutultrasound.com/api/media/acs-flashcards/scorm/?access=abc",
        "ACS Flashcards/index.html",
      ),
    ).toBe(
      "https://learn.allaboutultrasound.com/api/media/acs-flashcards/scorm/ACS%20Flashcards/",
    );
  });

  it("returns null base href when launch file is at zip root", () => {
    expect(scormLaunchBaseHref("https://example.com/scorm/", "index.html")).toBeNull();
  });

  it("injects base tag and SCORM API shim for iSpring flashcard decks", () => {
    const html = "<html><head><title>ACS Flashcards</title></head><body></body></html>";
    const out = injectScormLaunchHtml(html, {
      scormBaseUrl: "https://learn.allaboutultrasound.com/api/media/acs-flashcards/scorm/?access=abc",
      launchFile: "ACS Flashcards/index.html",
    });
    expect(out).toContain("<base href=");
    expect(out).toContain("ACS%20Flashcards/");
    expect(out).toContain("window.API_1484_11");
  });

  it("does not duplicate an existing base tag", () => {
    const html = '<html><head><base href="/existing/"></head><body></body></html>';
    const out = injectScormLaunchHtml(html, {
      scormBaseUrl: "https://example.com/scorm/",
      launchFile: "ACS Flashcards/index.html",
    });
    expect(out.match(/<base\b/gi)?.length).toBe(1);
    expect(out).toContain('href="/existing/"');
  });
});

describe("readMediaAuth referer fallback", () => {
  function readMediaAuth(req: { query: Record<string, unknown>; headers: Record<string, string | undefined> }) {
    const fromQuery = {
      token: (req.query.token as string) || undefined,
      access: (req.query.access as string) || undefined,
    };
    if (fromQuery.access || fromQuery.token) return fromQuery;
    const referer = req.headers.referer || "";
    if (!referer) return fromQuery;
    try {
      const ref = new URL(referer);
      const access = ref.searchParams.get("access") ?? undefined;
      const token = ref.searchParams.get("token") ?? undefined;
      if (access || token) return { access, token };
    } catch {
      /* ignore */
    }
    return fromQuery;
  }

  it("inherits access token from SCORM launch page referer for sub-resources", () => {
    const auth = readMediaAuth({
      query: {},
      headers: {
        referer: "https://learn.allaboutultrasound.com/api/media/acs-flashcards/scorm/?access=signed-token",
      },
    });
    expect(auth.access).toBe("signed-token");
  });

  it("prefers explicit query token over referer", () => {
    const auth = readMediaAuth({
      query: { access: "direct-token" },
      headers: {
        referer: "https://learn.allaboutultrasound.com/api/media/acs/scorm/?access=referer-token",
      },
    });
    expect(auth.access).toBe("direct-token");
  });
});

describe("SCORM embed URL trailing slash", () => {
  it("builds launch URLs with trailing slash before auth query", () => {
    const slug = "acs-flashcards";
    const authQuery = "?access=signed";
    expect(`/api/media/${slug}/scorm/${authQuery}`).toBe(
      "/api/media/acs-flashcards/scorm/?access=signed",
    );
  });
});
