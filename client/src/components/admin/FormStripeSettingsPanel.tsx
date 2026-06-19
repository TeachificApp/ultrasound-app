/**
 * FormStripeSettingsPanel.tsx
 * Shared admin UI component for configuring Stripe checkout on a form.
 * Used in both GeneralFormBuilder and FormBuilderAdmin (DIY forms).
 */
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FormStripeSettings {
  stripeEnabled: boolean;
  stripeCheckoutMode: "payment" | "subscription";
  stripePriceId: string;
  stripeAmount: string; // display in dollars, e.g. "49.00"
  stripeSuccessUrl: string;
  stripeCancelUrl: string;
}

interface Props {
  value: FormStripeSettings;
  onChange: (v: FormStripeSettings) => void;
}

export default function FormStripeSettingsPanel({ value, onChange }: Props) {
  const set = (patch: Partial<FormStripeSettings>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-200">
        <div>
          <p className="text-sm font-medium text-gray-800">Enable Stripe Checkout</p>
          <p className="text-xs text-gray-500">
            After form submission, redirect the user to a Stripe Checkout page.
          </p>
        </div>
        <Switch
          checked={value.stripeEnabled}
          onCheckedChange={v => set({ stripeEnabled: v })}
        />
      </div>

      {value.stripeEnabled && (
        <div className="space-y-3 pl-1">
          {/* Checkout mode */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Checkout Mode</Label>
            <Select
              value={value.stripeCheckoutMode}
              onValueChange={v => set({ stripeCheckoutMode: v as "payment" | "subscription" })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment">One-time Payment</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price ID */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Stripe Price ID <span className="text-gray-400">(recommended)</span>
            </Label>
            <Input
              value={value.stripePriceId}
              onChange={e => set({ stripePriceId: e.target.value })}
              placeholder="price_1ABC..."
              className="text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              From your Stripe Dashboard → Products. If set, this takes priority over the amount below.
            </p>
          </div>

          {/* Fallback amount */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Fallback Amount (USD) <span className="text-gray-400">(if no Price ID)</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                value={value.stripeAmount}
                onChange={e => set({ stripeAmount: e.target.value })}
                placeholder="49.00"
                className="text-sm pl-7"
                type="number"
                min="0.50"
                step="0.01"
              />
            </div>
          </div>

          {/* Success URL */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Success URL <span className="text-gray-400">(optional)</span>
            </Label>
            <Input
              value={value.stripeSuccessUrl}
              onChange={e => set({ stripeSuccessUrl: e.target.value })}
              placeholder="https://yoursite.com/thank-you?id={{submission_id}}"
              className="text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Use <code className="bg-gray-100 px-1 rounded">{"{{submission_id}}"}</code> as a placeholder. Defaults to the form page with a success query param.
            </p>
          </div>

          {/* Cancel URL */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Cancel URL <span className="text-gray-400">(optional)</span>
            </Label>
            <Input
              value={value.stripeCancelUrl}
              onChange={e => set({ stripeCancelUrl: e.target.value })}
              placeholder="https://yoursite.com/"
              className="text-sm"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Note:</strong> The Stripe checkout will open in the same tab after the form is submitted. Access grants from routing rules still apply before the redirect.
          </div>
        </div>
      )}
    </div>
  );
}
