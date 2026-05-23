/**
 * FunnelPageEditor.tsx
 * Full-screen drag-and-drop WYSIWYG block editor for funnel pages.
 * Route: /admin/funnels/:funnelId/pages/:pageId/edit
 * Reuses the same block system as the LMS LandingPageBuilder.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { type Block, type BlockType, BlockPreview } from "@/components/BlockPreview";
import { uid, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock } from "./LandingPageBuilder";
import {
  ArrowLeft, Save, Eye, Plus, Palette, X, FolderOpen, Layers, Settings, GitBranch, Trash2, ChevronDown, ChevronUp, GripVertical, Bookmark, BookOpen, Copy, Search,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Main Editor ─────────────────────────────────────────────────────────────

export default function FunnelPageEditor() {
  const { funnelId, pageId } = useParams<{ funnelId: string; pageId: string }>();
  const [, navigate] = useLocation();
  const numericPageId = Number(pageId);
  const numericFunnelId = Number(funnelId);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadedPageId, setLoadedPageId] = useState<number | null>(null);
  const [activeCat, setActiveCat] = useState<string>("Layout");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"catalog" | "from_pages" | "templates">("catalog");
  const [selectedSourceFunnelId, setSelectedSourceFunnelId] = useState<number | null>(null);
  const [selectedSourcePageId, setSelectedSourcePageId] = useState<number | null>(null);
  const [blockSearch, setBlockSearch] = useState("");

  // Auto-scroll preview canvas to the selected block
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load page data
  const { isLoading, data: pageData } = trpc.funnel.getPageById.useQuery(
    { id: numericPageId },
    { enabled: !isNaN(numericPageId) }
  );

  // Load blocks from page data — keyed on pageId so navigating to a copied/different page always reloads
  useEffect(() => {
    if (!pageData || loadedPageId === numericPageId) return;
    setLoadedPageId(numericPageId);
    setSelectedId(null);
    if (pageData.page.blocks) {
      try {
        const parsed = JSON.parse(pageData.page.blocks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBlocks(parsed as Block[]);
          return;
        }
      } catch { /* fall through to defaults */ }
    }
    setBlocks(getDefaultBlocks(pageData.page.pageType, pageData.page.title));
  }, [pageData, numericPageId, loadedPageId]);

  // Save blocks
  const updatePage = trpc.funnel.updatePage.useMutation({
    onSuccess: () => toast.success("Page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePage.mutateAsync({
        id: numericPageId,
        blocks: JSON.stringify(blocks),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks(prev => {
        const oldIndex = prev.findIndex(b => b.id === active.id);
        const newIndex = prev.findIndex(b => b.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const addBlock = useCallback((type: BlockType) => {
    const catalog = BLOCK_CATALOG.find(c => c.type === type);
    if (!catalog) return;
    const newBlock: Block = { id: uid(), type, data: { ...catalog.defaultData } };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedId(newBlock.id);
  }, []);

  const updateBlock = useCallback((id: string, data: Record<string, any>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, data } : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const block = prev.find(b => b.id === id);
      if (!block) return prev;
      const newBlock: Block = { ...block, id: uid(), data: { ...block.data } };
      const idx = prev.findIndex(b => b.id === id);
      return [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
    });
  }, []);

  const selectedBlock = blocks.find(b => b.id === selectedId);
  const catalogByCat = BLOCK_CATALOG.filter(c => c.category === activeCat);

  // Block picker: fetch funnels with pages (for "Copy from Other Pages" tab)
  const { data: funnelsWithPages } = trpc.funnelAdmin.getFunnelsWithPages.useQuery(
    undefined,
    { enabled: addMenuOpen && pickerTab === "from_pages" }
  );

  // Parse blocks for the selected source page
  const sourcePageBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceFunnelId || !selectedSourcePageId || !funnelsWithPages) return [];
    const funnel = funnelsWithPages.find(f => f.id === selectedSourceFunnelId);
    const page = funnel?.pages.find(p => p.id === selectedSourcePageId);
    if (!page?.blocks) return [];
    try {
      const parsed = typeof page.blocks === "string" ? JSON.parse(page.blocks) : page.blocks;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [selectedSourceFunnelId, selectedSourcePageId, funnelsWithPages]);

  const filteredSourceBlocks = useMemo(() => {
    if (!blockSearch.trim()) return sourcePageBlocks;
    const q = blockSearch.toLowerCase();
    return sourcePageBlocks.filter(b =>
      b.type.toLowerCase().includes(q) ||
      JSON.stringify(b.data).toLowerCase().includes(q)
    );
  }, [sourcePageBlocks, blockSearch]);

  const copyBlockFromPage = (block: Block) => {
    const copy: Block = { ...block, id: uid() };
    setBlocks(prev => [...prev, copy]);
    setSelectedId(copy.id);
    toast.success("Block copied!");
    setAddMenuOpen(false);
  };

  const copyAllBlocksFromPage = () => {
    if (!sourcePageBlocks.length) return;
    const copies = sourcePageBlocks.map(b => ({ ...b, id: uid() }));
    setBlocks(prev => [...prev, ...copies]);
    toast.success(`${copies.length} block${copies.length > 1 ? "s" : ""} copied!`);
    setAddMenuOpen(false);
  };

  const [saveTemplateDialogBlock, setSaveTemplateDialogBlock] = useState<Block | null>(null);
  const [saveTemplateBlockName, setSaveTemplateBlockName] = useState("");
  const [saveTemplateBlockDesc, setSaveTemplateBlockDesc] = useState("");
  const saveBlockTemplateMutation = trpc.blockTemplates.save.useMutation({
    onSuccess: () => {
      toast.success("Block saved as template!");
      utils.blockTemplates.list.invalidate();
      setSaveTemplateDialogBlock(null);
      setSaveTemplateBlockName("");
      setSaveTemplateBlockDesc("");
    },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSaveBlockAsTemplate = useCallback((block: Block) => {
    setSaveTemplateBlockName("");
    setSaveTemplateBlockDesc("");
    setSaveTemplateDialogBlock(block);
  }, []);

  // Page navigation sidebar
  const allPages = pageData?.allPages ?? [];
  const currentPage = pageData?.page;
  const funnelName = pageData?.funnel?.name ?? "Funnel";

  // SEO / Link Preview state
  const [showSeoPanel, setShowSeoPanel] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoImage, setSeoImage] = useState("");
  const [seoSaved, setSeoSaved] = useState(false);

  // Populate SEO fields when page data loads
  useEffect(() => {
    if (!pageData) return;
    setSeoTitle(pageData.page.seoTitle ?? "");
    setSeoDescription(pageData.page.seoDescription ?? "");
    setSeoImage(pageData.page.seoImage ?? "");
  }, [pageData]);

  const handleSaveSeo = () => {
    updatePage.mutate({
      id: numericPageId,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      seoImage: seoImage.trim() || null,
    }, {
      onSuccess: () => { setSeoSaved(true); setTimeout(() => setSeoSaved(false), 2000); },
    });
  };

  // Branch rules state
  const [showBranchRules, setShowBranchRules] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const savePageTemplateMutation = trpc.lmsAdmin.savePageTemplate.useMutation({
    onSuccess: () => { toast.success("Page saved as template!"); setShowSaveTemplate(false); setSaveTemplateName(""); setSaveTemplateDesc(""); },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });
  const handleSavePageAsTemplate = async () => {
    if (!saveTemplateName.trim()) { toast.error("Please enter a template name"); return; }
    setIsSavingTemplate(true);
    try {
      await savePageTemplateMutation.mutateAsync({ name: saveTemplateName, description: saveTemplateDesc, templateType: "page", blocks });
    } finally {
      setIsSavingTemplate(false);
    }
  };
  const utils = trpc.useUtils();

  const { data: branchRules = [] } = trpc.funnel.listBranchRules.useQuery(
    { pageId: numericPageId },
    { enabled: !isNaN(numericPageId) && showBranchRules }
  );

  const upsertBranchRule = trpc.funnel.upsertBranchRule.useMutation({
    onSuccess: () => {
      toast.success("Rule saved!");
      utils.funnel.listBranchRules.invalidate({ pageId: numericPageId });
      setEditingRule(null);
    },
    onError: (e: any) => toast.error(`Failed: ${e.message}`),
  });

  const deleteBranchRule = trpc.funnel.deleteBranchRule.useMutation({
    onSuccess: () => {
      toast.success("Rule deleted");
      utils.funnel.listBranchRules.invalidate({ pageId: numericPageId });
    },
  });

  const VARIABLES = [
    { value: "product_purchased", label: "Product Purchased" },
    { value: "order_bump_selected", label: "Order Bump Selected" },
    { value: "email_contains", label: "Email Contains" },
    { value: "email_domain", label: "Email Domain" },
    { value: "purchase_price", label: "Purchase Price (cents)" },
    { value: "source_url", label: "Source URL" },
    { value: "utm_source", label: "UTM Source" },
    { value: "utm_medium", label: "UTM Medium" },
    { value: "utm_campaign", label: "UTM Campaign" },
    { value: "date_range", label: "Date Range" },
    { value: "day_of_week", label: "Day of Week (0=Sun)" },
    { value: "hour_of_day", label: "Hour of Day (0-23)" },
    { value: "country", label: "Country (ISO)" },
    { value: "device_type", label: "Device Type" },
    { value: "custom_field", label: "Custom Field" },
  ];

  const OPERATORS = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not Equals" },
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Not Contains" },
    { value: "starts_with", label: "Starts With" },
    { value: "ends_with", label: "Ends With" },
    { value: "greater_than", label: "Greater Than" },
    { value: "less_than", label: "Less Than" },
    { value: "between", label: "Between (use | separator)" },
    { value: "in_list", label: "In List (comma-separated)" },
    { value: "not_in_list", label: "Not In List" },
    { value: "is_set", label: "Is Set" },
    { value: "is_not_set", label: "Is Not Set" },
  ];

  function newCondition() {
    return { variable: "product_purchased", operator: "equals", value: "" };
  }

  function newRule() {
    return {
      id: undefined,
      funnelPageId: numericPageId,
      name: "New Rule",
      priority: branchRules.length,
      matchMode: "all" as const,
      targetPageId: null as number | null,
      targetUrl: null as string | null,
      isActive: true,
      conditions: [newCondition()],
    };
  }

  return (
    <>
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/funnels/${funnelId}`)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 font-medium transition-colors"
          >
            <ArrowLeft size={16} /> Back to Funnel
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
            {funnelName}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {currentPage?.title ?? "Page Editor"}
          </span>
          {currentPage?.pageType && (
            <span className="text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full capitalize">
              {currentPage.pageType.replace("_", " ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pageData?.funnel?.slug && (currentPage?.slug || numericPageId) && (
            <a
              href={currentPage?.slug ? `/${pageData.funnel.slug}/${currentPage.slug}` : `/${pageData.funnel.slug}?preview=${numericPageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 border border-teal-200 bg-teal-50 hover:bg-teal-100 rounded-lg px-3 py-1.5 transition-colors font-medium"
            >
              <Eye size={14} /> Preview Page
            </a>
          )}
          <button
            onClick={() => { setSaveTemplateName(currentPage?.title ? `${currentPage.title} Template` : ""); setShowSaveTemplate(true); }}
            className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-lg px-3 py-1.5 transition-colors"
            title="Save current page as a reusable template"
          >
            <Bookmark size={14} /> Save as Template
          </button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-1.5 h-8"
          >
            <Save size={14} /> {isSaving ? "Saving…" : "Save Page"}
          </Button>
        </div>
      </div>

      {/* Save as Template Dialog */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSaveTemplate(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2"><Bookmark size={18} className="text-amber-500" /> Save Page as Template</h2>
              <button onClick={() => setShowSaveTemplate(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={saveTemplateName}
                  onChange={e => setSaveTemplateName(e.target.value)}
                  placeholder="e.g. Webinar Registration Page"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={saveTemplateDesc}
                  onChange={e => setSaveTemplateDesc(e.target.value)}
                  placeholder="Brief description of this template"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <p className="text-xs text-gray-500">This will save all {blocks.length} block{blocks.length !== 1 ? "s" : ""} on this page as a reusable page template.</p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowSaveTemplate(false)} className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg border border-gray-200 transition-colors">Cancel</button>
              <button onClick={handleSavePageAsTemplate} disabled={isSavingTemplate} className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
                {isSavingTemplate ? "Saving…" : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Block Catalog + Page Nav */}
        <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          {/* Page navigation */}
          {allPages.length > 1 && (
            <div className="p-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2 flex items-center gap-1">
                <Layers size={12} /> Funnel Pages
              </p>
              <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)', minHeight: '5rem' }}>
                {allPages.map((p: any) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-0.5 rounded-lg transition-colors ${
                      p.id === numericPageId ? "bg-teal-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (p.id !== numericPageId) {
                          navigate(`/admin/funnels/${numericFunnelId}/pages/${p.id}/edit`);
                        }
                      }}
                      className={`flex-1 text-left px-2 py-1.5 text-xs transition-colors truncate min-w-0 ${
                        p.id === numericPageId
                          ? "text-teal-700 font-semibold"
                          : "text-gray-600"
                      }`}
                    >
                      {p.title}
                      <span className="text-[10px] text-gray-400 ml-1 capitalize">
                        ({p.pageType.replace("_", " ")})
                      </span>
                    </button>
                    {pageData?.funnel?.slug && p.slug && (
                      <a
                        href={`/${pageData.funnel.slug}/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Preview: ${p.title}`}
                        className="flex-shrink-0 p-1 mr-1 text-gray-300 hover:text-teal-600 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <Eye size={11} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Page Settings */}
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2 flex items-center gap-1">
              <Settings size={12} /> Page Settings
            </p>
            <div className="space-y-2 px-1">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentPage?.isHidden ?? false}
                  onChange={e => updatePage.mutate({ id: numericPageId, isHidden: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span>Hidden from funnel</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentPage?.isStandaloneLanding ?? false}
                  onChange={e => updatePage.mutate({ id: numericPageId, isStandaloneLanding: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span>Standalone page</span>
              </label>

              {currentPage?.isStandaloneLanding && (
                <p className="text-[10px] text-blue-600 bg-blue-50 rounded px-1.5 py-1">
                  Accessible at /p/{currentPage.slug}
                </p>
              )}
            </div>
          </div>
          {/* Link Preview / SEO Panel */}
          <div className="p-2 border-b border-gray-100">
            <button
              onClick={() => setShowSeoPanel(v => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 py-1 hover:text-teal-700 transition-colors"
            >
              <span className="flex items-center gap-1"><Bookmark size={12} /> Link Preview</span>
              {showSeoPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showSeoPanel && (
              <div className="mt-2 space-y-2 px-1">
                <p className="text-[10px] text-gray-400">Override what iMessage, WhatsApp, and social media show when this link is shared.</p>
                <div>
                  <label className="text-[10px] font-medium text-gray-600 block mb-1">Display Name</label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder={currentPage?.title ?? "Page title"}
                    value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-600 block mb-1">Description</label>
                  <textarea
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    rows={3}
                    placeholder="Short description shown in link previews…"
                    value={seoDescription}
                    onChange={e => setSeoDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-600 block mb-1">Preview Image URL</label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="https://…"
                    value={seoImage}
                    onChange={e => setSeoImage(e.target.value)}
                  />
                  {seoImage && (
                    <img src={seoImage} alt="Preview" className="mt-1.5 w-full rounded-lg border border-gray-200 object-cover" style={{ maxHeight: 80 }} />
                  )}
                </div>
                {/* Mini preview card */}
                {(seoTitle || seoDescription) && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {seoImage && <img src={seoImage} alt="" className="w-full object-cover" style={{ maxHeight: 60 }} />}
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] font-semibold text-gray-800 truncate">{seoTitle || currentPage?.title}</p>
                      {seoDescription && <p className="text-[9px] text-gray-500 line-clamp-2">{seoDescription}</p>}
                      <p className="text-[9px] text-teal-600 mt-0.5 truncate">{typeof window !== 'undefined' ? window.location.hostname : 'app.allaboutultrasound.com'}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSaveSeo}
                  disabled={updatePage.isPending}
                  className="w-full text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg py-1.5 transition-colors disabled:opacity-50"
                >
                  {seoSaved ? "✓ Saved!" : updatePage.isPending ? "Saving…" : "Save Preview Settings"}
                </button>
              </div>
            )}
          </div>

          {/* Branch Rules Panel */}
          <div className="p-2 border-b border-gray-100">
            <button
              onClick={() => setShowBranchRules(v => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 py-1 hover:text-teal-700 transition-colors"
            >
              <span className="flex items-center gap-1"><GitBranch size={12} /> Branch Rules</span>
              {showBranchRules ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showBranchRules && (
              <div className="mt-2 space-y-2">
                {(branchRules as any[]).length === 0 && (
                  <p className="text-[10px] text-gray-400 px-1">No rules yet. Rules are evaluated in order — first match wins.</p>
                )}
                {(branchRules as any[]).map((rule: any, idx: number) => (
                  <div key={rule.id} className={`rounded-lg border text-[10px] px-2 py-1.5 ${
                    rule.isActive ? "border-teal-200 bg-teal-50" : "border-gray-200 bg-gray-50 opacity-60"
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-gray-700 truncate">{idx + 1}. {rule.name}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditingRule({ ...rule, conditions: rule.conditions ?? [] })} className="text-gray-400 hover:text-teal-600"><Settings size={10} /></button>
                        <button onClick={() => { if (confirm("Delete this rule?")) deleteBranchRule.mutate({ id: rule.id }); }} className="text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
                      </div>
                    </div>
                    <p className="text-gray-400 mt-0.5">
                      {rule.conditions?.length ?? 0} condition{rule.conditions?.length !== 1 ? "s" : ""} ({rule.matchMode})
                      {rule.targetPageId ? ` → page #${rule.targetPageId}` : rule.targetUrl ? ` → ${rule.targetUrl.substring(0, 20)}…` : " → (no target)"}
                    </p>
                  </div>
                ))}
                <button
                  onClick={() => setEditingRule(newRule())}
                  className="w-full flex items-center gap-1 justify-center text-[10px] text-teal-600 hover:text-teal-800 border border-dashed border-teal-300 rounded-lg py-1.5 transition-colors"
                >
                  <Plus size={10} /> Add Rule
                </button>
              </div>
            )}
          </div>

          {/* Branch Rule Editor Modal */}
          {editingRule && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold text-gray-800 text-sm">{editingRule.id ? "Edit" : "New"} Branch Rule</h3>
                  <button onClick={() => setEditingRule(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Rule Name</label>
                    <input
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      value={editingRule.name}
                      onChange={e => setEditingRule((r: any) => ({ ...r, name: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600 block mb-1">Match Mode</label>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={editingRule.matchMode}
                        onChange={e => setEditingRule((r: any) => ({ ...r, matchMode: e.target.value }))}
                      >
                        <option value="all">All conditions must match</option>
                        <option value="any">Any condition matches</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRule.isActive}
                          onChange={e => setEditingRule((r: any) => ({ ...r, isActive: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        Active
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">Conditions</label>
                    <div className="space-y-2">
                      {editingRule.conditions.map((cond: any, ci: number) => (
                        <div key={ci} className="flex gap-1 items-start">
                          <div className="flex-1 grid grid-cols-3 gap-1">
                            <select
                              className="col-span-1 text-xs border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              value={cond.variable}
                              onChange={e => setEditingRule((r: any) => ({ ...r, conditions: r.conditions.map((c: any, i: number) => i === ci ? { ...c, variable: e.target.value } : c) }))}
                            >
                              {VARIABLES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                            </select>
                            <select
                              className="col-span-1 text-xs border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              value={cond.operator}
                              onChange={e => setEditingRule((r: any) => ({ ...r, conditions: r.conditions.map((c: any, i: number) => i === ci ? { ...c, operator: e.target.value } : c) }))}
                            >
                              {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <input
                              className="col-span-1 text-xs border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              placeholder="Value"
                              value={cond.value}
                              onChange={e => setEditingRule((r: any) => ({ ...r, conditions: r.conditions.map((c: any, i: number) => i === ci ? { ...c, value: e.target.value } : c) }))}
                            />
                          </div>
                          <button
                            onClick={() => setEditingRule((r: any) => ({ ...r, conditions: r.conditions.filter((_: any, i: number) => i !== ci) }))}
                            className="text-gray-300 hover:text-red-400 mt-1.5 flex-shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setEditingRule((r: any) => ({ ...r, conditions: [...r.conditions, newCondition()] }))}
                      className="mt-2 text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1"
                    >
                      <Plus size={10} /> Add Condition
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Redirect Target</label>
                    <p className="text-[10px] text-gray-400 mb-2">Set a target page ID (from this funnel) or an external URL. Leave both empty to skip to next page.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Target Page ID</label>
                        <input
                          type="number"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="e.g. 42"
                          value={editingRule.targetPageId ?? ""}
                          onChange={e => setEditingRule((r: any) => ({ ...r, targetPageId: e.target.value ? parseInt(e.target.value) : null }))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Or External URL</label>
                        <input
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="https://..."
                          value={editingRule.targetUrl ?? ""}
                          onChange={e => setEditingRule((r: any) => ({ ...r, targetUrl: e.target.value || null }))}
                        />
                      </div>
                    </div>
                    {allPages.length > 0 && (
                      <div className="mt-2">
                        <label className="text-[10px] text-gray-500 block mb-1">Or pick a page from this funnel:</label>
                        <select
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          value={editingRule.targetPageId ?? ""}
                          onChange={e => setEditingRule((r: any) => ({ ...r, targetPageId: e.target.value ? parseInt(e.target.value) : null, targetUrl: null }))}
                        >
                          <option value="">— select page —</option>
                          {allPages.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.title} ({p.pageType})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 p-4 border-t">
                  <Button variant="outline" onClick={() => setEditingRule(null)} className="text-sm">Cancel</Button>
                  <Button
                    onClick={() => upsertBranchRule.mutate(editingRule)}
                    disabled={upsertBranchRule.isPending}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-sm"
                  >
                    {upsertBranchRule.isPending ? "Saving…" : "Save Rule"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add Block button */}
          <div className="p-2">
            <button
              onClick={() => { setPickerTab("catalog"); setAddMenuOpen(true); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
            >
              <Plus size={14} /> Add Block
            </button>
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <Plus size={24} />
              </div>
              <button
              onClick={() => { setPickerTab("catalog"); setAddMenuOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
            >
              <Plus size={16} /> Add Your First Block
            </button>
          <p className="text-sm">Open the block picker to add content</p>
              <p className="text-xs text-gray-300">
                This is a {currentPage?.pageType?.replace("_", " ")} page
              </p>
            </div>
          ) : (
            <div className="bg-white min-h-full shadow-sm mx-auto" style={{ maxWidth: "900px" }}>
              <DndContext sensors={sensors} modifiers={[restrictToFirstScrollableAncestor]} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onSaveAsTemplate={handleSaveBlockAsTemplate}
                      onMoveUp={idx > 0 ? () => setBlocks(prev => arrayMove(prev, idx, idx - 1)) : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => setBlocks(prev => arrayMove(prev, idx, idx + 1)) : undefined}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex justify-center py-6 border-t border-dashed border-gray-200">
                <button
                  onClick={() => { setPickerTab("catalog"); setAddMenuOpen(true); }}
                  className="w-full max-w-xs border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-xl py-3 text-teal-600 hover:text-teal-700 text-sm flex items-center justify-center gap-2 transition-colors bg-white"
                >
                  <Plus size={16} /> Add Block
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Block Settings */}
        <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
          {selectedBlock ? (
            <>
              <div className="flex items-center justify-between p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {BLOCK_CATALOG.find(c => c.type === selectedBlock.type)?.label ?? "Block"} Settings
                </p>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <div className="p-3">
                <BlockSettings block={selectedBlock} onChange={(data) => updateBlock(selectedBlock.id, data)} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
              <Palette size={24} className="mb-2 opacity-50" />
              <p className="text-sm">Click any block on the canvas to edit its settings</p>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── Block Picker Modal (same as LessonBlockEditor) ── */}
    <Dialog open={addMenuOpen} onOpenChange={open => { setAddMenuOpen(open); if (!open) setBlockSearch(""); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-teal-700 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add Content Block
          </DialogTitle>
        </DialogHeader>

        {/* Top-level tabs */}
        <div className="flex gap-1 border-b border-gray-200 shrink-0 -mx-1 px-1">
          <button
            onClick={() => setPickerTab("catalog")}
            className={cn(
              "px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5",
              pickerTab === "catalog"
                ? "text-teal-700 border-b-2 border-teal-500"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Plus className="w-3.5 h-3.5" /> New Block
          </button>
          <button
            onClick={() => setPickerTab("from_pages")}
            className={cn(
              "px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5",
              pickerTab === "from_pages"
                ? "text-teal-700 border-b-2 border-teal-500"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <BookOpen className="w-3.5 h-3.5" /> Copy from Other Pages
          </button>
          <button
            onClick={() => setPickerTab("templates")}
            className={cn(
              "px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5",
              pickerTab === "templates"
                ? "text-teal-700 border-b-2 border-teal-500"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Layers className="w-3.5 h-3.5" /> Block Templates
          </button>
        </div>

        {/* ── Catalog tab ── */}
        {pickerTab === "catalog" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Category tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto bg-gray-50 shrink-0">
              {CATALOG_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={cn(
                    "px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                    activeCat === cat
                      ? "text-teal-700 border-b-2 border-teal-500 bg-white"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* Block grid */}
            <div className="grid grid-cols-4 gap-2 p-1 overflow-y-auto flex-1">
              {catalogByCat.map(b => (
                <button
                  key={b.type}
                  onClick={() => { addBlock(b.type); setAddMenuOpen(false); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 text-gray-600 hover:text-teal-700 transition-all text-center"
                >
                  <span className="text-teal-600 text-2xl">{b.icon}</span>
                  <span className="text-xs leading-tight font-medium">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Copy from Other Pages tab ── */}
        {pickerTab === "from_pages" && (
          <div className="flex flex-1 overflow-hidden gap-3 min-h-0">
            {/* Left: Funnel + Page picker */}
            <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto border-r border-gray-100 pr-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Funnel</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                  value={selectedSourceFunnelId ?? ""}
                  onChange={e => {
                    setSelectedSourceFunnelId(e.target.value ? Number(e.target.value) : null);
                    setSelectedSourcePageId(null);
                  }}
                >
                  <option value="">— select funnel —</option>
                  {funnelsWithPages?.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              {selectedSourceFunnelId && (
                <div className="flex-1 overflow-y-auto">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Page</label>
                  {!funnelsWithPages ? (
                    <p className="text-xs text-gray-400 py-2">Loading…</p>
                  ) : (() => {
                    const pages = funnelsWithPages.find(f => f.id === selectedSourceFunnelId)?.pages ?? [];
                    return pages.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No pages with blocks in this funnel.</p>
                    ) : (
                      <div className="space-y-1">
                        {pages.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedSourcePageId(p.id); setBlockSearch(""); }}
                            className={cn(
                              "w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors",
                              selectedSourcePageId === p.id
                                ? "bg-teal-50 text-teal-700 font-semibold border border-teal-200"
                                : "text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            {p.title}
                            <span className="text-[10px] text-gray-400 ml-1 capitalize">({p.pageType})</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Right: Block list */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {!selectedSourcePageId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p>Select a page to browse its blocks</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2 shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input
                        value={blockSearch}
                        onChange={e => setBlockSearch(e.target.value)}
                        placeholder="Search blocks…"
                        className="pl-7 h-7 text-xs"
                      />
                    </div>
                    {sourcePageBlocks.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0"
                        onClick={copyAllBlocksFromPage}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy All ({sourcePageBlocks.length})
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {filteredSourceBlocks.length === 0 ? (
                      <p className="text-xs text-gray-400 py-4 text-center">No blocks found.</p>
                    ) : filteredSourceBlocks.map((b, i) => {
                      const catalogEntry = BLOCK_CATALOG.find(c => c.type === b.type);
                      return (
                        <div
                          key={b.id}
                          className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="text-gray-300 text-xs font-mono w-5 shrink-0 mt-0.5 text-right">{i + 1}</span>
                            {catalogEntry && (
                              <span className="shrink-0 text-teal-500 mt-0.5" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-700 leading-tight">
                                {catalogEntry?.label ?? b.type.replace(/_/g, " ")}
                              </p>
                              {b.data?.headline && (
                                <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{String(b.data.headline).slice(0, 60)}</p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs shrink-0 border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                            onClick={() => copyBlockFromPage(b)}
                          >
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Block Templates tab ── */}
        {pickerTab === "templates" && (
          <FunnelBlockTemplatesTab
            onInsert={(block) => {
              setBlocks(prev => [...prev, block]);
              setAddMenuOpen(false);
              toast.success("Block template inserted!");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
    {/* Save Block as Template Dialog */}
    <Dialog open={!!saveTemplateDialogBlock} onOpenChange={(open) => { if (!open) setSaveTemplateDialogBlock(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-teal-700 flex items-center gap-2">Save Block as Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Template Name <span className="text-red-500">*</span></label>
            <input type="text" value={saveTemplateBlockName} onChange={e => setSaveTemplateBlockName(e.target.value)} placeholder="e.g. Hero Banner" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Description <span className="text-gray-400">(optional)</span></label>
            <input type="text" value={saveTemplateBlockDesc} onChange={e => setSaveTemplateBlockDesc(e.target.value)} placeholder="Brief description" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => setSaveTemplateDialogBlock(null)} className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg border border-gray-200 transition-colors">Cancel</button>
          <button
            disabled={!saveTemplateBlockName.trim() || saveBlockTemplateMutation.isPending}
            onClick={() => {
              if (!saveTemplateDialogBlock || !saveTemplateBlockName.trim()) return;
              saveBlockTemplateMutation.mutate({ name: saveTemplateBlockName.trim(), description: saveTemplateBlockDesc.trim() || undefined, blockType: saveTemplateDialogBlock.type, blockData: JSON.parse(JSON.stringify(saveTemplateDialogBlock.data ?? {})) });
            }}
            className="text-sm bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveBlockTemplateMutation.isPending ? "Saving..." : "Save Template"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ─── Block Templates Tab (reused from LessonBlockEditor pattern) ─────────────────

function FunnelBlockTemplatesTab({ onInsert }: { onInsert: (block: Block) => void }) {
  const [search, setSearch] = useState("");
  const { data: templates, isLoading } = trpc.blockTemplates.list.useQuery({ search: search || undefined });
  const deleteMutation = trpc.blockTemplates.delete.useMutation({
    onSuccess: () => { toast.success("Template deleted"); },
  });
  const utils = trpc.useUtils();

  const handleDelete = (id: number) => {
    if (!confirm("Delete this template?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => utils.blockTemplates.list.invalidate(),
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden gap-3">
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search saved templates…"
          className="pl-8 h-8 text-xs"
        />
      </div>
      {isLoading ? (
        <p className="text-xs text-gray-400 text-center py-6">Loading templates…</p>
      ) : !templates?.length ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
          <Layers className="w-8 h-8 opacity-30" />
          <p className="text-xs">No saved block templates yet.</p>
          <p className="text-xs text-gray-300">Hover a block and click the bookmark icon to save it as a template.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {templates.map((tpl: any) => {
            let blockData: Record<string, any> = {};
            try { blockData = typeof tpl.blockData === "string" ? JSON.parse(tpl.blockData) : (tpl.blockData ?? {}); } catch { /* ignore */ }
            const catalogEntry = BLOCK_CATALOG.find(c => c.type === tpl.blockType);
            const block: Block = { id: uid(), type: tpl.blockType as any, data: blockData };
            return (
              <div key={tpl.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  {catalogEntry && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{tpl.name}</p>
                    {tpl.description && <p className="text-xs text-gray-400 truncate">{tpl.description}</p>}
                    <p className="text-xs text-gray-300">{catalogEntry?.label ?? tpl.blockType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onInsert({ ...block, id: uid() })}>
                    <Plus className="w-3 h-3 mr-1" /> Insert
                  </Button>
                  <button className="w-6 h-6 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    onClick={() => handleDelete(tpl.id)} title="Delete template">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Default blocks based on page type ────────────────────────────────────────

function getDefaultBlocks(pageType: string, title: string): Block[] {
  switch (pageType) {
    case "landing":
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: title || "Your Offer Headline",
            subheadline: "A compelling subtitle that explains the value of your offer",
            bgType: "gradient", gradientFrom: "#179ca3", gradientTo: "#0e4a50",
            gradientDir: "to bottom right", textColor: "#ffffff", align: "left",
            buttons: [{ text: "Get Started", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }],
          },
        },
        {
          id: uid(), type: "bullets",
          data: { headline: "What You Get", items: ["Benefit one", "Benefit two", "Benefit three"], iconColor: "#179ca3", bgColor: "#f8fffe" },
        },
        {
          id: uid(), type: "testimonial",
          data: { quote: "This completely transformed my practice.", author: "Happy Customer", avatarUrl: "", bgColor: "#f0fafa", accentColor: "#179ca3" },
        },
        {
          id: uid(), type: "cta_standalone",
          data: { headline: "Ready to Get Started?", subtext: "", ctaText: "Yes, I Want This!", ctaLink: "", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", align: "center" },
        },
      ];
    case "checkout":
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: "Complete Your Order",
            subheadline: "You're one step away from accessing everything",
            bgType: "color", bgColor: "#0e4a50", textColor: "#ffffff", align: "center",
            buttons: [],
          },
        },
        {
          id: uid(), type: "pricing_cta",
          data: { headline: "Your Investment", subtext: "Secure checkout powered by Stripe", ctaText: "Complete Purchase", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true },
        },
      ];
    case "upsell":
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: "Wait! Special One-Time Offer",
            subheadline: "Before you go, we have something special just for you",
            bgType: "color", bgColor: "#f59e0b", textColor: "#ffffff", align: "center",
            buttons: [{ text: "Yes, Add This!", color: "#ffffff", textColor: "#f59e0b", link: "", style: "filled" }],
          },
        },
        {
          id: uid(), type: "bullets",
          data: { headline: "What's Included", items: ["Bonus item one", "Bonus item two", "Bonus item three"], iconColor: "#f59e0b", bgColor: "#fff7ed" },
        },
      ];
    case "thank_you":
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: "Thank You!",
            subheadline: "Your order is confirmed. Check your email for access details.",
            bgType: "color", bgColor: "#179ca3", textColor: "#ffffff", align: "center",
            buttons: [{ text: "Access Your Content", color: "#ffffff", textColor: "#179ca3", link: "/", style: "filled" }],
          },
        },
        {
          id: uid(), type: "text",
          data: { html: "<h2>What Happens Next?</h2><ol><li>Check your email for login credentials</li><li>Access your content immediately</li><li>Start learning right away</li></ol>", align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" },
        },
      ];
    default:
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: title || "Page Title",
            subheadline: "Add your content below",
            bgType: "color", bgColor: "#179ca3", textColor: "#ffffff", align: "center",
            buttons: [],
          },
        },
      ];
  }
}
