export type EmbeddedFormUser = {
  name?: string | null;
  email?: string | null;
} | null | undefined;

const PLACEHOLDER_VALUES = ["first_name", "firstName", "last_name", "lastName", "full_name", "fullName", "name", "email"] as const;

function getNameParts(name: string | null | undefined) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    fullName: parts.join(" "),
  };
}

/**
 * Resolves the supported, legacy merge fields in an administrator-saved embed URL.
 * Unknown tokens are deliberately left intact; known missing profile values become
 * empty values rather than literal template text.
 */
export function resolveEmbeddedFormUrl(rawUrl: string, user: EmbeddedFormUser) {
  if (!rawUrl) return "";
  const { firstName, lastName, fullName } = getNameParts(user?.name);
  const values: Record<(typeof PLACEHOLDER_VALUES)[number], string> = {
    first_name: firstName,
    firstName,
    last_name: lastName,
    lastName,
    full_name: fullName,
    fullName,
    name: fullName,
    email: String(user?.email ?? "").trim(),
  };

  return rawUrl.replace(/\{\{\s*(first_name|firstName|last_name|lastName|full_name|fullName|name|email)\s*\}\}/g, (_match, key) =>
    encodeURIComponent(values[key as keyof typeof values]),
  );
}
