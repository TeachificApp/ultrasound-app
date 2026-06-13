import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { detectBrandFromPath } from "@shared/brandScopedRoutes";
import "./index.css";

const queryClient = new QueryClient();

// ─── Copy & Right-Click Protection ───────────────────────────────────────────
// Disable right-click context menu, copy, cut, and drag on public-facing pages.
// Admin routes (/admin/*) are fully exempt so editors can work normally.
// Input/textarea interactions are never blocked (browser handles those natively).

function isAdminRoute(): boolean {
  const path = window.location.pathname;
  return path === "/platform-admin" || path.startsWith("/admin");
}

function isFormElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

document.addEventListener("contextmenu", (e) => {
  if (isAdminRoute()) return; // allow on admin pages
  if (!isFormElement(e.target)) e.preventDefault();
});

document.addEventListener("copy", (e) => {
  if (isAdminRoute()) return; // allow on admin pages
  if (!isFormElement(e.target)) e.preventDefault();
});

document.addEventListener("cut", (e) => {
  if (isAdminRoute()) return; // allow on admin pages
  if (!isFormElement(e.target)) e.preventDefault();
});

// NOTE: dragstart prevention removed — it broke drag-and-drop in the page builder.
// Copy protection is handled by copy/cut listeners above.
// ─────────────────────────────────────────────────────────────────────────────

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = "/login";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Embed brand in the tRPC URL as a query param — this cannot be stripped by any proxy.
// The X-App-Hostname header is also sent as a belt-and-suspenders fallback.
function getBrandParam(): string {
  const fromPath = detectBrandFromPath(window.location.pathname);
  if (fromPath) return fromPath;
  const h = window.location.hostname.toLowerCase();
  if (h.includes("iheartecho")) return "iheartecho";
  return "aaus";
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `/api/trpc?_brand=${getBrandParam()}`,
      transformer: superjson,
      headers() {
        return { "X-App-Hostname": window.location.hostname };
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

// Build: 2026-06-13T17:00:00Z — freeEnrollProductType fix
// Register service worker for PWA installability
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failure is non-fatal
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
