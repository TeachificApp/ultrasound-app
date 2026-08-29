const URL_ENV_KEYS = [
  "BUILT_IN_FORGE_API_URL",
  "OPENAI_BASE_URL",
  "OPENAI_API_BASE",
  "FORGE_API_URL",
] as const;

const KEY_ENV_KEYS = [
  "BUILT_IN_FORGE_API_KEY",
  "OPENAI_API_KEY",
  "FORGE_API_KEY",
] as const;

function normalizeApiRoot(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) {
    return trimmed.slice(0, -3);
  }
  return trimmed;
}

/** First non-empty AI API key from supported Railway / Manus secret names. */
export function resolveForgeApiKey(): string | undefined {
  for (const key of KEY_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** First non-empty AI API base URL, with OpenAI default when OPENAI_API_KEY is set alone. */
export function resolveForgeApiUrl(): string | undefined {
  for (const key of URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return normalizeApiRoot(value);
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return "https://api.openai.com";
  }

  return undefined;
}

export function getOpenAiApiKey(): string {
  const key = resolveForgeApiKey();
  if (!key) {
    throw new Error(
      "AI API key is not configured. Set BUILT_IN_FORGE_API_KEY or OPENAI_API_KEY in Railway Variables.",
    );
  }
  return key;
}

/** Normalize configured API root (https://api.openai.com or Manus Forge host). */
export function getOpenAiApiRoot(): string {
  const raw = resolveForgeApiUrl();
  if (!raw) {
    throw new Error(
      "AI API URL is not configured. Set BUILT_IN_FORGE_API_URL (e.g. https://api.openai.com) or OPENAI_API_KEY.",
    );
  }
  return raw;
}

export function isOpenAiBackend(): boolean {
  try {
    const host = new URL(getOpenAiApiRoot()).hostname;
    return host === "api.openai.com" || host.endsWith(".openai.azure.com");
  } catch {
    return false;
  }
}

export function openAiV1Url(path: string): string {
  const segment = path.replace(/^\/+/, "").replace(/^v1\//, "");
  return `${getOpenAiApiRoot()}/v1/${segment}`;
}

/** Pick a chat model compatible with the configured backend. */
export function resolveLlmChatModel(explicitModel?: string): string {
  if (explicitModel?.trim()) return explicitModel.trim();
  return isOpenAiBackend() ? "gpt-4o-mini" : "gemini-2.5-flash";
}

export function resolveLlmChatCompletionsUrl(): string {
  if (isOpenAiBackend()) {
    return openAiV1Url("chat/completions");
  }
  const root = getOpenAiApiRoot();
  return `${root.replace(/\/$/, "")}/v1/chat/completions`;
}

export function aiConfigHelpText(): string {
  return `Accepted env vars — URL: ${URL_ENV_KEYS.join(", ")}; Key: ${KEY_ENV_KEYS.join(", ")}; or MANUS_API_KEY for Manus API v2 tasks`;
}

/** True when Manus API v2 or Forge/OpenAI chat credentials are configured. */
export function isAiConfigured(): boolean {
  if (process.env.MANUS_API_KEY?.trim()) return true;
  return !!(resolveForgeApiKey() && resolveForgeApiUrl());
}

/** Lightweight Forge/OpenAI chat check — does not create Manus tasks. */
export async function verifyForgeChatConnection(): Promise<boolean> {
  const response = await fetch(resolveLlmChatCompletionsUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify({
      model: resolveLlmChatModel(),
      messages: [{ role: "user", content: "Reply with the single word OK." }],
      max_tokens: 8,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Forge chat verification failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }
  return true;
}
