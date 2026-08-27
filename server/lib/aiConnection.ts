import { ENV } from "../_core/env";
import { verifyManusApiConnection } from "./manusApiClient";
import { isAiConfigured, verifyForgeChatConnection } from "./openAiConfig";

export type AiConnectionStatus = {
  configured: boolean;
  backend: "manus-api-v2" | "forge-chat" | "none";
  connected: boolean;
};

export async function verifyAiConnection(): Promise<AiConnectionStatus> {
  if (!isAiConfigured()) {
    return { configured: false, backend: "none", connected: false };
  }

  if (ENV.manusApiKey) {
    await verifyManusApiConnection();
    return { configured: true, backend: "manus-api-v2", connected: true };
  }

  await verifyForgeChatConnection();
  return { configured: true, backend: "forge-chat", connected: true };
}
