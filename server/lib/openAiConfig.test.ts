import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getOpenAiApiKey,
  getOpenAiApiRoot,
  isOpenAiBackend,
  isAiConfigured,
  openAiV1Url,
  resolveForgeApiKey,
  resolveForgeApiUrl,
  resolveLlmChatModel,
  resolveSpeechSynthesisV1Url,
  getSpeechSynthesisApiKey,
  isSpeechSynthesisConfigured,
} from "./openAiConfig";

describe("openAiConfig", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      "BUILT_IN_FORGE_API_URL",
      "BUILT_IN_FORGE_API_KEY",
      "OPENAI_API_KEY",
      "OPENAI_BASE_URL",
      "OPENAI_API_BASE",
      "FORGE_API_KEY",
      "FORGE_API_URL",
      "VITE_FRONTEND_FORGE_API_KEY",
      "VITE_FRONTEND_FORGE_API_URL",
      "MANUS_API_KEY",
    ]) {
      saved[key] = process.env[key];
      delete process.env[key];
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

  it("accepts OPENAI_API_KEY when forge key is unset", () => {
    delete process.env.BUILT_IN_FORGE_API_KEY;
    process.env.OPENAI_API_KEY = "sk-openai-only";
    expect(resolveForgeApiKey()).toBe("sk-openai-only");
    expect(getOpenAiApiKey()).toBe("sk-openai-only");
  });

  it("falls back to the existing Railway VITE Forge pair when server variables are absent", () => {
    delete process.env.BUILT_IN_FORGE_API_URL;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    delete process.env.FORGE_API_URL;
    delete process.env.FORGE_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_BASE;
    delete process.env.OPENAI_API_KEY;
    process.env.VITE_FRONTEND_FORGE_API_URL = "https://forge.manus.ai/v1";
    process.env.VITE_FRONTEND_FORGE_API_KEY = "railway-forge-key";

    expect(resolveForgeApiUrl()).toBe("https://forge.manus.ai");
    expect(resolveForgeApiKey()).toBe("railway-forge-key");
    expect(isAiConfigured()).toBe(true);
    expect(resolveLlmChatModel()).toBe("gemini-3-flash-preview");
  });

  it("defaults OpenAI base URL when only OPENAI_API_KEY is set", () => {
    delete process.env.BUILT_IN_FORGE_API_URL;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_BASE;
    delete process.env.FORGE_API_URL;
    delete process.env.FORGE_API_KEY;
    process.env.OPENAI_API_KEY = "sk-openai-only";
    expect(resolveForgeApiUrl()).toBe("https://api.openai.com");
    expect(resolveLlmChatModel()).toBe("gpt-4o-mini");
  });

  it("detects configured AI via Manus API key alone", () => {
    delete process.env.BUILT_IN_FORGE_API_URL;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    process.env.MANUS_API_KEY = "manus-test-key";
    expect(isAiConfigured()).toBe(true);
  });

  it("selects gemini model for Manus Forge host", () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.manus.ai";
    expect(resolveLlmChatModel()).toBe("gemini-3-flash-preview");
  });

  it("uses OPENAI_API_KEY for speech synthesis when Forge is Manus", () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.manus.ai";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.OPENAI_API_KEY = "sk-openai-tts";
    expect(isSpeechSynthesisConfigured()).toBe(true);
    expect(getSpeechSynthesisApiKey()).toBe("sk-openai-tts");
    expect(resolveSpeechSynthesisV1Url("audio/speech")).toBe(
      "https://api.openai.com/v1/audio/speech",
    );
  });

  it("reports speech synthesis unavailable for Manus Forge without OPENAI_API_KEY", () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.manus.ai";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    delete process.env.OPENAI_API_KEY;
    expect(isSpeechSynthesisConfigured()).toBe(false);
    expect(() => resolveSpeechSynthesisV1Url("audio/speech")).toThrow(/OPENAI_API_KEY/);
  });
});
