import { v4 as uuidv4 } from "uuid";
import { Trash2, Plus, GripVertical } from "lucide-react";
import type { McqData } from "../../types/quiz";

interface Props {
  data: McqData;
  onChange: (data: McqData) => void;
}

export function McqEditor({ data, onChange }: Props) {
  const toggle = (id: string, field: "correct") => {
    const choices = data.multiSelect
      ? data.choices.map((c) => (c.id === id ? { ...c, [field]: !c[field] } : c))
      : data.choices.map((c) => ({ ...c, correct: c.id === id }));
    onChange({ ...data, choices });
  };

  const updateText = (id: string, text: string) => {
    onChange({ ...data, choices: data.choices.map((c) => (c.id === id ? { ...c, text } : c)) });
  };

  const addChoice = () => {
    onChange({
      ...data,
      choices: [...data.choices, { id: uuidv4(), text: "", correct: false }],
    });
  };

  const removeChoice = (id: string) => {
    if (data.choices.length <= 2) return;
    onChange({ ...data, choices: data.choices.filter((c) => c.id !== id) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={data.multiSelect}
            onChange={(e) => onChange({ ...data, multiSelect: e.target.checked })}
            className="accent-teal-500"
          />
          Allow multiple correct answers
        </label>
      </div>

      <div className="space-y-2">
        {data.choices.map((choice, i) => (
          <div key={choice.id} className="flex items-center gap-2 group">
            <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
            <input
              type={data.multiSelect ? "checkbox" : "radio"}
              name={`correct-${i}`}
              checked={choice.correct}
              onChange={() => toggle(choice.id, "correct")}
              className="accent-teal-500 shrink-0"
            />
            <input
              type="text"
              value={choice.text}
              onChange={(e) => updateText(choice.id, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400"
            />
            <button
              onClick={() => removeChoice(choice.id)}
              disabled={data.choices.length <= 2}
              className="p-1.5 text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addChoice}
        className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add option
      </button>

      <p className="text-xs text-gray-400">
        {data.multiSelect ? "Check all correct answers" : "Select the one correct answer"}
      </p>
    </div>
  );
}
