import { ENV } from "../_core/env";

type ManusApiEnvelope = {
  ok: boolean;
  request_id?: string;
  error?: { code?: string; message?: string };
};

export type ManusTaskCreateResponse = ManusApiEnvelope & {
  task_id?: string;
  task_title?: string;
  task_url?: string;
};

export type ManusTaskStatus = "running" | "stopped" | "waiting" | "error";

export type ManusTaskDetailResponse = ManusApiEnvelope & {
  task?: { id: string; status: ManusTaskStatus; task_url?: string };
};

export type ManusTaskMessageResponse = ManusApiEnvelope & {
  messages?: Array<{
    type: string;
    assistant_message?: { content?: string };
    error_message?: { content?: string };
    status_update?: { agent_status?: ManusTaskStatus; status_detail?: { waiting_description?: string } };
    structured_output_result?: { success: boolean; value: unknown; error: string | null };
  }>;
};

export type ManusStructuredSchema = Record<string, unknown>;

const DEFAULT_BASE_URL = "https://api.manus.ai";
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 240_000;

function getConfig() {
  const apiKey = ENV.manusApiKey;
  if (!apiKey) throw new Error("MANUS_API_KEY is not configured on the Railway server");
  return {
    apiKey,
    baseUrl: (ENV.manusApiBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

function summarizeError(status: number, payload: unknown): string {
  const message = typeof payload === "object" && payload && "error" in payload
    ? String((payload as { error?: { message?: unknown } }).error?.message || "")
    : "";
  return message ? `Manus API request failed (${status}): ${message}` : `Manus API request failed (${status})`;
}

async function apiRequest<T extends ManusApiEnvelope>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey, baseUrl } = getConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-manus-api-key": apiKey,
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(summarizeError(response.status, payload));
  return payload as T;
}

export async function verifyManusApiConnection(): Promise<boolean> {
  await apiRequest<ManusApiEnvelope & { data?: unknown[] }>("/v2/task.list?limit=1");
  return true;
}

export async function createManusTask(input: {
  prompt: string;
  title?: string;
  structuredOutputSchema?: ManusStructuredSchema;
}): Promise<Required<Pick<ManusTaskCreateResponse, "task_id">> & ManusTaskCreateResponse> {
  const payload = {
    message: { content: input.prompt },
    title: input.title,
    locale: "en",
    interactive_mode: false,
    share_visibility: "private",
    ...(input.structuredOutputSchema ? { structured_output_schema: input.structuredOutputSchema } : {}),
  };
  const result = await apiRequest<ManusTaskCreateResponse>("/v2/task.create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.task_id) throw new Error("Manus API created a task without returning its task ID");
  return result as Required<Pick<ManusTaskCreateResponse, "task_id">> & ManusTaskCreateResponse;
}

export async function getManusTaskDetail(taskId: string): Promise<ManusTaskDetailResponse> {
  return apiRequest<ManusTaskDetailResponse>(`/v2/task.detail?task_id=${encodeURIComponent(taskId)}`);
}

export async function getManusTaskMessages(taskId: string): Promise<ManusTaskMessageResponse> {
  return apiRequest<ManusTaskMessageResponse>(`/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=asc&limit=100`);
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitForManusTask(
  taskId: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<{ structuredOutput?: unknown; assistantText?: string }> {
  const timeoutMs = options.timeoutMs ?? ENV.manusApiTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const detail = await getManusTaskDetail(taskId);
    const status = detail.task?.status;
    if (status === "running") {
      await pause(pollIntervalMs);
      continue;
    }
    const messages = await getManusTaskMessages(taskId);
    const structured = messages.messages?.find((message) => message.type === "structured_output_result")?.structured_output_result;
    if (structured) {
      if (!structured.success) throw new Error(`Manus structured output failed: ${structured.error || "unknown extraction error"}`);
      return { structuredOutput: structured.value };
    }
    if (status === "waiting") {
      const waiting = messages.messages?.find((message) => message.type === "status_update")?.status_update?.status_detail?.waiting_description;
      throw new Error(`Manus task requires user input or confirmation${waiting ? `: ${waiting}` : ""}`);
    }
    if (status === "error") {
      const error = messages.messages?.find((message) => message.type === "error_message")?.error_message?.content;
      throw new Error(`Manus task failed${error ? `: ${error}` : ""}`);
    }
    const assistantMessages = messages.messages?.filter((message) => message.type === "assistant_message") ?? [];
    const lastText = assistantMessages.at(-1)?.assistant_message?.content;
    if (status === "stopped" && lastText) return { assistantText: lastText };
    if (status === "stopped") throw new Error("Manus task completed without a usable result");
    await pause(pollIntervalMs);
  }
  throw new Error("Manus task timed out while the Railway request was waiting for completion");
}
