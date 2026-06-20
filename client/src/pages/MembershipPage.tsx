/**
 * MembershipPage — public-facing membership sales landing page.
 * Renders the admin-configured block content with a Stripe checkout CTA.
 * Route: /memberships/:slug
 */
import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BlockPreview } from "@/components/BlockPreview";
import IncludedItemsBlock from "@/components/IncludedItemsBlock";
import { RelatedProductsBlock } from "@/components/RelatedProductsBlock";
import { Check, Award, Loader2, Tag } from "lucide-react";
import { getLoginUrl } from "@/const";

const BILLING_LABELS: Record<string, string> = {
  monthly: "/month",
  annual: "/year",
  lifetime: " (lifetime)",
  one_time: "",
};

function formatPrice(price: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price / 100);
}

export default function MembershipPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [discountCode, setDiscountCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeError, setCodError] = useState<string | null>(null);

  const [appliedCodeId, setAppliedCodeId] = useState<number | null>(null);

  const { data: planData, isLoading } = trpc.membership.getBySlug.useQuery({ slug: slug ?? "" });
  const plan = planData?.plan ?? null;
  const membershipItems = planData?.items ?? [];

  // validateCode is a query — we trigger it manually via refetch
  const [codeToValidate, setCodeToValidate] = useState<string | null>(null);
  const validateCodeQuery = trpc.membership.validateCode.useQuery(
    { code: codeToValidate ?? "", planId: plan?.id ?? 0 },
    {
      enabled: !!codeToValidate && !!plan,
      retry: false,
      onSuccess: (result) => {
        setAppliedCode(codeToValidate!.toUpperCase());
        setAppliedCodeId(result.id);
        setCodError(null);
        const label = result.discountType === "percent"
          ? `${result.discountValue}% off`
          : `$${Number(result.discountValue).toFixed(2)} off`;
        toast.success(`Code applied: ${label}`);
      },
      onError: (e: any) => { setCodError(e.message); setAppliedCode(null); setAppliedCodeId(null); setCodeToValidate(null); toast.error(e.message); },
    }
  );

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);

  const checkoutMutation = trpc.membership.createCheckout.useMutation({
    onSuccess: (data) => {
      toast.success("Redirecting to checkout…");
      window.open(data.checkoutUrl, "_blank");
    },
    onError: (e: any) => {
      if (e?.data?.code === "BAD_REQUEST" && e.message?.toLowerCase().includes("already")) {
        toast.success("You already have access!", { description: "Redirecting to your dashboard..." });
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      } else {
        toast.error(e.message);
      }
    },
  });

  const selfEnrollFreeMutation = trpc.membership.selfEnrollFree.useMutation({
    onSuccess: () => {
      toast.success("You're in! Redirecting to your dashboard…");
      setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
    },
    onError: (e: any) => {
      if (e?.data?.code === "BAD_REQUEST" && e.message?.toLowerCase().includes("already")) {
        toast.success("You already have access!", { description: "Redirecting to your dashboard..." });
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      } else {
        toast.error(e.message);
      }
    },
  });

  const guestRegisterMutation = trpc.membership.guestCheckoutRegister.useMutation({
    onSuccess: (data) => {
      toast.success("Account ready — opening secure checkout…");
      window.location.href = data.checkoutPath;
    },
    onError: (e) => toast.error(e.message),
  });

  const isFree = !plan || !plan.price || Number(plan.price) === 0;

  const startCheckout = () => {
    if (!plan) return;
    // Free plan: skip Stripe entirely
    if (isFree) {
      if (!user) {
        // Redirect unauthenticated users to login with returnTo
        window.location.href = getLoginUrl(window.location.pathname);
        return;
      }
      selfEnrollFreeMutation.mutate({ planId: plan.id });
      return;
    }
    if (user) {
      checkoutMutation.mutate({
        planId: plan.id,
        discountCodeId: appliedCodeId ?? undefined,
        origin: window.location.origin,
      });
      return;
    }
    if (showGuestForm && guestName.trim() && guestEmail.trim()) {
      guestRegisterMutation.mutate({
        planSlug: slug ?? "",
        name: guestName.trim(),
        email: guestEmail.trim(),
        origin: window.location.origin,
      });
      return;
    }
    setShowGuestForm(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-500">
        <Award className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">Membership not found</p>
      </div>
    );
  }

  const blocks = plan.landingPageBlocks ? JSON.parse(plan.landingPageBlocks) : [];
  const bullets: string[] = plan.featureBullets ? JSON.parse(plan.featureBullets) : [];
  const accentColor = plan.accentColor ?? "#189aa1";

  // Compute discounted price
  let displayPrice = plan.price;
  let discountLabel: string | null = null;
  if (appliedCode && validateCodeQuery.data?.valid) {
    const { discountType, discountValue } = validateCodeQuery.data;
    if (discountType === "percent") {
      displayPrice = Math.round(plan.price * (1 - discountValue / 100));
      discountLabel = `${discountValue}% off`;
    } else {
      displayPrice = Math.max(0, plan.price - discountValue);
      discountLabel = `$${Number(discountValue).toFixed(2)} off`;
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* If admin configured blocks, render them */}
      {blocks.length > 0 ? (
        <div>
          {blocks.map((block: any) => {
            if (plan?.hidePricingOptions && (block.type === "pricing_options_auto" || block.type === "pricing_cards")) return null;
            // Use the real data-fetching component for related_products instead of BlockPreview's mock
            if (block.type === "related_products") {
              return <RelatedProductsBlock key={block.id} data={block.data ?? {}} currentType={undefined} />;
            }
            // Render included items using real membership items in admin sort order
            if (block.type === "included_items_auto") {
              return <IncludedItemsBlock key={block.id} data={block.data ?? {}} items={membershipItems} />;
            }
            return <BlockPreview key={block.id} block={block} onEnroll={startCheckout} onCheckoutPage={startCheckout} />;
          })}
        </div>
      ) : (
        /* Default sales page layout */
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: accentColor }}
            >
              <Award className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{plan.title}</h1>
            {plan.description && (
              <p className="text-lg text-gray-600 max-w-xl mx-auto">{plan.description}</p>
            )}
          </div>

          {/* Pricing card */}
          <div className="border-2 rounded-2xl p-8 mb-8 text-center" style={{ borderColor: accentColor }}>
            <div className="flex items-baseline justify-center gap-1 mb-1">
              <span className="text-4xl font-bold text-gray-900">
                {formatPrice(displayPrice, plan.currency)}
              </span>
              <span className="text-gray-500 text-lg">
                {BILLING_LABELS[plan.billingInterval]}
              </span>
            </div>
            {plan.compareAtPrice && (
              <p className="text-gray-400 line-through text-sm mb-1">
                {formatPrice(plan.compareAtPrice, plan.currency)}
              </p>
            )}
            {discountLabel && (
              <Badge className="bg-green-100 text-green-700 border-green-200 mb-2">
                <Tag className="w-3 h-3 mr-1" /> {discountLabel}
              </Badge>
            )}
            {(plan?.trialDays ?? 0) > 0 && (
              <p className="text-sm text-teal-600 font-medium mt-1">
                {plan!.trialDays}-day free trial
              </p>
            )}

            {/* Discount code */}
            <div className="flex gap-2 mt-6 max-w-xs mx-auto">
              <Input
                value={discountCode}
                onChange={(e) => { setDiscountCode(e.target.value.toUpperCase()); setCodError(null); setAppliedCode(null); }}
                placeholder="Discount code"
                className="font-mono uppercase text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!discountCode.trim() || validateCodeQuery.isFetching}
                onClick={() => setCodeToValidate(discountCode.trim())}
              >
                Apply
              </Button>
            </div>
            {codeError && <p className="text-xs text-red-500 mt-1">{codeError}</p>}
            {appliedCode && <p className="text-xs text-green-600 mt-1">✓ Code "{appliedCode}" applied</p>}

            {!user && showGuestForm && (
              <div className="mt-6 space-y-3 text-left">
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Full name"
                />
                <Input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Email address"
                />
              </div>
            )}
            <Button
              className="w-full mt-6 text-white font-semibold py-3 text-base rounded-xl"
              style={{ backgroundColor: accentColor }}
              disabled={checkoutMutation.isPending || guestRegisterMutation.isPending || selfEnrollFreeMutation.isPending}
              onClick={startCheckout}
            >
              {(checkoutMutation.isPending || guestRegisterMutation.isPending || selfEnrollFreeMutation.isPending) ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
              ) : isFree ? (
                "Join for Free"
              ) : (
                (plan?.trialDays ?? 0) > 0 ? `Start ${plan!.trialDays}-Day Free Trial` : "Get Access Now"
              )}
            </Button>
            {!user && !isFree && (
              <p className="text-xs text-gray-400 mt-2">
                {showGuestForm
                  ? "Enter your name and email to continue — no separate sign-up required."
                  : <>Already have an account? <a href={`/login?return=/memberships/${slug}`} className="text-teal-600 underline">Sign in</a></>}
              </p>
            )}
          </div>

          {/* Feature bullets */}
          {bullets.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">What's included</h3>
              <ul className="space-y-3">
                {bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: accentColor }} />
                    <span className="text-gray-700">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Floating CTA if blocks are used */}
      {blocks.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            className="shadow-xl text-white font-semibold px-6 py-3 rounded-xl"
            style={{ backgroundColor: accentColor }}
            disabled={checkoutMutation.isPending || selfEnrollFreeMutation.isPending}
            onClick={startCheckout}
            >
              {(checkoutMutation.isPending || selfEnrollFreeMutation.isPending) ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
              ) : isFree ? (
                "Join for Free"
              ) : (
                `Get ${plan?.title}`
              )}
          </Button>
        </div>
      )}
    </div>
  );
}
