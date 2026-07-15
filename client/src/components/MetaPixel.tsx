/**
 * MetaPixel — injects the correct Meta (Facebook) Pixel for the current domain.
 *
 * Pixel IDs are stored in the DB (site_settings table) and fetched via tRPC.
 * The correct pixel is chosen based on the current hostname:
 *   - app.allaboutultrasound.com  → aaus pixel
 *   - app.iheartecho.com          → ihe pixel
 *   - learn.allaboutultrasound.com → learn pixel
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { isLearnDomain, isIHeartEchoDomain } from "@/hooks/useSubdomain";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
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

export function MetaPixel() {
  const { data: pixelIds } = trpc.siteSettings.getPixelIds.useQuery(undefined, {
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

    if (pixelId) {
      injectPixel(pixelId);
    }
  }, [pixelIds]);

  return null;
}
