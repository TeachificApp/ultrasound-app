import { v4 as uuidv4 } from "uuid";
import type {
  OrderingData,
  DragDropData,
  DragWordsData,
  DropdownData,
  NumericData,
  LikertData,
  EssayData,
  QuestionData,
} from "../../types/quiz";
import { GripVertical, Plus, Trash2, Upload } from "lucide-react";

// ─── Ordering Editor ─────────────────────────────────────────────────────────

export function OrderingEditor({ data, onChange }: { data: OrderingData; onChange: (d: QuestionData) => void }) {
  const addItem = () => {
    onChange({ ...data, items: [...data.items, { id: uuidv4(), text: "" }] });
  };
  const removeItem = (id: string) => {
    onChange({ ...data, items: data.items.filter((i) => i.id !== id) });
  };
  const updateItem = (id: string, text: string) => {
    onChange({ ...data, items: data.items.map((i) => (i.id === id ? { ...i, text } : i)) });
  };
  const moveItem = (fromIdx: number, toIdx: number) => {
    const items = [...data.items];
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    onChange({ ...data, items });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Arrange items in the <strong>correct order</strong> below. The player will shuffle them for the learner.
      </p>
      {data.items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2 group">
          <div className="flex flex-col gap-0.5">
            {idx > 0 && (
              <button onClick={() => moveItem(idx, idx - 1)} className="text-gray-300 hover:text-gray-600 text-xs">▲</button>
            )}
            {idx < data.items.length - 1 && (
              <button onClick={() => moveItem(idx, idx + 1)} className="text-gray-300 hover:text-gray-600 text-xs">▼</button>
            )}
          </div>
          <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">
            {idx + 1}
          </span>
          <input
            value={item.text}
            onChange={(e) => updateItem(item.id, e.target.value)}
            placeholder={`Item ${idx + 1}`}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          />
          <button
            onClick={() => removeItem(item.id)}
            className="p-1.5 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button onClick={addItem} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700">
        <Plus className="w-3.5 h-3.5" /> Add Item
      </button>
    </div>
  );
}

// ─── Drag & Drop Editor ──────────────────────────────────────────────────────

export function DragDropEditor({ data, onChange }: { data: DragDropData; onChange: (d: QuestionData) => void }) {
  const uploadBg = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onChange({ ...data, backgroundImageUrl: reader.result as string });
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const addTarget = () => {
    onChange({
      ...data,
      targets: [...data.targets, { id: uuidv4(), label: `Target ${data.targets.length + 1}`, x: 30, y: 30, width: 20, height: 15 }],
    });
  };

  const addItem = () => {
    const targetId = data.targets[0]?.id || "";
    onChange({
      ...data,
      items: [...data.items, { id: uuidv4(), text: "", targetId }],
    });
  };

  const updateTarget = (id: string, updates: Partial<(typeof data.targets)[0]>) => {
    onChange({ ...data, targets: data.targets.map((t) => (t.id === id ? { ...t, ...updates } : t)) });
  };

  const updateItem = (id: string, updates: Partial<(typeof data.items)[0]>) => {
    onChange({ ...data, items: data.items.map((i) => (i.id === id ? { ...i, ...updates } : i)) });
  };

  const removeTarget = (id: string) => {
    onChange({ ...data, targets: data.targets.filter((t) => t.id !== id), items: data.items.filter((i) => i.targetId !== id) });
  };

  const removeItem = (id: string) => {
    onChange({ ...data, items: data.items.filter((i) => i.id !== id) });
  };

  return (
    <div className="space-y-4">
      {/* Background image */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Background Image</label>
        {data.backgroundImageUrl ? (
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            <img src={data.backgroundImageUrl} alt="Background" className="w-full max-h-40 object-cover" />
            <button
              onClick={() => onChange({ ...data, backgroundImageUrl: "" })}
              className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 rounded-full p-1 shadow"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={uploadBg} className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600">
            <Upload className="w-4 h-4" /> Upload background image
          </button>
        )}
      </div>

      {/* Drop targets */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Drop Targets (zones on image)</label>
        {data.targets.map((target, idx) => (
          <div key={target.id} className="flex items-center gap-2 mb-2 group">
            <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
            <input
              value={target.label}
              onChange={(e) => updateTarget(target.id, { label: e.target.value })}
              placeholder="Target label"
              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
            />
            <input type="number" value={target.x} onChange={(e) => updateTarget(target.id, { x: +e.target.value })} className="w-12 px-1 py-1 text-xs border rounded" placeholder="X%" />
            <input type="number" value={target.y} onChange={(e) => updateTarget(target.id, { y: +e.target.value })} className="w-12 px-1 py-1 text-xs border rounded" placeholder="Y%" />
            <button onClick={() => removeTarget(target.id)} className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button onClick={addTarget} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700">
          <Plus className="w-3.5 h-3.5" /> Add Target
        </button>
      </div>

      {/* Draggable items */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Draggable Items</label>
        {data.items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2 mb-2 group">
            <input
              value={item.text}
              onChange={(e) => updateItem(item.id, { text: e.target.value })}
              placeholder={`Item ${idx + 1}`}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
            />
            <select
              value={item.targetId}
              onChange={(e) => updateItem(item.id, { targetId: e.target.value })}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
            >
              {data.targets.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <button onClick={() => removeItem(item.id)} className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button onClick={addItem} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700">
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
      </div>
    </div>
  );
}

// ─── Drag the Words Editor ───────────────────────────────────────────────────

export function DragWordsEditor({ data, onChange }: { data: DragWordsData; onChange: (d: QuestionData) => void }) {
  const addBlank = () => {
    const id = `blank${data.blanks.length + 1}`;
    onChange({
      ...data,
      template: data.template + ` {{${id}}}`,
      blanks: [...data.blanks, { id, correctWord: "" }],
    });
  };

  const updateBlank = (id: string, word: string) => {
    onChange({ ...data, blanks: data.blanks.map((b) => (b.id === id ? { ...b, correctWord: word } : b)) });
  };

  const removeBlank = (id: string) => {
    onChange({
      ...data,
      template: data.template.replace(`{{${id}}}`, "___"),
      blanks: data.blanks.filter((b) => b.id !== id),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Template Text <span className="font-normal text-gray-400">(use {"{{blankId}}"} for blanks)</span>
        </label>
        <textarea
          value={data.template}
          onChange={(e) => onChange({ ...data, template: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
          placeholder="The {{blank1}} jumped over the {{blank2}}."
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Correct Words for Blanks</label>
        {data.blanks.map((blank) => (
          <div key={blank.id} className="flex items-center gap-2 mb-2 group">
            <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">{`{{${blank.id}}}`}</span>
            <input
              value={blank.correctWord}
              onChange={(e) => updateBlank(blank.id, e.target.value)}
              placeholder="Correct word"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
            />
            <button onClick={() => removeBlank(blank.id)} className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button onClick={addBlank} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700">
          <Plus className="w-3.5 h-3.5" /> Add Blank
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Distractor Words (optional)</label>
        <input
          value={(data.distractorWords || []).join(", ")}
          onChange={(e) => onChange({ ...data, distractorWords: e.target.value.split(",").map((w) => w.trim()).filter(Boolean) })}
          placeholder="word1, word2, word3"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        />
        <p className="text-xs text-gray-400 mt-1">Extra words that don't belong in any blank (comma-separated)</p>
      </div>
    </div>
  );
}

// ─── Dropdown (Select from Lists) Editor ─────────────────────────────────────

export function DropdownEditor({ data, onChange }: { data: DropdownData; onChange: (d: QuestionData) => void }) {
  const addBlank = () => {
    const id = `blank${data.blanks.length + 1}`;
    onChange({
      ...data,
      template: data.template + ` {{${id}}}`,
      blanks: [...data.blanks, { id, options: ["Option 1", "Option 2"], correctIndex: 0 }],
    });
  };

  const updateBlank = (id: string, updates: Partial<(typeof data.blanks)[0]>) => {
    onChange({ ...data, blanks: data.blanks.map((b) => (b.id === id ? { ...b, ...updates } : b)) });
  };

  const removeBlank = (id: string) => {
    onChange({
      ...data,
      template: data.template.replace(`{{${id}}}`, "___"),
      blanks: data.blanks.filter((b) => b.id !== id),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Template Text <span className="font-normal text-gray-400">(use {"{{blankId}}"} for dropdowns)</span>
        </label>
        <textarea
          value={data.template}
          onChange={(e) => onChange({ ...data, template: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dropdown Blanks</label>
        {data.blanks.map((blank) => (
          <div key={blank.id} className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-mono bg-white px-2 py-0.5 rounded border">{`{{${blank.id}}}`}</span>
              <button onClick={() => removeBlank(blank.id)} className="text-gray-300 hover:text-red-400">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1.5">
              {blank.options.map((opt, optIdx) => (
                <div key={optIdx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`dropdown-${blank.id}`}
                    checked={blank.correctIndex === optIdx}
                    onChange={() => updateBlank(blank.id, { correctIndex: optIdx })}
                    className="accent-teal-500"
                  />
                  <input
                    value={opt}
                    onChange={(e) => {
                      const options = [...blank.options];
                      options[optIdx] = e.target.value;
                      updateBlank(blank.id, { options });
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                  {blank.options.length > 2 && (
                    <button
                      onClick={() => {
                        const options = blank.options.filter((_, i) => i !== optIdx);
                        const correctIndex = blank.correctIndex >= optIdx && blank.correctIndex > 0 ? blank.correctIndex - 1 : blank.correctIndex;
                        updateBlank(blank.id, { options, correctIndex: Math.min(correctIndex, options.length - 1) });
                      }}
                      className="text-gray-300 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => updateBlank(blank.id, { options: [...blank.options, `Option ${blank.options.length + 1}`] })}
                className="text-xs text-teal-600 hover:text-teal-700 mt-1"
              >
                + Add option
              </button>
            </div>
          </div>
        ))}
        <button onClick={addBlank} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700">
          <Plus className="w-3.5 h-3.5" /> Add Dropdown
        </button>
      </div>
    </div>
  );
}

// ─── Numeric Editor ──────────────────────────────────────────────────────────

export function NumericEditor({ data, onChange }: { data: NumericData; onChange: (d: QuestionData) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Correct Value</label>
          <input
            type="number"
            step="any"
            value={data.correctValue}
            onChange={(e) => onChange({ ...data, correctValue: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tolerance (±)</label>
          <input
            type="number"
            step="any"
            min="0"
            value={data.tolerance}
            onChange={(e) => onChange({ ...data, tolerance: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={data.allowRange}
          onChange={(e) => onChange({ ...data, allowRange: e.target.checked })}
          className="accent-teal-500"
        />
        Accept a range of values instead
      </label>

      {data.allowRange && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Min Value</label>
            <input
              type="number"
              step="any"
              value={data.rangeMin ?? ""}
              onChange={(e) => onChange({ ...data, rangeMin: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Value</label>
            <input
              type="number"
              step="any"
              value={data.rangeMax ?? ""}
              onChange={(e) => onChange({ ...data, rangeMax: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Unit (optional)</label>
        <input
          value={data.unit || ""}
          onChange={(e) => onChange({ ...data, unit: e.target.value || undefined })}
          placeholder="e.g., kg, meters, %"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        />
      </div>
    </div>
  );
}

// ─── Likert Scale Editor ─────────────────────────────────────────────────────

export function LikertEditor({ data, onChange }: { data: LikertData; onChange: (d: QuestionData) => void }) {
  const addStatement = () => {
    onChange({ ...data, statements: [...data.statements, { id: uuidv4(), text: "" }] });
  };

  const updateStatement = (id: string, text: string) => {
    onChange({ ...data, statements: data.statements.map((s) => (s.id === id ? { ...s, text } : s)) });
  };

  const removeStatement = (id: string) => {
    onChange({ ...data, statements: data.statements.filter((s) => s.id !== id) });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Scale Size</label>
        <select
          value={data.scaleSize}
          onChange={(e) => {
            const size = parseInt(e.target.value);
            const defaults: Record<number, string[]> = {
              3: ["Disagree", "Neutral", "Agree"],
              5: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
              7: ["Strongly Disagree", "Disagree", "Somewhat Disagree", "Neutral", "Somewhat Agree", "Agree", "Strongly Agree"],
            };
            onChange({ ...data, scaleSize: size, scaleLabels: defaults[size] || data.scaleLabels });
          }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        >
          <option value={3}>3-point</option>
          <option value={5}>5-point</option>
          <option value={7}>7-point</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Scale Labels</label>
        <div className="flex gap-2 flex-wrap">
          {data.scaleLabels.map((label, idx) => (
            <input
              key={idx}
              value={label}
              onChange={(e) => {
                const labels = [...data.scaleLabels];
                labels[idx] = e.target.value;
                onChange({ ...data, scaleLabels: labels });
              }}
              className="px-2 py-1 text-xs border border-gray-200 rounded w-28 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Statements</label>
        {data.statements.map((stmt, idx) => (
          <div key={stmt.id} className="flex items-center gap-2 mb-2 group">
            <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
            <input
              value={stmt.text}
              onChange={(e) => updateStatement(stmt.id, e.target.value)}
              placeholder="Enter statement..."
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
            />
            <button onClick={() => removeStatement(stmt.id)} className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button onClick={addStatement} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700">
          <Plus className="w-3.5 h-3.5" /> Add Statement
        </button>
      </div>
    </div>
  );
}

// ─── Essay Editor ────────────────────────────────────────────────────────────

export function EssayEditor({ data, onChange }: { data: EssayData; onChange: (d: QuestionData) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Essay questions are manually graded. The learner writes a free-form response.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Min Words</label>
          <input
            type="number"
            min="0"
            value={data.minWords ?? ""}
            onChange={(e) => onChange({ ...data, minWords: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="No minimum"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Words</label>
          <input
            type="number"
            min="0"
            value={data.maxWords ?? ""}
            onChange={(e) => onChange({ ...data, maxWords: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="No maximum"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Placeholder Text</label>
        <input
          value={data.placeholder || ""}
          onChange={(e) => onChange({ ...data, placeholder: e.target.value })}
          placeholder="Write your answer here..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Grading Rubric (for instructor)</label>
        <textarea
          value={data.rubric || ""}
          onChange={(e) => onChange({ ...data, rubric: e.target.value })}
          rows={3}
          placeholder="Describe what constitutes a good answer..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
        />
      </div>
    </div>
  );
}
