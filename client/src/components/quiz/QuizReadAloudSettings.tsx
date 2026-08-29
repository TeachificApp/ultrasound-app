import {
  QUIZ_TTS_VOICES,
  DEFAULT_QUIZ_TTS_VOICE,
  getQuizVoiceLabel,
  type QuizTtsVoiceId,
} from "@shared/quizVoiceOptions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Volume2, Play, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuizVoiceSample } from "@/hooks/useQuizVoiceSample";
import { trpc } from "@/lib/trpc";

type Props = {
  enabled: boolean;
  voice: QuizTtsVoiceId;
  quizTitle: string;
  onEnabledChange: (enabled: boolean) => void;
  onVoiceChange: (voice: QuizTtsVoiceId) => void;
  className?: string;
  compact?: boolean;
};

/** Read-aloud settings shown at native quiz start (not mock exams). */
export function QuizReadAloudSettings({
  enabled,
  voice,
  quizTitle,
  onEnabledChange,
  onVoiceChange,
  className = "",
  compact = false,
}: Props) {
  const { preview, previewingVoice, isLoading } = useQuizVoiceSample(quizTitle);
  const { data: availability } = trpc.quizVoice.getAvailability.useQuery(undefined, {
    enabled,
  });

  return (
    <div className={cn("rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Volume2 className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
          <div>
            <Label htmlFor="quiz-read-aloud" className="text-sm font-medium text-gray-900">
              Read questions aloud
            </Label>
            {!compact && (
              <p className="text-xs text-gray-500 mt-0.5">
                Manus AI reads each question, answer choices, and feedback during the quiz.
              </p>
            )}
          </div>
        </div>
        <Switch id="quiz-read-aloud" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled ? (
        <div className="space-y-2">
          {availability?.configured === false ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Manus AI voices require <code className="font-mono">OPENAI_API_KEY</code> on Railway.
              Samples will use your browser voice until that is configured.
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-gray-600">Voice</Label>
            <span className="text-xs font-medium text-teal-700">
              Selected: {getQuizVoiceLabel(voice)}
            </span>
          </div>
          <div className="space-y-1.5" role="radiogroup" aria-label="Quiz read-aloud voice">
            {QUIZ_TTS_VOICES.map((option) => {
              const selected = voice === option.id;
              const previewing = previewingVoice === option.id;
              const busy = previewing && isLoading;

              return (
                <div
                  key={option.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border bg-white p-2 transition-colors",
                    selected ? "border-teal-500 ring-1 ring-teal-200" : "border-gray-200",
                  )}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onVoiceChange(option.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-50"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-teal-600 bg-teal-600 text-white" : "border-gray-300 bg-white",
                      )}
                    >
                      {selected ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-8 px-2.5 text-xs"
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void preview(option.id);
                    }}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5">Sample</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { DEFAULT_QUIZ_TTS_VOICE };
