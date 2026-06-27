/**
 * useSsoConsumer — Cross-domain SSO token consumer (?sso=TOKEN in URL)
 *
 * Uses GET /api/sso/exchange (full-page navigation) instead of the tRPC
 * exchangeToken mutation. Cloudflare strips Set-Cookie from fetch/XHR responses,
 * which left app.iheartecho.com unauthenticated after the AAUS bridge redirect.
 */
import { useEffect, useRef } from "react";

export function useSsoConsumer() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("sso");
    if (!token) return;

    hasRun.current = true;

    params.delete("sso");
    const cleanSearch = params.toString();
    const returnPath =
      window.location.pathname +
      (cleanSearch ? `?${cleanSearch}` : "") +
      window.location.hash;

    const query = new URLSearchParams({
      token,
      host: window.location.hostname,
    });
    if (returnPath.startsWith("/")) {
      query.set("returnTo", returnPath);
    }

    window.location.replace(`/api/sso/exchange?${query.toString()}`);
  }, []);
}
