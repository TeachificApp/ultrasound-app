import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { synthesizeSpeech } from "../_core/voiceGeneration";
import { isSpeechSynthesisConfigured } from "../lib/openAiConfig";
import { QUIZ_TTS_VOICE_IDS } from "../../shared/quizVoiceOptions";

export const quizVoiceRouter = router({
  /** Whether server-side Manus/OpenAI TTS is configured for quiz read-aloud. */
  getAvailability: protectedProcedure.query(() => ({
    configured: isSpeechSynthesisConfigured(),
  })),

  /** Synthesize quiz read-aloud audio for native quizzes (client-side playback). */
  synthesize: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(4096),
        voice: z.enum(QUIZ_TTS_VOICE_IDS),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const audio = await synthesizeSpeech({ text: input.text, voice: input.voice });
        return {
          audioBase64: audio.toString("base64"),
          mimeType: "audio/mpeg" as const,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Speech synthesis failed";
        if (message.includes("not configured")) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
});
