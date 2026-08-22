/**
 * Image generation — OpenAI DALL-E (Railway) or legacy Manus Forge ImageService.
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";
import { getOpenAiApiKey, isOpenAiBackend, openAiV1Url } from "../lib/openAiConfig";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

async function generateImageViaOpenAi(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (options.originalImages?.length) {
    console.warn(
      "[generateImage] originalImages editing is not supported with OpenAI DALL-E; using prompt-only generation"
    );
  }

  const response = await fetch(openAiV1Url("images/generations"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: options.prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const base64Data = result.data?.[0]?.b64_json;
  if (!base64Data) {
    throw new Error("OpenAI image generation returned no image data");
  }

  const buffer = Buffer.from(base64Data, "base64");
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );
  return { url };
}

async function generateImageViaForge(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || [],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    image: {
      b64Json: string;
      mimeType: string;
    };
  };
  const buffer = Buffer.from(result.image.b64Json, "base64");
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    result.image.mimeType
  );
  return { url };
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  if (isOpenAiBackend()) {
    return generateImageViaOpenAi(options);
  }
  return generateImageViaForge(options);
}
