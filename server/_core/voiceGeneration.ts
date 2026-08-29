/**
 * Text-to-speech via OpenAI audio/speech (Railway) or compatible API root.
 */
import { getOpenAiApiKey, openAiV1Url } from "../lib/openAiConfig";
import type { QuizTtsVoiceId } from "../../shared/quizVoiceOptions";

export type SynthesizeSpeechOptions = {
  text: string;
  voice: QuizTtsVoiceId;
};

export async function synthesizeSpeech(options: SynthesizeSpeechOptions): Promise<Buffer> {
  const input = options.text.trim();
  if (!input) {
    throw new Error("Cannot synthesize empty text");
  }

  const response = await fetch(openAiV1Url("audio/speech"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      input: input.slice(0, 4096),
      voice: options.voice,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI speech synthesis failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
