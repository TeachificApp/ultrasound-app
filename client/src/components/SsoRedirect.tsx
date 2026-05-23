/**
 * SsoRedirect — Performs a cross-domain redirect with an SSO token if the user
 * is authenticated, so they don't need to log in again on the target subdomain.
 *
 * Defaults to learn.allaboutultrasound.com but accepts an explicit `targetOrigin`
 * for redirecting to members.allaboutultrasound.com or other subdomains.
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { LEARN_APP_URL, MEMBERS_APP_URL } from "@/hooks/useSubdomain";

export { LEARN_APP_URL, MEMBERS_APP_URL };

interface SsoRedirectProps {
  path: string; // e.g. "/courses/my-course/player" or "/my-dashboard"
  /** Override the target origin. Defaults to LEARN_APP_URL. */
  targetOrigin?: string;
}

export function SsoRedirect({ path, targetOrigin = LEARN_APP_URL }: SsoRedirectProps) {
  const { user, loading } = useAuth();
  const issueToken = trpc.sso.issueToken.useMutation();

  useEffect(() => {
    if (loading) return; // wait for auth state

    const destination = targetOrigin + (path.startsWith("/") ? path : `/${path}`);

    if (!user) {
      // Not logged in — redirect without SSO token
      window.location.replace(destination);
      return;
    }

    // Issue SSO token then redirect
    issueToken.mutate(undefined, {
      onSuccess: ({ token }) => {
        const sep = destination.includes("?") ? "&" : "?";
        window.location.replace(`${destination}${sep}sso=${encodeURIComponent(token)}`);
      },
      onError: () => {
        // Fallback: redirect without SSO token
        window.location.replace(destination);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );
}
