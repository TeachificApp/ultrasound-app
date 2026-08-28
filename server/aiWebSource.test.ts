import { describe, expect, it } from "vitest";
import { isBlockedAiGenerationHost, normalizeAiGenerationSourceUrl, textFromAiGenerationHtml } from "./lib/aiWebSource";

describe("AI web source validation", () => {
  it("accepts a public HTTP(S) page and removes its fragment", () => {
    expect(normalizeAiGenerationSourceUrl("https://education.example.org/article#section").toString()).toBe("https://education.example.org/article");
  });

  it("rejects local, private, credentialed, and non-web URL targets", () => {
    expect(isBlockedAiGenerationHost("localhost")).toBe(true);
    expect(isBlockedAiGenerationHost("10.0.0.7")).toBe(true);
    expect(isBlockedAiGenerationHost("192.168.1.20")).toBe(true);
    expect(() => normalizeAiGenerationSourceUrl("http://127.0.0.1:3000/private")).toThrow();
    expect(() => normalizeAiGenerationSourceUrl("https://user:secret@example.org/page")).toThrow();
    expect(() => normalizeAiGenerationSourceUrl("file:///etc/passwd")).toThrow();
  });

  it("extracts readable text without scripts or markup", () => {
    expect(textFromAiGenerationHtml("<html><head><script>secret()</script></head><body><h1>Venous reflux</h1><p>Assessment text.</p></body></html>")).toBe("Venous reflux Assessment text.");
  });
});
