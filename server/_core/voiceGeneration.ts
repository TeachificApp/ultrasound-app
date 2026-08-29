/**
 * Text-to-speech via Manus AI (Forge audio/speech on Railway) or compatible API root.
 */
import { getSpeechSynthesisApiKey, resolveSpeechSynthesisV1Url } from "../lib/openAiConfig";
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

  const response = await fetch(resolveSpeechSynthesisV1Url("audio/speech"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getSpeechSynthesisApiKey()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      input: input.slice(0, 4096),
      voice: options.voice,
      instructions: "Speak in clear, warm United States English at a natural, unhurried conversational pace. Use brief pauses at sentence boundaries and articulate clinical terminology carefully.",
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Manus AI speech synthesis failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
