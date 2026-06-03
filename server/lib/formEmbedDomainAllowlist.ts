/**
 * formEmbedDomainAllowlist.ts — domain restriction checks for embed widgets.
 */

export function normalizeDomain(host: string): string {
  let h = host.trim().toLowerCase();
  h = h.replace(/^https?:\/\//, "");
  h = h.split("/")[0] ?? h;
  h = h.split(":")[0] ?? h;
  if (h.startsWith("www.")) h = h.slice(4);
  return h;
}

export function domainMatchesPattern(host: string, pattern: string): boolean {
  const h = normalizeDomain(host);
  const p = normalizeDomain(pattern);
  if (!p) return false;
  if (p.startsWith("*.")) {
    const suffix = p.slice(2);
    return h === suffix || h.endsWith("." + suffix);
  }
  return h === p;
}

export function isDomainAllowed(
  host: string,
  mode: "all" | "allowlist",
  allowedDomains: string[],
): boolean {
  if (mode === "all") return true;
  const normalizedHost = normalizeDomain(host);
  if (!normalizedHost) return false;
  return allowedDomains.some(p => domainMatchesPattern(normalizedHost, p));
}

export function extractHostFromUrl(url: string | undefined | null): string {
  if (!url) return "";
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return normalizeDomain(url);
  }
}
