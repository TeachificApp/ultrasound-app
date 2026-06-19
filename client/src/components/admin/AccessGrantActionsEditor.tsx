/**
 * AccessGrantActionsEditor.tsx
 * Shared admin UI component for configuring product access grants on routing rules.
 * Used in both FormSuccessModulesTab and DIYFormSuccessModulesTab.
 *
 * Value is a JSON string: Array<{productType: string, productId: number}>
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

export type ProductType = "course" | "download" | "bundle" | "membership" | "webinar";

export interface AccessGrantAction {
  productType: ProductType;
  productId: number | string; // string during editing
}

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  course: "Course",
  download: "Download / Digital Product",
  bundle: "Bundle",
  membership: "Membership Plan",
  webinar: "Webinar",
};

interface Props {
  /** JSON string or undefined */
  value: string | null | undefined;
  onChange: (json: string | undefined) => void;
}

function parseActions(json: string | null | undefined): AccessGrantAction[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export default function AccessGrantActionsEditor({ value, onChange }: Props) {
  const [actions, setActions] = useState<AccessGrantAction[]>(() => parseActions(value));

  const commit = (updated: AccessGrantAction[]) => {
    setActions(updated);
    const valid = updated.filter(a => a.productId && Number(a.productId) > 0);
    onChange(valid.length > 0 ? JSON.stringify(valid.map(a => ({ productType: a.productType, productId: Number(a.productId) }))) : undefined);
  };

  const addAction = () => {
    commit([...actions, { productType: "course", productId: "" }]);
  };

  const removeAction = (idx: number) => {
    commit(actions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, patch: Partial<AccessGrantAction>) => {
    commit(actions.map((a, i) => i === idx ? { ...a, ...patch } : a));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">Grant Product Access on Match</p>
      <p className="text-xs text-gray-500">
        When this routing rule matches, immediately grant the submitter access to the following products.
      </p>

      {actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={action.productType}
                onValueChange={v => updateAction(idx, { productType: v as ProductType })}
              >
                <SelectTrigger className="text-xs h-8 w-44 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map(pt => (
                    <SelectItem key={pt} value={pt} className="text-xs">
                      {PRODUCT_TYPE_LABELS[pt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={String(action.productId)}
                onChange={e => updateAction(idx, { productId: e.target.value })}
                placeholder="Product ID"
                className="text-xs h-8 w-28"
                type="number"
                min="1"
              />
              <button
                type="button"
                onClick={() => removeAction(idx)}
                className="text-red-400 hover:text-red-600 transition-colors p-1 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addAction}
        className="text-xs h-7 gap-1"
      >
        <Plus className="w-3 h-3" /> Add Access Grant
      </Button>

      {actions.length > 0 && (
        <p className="text-xs text-gray-400">
          Enter the numeric database ID for each product. You can find IDs in the respective admin pages.
        </p>
      )}
    </div>
  );
}
