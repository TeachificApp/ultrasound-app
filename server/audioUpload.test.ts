/**
 * Tests for audio upload data URI parsing fix.
 *
 * The root cause of the audio recording bug was that the regex
 * /^data:[^;]+;base64,/ fails to strip the prefix from data URIs
 * with mime types containing semicolons (e.g. audio/webm;codecs=opus).
 *
 * The fix uses indexOf(";base64,") to find the marker and slice after it,
 * which handles any mime type regardless of semicolons or commas.
 */

import { describe, it, expect } from "vitest";

// The old (broken) regex approach
function oldStrip(dataUri: string): string {
  return dataUri.replace(/^data:[^;]+;base64,/, "");
}

// The new (fixed) indexOf approach
function newStrip(dataUri: string): string {
  const marker = ";base64,";
  const idx = dataUri.indexOf(marker);
  return idx >= 0 ? dataUri.slice(idx + marker.length) : dataUri;
}

describe("Data URI base64 prefix stripping", () => {
  describe("Old regex (broken for mime types with params)", () => {
    it("works for simple mime types like image/png", () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgo=";
      expect(oldStrip(dataUri)).toBe("iVBORw0KGgo=");
    });

    it("FAILS for audio/webm;codecs=opus", () => {
      const dataUri = "data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EI=";
      const result = oldStrip(dataUri);
      // Old regex strips "data:audio/webm;" leaving "codecs=opus;base64,GkXfo..."
      expect(result).not.toBe("GkXfo59ChoEBQveBAULygQRC84EI=");
    });

    it("FAILS for audio/ogg;codecs=vorbis", () => {
      const dataUri = "data:audio/ogg;codecs=vorbis;base64,T2dnUwACAAA=";
      expect(oldStrip(dataUri)).not.toBe("T2dnUwACAAA=");
    });
  });

  describe("New indexOf approach (fixed)", () => {
    it("works for simple mime types like image/png", () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgo=";
      expect(newStrip(dataUri)).toBe("iVBORw0KGgo=");
    });

    it("works for audio/webm;codecs=opus", () => {
      const dataUri = "data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EI=";
      expect(newStrip(dataUri)).toBe("GkXfo59ChoEBQveBAULygQRC84EI=");
    });

    it("works for audio/ogg;codecs=vorbis", () => {
      const dataUri = "data:audio/ogg;codecs=vorbis;base64,T2dnUwACAAA=";
      expect(newStrip(dataUri)).toBe("T2dnUwACAAA=");
    });

    it("works for video/webm;codecs=vp8,opus (comma in mime params)", () => {
      const dataUri = "data:video/webm;codecs=vp8,opus;base64,GkXfo59ChoEB=";
      expect(newStrip(dataUri)).toBe("GkXfo59ChoEB=");
    });

    it("works for image/jpeg (no params)", () => {
      const dataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      expect(newStrip(dataUri)).toBe("/9j/4AAQSkZJRg==");
    });

    it("works for application/pdf", () => {
      const dataUri = "data:application/pdf;base64,JVBERi0xLjQ=";
      expect(newStrip(dataUri)).toBe("JVBERi0xLjQ=");
    });

    it("returns original string if no data URI prefix", () => {
      const raw = "GkXfo59ChoEBQveBAULygQRC84EI=";
      expect(newStrip(raw)).toBe(raw);
    });
  });

  describe("Buffer.from base64 produces valid data", () => {
    it("correctly decodes a simple base64 string with new approach", () => {
      const dataUri = "data:audio/webm;codecs=opus;base64,SGVsbG8gV29ybGQ=";
      const base64Data = newStrip(dataUri);
      const buffer = Buffer.from(base64Data, "base64");
      expect(buffer.toString("utf-8")).toBe("Hello World");
    });

    it("produces wrong result with old regex for webm mime type", () => {
      const dataUri = "data:audio/webm;codecs=opus;base64,SGVsbG8gV29ybGQ=";
      const base64Data = oldStrip(dataUri);
      // Old regex leaves "codecs=opus;base64,SGVsbG8gV29ybGQ=" which is not valid base64
      const buffer = Buffer.from(base64Data, "base64");
      expect(buffer.toString("utf-8")).not.toBe("Hello World");
    });

    it("handles real webm audio header bytes correctly", () => {
      // First 4 bytes of a WebM file: 0x1A 0x45 0xDF 0xA3 (EBML header)
      const webmHeader = Buffer.from([0x1A, 0x45, 0xDF, 0xA3]);
      const b64 = webmHeader.toString("base64");
      const dataUri = `data:audio/webm;codecs=opus;base64,${b64}`;

      const stripped = newStrip(dataUri);
      const decoded = Buffer.from(stripped, "base64");
      expect(decoded[0]).toBe(0x1A);
      expect(decoded[1]).toBe(0x45);
      expect(decoded[2]).toBe(0xDF);
      expect(decoded[3]).toBe(0xA3);
    });
  });
});
