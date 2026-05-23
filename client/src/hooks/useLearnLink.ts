/**
 * useLearnLink — Cross-domain SSO helper
 *
 * Returns a `navigateToLearn(path)` function that:
 *  1. Issues a short-lived SSO token from the server
 *  2. Appends ?sso=TOKEN to the learn.allaboutultrasound.com URL
 *  3. Opens the URL (in the same tab by default, or a new tab for admin previews)
 *
 * If the user is not logged in, navigates without a token (they'll see the login page).
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const LEARN_DOMAIN = "https://learn.allaboutultrasound.com";

export function getLearnUrl(path: string, ssoToken?: string): string {
  const base = LEARN_DOMAIN + (path.startsWith("/") ? path : `/${path}`);
  if (!ssoToken) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}sso=${encodeURIComponent(ssoToken)}`;
}

export function useLearnLink() {
  const { user } = useAuth();
  const issueToken = trpc.sso.issueToken.useMutation();

  /**
   * Navigate to a learn. path with SSO passthrough.
   * @param path  e.g. "/education-library" or "/courses/my-course/player"
   * @param newTab  open in a new tab (default: false)
   */
  async function navigateToLearn(path: string, newTab = false) {
    let url = getLearnUrl(path);
    if (user) {
      try {
        const { token } = await issueToken.mutateAsync();
        url = getLearnUrl(path, token);
      } catch {
        // If token issuance fails, navigate without SSO — user may need to log in
      }
    }
    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
  }

  /** Alias that always opens in a new tab — for admin preview buttons */
  async function openLearnLink(path: string) {
    return navigateToLearn(path, true);
  }

  return { navigateToLearn, openLearnLink, isLoading: issueToken.isPending };
}
