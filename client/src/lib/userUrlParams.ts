/**
 * userUrlParams.ts
 *
 * Utility for injecting logged-in user profile data into embed/iframe URLs.
 *
 * Supported template tags (case-insensitive):
 *   {{name}}        — user's full name (displayName → name → "")
 *   {{firstName}}   — user's first name
 *   {{lastName}}    — user's last name
 *   {{email}}       — user's email address
 *   {{userId}}      — user's numeric database ID
 *
 * Two modes:
 *   1. Template replacement — replaces {{tag}} occurrences directly in the URL string.
 *      Useful when the embed provider supports pre-filled query params like
 *      ?email={{email}}&name={{name}}
 *
 *   2. Auto-append — if the URL does NOT already contain a given param key, the
 *      value is appended as a query parameter so the receiving form/embed can
 *      read it from the URL automatically.
 *
 * For raw HTML embed codes (dangerouslySetInnerHTML), use injectUserParamsIntoHtml
 * which applies the same replacement inside src="..." and data-*="..." attributes.
 */

export interface UserParamSource {
  id?: number | null;
  name?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}

/** Map of tag name → resolved value */
function buildTagMap(user: UserParamSource): Record<string, string> {
  const fullName =
    user.displayName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.name?.trim() ||
    "";
  return {
    name: fullName,
    firstname: user.firstName?.trim() ?? "",
    lastname: user.lastName?.trim() ?? "",
    email: user.email?.trim() ?? "",
    userid: user.id != null ? String(user.id) : "",
  };
}

/**
 * Replace {{tag}} placeholders in a URL string, then append any remaining
 * user params as query parameters (only if not already present in the URL).
 */
export function injectUserParams(url: string, user: UserParamSource | null | undefined): string {
  if (!url) return url;
  if (!user) return url;

  const tags = buildTagMap(user);

  // Step 1: replace {{tag}} placeholders (case-insensitive)
  let result = url.replace(/\{\{(\w+)\}\}/gi, (_, key: string) => {
    const val = tags[key.toLowerCase()];
    return val !== undefined ? encodeURIComponent(val) : `{{${key}}}`;
  });

  // Step 2: append remaining params that aren't already in the URL
  try {
    const urlObj = new URL(result.startsWith("http") ? result : `https://placeholder.invalid${result}`);
    const appendMap: Record<string, string> = {
      user_name: tags.name,
      user_first_name: tags.firstname,
      user_last_name: tags.lastname,
      user_email: tags.email,
      user_id: tags.userid,
    };
    let changed = false;
    for (const [key, val] of Object.entries(appendMap)) {
      if (val && !urlObj.searchParams.has(key)) {
        urlObj.searchParams.set(key, val);
        changed = true;
      }
    }
    if (changed) {
      result = result.startsWith("http")
        ? urlObj.toString()
        : urlObj.pathname + urlObj.search + urlObj.hash;
    }
  } catch {
    // If URL parsing fails (e.g. relative path), just return the template-replaced string
  }

  return result;
}

/**
 * Apply user param injection to raw HTML embed code.
 * Replaces {{tag}} occurrences anywhere in the HTML string.
 * Also rewrites src="..." and href="..." attributes to include user params.
 */
export function injectUserParamsIntoHtml(html: string, user: UserParamSource | null | undefined): string {
  if (!html) return html;
  if (!user) return html;

  const tags = buildTagMap(user);

  // Replace {{tag}} placeholders anywhere in the HTML
  let result = html.replace(/\{\{(\w+)\}\}/gi, (_, key: string) => {
    const val = tags[key.toLowerCase()];
    return val !== undefined ? encodeURIComponent(val) : `{{${key}}}`;
  });

  // Also rewrite src="..." attributes to inject user params via injectUserParams
  result = result.replace(/\bsrc="([^"]+)"/gi, (_, srcUrl: string) => {
    return `src="${injectUserParams(srcUrl, user)}"`;
  });

  return result;
}

/**
 * The full list of supported tags for display in the editor UI.
 */
export const USER_PARAM_TAGS: { tag: string; label: string; description: string }[] = [
  { tag: "{{name}}",       label: "Full Name",   description: "User's full display name" },
  { tag: "{{firstName}}", label: "First Name",  description: "User's first name" },
  { tag: "{{lastName}}",  label: "Last Name",   description: "User's last name" },
  { tag: "{{email}}",     label: "Email",       description: "User's email address" },
  { tag: "{{userId}}",    label: "User ID",     description: "User's numeric database ID" },
];
