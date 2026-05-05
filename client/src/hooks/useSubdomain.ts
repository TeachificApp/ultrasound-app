/**
 * useSubdomain — Detect whether the app is running on the learn subdomain.
 * Returns { isLearnSubdomain } based on window.location.hostname.
 *
 * LMS subdomain hostnames:
 *   - learn.allaboutultrasound.com (production)
 *   - Any hostname starting with "learn." or containing "learn" as subdomain
 *
 * For local development, you can test by adding ?subdomain=learn to the URL.
 */
import { useMemo } from "react";

const LEARN_HOSTNAMES = [
  "learn.allaboutultrasound.com",
];

export function useSubdomain() {
  const isLearnSubdomain = useMemo(() => {
    const hostname = window.location.hostname;
    // Check exact match
    if (LEARN_HOSTNAMES.includes(hostname)) return true;
    // Check if hostname starts with "learn."
    if (hostname.startsWith("learn.")) return true;
    // Dev override via query param
    const params = new URLSearchParams(window.location.search);
    if (params.get("subdomain") === "learn") return true;
    return false;
  }, []);

  return { isLearnSubdomain };
}

/**
 * Non-hook version for use outside React components (e.g., in route config).
 */
export function isLearnDomain(): boolean {
  const hostname = window.location.hostname;
  if (LEARN_HOSTNAMES.includes(hostname)) return true;
  if (hostname.startsWith("learn.")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("subdomain") === "learn") return true;
  return false;
}
