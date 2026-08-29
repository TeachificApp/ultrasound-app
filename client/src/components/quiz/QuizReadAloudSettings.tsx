import { getQuizVoiceLabel, type QuizTtsVoiceId } from "@shared/quizVoiceOptions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  enabled: boolean;
  voice: QuizTtsVoiceId;
  onEnabledChange: (enabled: boolean) => void;
  className?: string;
  compact?: boolean;
};

/** Read-aloud settings shown at native quiz start (not mock exams). */
export function QuizReadAloudSettings({
  enabled,
  voice,
  onEnabledChange,
  className = "",
  compact = false,
}: Props) {
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
                Hear each question, answer choice, and feedback using the course creator’s selected voice.
              </p>
            )}
          </div>
        </div>
        <Switch id="quiz-read-aloud" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled ? (
        <div className="rounded-md bg-white px-3 py-2 text-xs text-gray-600">
          Voice selected by the course creator: <span className="font-medium text-teal-700">{getQuizVoiceLabel(voice)}</span>
        </div>
      ) : null}
    </div>
  );
}
