import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("voiceGeneration speech routing", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY", "OPENAI_API_KEY"]) {
      saved[key] = process.env[key];
    }
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.manus.ai";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.OPENAI_API_KEY = "sk-openai-tts";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("calls OpenAI TTS with the requested voice id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { synthesizeSpeech } = await import("../server/_core/voiceGeneration");
    await synthesizeSpeech({ text: "Hello", voice: "nova" });
    await synthesizeSpeech({ text: "Hello", voice: "onyx" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.openai.com/v1/audio/speech",
      expect.objectContaining({
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          input: "Hello",
          voice: "nova",
          instructions: "Speak in clear, warm United States English at a natural, unhurried conversational pace. Use brief pauses at sentence boundaries and articulate clinical terminology carefully.",
          response_format: "mp3",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.openai.com/v1/audio/speech",
      expect.objectContaining({
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          input: "Hello",
          voice: "onyx",
          instructions: "Speak in clear, warm United States English at a natural, unhurried conversational pace. Use brief pauses at sentence boundaries and articulate clinical terminology carefully.",
          response_format: "mp3",
        }),
      }),
    );
  });
});
