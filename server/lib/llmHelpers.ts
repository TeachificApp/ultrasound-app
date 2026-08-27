import { TRPCError } from "@trpc/server";
import { extractAssistantText, invokeLLM } from "../_core/llm";
import { isAiConfigured } from "./openAiConfig";

export function assertAiConfigured(): void {
  if (!isAiConfigured()) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "AI service not configured. Set MANUS_API_KEY or BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY in Railway Variables.",
    });
  }
}

export async function invokeLlmJsonPrompt(prompt: string): Promise<string> {
  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
  });
  const text = extractAssistantText(response);
  if (!text) throw new Error("AI returned empty content");
  return text;
}

export async function invokeLlmTextPrompt(prompt: string): Promise<string> {
  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
  });
  const text = extractAssistantText(response);
  if (!text) throw new Error("AI returned empty content");
  return text;
}
