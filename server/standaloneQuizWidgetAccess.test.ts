import { describe, expect, it } from "vitest";
import {
  buildStandaloneQuizWidgetEmbed,
  createStandaloneQuizWidgetToken,
  hashStandaloneQuizWidgetToken,
  normalizeWidgetOrigin,
} from "./lib/standaloneQuizWidgetAccess";

describe("standalone quiz widget credentials", () => {
  it("creates an opaque credential and persists only its stable SHA-256 digest", () => {
    const token = createStandaloneQuizWidgetToken();
    const tokenHash = hashStandaloneQuizWidgetToken(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toBe(token);
    expect(hashStandaloneQuizWidgetToken(token)).toBe(tokenHash);
  });

  it("builds a URL for only the intended quiz and normalizes the application origin", () => {
    expect(normalizeWidgetOrigin("https://learn.allaboutultrasound.com/path")).toBe("https://learn.allaboutultrasound.com");
    const { widgetUrl, embedCode } = buildStandaloneQuizWidgetEmbed({
      origin: "https://learn.allaboutultrasound.com",
      quizId: 30001,
      quizTitle: "RPhS Test & Learn Quiz",
      token: "opaque-token",
    });
    expect(widgetUrl).toBe("https://learn.allaboutultrasound.com/quizzes/30001?embed=1&widget=opaque-token");
    expect(embedCode).toContain('title="RPhS Test & Learn Quiz"');
  });
});
