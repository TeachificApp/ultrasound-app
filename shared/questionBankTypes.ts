export const QUESTION_BANK_TYPES = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "truefalse", label: "True / False" },
  { value: "flashcard", label: "Flashcard" },
  { value: "multiselect", label: "Multi-Select" },
  { value: "hotspot", label: "Hotspot" },
  { value: "matching", label: "Matching" },
] as const;

export type QuestionBankType = (typeof QUESTION_BANK_TYPES)[number]["value"];

export function questionBankTypeLabel(type: string): string {
  return QUESTION_BANK_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

export const QUESTION_BANK_TYPE_BADGE: Record<string, string> = {
  mcq: "bg-blue-100 text-blue-700",
  truefalse: "bg-green-100 text-green-700",
  flashcard: "bg-purple-100 text-purple-700",
  multiselect: "bg-orange-100 text-orange-700",
  hotspot: "bg-pink-100 text-pink-700",
  matching: "bg-cyan-100 text-cyan-700",
};
