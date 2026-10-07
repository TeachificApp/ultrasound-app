/**
 * MetaPixel — injects the correct Meta (Facebook) Pixel for the current domain.
 *
 * Pixel IDs are stored in the DB (site_settings table) and fetched via tRPC.
 * The correct pixel is chosen based on the current hostname:
 *   - app.allaboutultrasound.com  → aaus pixel
 *   - app.iheartecho.com          → ihe pixel
 *   - learn.allaboutultrasound.com → learn pixel
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { isLearnDomain, isIHeartEchoDomain } from "@/hooks/useSubdomain";
import { deferUntilIdle } from "@/lib/deferUntilIdle";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const META_PIXEL_READY_EVENT = "meta-pixel-ready";
const PURCHASE_STORAGE_PREFIX = "meta-pixel-purchase:";

function isValidMetaPixelId(pixelId: string): boolean {
  return /^\d{5,32}$/.test(pixelId);
}

function injectPixel(pixelId: string) {
  if (document.getElementById("meta-pixel-script")) return; // already injected

  // Standard Meta Pixel base code
  const script = document.createElement("script");
  script.id = "meta-pixel-script";
  script.innerHTML = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;
  document.head.insertBefore(script, document.head.firstChild);
  window.dispatchEvent(new Event(META_PIXEL_READY_EVENT));

  // Noscript fallback
  const noscript = document.createElement("noscript");
  noscript.id = "meta-pixel-noscript";
  const img = document.createElement("img");
  img.height = 1;
  img.width = 1;
  img.style.display = "none";
  img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.head.insertBefore(noscript, document.head.firstChild);
}

/**
 * Records one browser-side Purchase event after the application has verified a
 * paid Stripe return. Deliberately sends no price, currency, email, order, or
 * checkout-session data to Meta; the local session key only prevents a reload
 * from being counted as another conversion.
 */
export function trackMetaPurchaseOnce(checkoutSessionId: string): void {
  if (typeof window === "undefined" || !checkoutSessionId) return;

  const storageKey = `${PURCHASE_STORAGE_PREFIX}${checkoutSessionId}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
  } catch {
    // Private browsing may deny storage; still attempt the one current-page event.
  }

  let sent = false;
  const send = () => {
    if (sent || typeof window.fbq !== "function") return;
    sent = true;
    window.fbq("track", "Purchase", {});
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Tracking must never block the verified post-purchase experience.
    }
  };

  send();
  if (!sent) {
    window.addEventListener(META_PIXEL_READY_EVENT, send, { once: true });
  }
}

export function MetaPixel() {
  const [ready, setReady] = useState(false);
  useEffect(() => deferUntilIdle(() => setReady(true)), []);

  const { data: pixelIds } = trpc.siteSettings.getPixelIds.useQuery(undefined, {
    enabled: ready,
    staleTime: 1000 * 60 * 60, // cache for 1 hour
    retry: false,
  });

  useEffect(() => {
    if (!pixelIds) return;

    let pixelId: string | null = null;

    if (isLearnDomain()) {
      pixelId = pixelIds.learn;
    } else if (isIHeartEchoDomain()) {
      pixelId = pixelIds.ihe;
    } else {
      // Default: AAUS (app.allaboutultrasound.com and any other domain)
      pixelId = pixelIds.aaus;
    }

    if (pixelId && isValidMetaPixelId(pixelId)) {
      injectPixel(pixelId);
    }
  }, [pixelIds]);

  return null;
}
