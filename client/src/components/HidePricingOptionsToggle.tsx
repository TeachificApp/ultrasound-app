/**
 * HidePricingOptionsToggle
 *
 * A reusable toggle card for the "Hide additional pricing options" feature.
 * When enabled, the product landing page / checkout page will only show the
 * currently selected pricing option and hide the switcher that lets buyers
 * choose between multiple pricing tiers.
 *
 * Usage: drop inside any product admin "After Purchase" or "Pricing" tab.
 */

import React, { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface HidePricingOptionsToggleProps {
  /** Current value (controlled) */
  value: boolean;
  /** Called with new value when toggle changes */
  onChange: (v: boolean) => void;
  /** Whether a save is in progress */
  isSaving?: boolean;
}

export function HidePricingOptionsToggle({
  value,
  onChange,
  isSaving,
}: HidePricingOptionsToggleProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-start gap-4">
      <div className="flex-shrink-0 mt-0.5">
        <EyeOff className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Hide additional pricing options</p>
            <p className="text-xs text-gray-500 mt-0.5">
              When enabled, the pricing options switcher will be hidden on the landing page and
              checkout — buyers will only see the default pricing tier. Useful when you want to
              direct buyers to a specific price point.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
            <Switch
              checked={value}
              onCheckedChange={onChange}
              disabled={isSaving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
