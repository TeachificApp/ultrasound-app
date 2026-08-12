import { cn } from "@/lib/utils";
import { buildFreshAssetUrl, isStaleAssetError, staleAssetRecoveryKey } from "@/lib/staleAssetRecovery";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  autoReloading: boolean;
}

/**
 * Returns true if the error indicates a stale cached JS bundle that should be
 * resolved by reloading the page to pick up the latest deployment.
 * Covers: Vite/webpack chunk load failures AND ReferenceErrors from renamed/removed
 * identifiers in a newer build (e.g. "setCmeDirty is not defined").
 */
function isChunkLoadError(error: Error): boolean {
  const msg = error?.message ?? "";
  if (isStaleAssetError(error)) return true;
  // ReferenceErrors where an identifier "is not defined" — these indicate a stale
  // cached JS bundle referencing a variable that was renamed or removed in a newer build.
  if (error instanceof ReferenceError && msg.includes("is not defined")) return true;
  return false;
}

async function reloadWithFreshAssets(error: Error) {
  const key = staleAssetRecoveryKey(error);
  if (sessionStorage.getItem(key)) return false;
  sessionStorage.setItem(key, "1");

  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update()));
    }
  } catch {
    // A cache clean-up failure must not prevent the fresh document request.
  }

  window.location.replace(buildFreshAssetUrl(window.location.href));
  return true;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, autoReloading: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // If it's a chunk load error and we haven't already tried reloading, auto-reload
    if (isChunkLoadError(error)) {
      const alreadyTried = sessionStorage.getItem(staleAssetRecoveryKey(error));
      if (!alreadyTried) {
        // Trigger recovery after React finishes this render cycle.
        setTimeout(() => { void reloadWithFreshAssets(error); }, 100);
        return { hasError: true, error, autoReloading: true };
      }
    }
    return { hasError: true, error, autoReloading: false };
  }

  render() {
    if (this.state.hasError) {
      // Show a spinner while auto-reloading for chunk errors
      if (this.state.autoReloading) {
        return (
          <div className="flex items-center justify-center min-h-screen p-8 bg-background">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full" />
              <p className="text-sm text-muted-foreground">Updating resources, reloading…</p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.message}
              </pre>
            </div>

            <button
              onClick={() => {
                sessionStorage.removeItem(staleAssetRecoveryKey(this.state.error ?? new Error("manual reload")));
                void reloadWithFreshAssets(this.state.error ?? new Error("manual reload"));
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
