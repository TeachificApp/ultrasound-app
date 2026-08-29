import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { stripHtml } from "@/lib/utils";
import type { QuizTtsVoiceId } from "@shared/quizVoiceOptions";

const audioCache = new Map<string, string>();

function cacheKey(text: string, voice: QuizTtsVoiceId) {
  return `${voice}::${text.trim().toLowerCase()}`;
}

export function useQuizReadAloud(enabled: boolean, voice: QuizTtsVoiceId) {
  const synth = trpc.quizVoice.synthesize.useMutation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (rawText: string): Promise<void> => {
      if (!enabled) return;
      const text = stripHtml(rawText).replace(/\s+/g, " ").trim();
      if (!text) return;

      stop();
      setSpeaking(true);

      try {
        let src = audioCache.get(cacheKey(text, voice));
        if (!src) {
          const result = await synth.mutateAsync({ text, voice });
          src = `data:${result.mimeType};base64,${result.audioBase64}`;
          audioCache.set(cacheKey(text, voice), src);
        }

        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(src);
          audioRef.current = audio;
          audio.onended = () => {
            setSpeaking(false);
            audioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            setSpeaking(false);
            audioRef.current = null;
            reject(new Error("Audio playback failed"));
          };
          void audio.play().catch(reject);
        });
      } catch {
        setSpeaking(false);
      }
    },
    [enabled, voice, stop, synth],
  );

  const speakQuestionBundle = useCallback(
    async (question: string, options: string[], feedback?: string) => {
      if (!enabled) return;
      await speak(question);
      for (let i = 0; i < options.length; i++) {
        const letter = String.fromCharCode(65 + i);
        await speak(`Option ${letter}. ${options[i]}`);
      }
      if (feedback?.trim()) {
        await speak(feedback);
      }
    },
    [enabled, speak],
  );

  return { speak, speakQuestionBundle, stop, speaking, isLoading: synth.isPending };
}
