import { useCallback, useEffect, useRef, useState } from "react";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  shouldUseBrowserSpeechFallback,
  speakWithBrowser,
} from "@/lib/quizVoiceBrowserFallback";
import {
  buildQuizVoiceSampleScript,
  type QuizTtsVoiceId,
} from "@shared/quizVoiceOptions";

const sampleCache = new Map<string, string>();

function sampleCacheKey(voice: QuizTtsVoiceId, quizTitle: string) {
  return `${voice}::${buildQuizVoiceSampleScript(voice, quizTitle)}`;
}

function sampleErrorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Could not play the voice sample.";
}

export function useQuizVoiceSample(quizTitle: string) {
  const synth = trpc.quizVoice.synthesize.useMutation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<QuizTtsVoiceId | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPreviewingVoice(null);
    setIsPreviewLoading(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const preview = useCallback(
    async (voice: QuizTtsVoiceId) => {
      stop();
      setPreviewingVoice(voice);
      setIsPreviewLoading(true);
      const text = buildQuizVoiceSampleScript(voice, quizTitle);

      try {
        let src = sampleCache.get(sampleCacheKey(voice, quizTitle));
        if (!src) {
          const result = await synth.mutateAsync({ text, voice });
          if (!result.audioBase64?.trim()) {
            throw new Error("Speech synthesis returned empty audio.");
          }
          src = `data:${result.mimeType};base64,${result.audioBase64}`;
          sampleCache.set(sampleCacheKey(voice, quizTitle), src);
        }

        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(src);
          audioRef.current = audio;
          audio.onended = () => {
            setPreviewingVoice(null);
            setIsPreviewLoading(false);
            audioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            setPreviewingVoice(null);
            setIsPreviewLoading(false);
            audioRef.current = null;
            reject(new Error("Audio playback failed"));
          };
          void audio.play().catch(reject);
        });
      } catch (error) {
        if (shouldUseBrowserSpeechFallback(error)) {
          try {
            await speakWithBrowser(text);
            toast.message("Using browser voice preview", {
              description: "Add OPENAI_API_KEY on Railway for Manus AI voice samples.",
            });
            setPreviewingVoice(null);
            setIsPreviewLoading(false);
            return;
          } catch {
            /* fall through */
          }
        }
        toast.error(sampleErrorMessage(error));
        setPreviewingVoice(null);
        setIsPreviewLoading(false);
      }
    },
    [quizTitle, stop, synth],
  );

  return {
    preview,
    stop,
    previewingVoice,
    isLoading: isPreviewLoading || synth.isPending,
  };
}
