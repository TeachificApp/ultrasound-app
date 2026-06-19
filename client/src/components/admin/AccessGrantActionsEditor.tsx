/**
 * AccessGrantActionsEditor.tsx
 * Shared admin UI component for configuring product access grants on routing rules.
 * Used in both FormSuccessModulesTab and DIYFormSuccessModulesTab.
 *
 * Value is a JSON string: Array<{productType: string, productId: number}>
 * Products are dynamically loaded from the DB — no manual ID entry required.
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export type ProductType = "course" | "download" | "bundle" | "physical";

export interface AccessGrantAction {
  productType: ProductType;
  productId: number | string;
}

interface Props {
  /** JSON string or undefined */
  value: string | null | undefined;
  onChange: (json: string | undefined) => void;
}

function parseActions(json: string | null | undefined): AccessGrantAction[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.map((a: any) => ({
      productType: (a.productType === "membership" || a.productType === "webinar") ? "course" : a.productType as ProductType,
      productId: a.productId,
    }));
  } catch {}
  return [];
}

export default function AccessGrantActionsEditor({ value, onChange }: Props) {
  const [actions, setActions] = useState<AccessGrantAction[]>(() => parseActions(value));

  const { data: products, isLoading } = trpc.formBuilder.listGrantableProducts.useQuery(undefined, {
    staleTime: 60_000,
  });

  const optionsByType = useMemo(() => {
    if (!products) return { course: [], download: [], bundle: [], physical: [] } as Record<ProductType, Array<{ id: number; label: string }>>;
    return {
      course: products.courses.map(c => ({ id: c.id, label: `${c.title}${c.status !== 'public' ? ` (${c.status})` : ''}` })),
      download: products.downloads.map(d => ({ id: d.id, label: `${d.title}${d.status !== 'published' ? ` (${d.status})` : ''}` })),
      bundle: products.bundles.map(b => ({ id: b.id, label: b.title })),
      physical: products.physical.map(p => ({ id: p.id, label: `${p.title}${p.status !== 'published' ? ` (${p.status})` : ''}` })),
    };
  }, [products]);

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
    const newPatch = patch.productType ? { ...patch, productId: "" } : patch;
    commit(actions.map((a, i) => i === idx ? { ...a, ...newPatch } : a));
  };

  const TYPE_LABELS: Record<ProductType, string> = {
    course: "Course / Quiz / Workshop",
    download: "Digital Download",
    bundle: "Digital Bundle",
    physical: "Physical Product",
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">Grant Product Access on Match</p>
      <p className="text-xs text-gray-500">
        When this routing rule matches, immediately grant the submitter access to the following products.
      </p>
      {isLoading && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading products…
        </div>
      )}
      {actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action, idx) => {
            const opts = optionsByType[action.productType] ?? [];
            return (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                <Select
                  value={action.productType}
                  onValueChange={v => updateAction(idx, { productType: v as ProductType })}
                >
                  <SelectTrigger className="text-xs h-8 w-44 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as ProductType[]).map(pt => (
                      <SelectItem key={pt} value={pt} className="text-xs">
                        {TYPE_LABELS[pt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={action.productId ? String(action.productId) : ""}
                  onValueChange={v => updateAction(idx, { productId: v })}
                  disabled={isLoading || opts.length === 0}
                >
                  <SelectTrigger className="text-xs h-8 flex-1 min-w-[180px]">
                    <SelectValue placeholder={opts.length === 0 ? "No products available" : "Select a product…"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-xs">{TYPE_LABELS[action.productType]}</SelectLabel>
                      {opts.map(o => (
                        <SelectItem key={o.id} value={String(o.id)} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => removeAction(idx)}
                  className="text-red-400 hover:text-red-600 transition-colors p-1 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addAction}
        className="text-xs h-7 gap-1"
        disabled={isLoading}
      >
        <Plus className="w-3 h-3" /> Add Access Grant
      </Button>
    </div>
  );
}
