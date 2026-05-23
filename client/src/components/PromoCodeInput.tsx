/**
 * PromoCodeInput.tsx
 * Reusable promo code entry widget for checkout forms.
 * Validates against Stripe via the downloadsLearner.validatePromoCode procedure,
 * then surfaces the discount description and passes the code up to the parent.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface PromoCodeInputProps {
  /** Called when a valid code is applied; pass null to clear */
  onApply: (code: string | null, discountText: string | null) => void;
  /** Optional CSS class for the wrapper */
  className?: string;
}

export default function PromoCodeInput({ onApply, className }: PromoCodeInputProps) {
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discountText, setDiscountText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const utils = trpc.useUtils();

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setChecking(true);
    setError(null);
    try {
      const result = await utils.client.downloadsLearner.validatePromoCode.query({ code: trimmed });
      if (result.valid) {
        setAppliedCode(trimmed);
        setDiscountText(result.discountText);
        onApply(trimmed, result.discountText);
        setCode("");
      } else {
        setError((result as any).message ?? "Invalid promo code");
      }
    } catch {
      setError("Could not validate promo code. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleClear = () => {
    setAppliedCode(null);
    setDiscountText(null);
    setError(null);
    setCode("");
    onApply(null, null);
  };

  if (appliedCode) {
    return (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 font-mono text-xs px-2 py-0.5">
          {appliedCode}
        </Badge>
        <span className="text-sm text-green-700 font-medium">{discountText} applied</span>
        <button
          onClick={handleClear}
          className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
          title="Remove promo code"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApply(); } }}
            placeholder="Promo code"
            className="pl-9 font-mono text-sm uppercase tracking-wider"
            disabled={checking}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleApply}
          disabled={!code.trim() || checking}
          className="shrink-0 px-4"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
