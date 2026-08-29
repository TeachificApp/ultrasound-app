import { QUIZ_TTS_VOICES, DEFAULT_QUIZ_TTS_VOICE, type QuizTtsVoiceId } from "@shared/quizVoiceOptions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Volume2 } from "lucide-react";

type Props = {
  enabled: boolean;
  voice: QuizTtsVoiceId;
  onEnabledChange: (enabled: boolean) => void;
  onVoiceChange: (voice: QuizTtsVoiceId) => void;
  className?: string;
  compact?: boolean;
};

/** Read-aloud settings shown at native quiz start (not mock exams). */
export function QuizReadAloudSettings({
  enabled,
  voice,
  onEnabledChange,
  onVoiceChange,
  className = "",
  compact = false,
}: Props) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3 ${className}`}>
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
      {enabled && (
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Voice</Label>
          <Select value={voice} onValueChange={(v) => onVoiceChange(v as QuizTtsVoiceId)}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {QUIZ_TTS_VOICES.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_QUIZ_TTS_VOICE };
