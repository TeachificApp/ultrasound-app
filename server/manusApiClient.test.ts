import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Railway Manus API client", () => {
  const savedKey = process.env.MANUS_API_KEY;
  const forgeEnvKeys = [
    "BUILT_IN_FORGE_API_URL",
    "BUILT_IN_FORGE_API_KEY",
    "FORGE_API_URL",
    "FORGE_API_KEY",
    "VITE_FRONTEND_FORGE_API_URL",
    "VITE_FRONTEND_FORGE_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_API_BASE",
    "OPENAI_API_KEY",
  ] as const;
  const savedForgeEnv = Object.fromEntries(forgeEnvKeys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;

  beforeEach(() => {
    for (const key of forgeEnvKeys) delete process.env[key];
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.MANUS_API_KEY;
    else process.env.MANUS_API_KEY = savedKey;
    for (const key of forgeEnvKeys) {
      const value = savedForgeEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = originalFetch;
    vi.resetModules();
  });

  it("uses the server-only API key for a non-destructive connection check", async () => {
    process.env.MANUS_API_KEY = "server-only-test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    const { verifyManusApiConnection } = await import("./lib/manusApiClient");
    await expect(verifyManusApiConnection()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.manus.ai/v2/task.list?limit=1",
      expect.objectContaining({ headers: expect.objectContaining({ "x-manus-api-key": "server-only-test-key" }) }),
    );
  });

  it("does not fall back to managed Forge when a Manus API key is configured", async () => {
    process.env.MANUS_API_KEY = "server-only-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, task_id: "task123" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, task: { id: "task123", status: "stopped" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, messages: [{ type: "assistant_message", assistant_message: { content: "answer" } }] }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    const { invokeLLM } = await import("./_core/llm");
    const result = await invokeLLM({ messages: [{ role: "user", content: "Answer briefly" }] });
    expect(result.model).toBe("manus-api-v2");
    expect(result.choices[0].message.content).toBe("answer");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.manus.ai/v2/task.create");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(expect.objectContaining({
      interactive_mode: false,
      agent_profile: "manus-1.6-lite",
      message: expect.objectContaining({ connectors: [], enable_skills: [] }),
    }));
  });

  it("passes PDF sources to the Manus task as file attachments instead of URL-only prompt text", async () => {
    process.env.MANUS_API_KEY = "server-only-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, task_id: "task123" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, task: { id: "task123", status: "stopped" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, messages: [{ type: "assistant_message", assistant_message: { content: "answer" } }] }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    const { invokeLLM } = await import("./_core/llm");
    await invokeLLM({ messages: [{ role: "user", content: [{ type: "text", text: "Use this source" }, { type: "file_url", file_url: { url: "https://files.example/source.pdf", mime_type: "application/pdf" } }] }] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "text" }),
      expect.objectContaining({ type: "file", file_url: "https://files.example/source.pdf", mime_type: "application/pdf" }),
    ]));
  });

  it("automatically resumes one ordinary text question without confirming external actions", async () => {
    process.env.MANUS_API_KEY = "server-only-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        task: { id: "task123", status: "waiting" },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        messages: [{
          type: "status_update",
          status_update: {
            agent_status: "waiting",
            status_detail: { waiting_for_event_type: "messageAskUser", waiting_description: "Need a detail" },
          },
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, task_id: "task123" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        task: { id: "task123", status: "stopped" },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        messages: [{ type: "assistant_message", assistant_message: { content: "lesson" } }],
      }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    const { waitForManusTask } = await import("./lib/manusApiClient");

    await expect(waitForManusTask("task123", {
      pollIntervalMs: 0,
      autoResumeQuestion: true,
    })).resolves.toEqual({ assistantText: "lesson" });

    expect(fetchMock.mock.calls[2][0]).toBe("https://api.manus.ai/v2/task.sendMessage");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(expect.objectContaining({
      clear_connectors: true,
      message: expect.objectContaining({ connectors: [], enable_skills: [] }),
    }));
  });

  it("does not resume a confirmation or external-access waiting state", async () => {
    process.env.MANUS_API_KEY = "server-only-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        task: { id: "task123", status: "waiting" },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        messages: [{
          type: "status_update",
          status_update: {
            agent_status: "waiting",
            status_detail: { waiting_for_event_type: "needConnectMyBrowser", waiting_description: "Browser access" },
          },
        }],
      }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    const { waitForManusTask } = await import("./lib/manusApiClient");

    await expect(waitForManusTask("task123", {
      pollIntervalMs: 0,
      autoResumeQuestion: true,
    })).rejects.toThrow("Manus task requires user input or confirmation");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
