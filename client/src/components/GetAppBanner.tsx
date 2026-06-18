/**
 * GetAppBanner — PWA "Get App" install banner.
 *
 * behavior:
 * - Shows on every dashboard page load on mobile (< 768px) unless already running in standalone/PWA mode
 * - Android/Chrome: uses native beforeinstallprompt for one-tap install
 * - iOS Safari: shows "Add to Home Screen" instruction overlay
 * - Dismissed with ✕ for that session only (no persistent storage — reappears on next load)
 * - Never shown if app is already running in standalone mode (already installed)
 */
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { X, Download, Share } from "lucide-react";
import { isIHeartEchoDomain } from "@/hooks/useSubdomain";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isMobile() {
  return window.innerWidth < 768;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

const AAUS_ICON = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_icon_192_2af50158.png";
const IHE_ICON = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/icon-192_df958e9b.png";

export default function GetAppBanner() {
  const [visible, setVisible] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [location] = useLocation();
  const isIHE = useMemo(() => isIHeartEchoDomain(), []);
  const appName = isIHE ? "iHeartEcho™" : "UltrasoundAssist™";
  const appIcon = isIHE ? IHE_ICON : AAUS_ICON;

  useEffect(() => {
    // Only show on dashboard route
    if (location !== "/") return;
    // Never show if already installed as PWA
    if (isStandalone()) return;
    // Only show on mobile
    if (!isMobile()) return;

    // Capture the native install prompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js?build=v8").catch(() => {});
    }

    // Show banner after 2 seconds on dashboard load
    const timer = setTimeout(() => {
      setVisible(true);
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, [location]); // re-run whenever the route changes (so it shows again on each dashboard visit)

  // Hide when navigating away from dashboard
  useEffect(() => {
    if (location !== "/") {
      setVisible(false);
      setShowIosInstructions(false);
    }
  }, [location]);

  if (!visible) return null;

  function handleDismiss() {
    setVisible(false);
    setShowIosInstructions(false);
  }

  async function handleInstall() {
    if (isIOS()) {
      setShowIosInstructions(true);
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback: link to the app URL for manual install
      window.open(import.meta.env.VITE_APP_URL || "https://app.allaboutultrasound.com", "_blank");
    }
  }

  return (
    <>
      {/* Fixed bottom banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3 shadow-2xl"
        style={{
          background: "linear-gradient(90deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)",
          borderTop: "1px solid rgba(74, 217, 224, 0.3)",
        }}
      >
        {/* Left: icon + text */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={appIcon}
            alt={appName}
            className="w-10 h-10 rounded-xl flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">
              {appName}
            </p>
            <p className="text-[#4ad9e0] text-xs leading-tight truncate">
              Add to your home screen for quick access
            </p>
          </div>
        </div>

        {/* Right: Get App button + dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 bg-[#189aa1] hover:bg-[#15888e] text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
          >
            {isIOS() ? (
              <Share className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Get App
          </button>
          <button
            onClick={handleDismiss}
            className="text-white/50 hover:text-white p-1 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS instructions overlay */}
      {showIosInstructions && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowIosInstructions(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 text-center"
            style={{ background: "#0e2a35", border: "1px solid rgba(74,217,224,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={appIcon}
              alt={appName}
              className="w-16 h-16 rounded-2xl mx-auto mb-4"
            />
            <h3 className="text-white font-bold text-lg mb-2">Add to Home Screen</h3>
            <p className="text-white/70 text-sm mb-4 leading-relaxed">
              Install <strong className="text-white">{appName}</strong> for quick access from your home screen.
            </p>
            <ol className="text-left text-sm text-white/80 space-y-3 mb-6">
              <li className="flex items-start gap-2">
                <span className="bg-[#189aa1] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                <span>Tap the <strong className="text-[#4ad9e0]">Share</strong> button <Share className="w-4 h-4 inline text-[#4ad9e0]" /> in your Safari toolbar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-[#189aa1] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                <span>Scroll down and tap <strong className="text-[#4ad9e0]">"Add to Home Screen"</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-[#189aa1] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                <span>Tap <strong className="text-[#4ad9e0]">"Add"</strong> in the top-right corner</span>
              </li>
            </ol>
            <button
              onClick={() => { setShowIosInstructions(false); handleDismiss(); }}
              className="w-full bg-[#189aa1] hover:bg-[#15888e] text-white font-semibold py-3 rounded-full transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
