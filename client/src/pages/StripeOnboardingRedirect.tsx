/**
 * StripeOnboardingRedirect.tsx
 * Public page at /stripe-onboarding/:token
 *
 * Partners receive a link to this page in their email.
 * No site login is required — the token identifies the partner.
 * On load, it calls the public tRPC procedure to get a fresh Stripe
 * onboarding URL and immediately redirects the user there.
 */
import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StripeOnboardingRedirect() {
  const { token } = useParams<{ token: string }>();
  const [redirected, setRedirected] = useState(false);

  const mutation = trpc.revenueShare.getOnboardingLinkByToken.useMutation({
    onSuccess: (data) => {
      if (data?.url) {
        setRedirected(true);
        window.location.href = data.url;
      }
    },
  });

  useEffect(() => {
    if (token && !mutation.isPending && !mutation.isSuccess && !mutation.isError) {
      mutation.mutate({ token });
    }
  }, [token]);

  if (!token) {
    return <ErrorState message="Invalid onboarding link. Please contact admin@allaboutultrasound.com." />;
  }

  if (mutation.isPending || redirected) {
    return (
      <div className="min-h-screen bg-[#f0fafa] flex flex-col items-center justify-center gap-4 px-4">
        <div className="bg-white rounded-xl shadow-sm border border-[#d0f0f2] p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#189aa115" }}>
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#189aa1" }} />
          </div>
          <h1 className="text-lg font-bold text-gray-800 mb-1">Connecting to Stripe…</h1>
          <p className="text-sm text-gray-500">You'll be redirected to Stripe to complete your account setup. This only takes a moment.</p>
        </div>
        <p className="text-xs text-gray-400">All About Ultrasound™ · Revenue Share Program</p>
      </div>
    );
  }

  if (mutation.isError) {
    return <ErrorState message={(mutation.error as any)?.message || "This onboarding link is invalid or has expired. Please contact admin@allaboutultrasound.com to request a new link."} />;
  }

  return null;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#f0fafa] flex flex-col items-center justify-center gap-4 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8 max-w-sm w-full text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-gray-800 mb-2">Link Not Found</h1>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <Button asChild variant="outline" className="gap-1.5">
          <a href="mailto:admin@allaboutultrasound.com">
            <ExternalLink className="w-4 h-4" /> Contact Support
          </a>
        </Button>
      </div>
      <p className="text-xs text-gray-400">All About Ultrasound™ · Revenue Share Program</p>
    </div>
  );
}
