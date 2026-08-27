/** Strip invisible chars and normalize email for auth lookups / Zod validation. */
export function normalizeAuthEmail(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}
