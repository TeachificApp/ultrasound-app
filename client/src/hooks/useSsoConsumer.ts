/**
 * useSsoConsumer — Cross-domain SSO token consumer (?sso=TOKEN in URL)
 */
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { clearSsoBridgeLock, clearSsoSessionLocks } from "@/lib/ssoSession";

export function useSsoConsumer() {
  const exchangeToken = trpc.sso.exchangeToken.useMutation();
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
        onSuccess: () => {
          clearSsoBridgeLock();
          clearSsoSessionLocks();
          window.location.reload();
        },
        onError: (err) => {
          console.warn("[SSO] Token exchange failed:", err.message);
          clearSsoBridgeLock();
        },
      },
    );
  }, [exchangeToken]);
}
