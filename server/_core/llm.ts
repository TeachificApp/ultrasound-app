import { ENV } from "./env";
import { createManusTask, waitForManusTask, type ManusTaskContentPart } from "../lib/manusApiClient";
import {
  getOpenAiApiKey,
  isOpenAiBackend,
  resolveLlmChatCompletionsUrl,
  resolveLlmChatModel,
  resolveForgeApiKey,
  resolveForgeApiUrl,
} from "../lib/openAiConfig";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  /** Override default model when the selected direct chat backend supports it. */
  model?: string;
  /**
   * Select the non-interactive Forge chat API for an immediate response, or the
   * Manus task API only where an agent task is intentionally required.
   */
  transport?: "auto" | "forge" | "manus_task";
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const assertApiKey = () => {
  getOpenAiApiKey();
};

function serializeForManusTask(messages: Message[]): string {
  return messages.map((message) => {
    const content = ensureArray(message.content).map((part) => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      if (part.type === "image_url") return `Image reference: ${part.image_url.url}`;
      return `File reference: ${part.file_url.url}`;
    }).join("\n");
    return `${message.role.toUpperCase()}: ${content}`;
  }).join("\n\n");
}

function buildManusTaskContent(messages: Message[], prompt: string): string | ManusTaskContentPart[] {
  const files: ManusTaskContentPart[] = [];
  for (const message of messages) {
    for (const part of ensureArray(message.content)) {
      if (typeof part === "string" || part.type === "text") continue;
      if (part.type === "file_url") {
        files.push({
          type: "file",
          file_url: part.file_url.url,
          filename: "source.pdf",
          mime_type: part.file_url.mime_type,
        });
      } else if (part.type === "image_url") {
        files.push({
          type: "file",
          file_url: part.image_url.url,
          filename: "source-image",
        });
      }
    }
  }
  return files.length > 0 ? [{ type: "text", text: prompt }, ...files] : prompt;
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

async function invokeManusApi(params: InvokeParams): Promise<InvokeResult> {
  const responseFormat = normalizeResponseFormat(params);
  const structuredSchema = responseFormat?.type === "json_schema" ? responseFormat.json_schema.schema : undefined;
  const prompt = [
    "You are the AI service embedded in Ultrasound Clinical Intelligence. Follow the provided instructions exactly.",
    structuredSchema
      ? "Return the requested result through the required structured-output schema. Do not ask a follow-up question."
      : "Return the requested final answer directly. When the instructions request JSON, return valid JSON only with no Markdown fences.",
    serializeForManusTask(params.messages),
  ].join("\n\n");
  const created = await createManusTask({
    prompt,
    content: buildManusTaskContent(params.messages, prompt),
    structuredOutputSchema: structuredSchema,
  });
  const completed = await waitForManusTask(created.task_id);
  const content = completed.structuredOutput !== undefined
    ? JSON.stringify(completed.structuredOutput)
    : completed.assistantText ?? "";
  return {
    id: created.task_id,
    created: Math.floor(Date.now() / 1000),
    model: "manus-api-v2",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  };
}

export function extractAssistantText(result: InvokeResult): string {
  const content = result.choices[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part): part is TextContent => part.type === "text")
      .map((part) => part.text)
      .join("\n");
  }
  return "";
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const forgeConfigured = Boolean(resolveForgeApiKey() && resolveForgeApiUrl());
  const requestedTransport = params.transport ?? "auto";

  if (requestedTransport === "manus_task") {
    if (!ENV.manusApiKey) {
      throw new Error("MANUS_API_KEY is not configured for the requested Manus task transport");
    }
    return invokeManusApi(params);
  }

  if (requestedTransport === "forge" && !forgeConfigured) {
    throw new Error("Forge chat is not configured. Set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY in Railway Variables.");
  }

  if (requestedTransport === "auto" && ENV.manusApiKey && !forgeConfigured) {
    return invokeManusApi(params);
  }

  assertApiKey();

  const {
    messages,
    model,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    maxTokens,
    max_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    model: resolveLlmChatModel(model),
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  if (isOpenAiBackend()) {
    payload.max_tokens = max_tokens ?? maxTokens ?? 16384;
  } else {
    payload.max_tokens = max_tokens ?? maxTokens ?? 16384;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(resolveLlmChatCompletionsUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`[LLM] Forge chat request failed with HTTP ${response.status}`);
    throw new Error("AI generation is temporarily unavailable. Please retry in a moment.");
  }

  return (await response.json()) as InvokeResult;
}
