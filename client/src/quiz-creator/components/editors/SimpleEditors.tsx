import { v4 as uuidv4 } from "uuid";
import { Plus, Trash2, X } from "lucide-react";
import type { TfData, FillBlankData, ShortAnswerData, ImageChoiceData } from "../../types/quiz";

// ─── True / False ─────────────────────────────────────────────────────────────
export function TfEditor({ data, onChange }: { data: TfData; onChange: (d: TfData) => void }) {
  return (
    <div className="flex gap-4">
      {[true, false].map((val) => (
        <label
          key={String(val)}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 cursor-pointer select-none transition-all ${
            data.correct === val
              ? "border-teal-500 bg-teal-50 text-teal-700 font-semibold"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          <input
            type="radio"
            name="tf"
            checked={data.correct === val}
            onChange={() => onChange({ correct: val })}
            className="sr-only"
          />
          {val ? "✓ True" : "✗ False"}
        </label>
      ))}
    </div>
  );
}

// ─── Fill in the Blank ────────────────────────────────────────────────────────
export function FillBlankEditor({
  data,
  onChange,
}: {
  data: FillBlankData;
  onChange: (d: FillBlankData) => void;
}) {
  const addBlank = () => {
    const id = `blank${data.blanks.length + 1}`;
    onChange({
      ...data,
      blanks: [...data.blanks, { id, acceptedAnswers: [""], caseSensitive: false }],
    });
  };

  const updateTemplate = (template: string) => onChange({ ...data, template });

  const updateAnswer = (blankId: string, idx: number, val: string) => {
    onChange({
      ...data,
      blanks: data.blanks.map((b) =>
        b.id === blankId
          ? { ...b, acceptedAnswers: b.acceptedAnswers.map((a, i) => (i === idx ? val : a)) }
          : b
      ),
    });
  };

  const addAnswer = (blankId: string) => {
    onChange({
      ...data,
      blanks: data.blanks.map((b) =>
        b.id === blankId ? { ...b, acceptedAnswers: [...b.acceptedAnswers, ""] } : b
      ),
    });
  };

  const removeAnswer = (blankId: string, idx: number) => {
    onChange({
      ...data,
      blanks: data.blanks.map((b) =>
        b.id === blankId
          ? { ...b, acceptedAnswers: b.acceptedAnswers.filter((_, i) => i !== idx) }
          : b
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Template — use {"{{blankId}}"} as placeholder
        </label>
        <textarea
          value={data.template}
          onChange={(e) => updateTemplate(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400 resize-none"
          placeholder="The {{blank1}} is the largest organ."
        />
        <p className="text-xs text-gray-400 mt-1">
          Available placeholders: {data.blanks.map((b) => `{{${b.id}}}`).join(", ")}
        </p>
      </div>

      {data.blanks.map((blank) => (
        <div key={blank.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-teal-600 font-mono">{`{{${blank.id}}}`}</span>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={blank.caseSensitive}
                onChange={(e) =>
                  onChange({
                    ...data,
                    blanks: data.blanks.map((b) =>
                      b.id === blank.id ? { ...b, caseSensitive: e.target.checked } : b
                    ),
                  })
                }
                className="accent-teal-500"
              />
              Case sensitive
            </label>
          </div>
          <div className="space-y-1.5">
            {blank.acceptedAnswers.map((ans, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={ans}
                  onChange={(e) => updateAnswer(blank.id, idx, e.target.value)}
                  placeholder={`Accepted answer ${idx + 1}`}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                />
                {blank.acceptedAnswers.length > 1 && (
                  <button onClick={() => removeAnswer(blank.id, idx)} className="p-1.5 text-gray-300 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => addAnswer(blank.id)}
              className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add accepted answer
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={addBlank}
        className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium"
      >
        <Plus className="w-4 h-4" /> Add blank
      </button>
    </div>
  );
}

// ─── Short Answer ─────────────────────────────────────────────────────────────
export function ShortAnswerEditor({
  data,
  onChange,
}: {
  data: ShortAnswerData;
  onChange: (d: ShortAnswerData) => void;
}) {
  const addKeyword = () => onChange({ ...data, keywords: [...data.keywords, ""] });
  const updateKeyword = (i: number, val: string) =>
    onChange({ ...data, keywords: data.keywords.map((k, idx) => (idx === i ? val : k)) });
  const removeKeyword = (i: number) =>
    onChange({ ...data, keywords: data.keywords.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Sample / Model Answer
        </label>
        <textarea
          value={data.sampleAnswer}
          onChange={(e) => onChange({ ...data, sampleAnswer: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
          placeholder="Provide a model answer for instructors..."
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Keywords (for auto-grading hints)
        </label>
        <div className="space-y-1.5">
          {data.keywords.map((kw, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={kw}
                onChange={(e) => updateKeyword(i, e.target.value)}
                placeholder={`Keyword ${i + 1}`}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              />
              <button onClick={() => removeKeyword(i)} className="p-1.5 text-gray-300 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addKeyword}
          className="mt-2 flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add keyword
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={data.autoGrade}
          onChange={(e) => onChange({ ...data, autoGrade: e.target.checked })}
          className="accent-teal-500"
        />
        Enable keyword-based auto-grading
      </label>
    </div>
  );
}

// ─── Image Choice ─────────────────────────────────────────────────────────────
export function ImageChoiceEditor({
  data,
  onChange,
}: {
  data: ImageChoiceData;
  onChange: (d: ImageChoiceData) => void;
}) {
  const selectImage = (id: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onChange({
          ...data,
          choices: data.choices.map((c) =>
            c.id === id ? { ...c, imageUrl: reader.result as string } : c
          ),
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const toggleCorrect = (id: string) => {
    const choices = data.multiSelect
      ? data.choices.map((c) => (c.id === id ? { ...c, correct: !c.correct } : c))
      : data.choices.map((c) => ({ ...c, correct: c.id === id }));
    onChange({ ...data, choices });
  };

  const addChoice = () => {
    onChange({
      ...data,
      choices: [...data.choices, { id: uuidv4(), imageUrl: "", label: "", correct: false }],
    });
  };

  const removeChoice = (id: string) => {
    if (data.choices.length <= 2) return;
    onChange({ ...data, choices: data.choices.filter((c) => c.id !== id) });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={data.multiSelect}
          onChange={(e) => onChange({ ...data, multiSelect: e.target.checked })}
          className="accent-teal-500"
        />
        Allow multiple correct answers
      </label>

      <div className="grid grid-cols-2 gap-3">
        {data.choices.map((choice, i) => (
          <div
            key={choice.id}
            className={`relative border-2 rounded-xl overflow-hidden cursor-pointer transition-all ${
              choice.correct ? "border-teal-500" : "border-gray-200"
            }`}
            onClick={() => toggleCorrect(choice.id)}
          >
            {choice.imageUrl ? (
              <img src={choice.imageUrl} alt={choice.label} className="w-full h-32 object-cover" />
            ) : (
              <div
                className="w-full h-32 bg-gray-100 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
                onClick={(e) => { e.stopPropagation(); selectImage(choice.id); }}
              >
                <Plus className="w-6 h-6 mb-1" />
                <span className="text-xs">Upload image</span>
              </div>
            )}
            {choice.imageUrl && (
              <button
                className="absolute top-1 right-1 bg-white/80 rounded-full p-1 text-gray-500 hover:text-teal-600"
                onClick={(e) => { e.stopPropagation(); selectImage(choice.id); }}
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
            <div className="p-2 flex items-center gap-2">
              <input
                type={data.multiSelect ? "checkbox" : "radio"}
                checked={choice.correct}
                onChange={() => toggleCorrect(choice.id)}
                onClick={(e) => e.stopPropagation()}
                className="accent-teal-500 shrink-0"
              />
              <input
                type="text"
                value={choice.label}
                onChange={(e) => {
                  e.stopPropagation();
                  onChange({
                    ...data,
                    choices: data.choices.map((c) =>
                      c.id === choice.id ? { ...c, label: e.target.value } : c
                    ),
                  });
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="flex-1 text-xs border-none outline-none bg-transparent"
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeChoice(choice.id); }}
                disabled={data.choices.length <= 2}
                className="text-gray-300 hover:text-red-400 disabled:opacity-30"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addChoice}
        className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium"
      >
        <Plus className="w-4 h-4" /> Add image option
      </button>
    </div>
  );
}
