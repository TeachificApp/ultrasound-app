/**
 * FunnelBuilder.tsx
 * Standalone Funnel Builder — ClickFunnels-style multi-page funnel management.
 * Route: /admin/funnels
 * Supports creating funnels with multiple pages (landing, checkout, upsell, thank you)
 * that can optionally attach courses, downloads, or standalone products.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FUNNEL_TEMPLATES, getFunnelTemplateBlocks } from "@/lib/funnelTemplates";
import {
  ArrowLeft, Plus, Trash2, Copy, Eye, Settings, MoreHorizontal,
  Globe, FileText, CreditCard, Gift, ThumbsUp, Layers, ArrowRight,
  ExternalLink, BarChart3, Pencil, Check, X, ChevronDown, Zap,
  LayoutTemplate, ShoppingCart, Download, BookOpen, Package,
} from "lucide-react";

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
}

const PAGE_TYPE_META: Record<PageType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  landing: { label: "Landing Page", icon: <FileText size={16} />, color: "bg-blue-100 text-blue-700", description: "Capture leads and warm up traffic" },
  checkout: { label: "Checkout", icon: <CreditCard size={16} />, color: "bg-green-100 text-green-700", description: "Collect payment for products" },
  upsell: { label: "Upsell", icon: <Gift size={16} />, color: "bg-purple-100 text-purple-700", description: "Offer additional products after purchase" },
  downsell: { label: "Downsell", icon: <ShoppingCart size={16} />, color: "bg-orange-100 text-orange-700", description: "Alternative offer if upsell declined" },
  thank_you: { label: "Thank You", icon: <ThumbsUp size={16} />, color: "bg-teal-100 text-teal-700", description: "Confirm purchase and deliver access" },
  custom: { label: "Custom Page", icon: <Layers size={16} />, color: "bg-gray-100 text-gray-700", description: "Flexible page for any purpose" },
};

// ─── Funnel List View ─────────────────────────────────────────────────────────

function FunnelListView({ onSelect, onCreate }: { onSelect: (id: number) => void; onCreate: () => void }) {
  const { data: funnelList, isLoading } = trpc.funnel.list.useQuery();

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
      {!funnelList || funnelList.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Layers size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No funnels yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">Create your first sales funnel to start converting visitors into customers. Choose from templates or build from scratch.</p>
          <Button onClick={onCreate} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus size={16} /> Create Your First Funnel
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funnelList.map((funnel: Funnel) => (
            <FunnelCard key={funnel.id} funnel={funnel} onClick={() => onSelect(funnel.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FunnelCard({ funnel, onClick }: { funnel: Funnel; onClick: () => void }) {
  const statusColors: Record<FunnelStatus, string> = {
    draft: "bg-yellow-100 text-yellow-700",
    active: "bg-green-100 text-green-700",
    archived: "bg-gray-100 text-gray-500",
  };

  return (
    <div onClick={onClick} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-teal-200 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: funnel.accentColor + "20", color: funnel.accentColor }}>
            <Layers size={16} />
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[funnel.status]}`}>
            {funnel.status}
          </span>
        </div>
        <ArrowRight size={16} className="text-gray-300 group-hover:text-teal-500 transition-colors" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1 truncate">{funnel.name}</h3>
      {funnel.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{funnel.description}</p>}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><FileText size={12} /> {funnel.pages.length} pages</span>
        <span className="flex items-center gap-1"><Eye size={12} /> {funnel.totalViews} views</span>
        <span className="flex items-center gap-1"><BarChart3 size={12} /> {funnel.totalConversions} conversions</span>
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
    if (selectedTemplate) {
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

// ─── Funnel Detail / Editor View ──────────────────────────────────────────────

function FunnelDetailView({ funnelId, onBack, onEditPage }: { funnelId: number; onBack: () => void; onEditPage: (funnelId: number, pageId: number) => void }) {
  const { data: funnel, isLoading, refetch } = trpc.funnel.get.useQuery({ id: funnelId });
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [showAddPage, setShowAddPage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const updateFunnel = trpc.funnel.update.useMutation({ onSuccess: () => { refetch(); toast.success("Updated"); } });
  const deleteFunnel = trpc.funnel.delete.useMutation({ onSuccess: () => { toast.success("Funnel deleted"); onBack(); } });
  const duplicateFunnel = trpc.funnel.duplicate.useMutation({ onSuccess: () => { refetch(); toast.success("Funnel duplicated"); } });
  const addPage = trpc.funnel.addPage.useMutation({ onSuccess: () => { refetch(); setShowAddPage(false); toast.success("Page added"); } });
  const deletePage = trpc.funnel.deletePage.useMutation({ onSuccess: () => { refetch(); toast.success("Page deleted"); } });
  const connectPages = trpc.funnel.connectPages.useMutation({ onSuccess: () => { refetch(); } });

  useEffect(() => {
    if (funnel) setNameValue(funnel.name);
  }, [funnel]);

  if (isLoading || !funnel) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading funnel...</div>;
  }

  const handleStatusToggle = () => {
    const newStatus = funnel.status === "active" ? "draft" : "active";
    updateFunnel.mutate({ id: funnelId, status: newStatus });
  };

  const handleAddPage = (pageType: PageType) => {
    const title = PAGE_TYPE_META[pageType].label;
    addPage.mutate({ funnelId, pageType, title });
  };

  const handleAutoConnect = () => {
    // Auto-connect pages in order
    const pages = funnel.pages;
    for (let i = 0; i < pages.length - 1; i++) {
      connectPages.mutate({ fromPageId: pages[i].id, toPageId: pages[i + 1].id });
    }
    toast.success("Pages connected in sequence");
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
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
          <Button variant="outline" size="sm" onClick={handleAutoConnect} className="gap-1.5 text-xs">
            <Zap size={14} /> Auto-Connect
          </Button>
          <Button variant="outline" size="sm" onClick={handleStatusToggle} className={`gap-1.5 text-xs ${funnel.status === "active" ? "text-green-700 border-green-200 bg-green-50" : "text-yellow-700 border-yellow-200 bg-yellow-50"}`}>
            <Globe size={14} /> {funnel.status === "active" ? "Live" : "Draft"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => duplicateFunnel.mutate({ id: funnelId })} className="gap-1.5 text-xs">
            <Copy size={14} /> Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this funnel?")) deleteFunnel.mutate({ id: funnelId }); }} className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Funnel Info Bar */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <span className="flex items-center gap-1.5"><Eye size={14} /> {funnel.totalViews} views</span>
          <span className="flex items-center gap-1.5"><BarChart3 size={14} /> {funnel.totalConversions} conversions</span>
          {funnel.status === "active" && (
            <a href={`/f/${funnel.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-teal-600 hover:text-teal-700">
              <ExternalLink size={14} /> /f/{funnel.slug}
            </a>
          )}
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="text-sm text-gray-500 hover:text-teal-700 flex items-center gap-1.5">
          <Settings size={14} /> Settings
        </button>
      </div>

      {/* Settings Panel (collapsible) */}
      {showSettings && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">Funnel Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Accent Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={funnel.accentColor} onChange={e => updateFunnel.mutate({ id: funnelId, accentColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                <span className="text-xs text-gray-500">{funnel.accentColor}</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Background Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={funnel.bgColor} onChange={e => updateFunnel.mutate({ id: funnelId, bgColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                <span className="text-xs text-gray-500">{funnel.bgColor}</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <Textarea defaultValue={funnel.description || ""} onBlur={e => updateFunnel.mutate({ id: funnelId, description: e.target.value || null })} className="text-sm min-h-[60px]" />
          </div>
        </div>
      )}

      {/* Page Flow Visualization */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Funnel Pages</h2>
        <Button onClick={() => setShowAddPage(true)} variant="outline" size="sm" className="gap-1.5 text-xs">
          <Plus size={14} /> Add Page
        </Button>
      </div>

      {/* Pages as connected flow */}
      <div className="space-y-3">
        {funnel.pages.map((page, idx) => {
          const meta = PAGE_TYPE_META[page.pageType as PageType] || PAGE_TYPE_META.custom;
          const nextPage = page.nextPageId ? funnel.pages.find(p => p.id === page.nextPageId) : null;
          return (
            <div key={page.id}>
              <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-200 hover:shadow-sm transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                      {idx + 1}
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                      {meta.label}
                    </div>
                    <h3 className="font-medium text-gray-900">{page.title}</h3>
                    <span className="text-xs text-gray-400">/{page.slug}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEditPage(funnelId, page.id)} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 bg-teal-50 px-2 py-1 rounded-lg">
                      <Pencil size={12} /> Edit Page
                    </button>
                    <button onClick={() => { if (confirm("Delete this page?")) deletePage.mutate({ id: page.id }); }} className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>{page.views} views</span>
                  <span>{page.conversions} conversions</span>
                  {page.productType && <span className="flex items-center gap-1"><Package size={11} /> {page.productType}</span>}
                  {page.orderBumpId && <span className="flex items-center gap-1"><ShoppingCart size={11} /> Order bump attached</span>}
                </div>
              </div>
              {/* Connection arrow */}
              {idx < funnel.pages.length - 1 && (
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
        })}
      </div>

      {/* Add Page Dialog */}
      {showAddPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Add Page</h3>
              <button onClick={() => setShowAddPage(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-2">
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FunnelBuilder() {
  const [view, setView] = useState<"list" | "detail" | "edit">("list");
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [editPageId, setEditPageId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleSelectFunnel = (id: number) => {
    setSelectedFunnelId(id);
    setView("detail");
  };

  const handleCreated = (id: number) => {
    setShowCreate(false);
    setSelectedFunnelId(id);
    setView("detail");
  };

  const handleEditPage = (funnelId: number, pageId: number) => {
    setSelectedFunnelId(funnelId);
    setEditPageId(pageId);
    setView("edit");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {view === "list" && (
        <FunnelListView onSelect={handleSelectFunnel} onCreate={() => setShowCreate(true)} />
      )}
      {view === "detail" && selectedFunnelId && (
        <FunnelDetailView
          funnelId={selectedFunnelId}
          onBack={() => setView("list")}
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
