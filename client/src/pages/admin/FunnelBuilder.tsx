/**
 * FunnelBuilder.tsx
 * Standalone Funnel Builder — ClickFunnels-style multi-page funnel management.
 * Route: /admin/funnels
 * Supports creating funnels with multiple pages (landing, checkout, upsell, thank you)
 * that can optionally attach courses, downloads, or standalone products.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FUNNEL_TEMPLATES, getFunnelTemplateBlocks } from "@/lib/funnelTemplates";
import {
  ArrowLeft, Plus, Trash2, Copy, Eye, Settings, MoreHorizontal,
  Globe, FileText, CreditCard, Gift, ThumbsUp, Layers, ArrowRight,
  ExternalLink, BarChart3, Pencil, Check, X, ChevronDown, ChevronLeft, Zap,
  LayoutTemplate, ShoppingCart, Download, BookOpen, Package, GripVertical,
  GitBranch, List, ChevronUp, Users, TrendingDown, AlertTriangle, AlertCircle,
  Mail, Phone, Tag, Search, Filter,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import { FunnelFlowDiagram } from "@/components/FunnelFlowDiagram";
import { PublishDomainSelect } from "@/components/PublishDomainSelect";

type FunnelStatus = "draft" | "active" | "archived";
type PageType = "landing" | "checkout" | "upsell" | "downsell" | "thank_you" | "custom";

interface FunnelPage {
  id: number;
  funnelId: number;
  pageType: PageType;
  title: string;
  slug: string;
  blocks: string;
  nextPageId: number | null;
  productType: string | null;
  productId: number | null;
  customPrice: number | null;
  customPriceLabel: string | null;
  orderBumpId: number | null;
  sortOrder: number;
  isActive: boolean;
  isHidden: boolean;
  isStandaloneLanding: boolean;
  views: number;
  conversions: number;
  createdAt: string;
}

interface Funnel {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: FunnelStatus;
  templateName: string | null;
  accentColor: string;
  bgColor: string;
  logoUrl: string | null;
  totalViews: number;
  totalConversions: number;
  createdAt: string;
  updatedAt: string;
  pages: FunnelPage[];
  customDomain?: string | null;
  sortOrder?: number;
}

const PAGE_TYPE_META: Record<PageType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  landing: { label: "Landing Page", icon: <FileText size={16} />, color: "bg-blue-100 text-blue-700", description: "Capture leads and warm up traffic" },
  checkout: { label: "Checkout", icon: <CreditCard size={16} />, color: "bg-green-100 text-green-700", description: "Collect payment for products" },
  upsell: { label: "Upsell", icon: <Gift size={16} />, color: "bg-teal-100 text-teal-700", description: "Offer additional products after purchase" },
  downsell: { label: "Downsell", icon: <ShoppingCart size={16} />, color: "bg-orange-100 text-orange-700", description: "Alternative offer if upsell declined" },
  thank_you: { label: "Thank You", icon: <ThumbsUp size={16} />, color: "bg-teal-100 text-teal-700", description: "Confirm purchase and deliver access" },
  custom: { label: "Custom Page", icon: <Layers size={16} />, color: "bg-gray-100 text-gray-700", description: "Flexible page for any purpose" },
};

// ─── Funnel List View ─────────────────────────────────────────────────────────

function FunnelListView({ onSelect, onCreate }: { onSelect: (id: number) => void; onCreate: () => void }) {
  const { data: funnelList, isLoading, refetch } = trpc.funnel.list.useQuery();
  const [localFunnels, setLocalFunnels] = useState<Funnel[]>([]);
  const reorderFunnels = trpc.funnel.reorderFunnels.useMutation({ onError: () => { refetch(); toast.error("Failed to save order"); } });
  const listSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (funnelList) setLocalFunnels(funnelList as unknown as Funnel[]);
  }, [funnelList]);

  const handleFunnelDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalFunnels(prev => {
      const oldIdx = prev.findIndex(f => f.id === active.id);
      const newIdx = prev.findIndex(f => f.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      reorderFunnels.mutate({ funnelIds: reordered.map(f => f.id) });
      return reordered;
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Platform Admin breadcrumb */}
      <div className="mb-1">
        <Link href="/platform-admin" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-3 h-3" /> Platform Admin
        </Link>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funnel Builder</h1>
          <p className="text-gray-500 mt-1">Create multi-step sales funnels to convert visitors into customers</p>
        </div>
        <Button onClick={onCreate} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
          <Plus size={16} /> New Funnel
        </Button>
      </div>

      {/* Funnel Grid */}
      {!localFunnels || localFunnels.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Layers size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No funnels yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">Create your first sales funnel to start converting visitors into customers. Choose from templates or build from scratch.</p>
          <Button onClick={onCreate} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus size={16} /> Create Your First Funnel
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">Drag cards to reorder your funnels</p>
          <DndContext sensors={listSensors} modifiers={[restrictToFirstScrollableAncestor]} collisionDetection={closestCenter} onDragEnd={handleFunnelDragEnd}>
            <SortableContext items={localFunnels.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {localFunnels.map((funnel: Funnel, fi: number) => (
                  <SortableFunnelCard key={funnel.id} funnel={funnel} onClick={() => onSelect(funnel.id)}
                    onMoveUp={fi > 0 ? () => setLocalFunnels(prev => { const r = arrayMove(prev, fi, fi - 1); reorderFunnels.mutate({ funnelIds: r.map(f => f.id) }); return r; }) : undefined}
                    onMoveDown={fi < localFunnels.length - 1 ? () => setLocalFunnels(prev => { const r = arrayMove(prev, fi, fi + 1); reorderFunnels.mutate({ funnelIds: r.map(f => f.id) }); return r; }) : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

function SortableFunnelCard({ funnel, onClick, onMoveUp, onMoveDown }: { funnel: Funnel; onClick: () => void; onMoveUp?: () => void; onMoveDown?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: funnel.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const statusColors: Record<FunnelStatus, string> = {
    draft: "bg-yellow-100 text-yellow-700",
    active: "bg-green-100 text-green-700",
    archived: "bg-gray-100 text-gray-500",
  };

  return (
    <div ref={setNodeRef} style={style} className={`bg-white rounded-xl border p-5 transition-all group ${
      isDragging ? "border-teal-400 shadow-xl" : "border-gray-200 hover:shadow-md hover:border-teal-200"
    }`}>
      <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded -ml-1"
            title="Drag to reorder"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </button>
          <div className="flex flex-col gap-0">
            <button disabled={!onMoveUp} onClick={e => { e.stopPropagation(); onMoveUp?.(); }} className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-teal-600 disabled:opacity-20 disabled:cursor-not-allowed" title="Move up"><ChevronUp size={12} /></button>
            <button disabled={!onMoveDown} onClick={e => { e.stopPropagation(); onMoveDown?.(); }} className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-teal-600 disabled:opacity-20 disabled:cursor-not-allowed" title="Move down"><ChevronDown size={12} /></button>
          </div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: funnel.accentColor + "20", color: funnel.accentColor }}>
            <Layers size={16} />
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[funnel.status]}`}>
            {funnel.status}
          </span>
        </div>
        <button onClick={onClick} className="text-gray-300 group-hover:text-teal-500 transition-colors hover:text-teal-600" title="Open funnel">
          <ArrowRight size={16} />
        </button>
      </div>
      <div onClick={onClick} className="cursor-pointer">
        <h3 className="font-semibold text-gray-900 mb-1 truncate">{funnel.name}</h3>
        {funnel.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{funnel.description}</p>}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><FileText size={12} /> {funnel.pages.length} pages</span>
          <span className="flex items-center gap-1"><Eye size={12} /> {funnel.totalViews} views</span>
          <span className="flex items-center gap-1"><BarChart3 size={12} /> {funnel.totalConversions} conversions</span>
        </div>
      </div>
    </div>
  );
}

// ─── Create Funnel Dialog ─────────────────────────────────────────────────────

function CreateFunnelDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [step, setStep] = useState<"template" | "details">("template");
  const { data: savedTemplates } = trpc.funnel.listTemplates.useQuery();

  const createFunnel = trpc.funnel.create.useMutation({
    onSuccess: (data) => {
      toast.success("Funnel created!");
      onCreated(data.id);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const addPage = trpc.funnel.addPage.useMutation();

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Please enter a funnel name"); return; }
    const result = await createFunnel.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      templateName: selectedTemplate || undefined,
    });

    // If a template is selected, create default pages from template
    if (selectedTemplate?.startsWith("saved:")) {
      // User-saved template — load pages from database
      const tplId = parseInt(selectedTemplate.replace("saved:", ""));
      const tpl = savedTemplates?.find(t => t.id === tplId);
      if (tpl) {
        const pages = JSON.parse(tpl.pagesJson || "[]") as Array<{ pageType: string; title: string; slug?: string; blocks?: string }>;
        for (const page of pages) {
          await addPage.mutateAsync({
            funnelId: result.id,
            pageType: page.pageType as any,
            title: page.title,
            blocks: typeof page.blocks === "string" ? page.blocks : JSON.stringify(page.blocks || []),
          });
        }
      }
    } else if (selectedTemplate) {
      const templatePages = getTemplatePages(selectedTemplate);
      for (const page of templatePages) {
        await addPage.mutateAsync({
          funnelId: result.id,
          pageType: page.type,
          title: page.title,
          blocks: JSON.stringify(page.blocks || []),
        });
      }
    } else {
      // Create default landing page
      await addPage.mutateAsync({
        funnelId: result.id,
        pageType: "landing",
        title: "Landing Page",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {step === "template" ? "Choose a Template" : "Funnel Details"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "template" ? (
            <div className="space-y-4">
              {/* Blank option */}
              <div
                onClick={() => { setSelectedTemplate(null); setStep("details"); }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-teal-300 hover:shadow-sm ${!selectedTemplate ? "border-teal-500 bg-teal-50" : "border-gray-200"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Plus size={20} className="text-gray-400" /></div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Start from Scratch</h3>
                    <p className="text-sm text-gray-500">Build your funnel page by page with the block editor</p>
                  </div>
                </div>
              </div>

              {/* Template options */}
              {FUNNEL_TEMPLATES.map(tpl => (
                <div
                  key={tpl.name}
                  onClick={() => { setSelectedTemplate(tpl.name); setStep("details"); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-teal-300 hover:shadow-sm ${selectedTemplate === tpl.name ? "border-teal-500 bg-teal-50" : "border-gray-200"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600"><LayoutTemplate size={20} /></div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                      <p className="text-sm text-gray-500">{tpl.description}</p>
                    </div>
                  </div>
                </div>
              ))}
              {/* User-saved templates */}
              {savedTemplates && savedTemplates.length > 0 && (
                <>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Saved Templates</p>
                  </div>
                  {savedTemplates.map(tpl => (
                    <div
                      key={`saved-${tpl.id}`}
                      onClick={() => { setSelectedTemplate(`saved:${tpl.id}`); setStep("details"); }}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-teal-300 hover:shadow-sm ${selectedTemplate === `saved:${tpl.id}` ? "border-teal-500 bg-teal-50" : "border-gray-200"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600"><LayoutTemplate size={20} /></div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                          <p className="text-sm text-gray-500">{tpl.description || "Custom saved template"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Funnel Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Vascular Cross-Training Sales Funnel" className="h-10" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description (optional)</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this funnel's purpose..." className="min-h-[80px]" />
              </div>
              {selectedTemplate && (
                <div className="bg-teal-50 rounded-lg p-3 flex items-center gap-2 text-sm text-teal-700">
                  <LayoutTemplate size={16} /> Using template: <span className="font-semibold">{selectedTemplate}</span>
                  <button onClick={() => setStep("template")} className="ml-auto text-teal-600 hover:text-teal-800 text-xs underline">Change</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          {step === "details" ? (
            <>
              <button onClick={() => setStep("template")} className="text-sm text-gray-500 hover:text-gray-700">← Back to templates</button>
              <Button onClick={handleCreate} disabled={createFunnel.isPending || !name.trim()} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                {createFunnel.isPending ? "Creating..." : "Create Funnel"}
              </Button>
            </>
          ) : (
            <>
              <span />
              <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Funnel Settings Panel ──────────────────────────────────────────────────

function FunnelSettingsPanel({ funnel, funnelId, onUpdate, onRefetch }: { funnel: any; funnelId: number; onUpdate: any; onRefetch: () => void }) {
  const [slug, setSlug] = useState(funnel.slug ?? "");
  const [metaTitle, setMetaTitle] = useState(funnel.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(funnel.metaDescription ?? "");
  const [thankYouUrl, setThankYouUrl] = useState(funnel.thankYouUrl ?? "");
  const [customDomain, setCustomDomain] = useState<string>(funnel.customDomain ?? "");
  const updateFunnelSettings = trpc.funnel.updateFunnelSettings.useMutation({
    onSuccess: () => { toast.success("Funnel settings saved"); onRefetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  function handleSave() {
    updateFunnelSettings.mutate({
      funnelId,
      slug: slug.trim() || funnel.slug,
      name: funnel.name,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      thankYouUrl: thankYouUrl.trim() || undefined,
      status: funnel.status,
      customDomain: customDomain || null,
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-5">
      <h3 className="font-semibold text-gray-900 text-sm">Funnel Settings</h3>
      {/* Colors & Description */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Accent Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={funnel.accentColor} onChange={e => onUpdate.mutate({ id: funnelId, accentColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
            <span className="text-xs text-gray-500">{funnel.accentColor}</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Background Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={funnel.bgColor} onChange={e => onUpdate.mutate({ id: funnelId, bgColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
            <span className="text-xs text-gray-500">{funnel.bgColor}</span>
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Description</label>
        <Textarea defaultValue={funnel.description || ""} onBlur={e => onUpdate.mutate({ id: funnelId, description: e.target.value || null })} className="text-sm min-h-[60px]" />
      </div>
      {/* Publish Domain Override */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Published Domain</h4>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Publish Domain Override</label>
          <PublishDomainSelect
            value={customDomain}
            onChange={setCustomDomain}
            className="w-full h-9 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Override the global funnel domain for this funnel only. "Use global default" follows the setting in LMS Admin → Settings.
          </p>
        </div>
      </div>
      {/* URL & SEO */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">URL &amp; SEO</h4>
        <div>
          <label className="text-xs text-gray-500 block mb-1">URL Slug</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 whitespace-nowrap">/f/</span>
            <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))} placeholder="funnel-slug" className="flex-1 h-8 text-sm" />
          </div>
          <p className="text-xs text-gray-400 mt-1">Changing this will break existing links to this funnel.</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Meta Title (SEO)</label>
          <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder="Leave blank to use funnel name" className="h-8 text-sm" maxLength={255} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Meta Description (SEO)</label>
          <Textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} placeholder="Brief description for search engines" className="text-sm min-h-[60px] resize-none" maxLength={500} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Thank-You / Post-Purchase Redirect URL</label>
          <Input value={thankYouUrl} onChange={e => setThankYouUrl(e.target.value)} placeholder="https://example.com/thank-you (leave blank to use thank-you page)" className="h-8 text-sm" />
          <p className="text-xs text-gray-400 mt-1">Override the default thank-you page with a custom redirect URL after purchase.</p>
        </div>
        <Button size="sm" variant="outline" className="border-teal-300 text-teal-600 hover:bg-teal-50"
          disabled={updateFunnelSettings.isPending}
          onClick={handleSave}
        >
          {updateFunnelSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Funnel Detail / Editor View ──────────────────────────────────────────────

function FunnelDetailView({ funnelId, onBack, onEditPage }: { funnelId: number; onBack: () => void; onEditPage: (funnelId: number, pageId: number) => void }) {
  const { data: funnel, isLoading, refetch } = trpc.funnel.get.useQuery({ id: funnelId });
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [showAddPage, setShowAddPage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localPages, setLocalPages] = useState<FunnelPage[]>([]);
  const [pageView, setPageView] = useState<"list" | "diagram">("list");
  const [copyPageDialog, setCopyPageDialog] = useState<{ pageId: number; pageTitle: string } | null>(null);
  const [copyTargetFunnelId, setCopyTargetFunnelId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"pages" | "settings" | "contacts" | "analytics">("pages");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadPage, setLeadPage] = useState(1);

  const updateFunnel = trpc.funnel.update.useMutation({ onSuccess: () => { refetch(); toast.success("Updated"); } });
  const deleteFunnel = trpc.funnel.delete.useMutation({ onSuccess: () => { toast.success("Funnel deleted"); onBack(); } });
  const duplicateFunnel = trpc.funnel.duplicate.useMutation({ onSuccess: () => { refetch(); toast.success("Funnel duplicated"); } });
  const addPage = trpc.funnel.addPage.useMutation({ onSuccess: () => { refetch(); setShowAddPage(false); toast.success("Page added"); } });
  const deletePage = trpc.funnel.deletePage.useMutation({ onSuccess: () => { refetch(); toast.success("Page deleted"); } });
  const duplicatePage = trpc.funnel.duplicatePage.useMutation({ onSuccess: () => { refetch(); toast.success("Page duplicated"); } });
  const copyPageToFunnel = trpc.funnel.copyPageToFunnel.useMutation({ onSuccess: () => { refetch(); setCopyPageDialog(null); toast.success("Page copied to funnel!"); } });
  const copyPageAsStandalone = trpc.funnel.copyPageAsStandalone.useMutation({ onSuccess: (d) => { refetch(); setCopyPageDialog(null); toast.success(`Standalone page created at /p/${d.slug}`); } });
  const { data: allFunnels } = trpc.funnel.list.useQuery();
  const connectPages = trpc.funnel.connectPages.useMutation({ onSuccess: () => { refetch(); } });
  const updatePage = trpc.funnel.updatePage.useMutation({ onSuccess: () => { refetch(); toast.success("Page updated"); } });
  const saveAsTemplate = trpc.funnel.saveAsTemplate.useMutation({ onSuccess: () => { toast.success("Saved as template! It will appear in the template list when creating new funnels."); } });
  const reorderPages = trpc.funnel.reorderPages.useMutation({ onError: () => { refetch(); toast.error("Failed to save order"); } });
  const { data: flowData } = trpc.funnel.getFlowDiagram.useQuery({ funnelId });
  const { data: analyticsData } = trpc.funnelAdmin.getFunnelAnalytics.useQuery({ funnelId }, { enabled: activeTab === "analytics" });
  const { data: leadsData, refetch: refetchLeads } = trpc.funnel.listLeads.useQuery({ funnelId, page: leadPage, limit: 50, search: leadSearch || undefined }, { enabled: activeTab === "contacts" });
  const { data: csvData, refetch: fetchCSV } = trpc.funnelAdmin.exportFunnelLeadsCSV.useQuery({ funnelId }, { enabled: false });
  const { data: importablePages } = trpc.funnelAdmin.listImportablePages.useQuery({ excludeFunnelId: funnelId }, { enabled: showAddPage });
  const { data: platformSettings } = trpc.lmsGroup.getPlatformSettings.useQuery();
  // Default funnel base URL: per-funnel customDomain > global funnelPublishDomain > app origin
  const funnelPublishBase = (d: { customDomain?: string | null }) =>
    d.customDomain ? `https://${d.customDomain}` :
    platformSettings?.funnelPublishDomain ? `https://${platformSettings.funnelPublishDomain}` :
    window.location.origin;
  const importPage = trpc.funnelAdmin.importPageToFunnel.useMutation({ onSuccess: () => { refetch(); setShowAddPage(false); toast.success("Page imported!"); } });
  const [importTab, setImportTab] = useState<"new" | "import">("new");
  const [selectedSourceIdx, setSelectedSourceIdx] = useState<number | null>(null);

  const pageSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (funnel) {
      setNameValue(funnel.name);
      setLocalPages(funnel.pages as unknown as FunnelPage[]);
    }
  }, [funnel]);

  const handlePageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalPages(prev => {
      const oldIdx = prev.findIndex(p => p.id === active.id);
      const newIdx = prev.findIndex(p => p.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      reorderPages.mutate({ funnelId, pageIds: reordered.map(p => p.id) });
      return reordered;
    });
  };

  if (isLoading || !funnel) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading funnel...</div>;
  }

  const handleExportCSV = async () => {
    const result = await fetchCSV();
    if (result.data?.csvContent) {
      const blob = new Blob([result.data.csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${funnel.name.replace(/\s+/g, "-").toLowerCase()}-leads.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.data.total} leads`);
    }
  };

  const handleStatusToggle = () => {
    const newStatus = funnel.status === "active" ? "draft" : "active";
    updateFunnel.mutate({ id: funnelId, status: newStatus });
  };

  const handleAddPage = (pageType: PageType) => {
    const title = PAGE_TYPE_META[pageType].label;
    addPage.mutate({ funnelId, pageType, title });
  };

  const handleAutoConnect = () => {
    const pages = funnel.pages;
    const allConnected = pages.length > 1 && pages.slice(0, -1).every((p, i) => p.nextPageId === pages[i + 1].id);
    if (allConnected) {
      // Disconnect all pages
      for (let i = 0; i < pages.length - 1; i++) {
        connectPages.mutate({ fromPageId: pages[i].id, toPageId: null });
      }
      toast.success("Pages disconnected");
    } else {
      // Connect pages in order
      for (let i = 0; i < pages.length - 1; i++) {
        connectPages.mutate({ fromPageId: pages[i].id, toPageId: pages[i + 1].id });
      }
      toast.success("Pages connected in sequence");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-1 text-xs text-gray-400">
        <Link href="/platform-admin" className="hover:text-gray-700 transition-colors">Platform Admin</Link>
        <span>/</span>
        <Link href="/admin/funnels" className="hover:text-gray-700 transition-colors">Funnels</Link>
      </div>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-700 transition-colors">
            <ArrowLeft size={16} /> All Funnels
          </button>
          <div className="w-px h-5 bg-gray-200" />
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input value={nameValue} onChange={e => setNameValue(e.target.value)} className="h-8 w-64 text-sm font-semibold" autoFocus />
              <button onClick={() => { updateFunnel.mutate({ id: funnelId, name: nameValue }); setEditingName(false); }} className="text-teal-600 hover:text-teal-700"><Check size={16} /></button>
              <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{funnel.name}</h1>
              <button onClick={() => setEditingName(true)} className="text-gray-400 hover:text-teal-600"><Pencil size={14} /></button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const pages = funnel.pages;
            const allConnected = pages.length > 1 && pages.slice(0, -1).every((p, i) => p.nextPageId === pages[i + 1].id);
            return (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoConnect}
                className={`gap-1.5 text-xs ${
                  allConnected
                    ? "text-teal-700 border-teal-300 bg-teal-50 hover:bg-teal-100"
                    : "text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
                title={allConnected ? "Pages are connected in sequence" : "Click to auto-connect pages in order"}
              >
                <Zap size={14} className={allConnected ? "fill-teal-500 text-teal-600" : ""} />
                Auto-Connect
                {allConnected && <span className="ml-1 text-[10px] font-normal text-teal-600">ON</span>}
              </Button>
            );
          })()}
          <Button variant="outline" size="sm" onClick={handleStatusToggle} className={`gap-1.5 text-xs ${funnel.status === "active" ? "text-green-700 border-green-200 bg-green-50" : "text-yellow-700 border-yellow-200 bg-yellow-50"}`}>
            <Globe size={14} /> {funnel.status === "active" ? "Live" : "Draft"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => duplicateFunnel.mutate({ id: funnelId })} className="gap-1.5 text-xs">
            <Copy size={14} /> Duplicate
          <Button variant="outline" size="sm" onClick={() => { const tplName = prompt("Template name:", funnel.name + " Template"); if (tplName) saveAsTemplate.mutate({ id: funnelId, templateName: tplName }); }} className="gap-1.5 text-xs text-teal-600 border-teal-200 hover:bg-teal-50">
            <LayoutTemplate size={14} /> Save as Template
          </Button>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this funnel?")) deleteFunnel.mutate({ id: funnelId }); }} className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Funnel Info Bar */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <span className="flex items-center gap-1.5"><Eye size={14} /> {funnel.totalViews} views</span>
          <span className="flex items-center gap-1.5"><BarChart3 size={14} /> {funnel.totalConversions} conversions</span>
          {funnel.status === "active" && (() => {
            const base = funnelPublishBase(funnel);
            const displayBase = funnel.customDomain ? funnel.customDomain : (platformSettings?.funnelPublishDomain ?? window.location.host);
            return (
              <a href={`${base}/${funnel.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-teal-600 hover:text-teal-700">
                <ExternalLink size={14} /> {displayBase}/{funnel.slug}
              </a>
            );
          })()}
        </div>
      </div>

      {/* Four-Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {([
          { id: "pages", label: "Pages", icon: <List size={14} /> },
          { id: "settings", label: "Settings", icon: <Settings size={14} /> },
          { id: "contacts", label: "Contacts", icon: <Users size={14} /> },
          { id: "analytics", label: "Analytics", icon: <BarChart3 size={14} /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── PAGES TAB ── */}
      {activeTab === "pages" && (<>
      {/* Page Flow Visualization */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Funnel Pages</h2>
          <p className="text-xs text-gray-400 mt-0.5">{pageView === "list" ? "Drag the handle to reorder steps" : "Click a node to edit the page"}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setPageView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                pageView === "list" ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <List size={13} /> List
            </button>
            <button
              onClick={() => setPageView("diagram")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                pageView === "diagram" ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <GitBranch size={13} /> Diagram
            </button>
          </div>
          <Button onClick={() => setShowAddPage(true)} variant="outline" size="sm" className="gap-1.5 text-xs">
            <Plus size={14} /> Add Page
          </Button>
        </div>
      </div>

      {/* Diagram View */}
      {pageView === "diagram" && (
        <FunnelFlowDiagram funnelId={funnelId} onEditPage={onEditPage} />
      )}

      {/* Pages as sortable connected flow */}
      {pageView === "list" && (
      <DndContext sensors={pageSensors} modifiers={[restrictToFirstScrollableAncestor]} collisionDetection={closestCenter} onDragEnd={handlePageDragEnd}>
        <SortableContext items={localPages.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {localPages.map((page, idx) => {
              const meta = PAGE_TYPE_META[page.pageType as PageType] || PAGE_TYPE_META.custom;
              const nextPage = page.nextPageId ? localPages.find(p => p.id === page.nextPageId) : null;
              return (
                <SortableFunnelPageRow
                  key={page.id}
                  page={page}
                  idx={idx}
                  meta={meta}
                  nextPage={nextPage}
                  isLast={idx === localPages.length - 1}
                  funnelId={funnelId}
                  funnelSlug={funnel.slug}
                  funnelCustomDomain={funnel.customDomain}
                  funnelPublishDomain={platformSettings?.funnelPublishDomain}
                  onEditPage={onEditPage}
                  onDuplicate={() => duplicatePage.mutate({ id: page.id })}
                  onCopyPage={() => setCopyPageDialog({ pageId: page.id, pageTitle: page.title })}
                  onRename={() => { const newTitle = prompt("Page title:", page.title); if (newTitle && newTitle !== page.title) updatePage.mutate({ id: page.id, title: newTitle }); }}
                  onEditSlug={(newSlug: string) => updatePage.mutate({ id: page.id, slug: newSlug })}
                  onDelete={() => { if (confirm("Delete this page?")) deletePage.mutate({ id: page.id }); }}
                  onMoveUp={idx > 0 ? () => setLocalPages(prev => { const r = arrayMove(prev, idx, idx - 1); reorderPages.mutate({ funnelId, pageIds: r.map(p => p.id) }); return r; }) : undefined}
                  onMoveDown={idx < localPages.length - 1 ? () => setLocalPages(prev => { const r = arrayMove(prev, idx, idx + 1); reorderPages.mutate({ funnelId, pageIds: r.map(p => p.id) }); return r; }) : undefined}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      )}

      {/* Branch Patterns Summary */}
      {pageView === "list" && flowData && flowData.some((p: any) => p.branchRules?.some((r: any) => r.isActive)) && (
        <div className="mt-6 bg-white border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-800">Conditional Branch Patterns</h3>
            <span className="text-xs text-gray-400 ml-1">— rules evaluated before the default next step</span>
          </div>
          <div className="space-y-4">
            {flowData.filter((p: any) => p.branchRules?.some((r: any) => r.isActive)).map((p: any) => (
              <div key={p.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{p.title}</span>
                  <span className="text-xs text-gray-400">/{p.slug}</span>
                </div>
                <div className="space-y-2">
                  {p.branchRules.filter((r: any) => r.isActive).map((rule: any, ri: number) => {
                    const targetPage = flowData.find((tp: any) => tp.id === rule.targetPageId);
                    return (
                      <div key={rule.id} className="flex items-start gap-2 text-xs">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px]">{ri + 1}</span>
                        <div className="flex-1">
                          <span className="font-medium text-gray-700">{rule.name}</span>
                          {rule.conditions.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {rule.conditions.map((c: any, ci: number) => (
                                <div key={c.id} className="text-gray-500">
                                  {ci > 0 && <span className="text-amber-600 font-medium mr-1">{rule.matchMode === "all" ? "AND" : "OR"}</span>}
                                  <span className="font-mono bg-gray-50 px-1 rounded">{c.variable.replace(/_/g, " ")}</span>
                                  <span className="mx-1 text-gray-400">{c.operator.replace(/_/g, " ")}</span>
                                  <span className="font-mono bg-gray-50 px-1 rounded">{c.value || "—"}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-gray-400">→</span>
                            {targetPage ? (
                              <span className="text-teal-700 font-medium">{targetPage.title}</span>
                            ) : rule.targetUrl ? (
                              <a href={rule.targetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate max-w-xs">{rule.targetUrl}</a>
                            ) : (
                              <span className="text-red-400 italic">No target set</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2 text-xs text-gray-400 pl-7 pt-1 border-t border-gray-100 mt-2">
                    <span className="text-gray-300">↓ default:</span>
                    {p.nextPageId ? (
                      <span className="text-gray-500">{flowData.find((tp: any) => tp.id === p.nextPageId)?.title ?? "Unknown"}</span>
                    ) : (
                      <span className="italic">end of funnel</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Copy Page Dialog */}
      {copyPageDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Copy Page</h3>
              <button onClick={() => setCopyPageDialog(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Copying: <span className="font-medium text-gray-800">{copyPageDialog.pageTitle}</span></p>
            <div className="space-y-3">
              {/* Option 1: Duplicate within same funnel */}
              <button
                onClick={() => { duplicatePage.mutate({ id: copyPageDialog.pageId }); setCopyPageDialog(null); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-100 text-teal-600"><Copy size={16} /></div>
                <div>
                  <h4 className="font-medium text-gray-900 text-sm">Copy within this funnel</h4>
                  <p className="text-xs text-gray-500">Duplicate the page and add it to the end of this funnel</p>
                </div>
              </button>
              {/* Option 2: Copy to another funnel */}
              <div className="p-3 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600"><ArrowLeft size={16} className="rotate-180" /></div>
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm">Copy to another funnel</h4>
                    <p className="text-xs text-gray-500">Add this page to a different funnel</p>
                  </div>
                </div>
                <select
                  className="w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white"
                  value={copyTargetFunnelId}
                  onChange={e => setCopyTargetFunnelId(e.target.value)}
                >
                  <option value="">Select a funnel...</option>
                  {(allFunnels ?? []).filter((f: any) => f.id !== funnelId).map((f: any) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!copyTargetFunnelId || copyPageToFunnel.isPending}
                  onClick={() => copyPageToFunnel.mutate({ pageId: copyPageDialog.pageId, targetFunnelId: parseInt(copyTargetFunnelId) })}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {copyPageToFunnel.isPending ? "Copying..." : "Copy to Selected Funnel"}
                </Button>
              </div>
              {/* Option 3: Copy as standalone landing page */}
              <button
                onClick={() => copyPageAsStandalone.mutate({ pageId: copyPageDialog.pageId })}
                disabled={copyPageAsStandalone.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-100 text-teal-600"><Eye size={16} /></div>
                <div>
                  <h4 className="font-medium text-gray-900 text-sm">Copy as standalone landing page</h4>
                  <p className="text-xs text-gray-500">Publish at /p/[slug] — accessible without going through the funnel</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Page Dialog */}
      {showAddPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Add Page</h3>
              <button onClick={() => setShowAddPage(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            {/* Tab switcher */}
            <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
              <button
                onClick={() => setImportTab("new")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  importTab === "new" ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Create New
              </button>
              <button
                onClick={() => setImportTab("import")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  importTab === "import" ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Import Existing
              </button>
            </div>

            {importTab === "new" && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(Object.entries(PAGE_TYPE_META) as [PageType, typeof PAGE_TYPE_META[PageType]][]).map(([type, meta]) => (
                  <button
                    key={type}
                    onClick={() => handleAddPage(type)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.color}`}>{meta.icon}</div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm">{meta.label}</h4>
                      <p className="text-xs text-gray-500">{meta.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {importTab === "import" && (
              <div className="space-y-4">
                {/* Step 1: Source selector */}
                {!importablePages ? (
                  <div className="text-center py-8 text-gray-400"><p className="text-sm">Loading sources...</p></div>
                ) : importablePages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Layers size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No pages available to import</p>
                    <p className="text-xs mt-1">Create courses, downloads, or pages in other funnels first</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Select Source</label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                        value={selectedSourceIdx ?? ""}
                        onChange={e => setSelectedSourceIdx(e.target.value === "" ? null : Number(e.target.value))}
                      >
                        <option value="">— Choose a funnel, course, or product —</option>
                        {importablePages.map((src: any, idx: number) => (
                          <option key={`${src.sourceType}-${src.sourceId}`} value={idx}>
                            {src.sourceType === "funnel" ? "📂" : src.sourceType === "course" ? "🎓" : src.sourceType === "download" ? "📥" : "🔗"}
                            {" "}{src.sourceName}{" "}
                            {src.sourceStatus !== "published" && src.sourceStatus !== "public" ? `(${src.sourceStatus})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Step 2: Page list for selected source */}
                    {selectedSourceIdx !== null && importablePages[selectedSourceIdx] && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Select Page</label>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {importablePages[selectedSourceIdx].pages.map((p: any) => {
                            const src = importablePages[selectedSourceIdx];
                            const typeColor = src.sourceType === "funnel" ? "bg-blue-100 text-blue-700" : src.sourceType === "course" ? "bg-green-100 text-green-700" : "bg-teal-100 text-teal-700";
                            return (
                              <button
                                key={`${p.sourceType}-${p.id}`}
                                onClick={() => importPage.mutate({ sourcePageId: p.id, targetFunnelId: funnelId, sourceType: p.sourceType })}
                                disabled={importPage.isPending}
                                className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all text-left"
                              >
                                <div className="min-w-0">
                                  <span className="text-sm font-medium text-gray-900 block truncate">{p.title}</span>
                                  <span className="text-xs text-gray-400">/{p.slug}</span>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ml-2 shrink-0 ${typeColor}`}>
                                  {p.pageType.replace(/_/g, " ")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </>)}

      {/* ── SETTINGS TAB ── */}
      {activeTab === "settings" && (
        <FunnelSettingsPanel funnel={funnel} funnelId={funnelId} onUpdate={updateFunnel} onRefetch={refetch} />
      )}

      {/* ── CONTACTS TAB ── */}
      {activeTab === "contacts" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Contacts & Leads</h2>
              <p className="text-xs text-gray-400 mt-0.5">{leadsData?.total ?? 0} total contacts captured</p>
            </div>
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download size={14} /> Export CSV
            </Button>
          </div>
          {/* Search */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={leadSearch}
              onChange={e => { setLeadSearch(e.target.value); setLeadPage(1); }}
              className="w-full h-9 pl-8 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {/* Leads table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source Page</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leadsData?.leads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.name || <span className="text-gray-400 italic">No name</span>}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1"><Mail size={11} /> {lead.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{lead.phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{lead.sourcePage || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      {lead.tags ? (
                        <div className="flex flex-wrap gap-1">
                          {lead.tags.split(",").map((t: string) => (
                            <span key={t} className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">{t.trim()}</span>
                          ))}
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {(!leadsData?.leads || leadsData.leads.length === 0) && (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No contacts yet</p>
                    <p className="text-xs mt-1">Contacts appear when visitors submit lead capture forms in your funnel</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {leadsData && leadsData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-400">Page {leadPage} of {leadsData.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={leadPage <= 1} onClick={() => setLeadPage(p => p - 1)} className="text-xs">Previous</Button>
                <Button variant="outline" size="sm" disabled={leadPage >= leadsData.totalPages} onClick={() => setLeadPage(p => p + 1)} className="text-xs">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === "analytics" && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Funnel Analytics</h2>
          {!analyticsData ? (
            <div className="flex items-center justify-center h-40 text-gray-400">Loading analytics...</div>
          ) : (
            <div className="space-y-6">
              {/* Overview KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total Views</p>
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.totalViews.toLocaleString()}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total Leads</p>
                  <p className="text-2xl font-bold text-teal-700">{analyticsData.totalLeads.toLocaleString()}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Overall Conversion</p>
                  <p className="text-2xl font-bold text-green-700">{analyticsData.overallConversionRate}%</p>
                </div>
              </div>

              {/* Critical Issues */}
              {analyticsData.issues.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <h3 className="text-sm font-semibold text-amber-800">Sales Workflow Issues ({analyticsData.issues.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {analyticsData.issues.map((issue: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        {issue.severity === "error" ? (
                          <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <span className="font-medium text-gray-800">{issue.pageTitle}</span>
                          <span className="text-gray-500 ml-1">— {issue.issue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-Page Funnel Analysis */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Page-by-Page Breakdown</h3>
                <div className="space-y-3">
                  {analyticsData.pageStats.map((page: any, idx: number) => (
                    <div key={page.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                          <div>
                            <span className="font-medium text-gray-900 text-sm">{page.title}</span>
                            {page.isBuyPoint && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Buy Point</span>}
                            {page.isHidden && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Hidden</span>}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">/{page.slug}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div>
                          <p className="text-xs text-gray-400">Views</p>
                          <p className="text-lg font-bold text-gray-900">{page.views.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Conversions</p>
                          <p className="text-lg font-bold text-teal-700">{page.conversions.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Conv. Rate</p>
                          <p className={`text-lg font-bold ${page.conversionRate >= 10 ? "text-green-700" : page.conversionRate >= 3 ? "text-yellow-600" : "text-gray-500"}`}>{page.conversionRate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Drop-off</p>
                          <p className={`text-lg font-bold flex items-center justify-center gap-1 ${page.dropOffRate > 70 ? "text-red-600" : page.dropOffRate > 40 ? "text-amber-600" : "text-gray-500"}`}>
                            {idx > 0 && <TrendingDown size={14} />}{page.dropOffRate > 0 ? `${page.dropOffRate}%` : "—"}
                          </p>
                        </div>
                      </div>
                      {/* Drop-off bar */}
                      {idx > 0 && page.views > 0 && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                page.dropOffRate > 70 ? "bg-red-400" : page.dropOffRate > 40 ? "bg-amber-400" : "bg-teal-400"
                              }`}
                              style={{ width: `${100 - page.dropOffRate}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{100 - page.dropOffRate}% of previous page visitors reached this page</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sortable Funnel Page Row ────────────────────────────────────────────────

function SortableFunnelPageRow({
  page, idx, meta, nextPage, isLast, funnelId, funnelSlug, funnelCustomDomain, funnelPublishDomain, onEditPage, onDuplicate, onCopyPage, onRename, onEditSlug, onDelete, onMoveUp, onMoveDown,
}: {
  page: FunnelPage;
  idx: number;
  meta: { label: string; icon: React.ReactNode; color: string; description: string };
  nextPage: FunnelPage | null | undefined;
  isLast: boolean;
  funnelId: number;
  funnelSlug: string;
  funnelCustomDomain?: string | null;
  funnelPublishDomain?: string | null;
  onEditPage: (funnelId: number, pageId: number) => void;
  onDuplicate: () => void;
  onCopyPage: () => void;
  onRename: () => void;
  onEditSlug: (newSlug: string) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugValue, setSlugValue] = useState(page.slug);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`bg-white border rounded-xl p-4 transition-all group ${
        isDragging ? "border-teal-400 shadow-lg" : "border-gray-200 hover:border-teal-200 hover:shadow-sm"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Drag handle */}
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded"
              title="Drag to reorder"
            >
              <GripVertical size={16} />
            </button>
            <div className="flex flex-col gap-0">
              <button disabled={!onMoveUp} onClick={onMoveUp} className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-teal-600 disabled:opacity-20 disabled:cursor-not-allowed" title="Move up"><ChevronUp size={12} /></button>
              <button disabled={!onMoveDown} onClick={onMoveDown} className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-teal-600 disabled:opacity-20 disabled:cursor-not-allowed" title="Move down"><ChevronDown size={12} /></button>
            </div>
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-bold text-gray-500">
              {idx + 1}
            </div>
            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
              {meta.label}
            </div>
            <h3 className="font-medium text-gray-900">{page.title}</h3>
            {editingSlug ? (
              <form
                className="flex items-center gap-1"
                onSubmit={e => {
                  e.preventDefault();
                  const clean = slugValue.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
                  if (clean && clean !== page.slug) onEditSlug(clean);
                  setEditingSlug(false);
                }}
              >
                <span className="text-xs text-gray-400">/</span>
                <input
                  autoFocus
                  value={slugValue}
                  onChange={e => setSlugValue(e.target.value)}
                  onBlur={() => {
                    const clean = slugValue.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
                    if (clean && clean !== page.slug) onEditSlug(clean);
                    setEditingSlug(false);
                  }}
                  onKeyDown={e => { if (e.key === "Escape") { setSlugValue(page.slug); setEditingSlug(false); } }}
                  className="text-xs border border-teal-300 rounded px-1.5 py-0.5 w-40 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </form>
            ) : (
              <button
                onClick={() => { setSlugValue(page.slug); setEditingSlug(true); }}
                className="text-xs text-gray-400 hover:text-teal-600 hover:underline flex items-center gap-0.5 group/slug"
                title="Click to edit URL slug"
              >
                /{page.slug}
                <Pencil size={10} className="opacity-0 group-hover/slug:opacity-100 transition-opacity ml-0.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={`${funnelCustomDomain ? `https://${funnelCustomDomain}` : (funnelPublishDomain ? `https://${funnelPublishDomain}` : window.location.origin)}/${funnelSlug}/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg"
              title="Preview this page"
            >
              <ExternalLink size={12} /> Preview
            </a>
            <button onClick={() => onEditPage(funnelId, page.id)} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 bg-teal-50 px-2 py-1 rounded-lg">
              <Pencil size={12} /> Edit Page
            </button>
            <button onClick={onDuplicate} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
              <Copy size={12} /> Duplicate
            </button>
            <button onClick={onCopyPage} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 bg-teal-50 px-2 py-1 rounded-lg">
              <Copy size={12} /> Copy To...
            </button>
            <button onClick={onRename} className="text-xs text-gray-600 hover:text-gray-700 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
              <Settings size={12} /> Rename
            </button>
            <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 pl-8">
          <span>{page.views} views</span>
          <span>{page.conversions} conversions</span>
          {page.productType && <span className="flex items-center gap-1"><Package size={11} /> {page.productType}</span>}
          {page.orderBumpId && <span className="flex items-center gap-1"><ShoppingCart size={11} /> Order bump attached</span>}
          {page.isHidden && <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Hidden</span>}
          {page.isStandaloneLanding && <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">Standalone /p/{page.slug}</span>}
        </div>
      </div>
      {/* Connection arrow */}
      {!isLast && (
        <div className="flex items-center justify-center py-1">
          <div className="flex flex-col items-center">
            <div className="w-px h-3 bg-gray-300" />
            <ArrowRight size={12} className="text-gray-300 rotate-90" />
            {nextPage && <span className="text-[10px] text-gray-400">→ {nextPage.title}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Funnel Page Editor (opens the block editor) ──────────────────────────────

function FunnelPageEditor({ funnelId, pageId, onBack }: { funnelId: number; pageId: number; onBack: () => void }) {
  const [, navigate] = useLocation();
  // Navigate to the standalone funnel page editor route
  useEffect(() => {
    navigate(`/admin/funnels/${funnelId}/pages/${pageId}/edit`);
  }, [funnelId, pageId, navigate]);
  return null;
}

// ─── Helper: Get template pages ───────────────────────────────────────────────

function getTemplatePages(templateName: string): Array<{ type: PageType; title: string; blocks?: any[] }> {
  // Map template names to default page structures
  const templatePageMap: Record<string, Array<{ type: PageType; title: string }>> = {
    "Course Sales Funnel": [
      { type: "landing", title: "Course Landing Page" },
      { type: "checkout", title: "Course Checkout" },
      { type: "upsell", title: "Workbook Upsell" },
      { type: "thank_you", title: "Welcome & Access" },
    ],
    "Lead Magnet Funnel": [
      { type: "landing", title: "Lead Capture Page" },
      { type: "thank_you", title: "Thank You + Offer" },
    ],
    "Webinar Funnel": [
      { type: "landing", title: "Webinar Registration" },
      { type: "custom", title: "Webinar Room" },
      { type: "checkout", title: "Special Offer Checkout" },
      { type: "thank_you", title: "Thank You" },
    ],
    "Product Launch Funnel": [
      { type: "landing", title: "Coming Soon / Waitlist" },
      { type: "landing", title: "Sales Page" },
      { type: "checkout", title: "Checkout" },
      { type: "upsell", title: "One-Time Offer" },
      { type: "thank_you", title: "Order Confirmation" },
    ],
  };

  return templatePageMap[templateName] || [
    { type: "landing", title: "Landing Page" },
    { type: "checkout", title: "Checkout" },
    { type: "thank_you", title: "Thank You" },
  ];
}

// ─── Global Contacts Tab ─────────────────────────────────────────────────────

function GlobalContactsTab({ funnelList }: { funnelList: Funnel[] }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [funnelFilter, setFunnelFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<"all" | "lead" | "registered" | "purchaser">("all");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = trpc.funnelAdmin.globalContacts.useQuery({
    page,
    pageSize: 50,
    search: debouncedSearch || undefined,
    funnelId: funnelFilter,
    conversionStatus: statusFilter,
  });

  const { refetch: fetchCSV } = trpc.funnelAdmin.exportAllContactsCSV.useQuery(
    { funnelId: funnelFilter },
    { enabled: false }
  );

  const handleExportCSV = async () => {
    const result = await fetchCSV();
    if (result.data?.csvContent) {
      const blob = new Blob([result.data.csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "purchaser") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Purchaser</span>;
    if (status === "registered") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Registered</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Lead</span>;
  };

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email, name, or funnel..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={funnelFilter ?? ""}
          onChange={e => { setFunnelFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        >
          <option value="">All Funnels</option>
          {funnelList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="lead">Lead Only</option>
          <option value="registered">Registered</option>
          <option value="purchaser">Purchaser</option>
        </select>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
          <Download size={14} /> Export CSV
        </Button>
      </div>

      {/* Count */}
      {data && (
        <p className="text-sm text-gray-500 mb-3">{data.total.toLocaleString()} contact{data.total !== 1 ? "s" : ""}</p>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Funnel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead Captured</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.contacts.length ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No contacts found</td></tr>
              ) : (
                data.contacts.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.name || <span className="text-gray-400 italic">Unknown</span>}</div>
                      <div className="text-xs text-gray-500">{c.email}</div>
                      {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{c.funnelName ?? "-"}</td>
                    <td className="px-4 py-3">{statusBadge(c.conversionStatus)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.source ?? "-"}</td>
                    <td className="px-4 py-3">
                      {c.tags ? c.tags.split(",").map(t => (
                        <span key={t} className="inline-block mr-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t.trim()}</span>
                      )) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.registeredAt ? new Date(c.registeredAt).toLocaleDateString() : <span className="text-gray-300">-</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ─── Conversion Tracker Tab ───────────────────────────────────────────────────

function ConversionTrackerTab({ funnelList }: { funnelList: Funnel[] }) {
  const [funnelFilter, setFunnelFilter] = useState<number | undefined>(undefined);

  const { data, isLoading } = trpc.funnelAdmin.conversionFunnel.useQuery({ funnelId: funnelFilter });

  const metricCard = (label: string, value: number | string, sub?: string, color?: string) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color ?? "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* Funnel filter */}
      <div className="flex items-center gap-3 mb-6">
        <Filter size={14} className="text-gray-400" />
        <select
          value={funnelFilter ?? ""}
          onChange={e => setFunnelFilter(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        >
          <option value="">All Funnels</option>
          {funnelList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : data ? (
        <>
          {/* Funnel Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {metricCard("Total Leads", data.totalLeads.toLocaleString(), "unique emails captured")}
            {metricCard("Registered Users", data.registeredUsers.toLocaleString(), "created an account", "text-blue-600")}
            {metricCard("Purchasers", data.purchasers.toLocaleString(), "completed a purchase", "text-green-600")}
            {metricCard("Lead → Registered", `${data.leadToRegisteredRate}%`, "of leads registered", data.leadToRegisteredRate > 20 ? "text-green-600" : "text-orange-500")}
            {metricCard("Registered → Buyer", `${data.registeredToPurchaserRate}%`, "of users purchased", data.registeredToPurchaserRate > 10 ? "text-green-600" : "text-orange-500")}
            {metricCard("Overall Conversion", `${data.overallConversionRate}%`, "lead to purchaser", data.overallConversionRate > 5 ? "text-green-600" : "text-red-500")}
          </div>

          {/* Visual Funnel */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Conversion Funnel</h3>
            <div className="flex items-end gap-2 h-32">
              {[
                { label: "Leads", value: data.totalLeads, color: "bg-gray-400" },
                { label: "Registered", value: data.registeredUsers, color: "bg-blue-400" },
                { label: "Purchasers", value: data.purchasers, color: "bg-green-500" },
              ].map((step, i) => {
                const maxVal = data.totalLeads || 1;
                const height = Math.max(8, Math.round((step.value / maxVal) * 100));
                return (
                  <div key={i} className="flex flex-col items-center flex-1">
                    <div className="text-sm font-bold text-gray-700 mb-1">{step.value.toLocaleString()}</div>
                    <div
                      className={`w-full rounded-t-lg ${step.color} transition-all`}
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-xs text-gray-500 mt-2 text-center">{step.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-Funnel Breakdown */}
          {data.byFunnel.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Per-Funnel Breakdown</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Funnel</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Leads</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Registered</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Purchasers</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Reg. Rate</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Purchase Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byFunnel.map(f => (
                    <tr key={f.funnelId} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{f.funnelName}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{f.leads.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-blue-600">{f.registered.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-green-600">{f.purchasers.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-medium ${f.registrationRate > 20 ? "text-green-600" : "text-orange-500"}`}>{f.registrationRate}%</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-medium ${f.purchaseRate > 10 ? "text-green-600" : "text-orange-500"}`}>{f.purchaseRate}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent Leads */}
          {data.recentLeads.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Recent Leads</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {data.recentLeads.map((l, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{l.name || l.email}</div>
                      {l.name && <div className="text-xs text-gray-500">{l.email}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">{l.funnelName}</div>
                      <div className="text-xs text-gray-400">{l.createdAt ? new Date(l.createdAt).toLocaleDateString() : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FunnelBuilder() {
  const params = useParams<{ funnelId?: string }>();
  const [, navigate] = useLocation();
  const urlFunnelId = params.funnelId ? Number(params.funnelId) : null;

  const [view, setView] = useState<"list" | "detail" | "edit">(
    urlFunnelId ? "detail" : "list"
  );
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(urlFunnelId);
  const [editPageId, setEditPageId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Sync URL params to state when navigating back from page editor
  useEffect(() => {
    if (urlFunnelId) {
      setSelectedFunnelId(urlFunnelId);
      setView("detail");
    } else {
      setView("list");
    }
  }, [urlFunnelId]);

  const handleSelectFunnel = (id: number) => {
    navigate(`/admin/funnels/${id}`);
  };

  const handleCreated = (id: number) => {
    setShowCreate(false);
    navigate(`/admin/funnels/${id}`);
  };

  const handleEditPage = (funnelId: number, pageId: number) => {
    navigate(`/admin/funnels/${funnelId}/pages/${pageId}/edit`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {view === "list" && (
        <FunnelListView onSelect={handleSelectFunnel} onCreate={() => setShowCreate(true)} />
      )}
      {view === "detail" && selectedFunnelId && (
        <FunnelDetailView
          funnelId={selectedFunnelId}
          onBack={() => navigate("/admin/funnels")}
          onEditPage={handleEditPage}
        />
      )}
      {view === "edit" && selectedFunnelId && editPageId && (
        <FunnelPageEditor
          funnelId={selectedFunnelId}
          pageId={editPageId}
          onBack={() => setView("detail")}
        />
      )}
      {showCreate && (
        <CreateFunnelDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
