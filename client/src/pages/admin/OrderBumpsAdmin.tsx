/**
 * OrderBumpsAdmin.tsx
 * Admin panel for managing order bumps — create, edit, delete bump offers
 * with editable landing page content and product connections.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Plus, Trash2, Edit, ToggleLeft, ToggleRight, TrendingUp,
  ArrowRight, Package, BookOpen, Download, Layers, X,
} from "lucide-react";

type OrderBump = {
  id: number;
  triggerType: "course" | "download" | "bundle";
  triggerProductId: number;
  bumpType: "course" | "download" | "bundle" | "physical";
  bumpProductId: number;
  timing: "before_checkout" | "after_checkout";
  bumpPrice: number;
  discountLabel: string | null;
  headline: string | null;
  subheadline: string | null;
  bodyHtml: string | null;
  imageUrl: string | null;
  ctaText: string;
  ctaColor: string;
  skipText: string;
  isActive: boolean;
  impressions: number;
  conversions: number;
  createdAt: string;
  updatedAt: string;
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen size={14} className="text-teal-600" />,
  download: <Download size={14} className="text-blue-600" />,
  bundle: <Layers size={14} className="text-purple-600" />,
  physical: <Package size={14} className="text-amber-600" />,
};

export default function OrderBumpsAdmin() {
  const utils = trpc.useUtils();
  const { data: bumps, isLoading } = trpc.orderBumpsAdmin.list.useQuery();
  const [editingBump, setEditingBump] = useState<OrderBump | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Get product names for display
  const { data: coursesResult } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", page: 1, pageSize: 200 });
  const { data: downloads } = trpc.downloadsAdmin.list.useQuery();
  const courses = coursesResult?.courses ?? [];

  const deleteMutation = trpc.orderBumpsAdmin.delete.useMutation({
    onSuccess: () => { toast.success("Order bump deleted"); utils.orderBumpsAdmin.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.orderBumpsAdmin.update.useMutation({
    onSuccess: () => { toast.success("Order bump updated"); utils.orderBumpsAdmin.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function getProductName(type: string, id: number): string {
    if (type === "course" || type === "quiz") {
      const course = courses?.find((c: any) => c.id === id);
      return course?.title ?? `Course #${id}`;
    }
    if (type === "download") {
      const dl = downloads?.find((d: any) => d.id === id);
      return dl?.title ?? `Download #${id}`;
    }
    if (type === "physical") return `Physical item #${id}`;
    return `Bundle #${id}`;
  }

  function toggleActive(bump: OrderBump) {
    updateMutation.mutate({ id: bump.id, isActive: !bump.isActive });
  }

  if (isLoading) return <div className="text-center py-8 text-gray-400">Loading order bumps...</div>;

  // Show editor if creating or editing
  if (isCreating || editingBump) {
    return (
      <OrderBumpEditor
        bump={editingBump}
        courses={courses ?? []}
        downloads={downloads ?? []}
        onClose={() => { setIsCreating(false); setEditingBump(null); }}
        onSaved={() => { setIsCreating(false); setEditingBump(null); utils.orderBumpsAdmin.list.invalidate(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Order Bumps</h3>
          <p className="text-xs text-gray-500">Show upsell offers before or after checkout to increase average order value.</p>
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Plus size={14} className="mr-1" /> New Order Bump
        </Button>
      </div>

      {(!bumps || bumps.length === 0) ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Package size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No order bumps yet. Create one to start upselling!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bumps.map((bump: any) => (
            <div key={bump.id} className={`border rounded-lg p-4 transition-all ${bump.isActive ? "border-teal-200 bg-white" : "border-gray-200 bg-gray-50 opacity-70"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${bump.timing === "before_checkout" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {bump.timing === "before_checkout" ? "Before Checkout" : "After Checkout"}
                    </span>
                    {!bump.isActive && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1">{TYPE_ICONS[bump.triggerType]} {getProductName(bump.triggerType, bump.triggerProductId)}</span>
                    <ArrowRight size={12} className="text-gray-400" />
                    <span className="flex items-center gap-1 font-medium text-teal-700">{TYPE_ICONS[bump.bumpType]} {getProductName(bump.bumpType, bump.bumpProductId)}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Price: <strong className="text-gray-700">${(bump.bumpPrice / 100).toFixed(2)}</strong></span>
                    {bump.discountLabel && <span className="text-green-600">{bump.discountLabel}</span>}
                    <span className="flex items-center gap-1"><TrendingUp size={10} /> {bump.conversions}/{bump.impressions} ({bump.impressions > 0 ? ((bump.conversions / bump.impressions) * 100).toFixed(1) : "0"}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(bump)} className="p-1.5 rounded hover:bg-gray-100" title={bump.isActive ? "Deactivate" : "Activate"}>
                    {bump.isActive ? <ToggleRight size={18} className="text-teal-600" /> : <ToggleLeft size={18} className="text-gray-400" />}
                  </button>
                  <button onClick={() => setEditingBump(bump)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-teal-600" title="Edit"><Edit size={14} /></button>
                  <button onClick={() => { if (confirm("Delete this order bump?")) deleteMutation.mutate({ id: bump.id }); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Order Bump Editor ───────────────────────────────────────────────────────
function OrderBumpEditor({ bump, courses, downloads, onClose, onSaved }: {
  bump: OrderBump | null;
  courses: any[];
  downloads: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !bump;
  const [form, setForm] = useState({
    triggerType: bump?.triggerType ?? "course" as "course" | "download" | "bundle",
    triggerProductId: bump?.triggerProductId ?? 0,
    bumpType: bump?.bumpType ?? "download" as "course" | "download" | "bundle" | "physical",
    bumpProductId: bump?.bumpProductId ?? 0,
    timing: bump?.timing ?? "after_checkout" as "before_checkout" | "after_checkout",
    bumpPrice: bump?.bumpPrice ?? 0,
    discountLabel: bump?.discountLabel ?? "",
    headline: bump?.headline ?? "Special One-Time Offer!",
    subheadline: bump?.subheadline ?? "Add this to your order at a special price",
    bodyHtml: bump?.bodyHtml ?? "",
    imageUrl: bump?.imageUrl ?? "",
    ctaText: bump?.ctaText ?? "Add to Order",
    ctaColor: bump?.ctaColor ?? "#179ca3",
    skipText: bump?.skipText ?? "No thanks, continue",
    isActive: bump?.isActive ?? true,
  });

  const createMutation = trpc.orderBumpsAdmin.create.useMutation({
    onSuccess: () => { toast.success("Order bump created"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.orderBumpsAdmin.update.useMutation({
    onSuccess: () => { toast.success("Order bump updated"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  function handleSave() {
    if (!form.triggerProductId || !form.bumpProductId) {
      toast.error("Please select both trigger and bump products");
      return;
    }
    if (isNew) {
      createMutation.mutate(form);
    } else {
      updateMutation.mutate({ id: bump!.id, ...form });
    }
  }

  const triggerProducts = form.triggerType === "course" ? courses.filter((c: any) => c.type === "course") :
    form.triggerType === "download" ? downloads : [];
  const bumpProducts = form.bumpType === "course" ? courses.filter((c: any) => c.type === "course") :
    form.bumpType === "download" ? downloads : form.bumpType === "physical" ? [{ id: form.bumpProductId || 1, title: form.headline || "Physical add-on" }] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">{isNew ? "Create Order Bump" : "Edit Order Bump"}</h3>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500"><X size={18} /></button>
      </div>

      {/* Trigger & Bump Product Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">When someone buys...</label>
          <select value={form.triggerType} onChange={e => setForm({ ...form, triggerType: e.target.value as any, triggerProductId: 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2">
            <option value="course">Course</option>
            <option value="download">Download</option>
            <option value="bundle">Bundle</option>
            <option value="physical">Physical Item</option>
          </select>
          <select value={form.triggerProductId} onChange={e => setForm({ ...form, triggerProductId: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value={0}>— Select product —</option>
            {triggerProducts.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">Offer them...</label>
          <select value={form.bumpType} onChange={e => setForm({ ...form, bumpType: e.target.value as any, bumpProductId: 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2">
            <option value="course">Course</option>
            <option value="download">Download</option>
            <option value="bundle">Bundle</option>
          </select>
          <select value={form.bumpProductId} onChange={e => setForm({ ...form, bumpProductId: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value={0}>— Select product —</option>
            {bumpProducts.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      {/* Timing & Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Timing</label>
          <select value={form.timing} onChange={e => setForm({ ...form, timing: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option value="before_checkout">Before Checkout</option>
            <option value="after_checkout">After Checkout</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Bump Price (cents)</label>
          <Input type="number" value={form.bumpPrice} onChange={e => setForm({ ...form, bumpPrice: Number(e.target.value) })} />
          <span className="text-[10px] text-gray-400">${(form.bumpPrice / 100).toFixed(2)}</span>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Discount Label</label>
          <Input value={form.discountLabel} onChange={e => setForm({ ...form, discountLabel: e.target.value })} placeholder="e.g. 50% OFF" />
        </div>
      </div>

      {/* Bump Landing Page Content */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Bump Offer Content</h4>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Headline</label>
          <Input value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} placeholder="Special One-Time Offer!" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Subheadline</label>
          <Input value={form.subheadline} onChange={e => setForm({ ...form, subheadline: e.target.value })} placeholder="Add this to your order..." />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Body Content</label>
          <RichTextEditor value={form.bodyHtml} onChange={(html) => setForm({ ...form, bodyHtml: html })} minHeight={120} maxHeight={300} placeholder="Describe the offer..." />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Image URL</label>
          <Input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
        </div>
      </div>

      {/* CTA Customization */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">CTA Button Text</label>
          <Input value={form.ctaText} onChange={e => setForm({ ...form, ctaText: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">CTA Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.ctaColor} onChange={e => setForm({ ...form, ctaColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
            <Input value={form.ctaColor} onChange={e => setForm({ ...form, ctaColor: e.target.value })} className="flex-1" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Skip Text</label>
          <Input value={form.skipText} onChange={e => setForm({ ...form, skipText: e.target.value })} />
        </div>
      </div>

      {/* Preview */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-gray-50 to-white">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</p>
        <div className="max-w-md mx-auto border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
          {form.discountLabel && <span className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white bg-red-500 mb-2">{form.discountLabel}</span>}
          {form.headline && <h3 className="text-lg font-bold text-gray-900 mb-1">{form.headline}</h3>}
          {form.subheadline && <p className="text-sm text-gray-600 mb-3">{form.subheadline}</p>}
          {form.imageUrl && <img src={form.imageUrl} className="w-full h-32 object-cover rounded-lg mb-3" alt="" />}
          {form.bodyHtml && <div className="prose text-sm mb-4" dangerouslySetInnerHTML={{ __html: form.bodyHtml }} />}
          <div className="flex flex-col gap-2">
            <button className="w-full py-3 rounded-lg text-white font-semibold text-sm" style={{ backgroundColor: form.ctaColor }}>
              {form.ctaText} — ${(form.bumpPrice / 100).toFixed(2)}
            </button>
            <button className="text-xs text-gray-400 hover:text-gray-600 underline">{form.skipText}</button>
          </div>
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
          <span className="text-sm text-gray-700">Active (show to customers)</span>
        </label>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
          {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : isNew ? "Create Order Bump" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
