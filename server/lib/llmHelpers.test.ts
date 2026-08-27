import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("llmHelpers", () => {
  const savedManusKey = process.env.MANUS_API_KEY;

  afterEach(() => {
    if (savedManusKey === undefined) delete process.env.MANUS_API_KEY;
    else process.env.MANUS_API_KEY = savedManusKey;
    vi.resetModules();
  });

  it("routes JSON prompts through invokeLLM when Manus API key is configured", async () => {
    process.env.MANUS_API_KEY = "server-only-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, task_id: "task-json" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, task: { id: "task-json", status: "stopped" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        messages: [{
          type: "assistant_message",
          assistant_message: { content: '{"questions":[]}' },
        }],
      }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const { invokeLlmJsonPrompt } = await import("./llmHelpers");
    const text = await invokeLlmJsonPrompt('Return {"questions":[]}');
    expect(JSON.parse(text)).toEqual({ questions: [] });
  });

  it("uses gemini model on Forge when generating JSON prompts", async () => {
    const savedEnv: Record<string, string | undefined> = {};
    for (const key of ["MANUS_API_KEY", "BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"]) {
      savedEnv[key] = process.env[key];
    }
    delete process.env.MANUS_API_KEY;
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.manus.ai";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-test-key";

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "chatcmpl-test",
      created: 1,
      model: "gemini-2.5-flash",
      choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }],
    }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const { invokeLlmJsonPrompt } = await import("./llmHelpers");
    const text = await invokeLlmJsonPrompt('Return {"ok":true}');
    expect(JSON.parse(text)).toEqual({ ok: true });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe("gemini-2.5-flash");
    expect(fetchMock.mock.calls[0][0]).toBe("https://forge.manus.ai/v1/chat/completions");

    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
});

describe("aiConnection", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["MANUS_API_KEY", "BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"]) {
      savedEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  });

  it("reports unconfigured when no AI credentials exist", async () => {
    delete process.env.MANUS_API_KEY;
    delete process.env.BUILT_IN_FORGE_API_URL;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    const { verifyAiConnection } = await import("./aiConnection");
    await expect(verifyAiConnection()).resolves.toEqual({
      configured: false,
      backend: "none",
      connected: false,
    });
  });

  it("prefers Manus API v2 when MANUS_API_KEY is set", async () => {
    process.env.MANUS_API_KEY = "server-only-test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    const { verifyAiConnection } = await import("./aiConnection");
    await expect(verifyAiConnection()).resolves.toEqual({
      configured: true,
      backend: "manus-api-v2",
      connected: true,
    });
  });
});
