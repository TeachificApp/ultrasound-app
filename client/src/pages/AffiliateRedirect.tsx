import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";

/**
 * /ref/:slug — tracks an affiliate link click and redirects to the destination URL.
 * This is a public page (no auth required).
 */
export default function AffiliateRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const track = trpc.lmsAdmin.trackAffiliateClick.useMutation();

  useEffect(() => {
    if (!slug) return;
    track.mutate(
      { slug },
      {
        onSuccess: (data: any) => {
          if (data?.destinationUrl) {
            window.location.replace(data.destinationUrl);
          } else {
            // Fallback to homepage if no destination
            window.location.replace("/");
          }
        },
        onError: () => {
          // Even on error, redirect to homepage
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
