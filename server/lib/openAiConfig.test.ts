import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getOpenAiApiRoot,
  isOpenAiBackend,
  openAiV1Url,
} from "./openAiConfig";

describe("openAiConfig", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"]) {
      saved[key] = process.env[key];
    }
    process.env.BUILT_IN_FORGE_API_URL = "https://api.openai.com";
    process.env.BUILT_IN_FORGE_API_KEY = "sk-test";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("detects OpenAI backend", () => {
    expect(isOpenAiBackend()).toBe(true);
  });

  it("normalizes base URL with /v1 suffix", () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://api.openai.com/v1";
    expect(getOpenAiApiRoot()).toBe("https://api.openai.com");
    expect(openAiV1Url("images/generations")).toBe(
      "https://api.openai.com/v1/images/generations"
    );
  });

  it("builds whisper transcription URL", () => {
    expect(openAiV1Url("audio/transcriptions")).toBe(
      "https://api.openai.com/v1/audio/transcriptions"
    );
  });

  it("returns false for Manus Forge host", () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.manus.ai";
    expect(isOpenAiBackend()).toBe(false);
  });
});
