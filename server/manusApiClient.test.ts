import { afterEach, describe, expect, it, vi } from "vitest";

describe("Railway Manus API client", () => {
  const savedKey = process.env.MANUS_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (savedKey === undefined) delete process.env.MANUS_API_KEY;
    else process.env.MANUS_API_KEY = savedKey;
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
  });
});
