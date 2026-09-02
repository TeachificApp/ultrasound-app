import { Plus, Tags, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ImageLabelChoice, ImageLabelingData, ImageLabelTarget } from "../../types/quiz";

interface Props {
  data: ImageLabelingData;
  image?: { url: string; alt: string } | null;
  onChange: (data: ImageLabelingData) => void;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export function ImageLabelingEditor({ data, image, onChange }: Props) {
  const updateLabel = (id: string, text: string) => onChange({
    ...data,
    labels: data.labels.map((label) => label.id === id ? { ...label, text } : label),
  });
  const addLabel = () => onChange({
    ...data,
    labels: [...data.labels, { id: uuidv4(), text: `Label ${data.labels.length + 1}` }],
  });
  const removeLabel = (id: string) => onChange({
    ...data,
    labels: data.labels.filter((label) => label.id !== id),
    targets: data.targets.map((target) => target.labelId === id ? { ...target, labelId: "" } : target),
  });
  const updateTarget = (id: string, updates: Partial<ImageLabelTarget>) => onChange({
    ...data,
    targets: data.targets.map((target) => {
      if (target.id === id) return { ...target, ...updates };
      // A supplied label can be correct for one blank target only.
      if (updates.labelId && target.labelId === updates.labelId) return { ...target, labelId: "" };
      return target;
    }),
  });
  const removeTarget = (id: string) => onChange({ ...data, targets: data.targets.filter((target) => target.id !== id) });
  const addTargetAt = (x = 50, y = 50) => onChange({
    ...data,
    targets: [...data.targets, { id: uuidv4(), x: clampPercent(x), y: clampPercent(y), labelId: "" }],
  });

  return (
    <section className="space-y-4 rounded-2xl border border-teal-100 bg-teal-50/40 p-4" aria-label="Image-labeling question setup">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white"><Tags className="h-4 w-4" aria-hidden="true" /></div>
        <div>
          <h3 className="text-sm font-semibold text-teal-950">Image labeling</h3>
          <p className="mt-0.5 text-xs leading-5 text-teal-800">Add the image above, create the label choices, then click the image to place each blank label target. Learners select the correct label at each target.</p>
        </div>
      </div>

      {!image?.url ? (
        <div className="rounded-xl border border-dashed border-teal-300 bg-white px-4 py-5 text-sm text-teal-900">
          Add a question image using the <strong>Image</strong> control above before placing label targets.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">1. Place label targets</p>
          <div className="relative overflow-hidden rounded-xl border border-teal-200 bg-white">
            <img
              src={image.url}
              alt={image.alt || "Question image for label placement"}
              className="block max-h-[32rem] w-full cursor-crosshair object-contain"
              onClick={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                addTargetAt(((event.clientX - bounds.left) / bounds.width) * 100, ((event.clientY - bounds.top) / bounds.height) * 100);
              }}
            />
            {data.targets.map((target, index) => (
              <div key={target.id} className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-xs font-bold text-white shadow" style={{ left: `${target.x}%`, top: `${target.y}%` }} aria-hidden="true">{index + 1}</div>
            ))}
          </div>
          <button type="button" onClick={() => addTargetAt()} className="rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100">Add target at image center</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-teal-100 bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-teal-800">2. Available labels</p><button type="button" onClick={addLabel} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900"><Plus className="h-3.5 w-3.5" /> Add label</button></div>
          <div className="space-y-2">
            {data.labels.map((label, index) => (
              <div key={label.id} className="flex items-center gap-2"><span className="w-5 text-right text-xs font-semibold text-teal-700">{index + 1}</span><input value={label.text} onChange={(event) => updateLabel(label.id, event.target.value)} aria-label={`Label ${index + 1} text`} className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none" /><button type="button" onClick={() => removeLabel(label.id)} disabled={data.labels.length <= 1} className="rounded p-1 text-gray-400 hover:text-red-600 disabled:opacity-30" aria-label={`Remove label ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button></div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-teal-100 bg-white p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-teal-800">3. Connect each target to its correct label</p>
          {data.targets.length === 0 ? <p className="text-sm text-gray-500">Click the image above to add a target.</p> : <div className="space-y-2">{data.targets.map((target, index) => (
            <div key={target.id} className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem_3.5rem_auto] items-center gap-2 rounded-lg border border-gray-100 p-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">{index + 1}</span>
              <select value={target.labelId} onChange={(event) => updateTarget(target.id, { labelId: event.target.value })} aria-label={`Correct label for target ${index + 1}`} className="min-w-0 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none"><option value="">Choose label</option>{data.labels.map((label) => <option key={label.id} value={label.id}>{label.text || "Untitled label"}</option>)}</select>
              <input type="number" min="0" max="100" value={Math.round(target.x)} onChange={(event) => updateTarget(target.id, { x: clampPercent(Number(event.target.value)) })} aria-label={`Target ${index + 1} horizontal position`} className="w-full rounded-md border border-gray-200 px-1 py-1.5 text-center text-xs" title="Horizontal position (%)" />
              <input type="number" min="0" max="100" value={Math.round(target.y)} onChange={(event) => updateTarget(target.id, { y: clampPercent(Number(event.target.value)) })} aria-label={`Target ${index + 1} vertical position`} className="w-full rounded-md border border-gray-200 px-1 py-1.5 text-center text-xs" title="Vertical position (%)" />
              <button type="button" onClick={() => removeTarget(target.id)} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label={`Remove target ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}</div>}
          <p className="mt-3 text-[11px] leading-4 text-gray-500">Position fields use percentages from the left and top edges of the image. Give each target a different correct label.</p>
        </div>
      </div>
    </section>
  );
}
