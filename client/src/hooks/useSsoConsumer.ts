/**
 * useSsoConsumer — Cross-domain SSO token consumer
 *
 * Run this hook once at the top level of the LMSRouter (learn. domain).
 * It reads ?sso=TOKEN from the URL, exchanges it for a session cookie via the
 * server, then removes the token from the URL so it doesn't persist in history.
 */
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

export function useSsoConsumer() {
  const exchangeToken = trpc.sso.exchangeToken.useMutation();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("sso");
    if (!token) return;

    hasRun.current = true;

    // Remove ?sso= from URL immediately so it doesn't persist in history
    params.delete("sso");
    const cleanSearch = params.toString();
    const cleanUrl =
      window.location.pathname + (cleanSearch ? `?${cleanSearch}` : "") + window.location.hash;
    window.history.replaceState({}, "", cleanUrl);

    // Exchange the token for a session cookie
    exchangeToken.mutate(
      { token },
      {
        onSuccess: () => {
          // Reload the page so the new session cookie is picked up by the tRPC auth.me query
          window.location.reload();
        },
        onError: (err) => {
          console.warn("[SSO] Token exchange failed:", err.message);
          // Don't redirect — user can still log in manually
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
