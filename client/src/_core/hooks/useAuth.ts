import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    try {
      // Use a direct fetch POST to /api/auth/logout — bypasses tRPC httpBatchLink
      // so the Set-Cookie: clear header is never merged with other batched responses.
      const resp = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-App-Hostname": window.location.hostname,
          "Content-Type": "application/json",
        },
      });
      if (!resp.ok) {
        console.error("[logout] server returned", resp.status);
      }
    } catch (error) {
      console.error("[logout] fetch error:", error);
    }
    // Clear client-side auth state
    utils.auth.me.setData(undefined, null);
    localStorage.removeItem("manus-runtime-user-info");
    // Add ?logout=1 so the Login page knows not to auto-redirect even if
    // the cookie somehow persists (e.g., domain mismatch edge case).
    window.location.href = getLoginUrl() + "?logout=1";
  }, [utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
