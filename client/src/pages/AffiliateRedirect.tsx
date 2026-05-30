import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";

/**
 * /ref/:slug — tracks an affiliate link click, stores the affiliate code in
 * localStorage (30-day attribution window), and redirects to the destination URL.
 * This is a public page (no auth required).
 */

export const AFFILIATE_CODE_KEY = "aau_aff_code";
export const AFFILIATE_CODE_EXPIRY_KEY = "aau_aff_expiry";
export const AFFILIATE_WINDOW_DAYS = 30;

export function storeAffiliateCode(code: string) {
  const expiry = Date.now() + AFFILIATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  try {
    localStorage.setItem(AFFILIATE_CODE_KEY, code);
    localStorage.setItem(AFFILIATE_CODE_EXPIRY_KEY, String(expiry));
  } catch {}
}

export function getStoredAffiliateCode(): string | null {
  try {
    const code = localStorage.getItem(AFFILIATE_CODE_KEY);
    const expiry = localStorage.getItem(AFFILIATE_CODE_EXPIRY_KEY);
    if (!code || !expiry) return null;
    if (Date.now() > Number(expiry)) {
      localStorage.removeItem(AFFILIATE_CODE_KEY);
      localStorage.removeItem(AFFILIATE_CODE_EXPIRY_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearAffiliateCode() {
  try {
    localStorage.removeItem(AFFILIATE_CODE_KEY);
    localStorage.removeItem(AFFILIATE_CODE_EXPIRY_KEY);
  } catch {}
}

export default function AffiliateRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const track = trpc.lmsAdmin.trackAffiliateClick.useMutation();

  useEffect(() => {
    if (!slug) return;
    track.mutate(
      { slug },
      {
        onSuccess: (data: any) => {
          // Store the affiliate code for checkout attribution (30-day window)
          if (data?.affiliateCode) {
            storeAffiliateCode(data.affiliateCode);
          }
          if (data?.destinationUrl) {
            window.location.replace(data.destinationUrl);
          } else {
            window.location.replace("/");
          }
        },
        onError: () => {
          window.location.replace("/");
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Redirecting…</p>
      </div>
    </div>
  );
}
