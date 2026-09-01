export const QUIZ_ACCOUNT_FIELD_OPTIONS = [
  { key: "full_name", label: "Full name" },
  { key: "email", label: "Email address" },
  { key: "credentials", label: "Professional credentials" },
  { key: "specialty", label: "Specialty" },
] as const;

export type QuizAccountFieldKey = (typeof QUIZ_ACCOUNT_FIELD_OPTIONS)[number]["key"];
export type QuizAccountFieldValue = { key: QuizAccountFieldKey; label: string; value: string };

const ACCOUNT_FIELD_KEYS = new Set<QuizAccountFieldKey>(QUIZ_ACCOUNT_FIELD_OPTIONS.map(field => field.key));

export function normalizeQuizAccountFieldKeys(value: unknown): QuizAccountFieldKey[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<QuizAccountFieldKey>();
  return value.filter((key): key is QuizAccountFieldKey => {
    if (typeof key !== "string" || !ACCOUNT_FIELD_KEYS.has(key as QuizAccountFieldKey) || seen.has(key as QuizAccountFieldKey)) return false;
    seen.add(key as QuizAccountFieldKey);
    return true;
  });
}

export function resolveQuizAccountFields(
  selectedFields: unknown,
  profile: { name?: string | null; firstName?: string | null; lastName?: string | null; displayName?: string | null; email?: string | null; credentials?: string | null; specialty?: string | null },
): QuizAccountFieldValue[] {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || profile.displayName?.trim() || profile.name?.trim() || "";
  const values: Record<QuizAccountFieldKey, string> = {
    full_name: fullName,
    email: profile.email?.trim() || "",
    credentials: profile.credentials?.trim() || "",
    specialty: profile.specialty?.trim() || "",
  };
  return normalizeQuizAccountFieldKeys(selectedFields).map(key => ({
    key,
    label: QUIZ_ACCOUNT_FIELD_OPTIONS.find(field => field.key === key)!.label,
    value: values[key],
  }));
}
