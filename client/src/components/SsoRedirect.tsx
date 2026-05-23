/**
 * SsoRedirect — Performs a cross-domain redirect to learn.allaboutultrasound.com
 * with an SSO token if the user is authenticated, so they don't need to log in again.
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const LEARN_DOMAIN = "https://learn.allaboutultrasound.com";

interface SsoRedirectProps {
  path: string; // e.g. "/education-library" or "/courses/my-course/player"
}

export function SsoRedirect({ path }: SsoRedirectProps) {
  const { user, loading } = useAuth();
  const issueToken = trpc.sso.issueToken.useMutation();

  useEffect(() => {
    if (loading) return; // wait for auth state

    const destination = LEARN_DOMAIN + (path.startsWith("/") ? path : `/${path}`);

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
