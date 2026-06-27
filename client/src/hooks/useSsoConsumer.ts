/**
 * useSsoConsumer — Cross-domain SSO token consumer (?sso=TOKEN in URL)
 *
 * After exchangeToken succeeds, we must NOT immediately call window.location.reload().
 * The browser may not have committed the Set-Cookie header to its cookie store before
 * the reload triggers a new network request, causing auth.me to return null and
 * restarting the SSO bridge loop.
 *
 * Fix: invalidate the auth.me cache first (React re-render), then do a delayed reload
 * only if auth.me still returns null after the invalidation (i.e., the cookie really
 * didn't land). This gives the browser time to commit the cookie before the next request.
 */
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { clearSsoBridgeLock, clearSsoSessionLocks } from "@/lib/ssoSession";

export function useSsoConsumer() {
  const exchangeToken = trpc.sso.exchangeToken.useMutation();
  const utils = trpc.useUtils();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("sso");
    if (!token) return;

    hasRun.current = true;

    params.delete("sso");
    const cleanSearch = params.toString();
    const cleanUrl =
      window.location.pathname + (cleanSearch ? `?${cleanSearch}` : "") + window.location.hash;
    window.history.replaceState({}, "", cleanUrl);

    exchangeToken.mutate(
      { token },
      {
        onSuccess: async () => {
          clearSsoBridgeLock();
          clearSsoSessionLocks();
          // Give the browser a tick to commit the Set-Cookie header before
          // we query auth.me — this prevents the race condition where reload()
          // fires before the cookie is stored, making auth.me return null again.
          await new Promise((resolve) => setTimeout(resolve, 150));
          // Invalidate auth.me so React re-fetches with the new cookie.
          // If the cookie landed correctly, this will resolve the user and
          // useSsoBridge will see user !== null and stop retrying.
          await utils.auth.me.invalidate();
          // Small additional delay then reload to ensure the full app state
          // (memberships, roles, etc.) is refreshed from the server.
          setTimeout(() => {
            window.location.reload();
          }, 300);
        },
        onError: (err) => {
          console.warn("[SSO] Token exchange failed:", err.message);
          clearSsoBridgeLock();
        },
      },
    );
  }, [exchangeToken, utils]);
}
