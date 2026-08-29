import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  buildQuizVoiceSampleScript,
  type QuizTtsVoiceId,
} from "@shared/quizVoiceOptions";

const sampleCache = new Map<string, string>();

function sampleCacheKey(voice: QuizTtsVoiceId, quizTitle: string) {
  return `${voice}::${buildQuizVoiceSampleScript(voice, quizTitle)}`;
}

export function useQuizVoiceSample(quizTitle: string) {
  const synth = trpc.quizVoice.synthesize.useMutation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<QuizTtsVoiceId | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewingVoice(null);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const preview = useCallback(
    async (voice: QuizTtsVoiceId) => {
      stop();
      setPreviewingVoice(voice);
      const text = buildQuizVoiceSampleScript(voice, quizTitle);

      try {
        let src = sampleCache.get(sampleCacheKey(voice, quizTitle));
        if (!src) {
          const result = await synth.mutateAsync({ text, voice });
          src = `data:${result.mimeType};base64,${result.audioBase64}`;
          sampleCache.set(sampleCacheKey(voice, quizTitle), src);
        }

        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(src);
          audioRef.current = audio;
          audio.onended = () => {
            setPreviewingVoice(null);
            audioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            setPreviewingVoice(null);
            audioRef.current = null;
            reject(new Error("Audio playback failed"));
          };
          void audio.play().catch(reject);
        });
      } catch {
        setPreviewingVoice(null);
      }
    },
    [quizTitle, stop, synth],
  );

  return {
    preview,
    stop,
    previewingVoice,
    isLoading: synth.isPending,
  };
}
