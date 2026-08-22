/** Normalize BUILT_IN_FORGE_API_URL to https://api.openai.com (strip trailing /v1). */
export function getOpenAiApiRoot(): string {
  const raw = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
  if (!raw) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (raw.endsWith("/v1")) {
    return raw.slice(0, -3);
  }
  return raw;
}

export function getOpenAiApiKey(): string {
  const key = process.env.BUILT_IN_FORGE_API_KEY;
  if (!key) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
  return key;
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
