import { ENV } from "../_core/env";
import { verifyManusApiConnection } from "./manusApiClient";
import { isAiConfigured, resolveForgeApiKey, resolveForgeApiUrl, verifyForgeChatConnection } from "./openAiConfig";

export type AiConnectionStatus = {
  configured: boolean;
  backend: "manus-api-v2" | "forge-chat" | "none";
  connected: boolean;
};

export async function verifyAiConnection(): Promise<AiConnectionStatus> {
  if (!isAiConfigured()) {
    return { configured: false, backend: "none", connected: false };
  }

  if (resolveForgeApiKey() && resolveForgeApiUrl()) {
    await verifyForgeChatConnection();
    return { configured: true, backend: "forge-chat", connected: true };
  }

  if (ENV.manusApiKey) {
    await verifyManusApiConnection();
    return { configured: true, backend: "manus-api-v2", connected: true };
  }

  return { configured: false, backend: "none", connected: false };
}
