const URL_ENV_KEYS = [
  "BUILT_IN_FORGE_API_URL",
  "OPENAI_BASE_URL",
  "OPENAI_API_BASE",
  "OPENAI_API_URL",
  "FORGE_API_URL",
] as const;

const KEY_ENV_KEYS = [
  "BUILT_IN_FORGE_API_KEY",
  "OPENAI_API_KEY",
  "FORGE_API_KEY",
  "OPENAI_KEY",
  "OPENAI_SECRET_KEY",
  "OPENAI_SECRET",
  "AI_API_KEY",
  "LLM_API_KEY",
] as const;

/** Env var names that look like AI/LLM credentials (for diagnostics + fallback discovery). */
const DISCOVER_KEY_NAME =
  /^(BUILT_IN_FORGE|OPENAI|FORGE|AI|LLM)[_A-Z0-9]*(KEY|SECRET|TOKEN|API_KEY)$/i;

export type AiEnvKeyStatus = {
  present: boolean;
  prefix?: string;
};

export type AiEnvDiagnostics = {
  configured: boolean;
  resolvedKeyFrom: string | null;
  urlConfigured: boolean;
  resolvedUrlFrom: string | null;
  isOpenAiBackend: boolean;
  checkedKeys: Record<string, AiEnvKeyStatus>;
  discoveredKeyNames: string[];
  help: string;
};

function normalizeApiRoot(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) {
    return trimmed.slice(0, -3);
  }
  return trimmed;
}

function keyPrefix(value: string): string {
  return value.length <= 10 ? `${value.slice(0, 3)}…` : value.slice(0, 10);
}

/** True for OpenAI-style keys (sk-…), excluding Stripe secret keys (sk_test_/sk_live_). */
export function looksLikeOpenAiKey(value: string): boolean {
  const trimmed = value.trim();
  if (/^sk_(test|live)_/i.test(trimmed)) return false;
  return /^sk-[a-zA-Z0-9_-]{8,}/.test(trimmed);
}

function discoverAiApiKeyFromEnv(): { name: string; value: string } | undefined {
  for (const [name, raw] of Object.entries(process.env)) {
    const value = raw?.trim();
    if (!value) continue;
    if (KEY_ENV_KEYS.includes(name as (typeof KEY_ENV_KEYS)[number])) continue;
    if (!DISCOVER_KEY_NAME.test(name)) continue;
    return { name, value };
  }
  return undefined;
}

function discoverAiApiUrlFromEnv(): { name: string; value: string } | undefined {
  for (const [name, raw] of Object.entries(process.env)) {
    const value = raw?.trim();
    if (!value) continue;
    if (URL_ENV_KEYS.includes(name as (typeof URL_ENV_KEYS)[number])) continue;
    if (!/^(BUILT_IN_FORGE|OPENAI|FORGE|AI|LLM)[_A-Z0-9]*(URL|BASE|ENDPOINT|HOST)$/i.test(name)) {
      continue;
    }
    return { name, value };
  }
  return undefined;
}

/** First non-empty AI API key from supported Railway / Manus secret names. */
export function resolveForgeApiKey(): string | undefined {
  for (const key of KEY_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return discoverAiApiKeyFromEnv()?.value;
}

/** Which env var supplied the resolved API key (for diagnostics). */
export function resolveForgeApiKeySource(): string | null {
  for (const key of KEY_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return key;
  }
  return discoverAiApiKeyFromEnv()?.name ?? null;
}

/** First non-empty AI API base URL, with OpenAI default when an OpenAI key is set alone. */
export function resolveForgeApiUrl(): string | undefined {
  for (const key of URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return normalizeApiRoot(value);
  }

  const discovered = discoverAiApiUrlFromEnv();
  if (discovered) return normalizeApiRoot(discovered.value);

  const apiKey = resolveForgeApiKey();
  if (apiKey && looksLikeOpenAiKey(apiKey)) {
    return "https://api.openai.com";
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return "https://api.openai.com";
  }

  return undefined;
}

export function resolveForgeApiUrlSource(): string | null {
  for (const key of URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return key;
  }
  const discovered = discoverAiApiUrlFromEnv();
  if (discovered) return discovered.name;

  const apiKey = resolveForgeApiKey();
  if (apiKey && looksLikeOpenAiKey(apiKey)) {
    return "(default: https://api.openai.com from OpenAI key)";
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return "(default: https://api.openai.com from OPENAI_API_KEY)";
  }

  return null;
}

export function getAiEnvDiagnostics(): AiEnvDiagnostics {
  const checkedKeys: Record<string, AiEnvKeyStatus> = {};
  for (const key of KEY_ENV_KEYS) {
    const value = process.env[key]?.trim();
    checkedKeys[key] = value
      ? { present: true, prefix: keyPrefix(value) }
      : { present: false };
  }

  const discoveredKeyNames = Object.keys(process.env).filter(name => {
    const value = process.env[name]?.trim();
    if (!value) return false;
    if (KEY_ENV_KEYS.includes(name as (typeof KEY_ENV_KEYS)[number])) return false;
    return DISCOVER_KEY_NAME.test(name);
  });

  for (const name of discoveredKeyNames) {
    const value = process.env[name]?.trim();
    if (value && !checkedKeys[name]) {
      checkedKeys[name] = { present: true, prefix: keyPrefix(value) };
    }
  }

  const resolvedKeyFrom = resolveForgeApiKeySource();
  const resolvedUrlFrom = resolveForgeApiUrlSource();
  const configured = !!resolveForgeApiKey();
  const urlConfigured = !!resolveForgeApiUrl();

  let isOpenAi = false;
  if (urlConfigured) {
    try {
      isOpenAi = isOpenAiBackend();
    } catch {
      isOpenAi = false;
    }
  }

  return {
    configured,
    resolvedKeyFrom,
    urlConfigured,
    resolvedUrlFrom,
    isOpenAiBackend: isOpenAi,
    checkedKeys,
    discoveredKeyNames,
    help: aiConfigHelpText(),
  };
}

export function getOpenAiApiKey(): string {
  const key = resolveForgeApiKey();
  if (!key) {
    throw new Error(
      "AI API key is not configured. Set OPENAI_API_KEY or BUILT_IN_FORGE_API_KEY in Railway Variables (service must be redeployed after adding). Check /api/debug/ai-status for what the server sees.",
    );
  }
  return key;
}

/** Normalize configured API root (https://api.openai.com or Manus Forge host). */
export function getOpenAiApiRoot(): string {
  const raw = resolveForgeApiUrl();
  if (!raw) {
    throw new Error(
      "AI API URL is not configured. Set BUILT_IN_FORGE_API_URL (e.g. https://api.openai.com) or OPENAI_API_KEY. Check /api/debug/ai-status.",
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
  return `Accepted env vars — URL: ${URL_ENV_KEYS.join(", ")}; Key: ${KEY_ENV_KEYS.join(", ")} (plus any OPENAI/AI/LLM*KEY name)`;
}
