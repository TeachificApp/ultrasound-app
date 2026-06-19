/**
 * StripePriceIdPicker.tsx
 * Allows admins to either enter an existing Stripe Price ID or create a new
 * Stripe product + price inline. Used in routing rule Stripe settings panels.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, CheckCircle2, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Props {
  value: string | undefined;
  onChange: (priceId: string | undefined) => void;
  checkoutMode?: "payment" | "subscription";
}

export default function StripePriceIdPicker({ value, onChange, checkoutMode = "payment" }: Props) {
  const [mode, setMode] = useState<"existing" | "create">("existing");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmountDollars, setNewAmountDollars] = useState("");
  const [newInterval, setNewInterval] = useState<"month" | "year">("month");

  const createProduct = trpc.formBuilder.createStripeProduct.useMutation({
    onSuccess: (data) => {
      onChange(data.priceId);
      toast.success(`Stripe product created! Price ID: ${data.priceId}`);
      setMode("existing");
      setNewName("");
      setNewDescription("");
      setNewAmountDollars("");
    },
    onError: (err) => {
      toast.error(`Failed to create Stripe product: ${err.message}`);
    },
  });

  const handleCreate = () => {
    const amountCents = Math.round(parseFloat(newAmountDollars) * 100);
    if (!newName.trim()) { toast.error("Product name is required"); return; }
    if (isNaN(amountCents) || amountCents < 50) { toast.error("Amount must be at least $0.50"); return; }
    createProduct.mutate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      amountCents,
      mode: checkoutMode,
      interval: checkoutMode === "subscription" ? newInterval : undefined,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-xs">Stripe Price ID</Label>
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${mode === "existing" ? "bg-cyan-600 text-white border-cyan-600" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}
          >
            Enter existing
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${mode === "create" ? "bg-cyan-600 text-white border-cyan-600" : "border-gray-300 text-gray-500 hover:border-gray-400"}`}
          >
            <Plus className="w-3 h-3 inline mr-0.5" />Create new
          </button>
        </div>
      </div>

      {mode === "existing" && (
        <div className="space-y-1">
          <Input
            value={value ?? ""}
            onChange={e => onChange(e.target.value || undefined)}
            placeholder="price_xxx"
            className="h-8 text-xs font-mono"
          />
          {value && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-600 font-mono">{value}</span>
              <a
                href={`https://dashboard.stripe.com/prices/${value}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
              >
                View in Stripe <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {mode === "create" && (
        <div className="border rounded-md p-3 space-y-2 bg-gray-50">
          <p className="text-xs font-medium text-gray-700">Create a new Stripe product</p>
          <div>
            <Label className="text-xs text-gray-600">Product name *</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Echo Fundamentals Course"
              className="mt-0.5 h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Description (optional)</Label>
            <Input
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Short description shown on Stripe checkout"
              className="mt-0.5 h-8 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs text-gray-600">Price (USD) *</Label>
              <div className="relative mt-0.5">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                <Input
                  value={newAmountDollars}
                  onChange={e => setNewAmountDollars(e.target.value)}
                  placeholder="49.00"
                  type="number"
                  min="0.50"
                  step="0.01"
                  className="h-8 text-xs pl-6"
                />
              </div>
            </div>
            {checkoutMode === "subscription" && (
              <div>
                <Label className="text-xs text-gray-600">Billing interval</Label>
                <select
                  value={newInterval}
                  onChange={e => setNewInterval(e.target.value as "month" | "year")}
                  className="mt-0.5 h-8 text-xs border rounded px-2 bg-white"
                >
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={createProduct.isPending || !newName.trim() || !newAmountDollars}
              className="text-xs h-7 text-white bg-cyan-600 hover:bg-cyan-700"
            >
              {createProduct.isPending ? (
                <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Creating…</>
              ) : (
                <><Plus className="w-3 h-3 mr-1" /> Create &amp; Use</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMode("existing")}
              className="text-xs h-7"
            >
              Cancel
            </Button>
          </div>
          {value && (
            <Badge variant="outline" className="text-xs font-mono text-green-700 border-green-300">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {value}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
