/**
 * OrderBumpOffer.tsx
 * Displays an order bump offer card — used on success pages (after checkout)
 * and on landing pages (before checkout).
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";

interface OrderBumpOfferProps {
  triggerType: "course" | "quiz" | "download" | "bundle" | "physical" | "cohort" | "webinar" | "membership";
  triggerProductId: number;
  timing: "before_checkout" | "after_checkout";
  onAccept?: (bumpData: { bumpId: number; bumpType: string; bumpProductId: number; bumpPrice: number; headline?: string | null }) => void;
  onDecline?: () => void;
}

export default function OrderBumpOffer({ triggerType, triggerProductId, timing, onAccept, onDecline }: OrderBumpOfferProps) {
  const [dismissed, setDismissed] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const { data: bumps, isLoading } = trpc.orderBumps.getForProduct.useQuery(
    { triggerType, triggerProductId, timing },
    { enabled: !!triggerProductId }
  );

  const recordImpression = trpc.orderBumps.recordImpression.useMutation();
  const acceptBump = trpc.orderBumps.acceptBump.useMutation({
    onSuccess: (data) => {
      setAccepted(true);
      toast.success("Added to your order!");
      onAccept?.({ bumpId: data.bumpId, bumpType: data.bumpType, bumpProductId: data.bumpProductId, bumpPrice: data.bumpPrice, headline: data.headline });
    },
    onError: (e) => toast.error(e.message),
  });

  // Record impression when bump is shown
  useEffect(() => {
    if (bumps && bumps.length > 0 && !dismissed) {
      bumps.forEach((bump: any) => {
        recordImpression.mutate({ bumpId: bump.id });
      });
    }
  }, [bumps?.length]);

  if (isLoading || !bumps || bumps.length === 0 || dismissed || accepted) return null;

  // Show the first active bump
  const bump = bumps[0] as any;

  function handleAccept() {
    if (timing === "before_checkout" && onAccept) {
      setAccepted(true);
      toast.success("Order bump added to checkout.");
      onAccept({
        bumpId: bump.id,
        bumpType: bump.bumpType,
        bumpProductId: bump.bumpProductId,
        bumpPrice: bump.bumpPrice,
        headline: bump.headline,
      });
      return;
    }
    acceptBump.mutate({
      bumpId: bump.id,
      triggerOrderType: triggerType as any,
    });
  }

  function handleDecline() {
    setDismissed(true);
    onDecline?.();
  }

  return (
    <div className="relative border-2 border-dashed border-amber-300 rounded-xl p-6 bg-gradient-to-br from-amber-50 to-white shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Close button */}
      <button onClick={handleDecline} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
        <X size={16} />
      </button>

      {/* Discount badge */}
      <div className="flex flex-wrap gap-2 mb-3">
        {bump.discountLabel && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 shadow-sm">
            {bump.discountLabel}
          </span>
        )}
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
          bump.bumpType === "physical" ? "bg-amber-100 text-amber-700" :
          bump.bumpType === "webinar" ? "bg-purple-100 text-purple-700" :
          bump.bumpType === "membership" ? "bg-indigo-100 text-indigo-700" :
          "bg-blue-100 text-blue-700"
        }`}>
          {bump.bumpType === "physical" ? "Physical add-on" :
           bump.bumpType === "webinar" ? "Webinar" :
           bump.bumpType === "membership" ? "Membership" :
           bump.bumpType === "course" ? "Course" :
           bump.bumpType === "quiz" ? "Quiz" :
           bump.bumpType === "bundle" ? "Bundle" :
           bump.bumpType === "cohort" ? "Cohort" :
           "Digital add-on"}
        </span>
      </div>

      {/* Headline */}
      <div className="flex items-start gap-2 mb-2">
        <Sparkles size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          {bump.headline && <h3 className="text-lg font-bold text-gray-900">{bump.headline}</h3>}
          {bump.subheadline && <p className="text-sm text-gray-600 mt-0.5">{bump.subheadline}</p>}
        </div>
      </div>

      {/* Image */}
      {bump.imageUrl && (
        <img src={bump.imageUrl} alt="" className="w-full h-40 object-cover rounded-lg mt-3 mb-3" />
      )}

      {/* Body content */}
      {bump.bodyHtml && (
        <div className="prose prose-sm text-gray-700 mt-3 mb-4" dangerouslySetInnerHTML={{ __html: bump.bodyHtml }} />
      )}

      {/* CTA buttons */}
      <div className="flex flex-col gap-2 mt-4">
        <Button
          onClick={handleAccept}
          disabled={acceptBump.isPending}
          className="w-full py-3 text-white font-semibold shadow-md hover:shadow-lg transition-all"
          style={{ backgroundColor: bump.ctaColor }}
        >
          {acceptBump.isPending ? "Adding..." : `${bump.ctaText} - $${Number(bump.bumpPrice).toFixed(2)}`}
        </Button>
        <button onClick={handleDecline} className="text-xs text-gray-400 hover:text-gray-600 underline text-center py-1">
          {bump.skipText}
        </button>
      </div>
    </div>
  );
}
