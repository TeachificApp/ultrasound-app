import type { ImageLabelingData } from "../types/quiz";
import type { ImageLabelingAnswer } from "@shared/imageLabeling";

interface Props {
  data: ImageLabelingData;
  imageUrl?: string | null;
  imageAlt?: string | null;
  answer?: ImageLabelingAnswer;
  onChange: (answer: ImageLabelingAnswer) => void;
  disabled?: boolean;
}

export function ImageLabelingInteraction({ data, imageUrl, imageAlt, answer = {}, onChange, disabled = false }: Props) {
  if (!imageUrl) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">This image-labeling question is missing its image.</p>;
  }
  if (data.targets.length === 0 || data.labels.length === 0) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">This image-labeling question needs at least one label and one image target.</p>;
  }

  const updateAnswer = (targetId: string, labelId: string) => onChange({ ...answer, [targetId]: labelId });

  return (
    <section className="space-y-3" aria-label="Image-labeling response">
      <p className="text-sm leading-5 opacity-80">Select the correct label for each numbered blank beside the image.</p>
      <div className="relative overflow-hidden rounded-xl border border-white/30 bg-white/10">
        <img src={imageUrl} alt={imageAlt || "Image for labeling"} className="block max-h-[34rem] w-full object-contain" />
        {data.targets.map((target, index) => {
          const positionOnRight = target.x > 59;
          const labelsUsedAtOtherTargets = new Set(
            Object.entries(answer)
              .filter(([targetId]) => targetId !== target.id)
              .map(([, labelId]) => labelId),
          );
          return (
            <label
              key={target.id}
              className="absolute flex max-w-[12rem] items-center gap-1.5"
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
                transform: positionOnRight ? "translate(-100%, -50%)" : "translate(0, -50%)",
              }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-teal-500 bg-white text-xs font-bold text-teal-800 shadow" aria-hidden="true">{index + 1}</span>
              <span className="sr-only">Label for image target {index + 1}</span>
              <select
                value={answer[target.id] ?? ""}
                onChange={(event) => updateAnswer(target.id, event.target.value)}
                disabled={disabled}
                className="min-w-0 max-w-[9.5rem] rounded-md border border-teal-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="">Choose label</option>
                {data.labels.map((label) => <option key={label.id} value={label.id} disabled={labelsUsedAtOtherTargets.has(label.id)}>{label.text || "Untitled label"}</option>)}
              </select>
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Available labels">
        {data.labels.map((label) => <span key={label.id} className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900">{label.text || "Untitled label"}</span>)}
      </div>
    </section>
  );
}
