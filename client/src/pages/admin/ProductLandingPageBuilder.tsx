/**
 * ProductLandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG landing page editor for physical products.
 * Route: /admin/products/:productId/landing-builder
 *
 * Thin wrapper — all block catalog, BlockPreview, BlockSettings, and SortableBlock
 * are imported from LandingPageBuilder.tsx so all builders stay in sync.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type Block, type BlockType } from "@/components/BlockPreview";
import { uid, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock } from "./LandingPageBuilder";
import {
  ArrowLeft, Save, Eye, Plus, Palette, X, Layers, BookOpen, Copy, Search, BookmarkPlus, Bookmark, FolderOpen, Trash2,
} from "lucide-react";

export default function ProductLandingPageBuilder() {
  const { productId } = useParams<{ productId: string }>();
  const [, navigate] = useLocation();
  const numericProductId = Number(productId);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("Layout");
  const [productInfo, setProductInfo] = useState<{ title: string; slug: string } | null>(null);
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);

  // SEO / Link Preview state
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoImage, setSeoImage] = useState("");
  const [seoSaved, setSeoSaved] = useState(false);

  // Block picker modal state
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"catalog" | "from_pages" | "templates">("catalog");
  const [selectedSourceProductId, setSelectedSourceProductId] = useState<number | null>(null);
  const [selectedSourceFunnelId, setSelectedSourceFunnelId] = useState<number | null>(null);
  const [selectedSourceFunnelPageId, setSelectedSourceFunnelPageId] = useState<number | null>(null);
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [selectedSourceDownloadId, setSelectedSourceDownloadId] = useState<number | null>(null);
  const [blockSearch, setBlockSearch] = useState("");
  // Right panel resizable width
  const [rightPanelWidth, setRightPanelWidth] = useState(288);
  const rightPanelDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    rightPanelDragRef.current = { startX: e.clientX, startWidth: rightPanelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!rightPanelDragRef.current) return;
      const delta = rightPanelDragRef.current.startX - ev.clientX;
      const newWidth = Math.min(700, Math.max(240, rightPanelDragRef.current.startWidth + delta));
      setRightPanelWidth(newWidth);
    };
    const onUp = () => {
      rightPanelDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Save-as-page-template dialog state
  const [showSavePageTemplate, setShowSavePageTemplate] = useState(false);
  const [savePageTemplateName, setSavePageTemplateName] = useState("");
  const [savePageTemplateDesc, setSavePageTemplateDesc] = useState("");
  const [isSavingPageTemplate, setIsSavingPageTemplate] = useState(false);

  // Save-as-template dialog state
  const [saveTemplateDialogBlock, setSaveTemplateDialogBlock] = useState<Block | null>(null);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const utils = trpc.useUtils();
  const savePageTemplateMutation = trpc.lmsAdmin.savePageTemplate.useMutation({
    onSuccess: () => {
      toast.success("Page saved as template!");
      utils.lmsAdmin.listPageTemplates.invalidate();
      setShowSavePageTemplate(false);
      setSavePageTemplateName("");
      setSavePageTemplateDesc("");
      setIsSavingPageTemplate(false);
    },
    onError: (e: any) => { toast.error(`Save failed: ${e.message}`); setIsSavingPageTemplate(false); },
  });
  const handleSavePageAsTemplate = async () => {
    if (!savePageTemplateName.trim()) { toast.error("Please enter a template name"); return; }
    setIsSavingPageTemplate(true);
    savePageTemplateMutation.mutate({ name: savePageTemplateName, description: savePageTemplateDesc, templateType: "page", blocks });
  };
  const saveBlockTemplateMutation = trpc.blockTemplates.save.useMutation({
    onSuccess: () => {
      toast.success("Block saved as template!");
      utils.blockTemplates.list.invalidate();
      setSaveTemplateDialogBlock(null);
      setSaveTemplateName("");
      setSaveTemplateDesc("");
    },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });
  const handleSaveBlockAsTemplate = useCallback((block: Block) => {
    setSaveTemplateName("");
    setSaveTemplateDesc("");
    setSaveTemplateDialogBlock(block);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Platform settings for publish domain
  const { data: platformSettings } = trpc.lmsGroup.getPlatformSettings.useQuery();
  const productPublishBase = platformSettings?.productPublishDomain
    ? `https://${platformSettings.productPublishDomain}`
    : window.location.origin;

  const { isLoading, data: lpData } = trpc.productsAdmin.getLandingBlocks.useQuery(
    { productId: numericProductId },
    { enabled: !isNaN(numericProductId) }
  );

  // Load blocks from page data — must be in useEffect to avoid setState-during-render (React error #185)
  useEffect(() => {
    if (!lpData || hasLoaded) return;
    setHasLoaded(true);
    setProductInfo({ title: lpData.productTitle, slug: lpData.productSlug });
    if (lpData.blocks && lpData.blocks.length > 0) {
      setBlocks(lpData.blocks as Block[]);
    } else {
      setBlocks(getDefaultBlocks(lpData.productTitle));
    }
    // Load SEO fields
    if ((lpData as any).seoTitle) setSeoTitle((lpData as any).seoTitle);
    if ((lpData as any).seoDescription) setSeoDescription((lpData as any).seoDescription);
    if ((lpData as any).seoImage) setSeoImage((lpData as any).seoImage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpData]);

  // Save SEO / Link Preview
  const saveSeoMutation = trpc.productsAdmin.saveLandingPageSeo.useMutation({
    onSuccess: () => { setSeoSaved(true); setTimeout(() => setSeoSaved(false), 2000); },
    onError: (e: any) => toast.error(`SEO save failed: ${e.message}`),
  });
  const handleSaveSeo = () => {
    saveSeoMutation.mutate({ productId: numericProductId, seoTitle, seoDescription, seoImage });
  };

  const saveBlocks = trpc.productsAdmin.saveLandingBlocks.useMutation({
    onSuccess: () => toast.success("Sales page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveBlocks.mutateAsync({ productId: numericProductId, blocks });
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

  // Block picker: fetch all page sources for "Copy from Other Pages" tab
  const { data: coursesWithBlocks } = trpc.lmsAdmin.getCoursesWithLandingBlocks.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: downloadsWithBlocks } = trpc.lmsAdmin.getDownloadsWithLandingBlocks.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: productsWithBlocks } = trpc.lmsAdmin.getProductsWithLandingBlocks.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: funnelsWithPages } = trpc.funnelAdmin.getFunnelsWithPages.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const sourceCourseBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceCourseId || !coursesWithBlocks) return [];
    const course = coursesWithBlocks.find((c: any) => c.id === selectedSourceCourseId);
    if (!course?.blocks) return [];
    try { const p = typeof course.blocks === "string" ? JSON.parse(course.blocks) : course.blocks; return Array.isArray(p) ? p : []; } catch { return []; }
  }, [selectedSourceCourseId, coursesWithBlocks]);
  const sourceDownloadBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceDownloadId || !downloadsWithBlocks) return [];
    const download = downloadsWithBlocks.find((d: any) => d.id === selectedSourceDownloadId);
    if (!download?.landingBlocks) return [];
    try { const p = typeof download.landingBlocks === "string" ? JSON.parse(download.landingBlocks) : download.landingBlocks; return Array.isArray(p) ? p : []; } catch { return []; }
  }, [selectedSourceDownloadId, downloadsWithBlocks]);
  const sourceProductBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceProductId || !productsWithBlocks) return [];
    const product = productsWithBlocks.find((p: any) => p.id === selectedSourceProductId);
    if (!product?.landingBlocks) return [];
    try { const parsed = typeof product.landingBlocks === "string" ? JSON.parse(product.landingBlocks) : product.landingBlocks; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }, [selectedSourceProductId, productsWithBlocks]);
  const sourceFunnelPageBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceFunnelId || !selectedSourceFunnelPageId || !funnelsWithPages) return [];
    const funnel = funnelsWithPages.find((f: any) => f.id === selectedSourceFunnelId);
    const page = funnel?.pages.find((p: any) => p.id === selectedSourceFunnelPageId);
    if (!page?.blocks) return [];
    try { const parsed = typeof page.blocks === "string" ? JSON.parse(page.blocks) : page.blocks; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }, [selectedSourceFunnelId, selectedSourceFunnelPageId, funnelsWithPages]);
  const activeSourceBlocks = selectedSourceFunnelPageId ? sourceFunnelPageBlocks : selectedSourceCourseId ? sourceCourseBlocks : selectedSourceDownloadId ? sourceDownloadBlocks : sourceProductBlocks;
  const filteredSourceBlocks = useMemo(() => {
    if (!blockSearch.trim()) return activeSourceBlocks;
    const q = blockSearch.toLowerCase();
    return activeSourceBlocks.filter((b: Block) =>
      b.type.toLowerCase().includes(q) ||
      JSON.stringify(b.data).toLowerCase().includes(q)
    );
  }, [activeSourceBlocks, blockSearch]);
  const copyBlockFromSource = (block: Block) => {
    const copy: Block = { ...block, id: uid() };
    setBlocks(prev => [...prev, copy]);
    setSelectedId(copy.id);
    toast.success("Block copied!");
    setAddMenuOpen(false);
  };
  const copyAllBlocksFromSource = () => {
    if (!activeSourceBlocks.length) return;
    const copies = activeSourceBlocks.map((b: Block) => ({ ...b, id: uid() }));
    setBlocks(prev => [...prev, ...copies]);
    toast.success(`${copies.length} block${copies.length > 1 ? "s" : ""} copied!`);
    setAddMenuOpen(false);
  };

  return (
    <>
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/lms?tab=products&editProduct=${productId}`)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 font-medium transition-colors"
          >
            <ArrowLeft size={16} /> Back to Product
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
            {productInfo?.title ?? "Loading…"}
          </span>
          <span className="text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
            Product Sales Page
          </span>
        </div>
        <div className="flex items-center gap-2">
          {productInfo?.slug && (
            <a
              href={`${productPublishBase}/product/${productInfo.slug}?preview=admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Eye size={14} /> Preview
            </a>
          )}
          <button
            onClick={() => setShowApplyTemplate(true)}
            className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 border border-teal-200 bg-teal-50 hover:bg-teal-100 rounded-lg px-3 py-1.5 transition-colors"
            title="Apply a saved page template"
          >
            <FolderOpen size={14} /> Apply Template
          </button>
          <button
            onClick={() => { setSavePageTemplateName(""); setSavePageTemplateDesc(""); setShowSavePageTemplate(true); }}
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

      {/* Apply Template Modal */}
      {showApplyTemplate && (
        <ProductApplyTemplateModal
          onClose={() => setShowApplyTemplate(false)}
          onApply={(tplBlocks) => {
            if (blocks.length > 0 && !confirm(`This will replace all ${blocks.length} block${blocks.length !== 1 ? 's' : ''} on this page with the template. Continue?`)) return;
            setBlocks(tplBlocks.map(b => ({ ...b, id: uid() })));
            setSelectedId(null);
            setShowApplyTemplate(false);
            toast.success("Template applied!");
          }}
        />
      )}

      {/* Save as Page Template Dialog */}
      <Dialog open={showSavePageTemplate} onOpenChange={(open) => { if (!open) setShowSavePageTemplate(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bookmark className="w-4 h-4 text-amber-500" /> Save Page as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Template Name <span className="text-red-500">*</span></label>
              <Input value={savePageTemplateName} onChange={e => setSavePageTemplateName(e.target.value)} placeholder="e.g. Product Sales Page" className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Description (optional)</label>
              <Input value={savePageTemplateDesc} onChange={e => setSavePageTemplateDesc(e.target.value)} placeholder="Brief description…" className="h-8 text-sm" />
            </div>
            <p className="text-xs text-gray-400">This will save all {blocks.length} block{blocks.length !== 1 ? "s" : ""} as a reusable page template.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowSavePageTemplate(false)} className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg border border-gray-200 transition-colors">Cancel</button>
            <Button onClick={handleSavePageAsTemplate} disabled={isSavingPageTemplate} className="bg-amber-500 hover:bg-amber-600 text-white text-sm h-9">
              <BookmarkPlus className="w-4 h-4 mr-1" /> {isSavingPageTemplate ? "Saving…" : "Save Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Add Block button */}
        <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3">
            <button
              onClick={() => { setPickerTab("catalog"); setAddMenuOpen(true); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
            >
              <Plus size={14} /> Add Block
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs text-gray-400 text-center mt-4 px-2">Click "Add Block" to open the block picker with all block types, copy blocks from other pages, or insert saved templates.</p>
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
                      onMoveUp={idx > 0 ? () => setBlocks(prev => arrayMove(prev, idx, idx - 1)) : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => setBlocks(prev => arrayMove(prev, idx, idx + 1)) : undefined}
                      onSaveAsTemplate={handleSaveBlockAsTemplate}
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
        <div className="flex-shrink-0 flex flex-row" style={{ width: rightPanelWidth }}>
          {/* Drag handle — outside overflow container so it's never clipped */}
          <div
            onMouseDown={handleRightPanelMouseDown}
            className="w-2 flex-shrink-0 cursor-col-resize bg-gray-100 hover:bg-teal-400 active:bg-teal-500 transition-colors flex items-center justify-center group border-l border-gray-200"
            title="Drag to resize panel"
          >
            <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-80">
              <div className="w-0.5 h-3 bg-gray-500 rounded" />
              <div className="w-0.5 h-3 bg-gray-500 rounded" />
              <div className="w-0.5 h-3 bg-gray-500 rounded" />
            </div>
          </div>
          <div className="flex-1 bg-white overflow-y-auto min-w-0">
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
            <div className="flex flex-col h-full">
              <div className="pl-4 pr-3 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Bookmark size={12} /> Link Preview / SEO
                </p>
              </div>
              <div className="pl-4 pr-3 py-3 space-y-3 flex-1">
                <p className="text-[10px] text-gray-400">Override what iMessage, WhatsApp, and social media show when this page link is shared.</p>
                <div>
                  <label className="text-[10px] font-medium text-gray-600 block mb-1">Display Name (og:title)</label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder={productInfo?.title ?? "Page title"}
                    value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-600 block mb-1">Description (og:description)</label>
                  <textarea
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    rows={3}
                    placeholder="Short description shown in link previews…"
                    value={seoDescription}
                    onChange={e => setSeoDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-600 block mb-1">Preview Image URL (og:image)</label>
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
                {/* Mini link preview card */}
                {(seoTitle || seoDescription) && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {seoImage && <img src={seoImage} alt="" className="w-full object-cover" style={{ maxHeight: 60 }} />}
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] font-semibold text-gray-800 truncate">{seoTitle || productInfo?.title}</p>
                      {seoDescription && <p className="text-[9px] text-gray-500 line-clamp-2">{seoDescription}</p>}
                      <p className="text-[9px] text-teal-600 mt-0.5 truncate">{typeof window !== 'undefined' ? window.location.hostname : 'allaboutultrasound.com'}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSaveSeo}
                  disabled={saveSeoMutation.isPending}
                  className="w-full text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg py-1.5 transition-colors disabled:opacity-50"
                >
                  {seoSaved ? "✓ Saved!" : saveSeoMutation.isPending ? "Saving…" : "Save Preview Settings"}
                </button>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 text-center">Click any block on the canvas to edit its settings</p>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
    {/* ── Block Picker Modal ── */}
    <Dialog open={addMenuOpen} onOpenChange={open => { setAddMenuOpen(open); if (!open) setBlockSearch(""); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-teal-700 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add Content Block
          </DialogTitle>
        </DialogHeader>
        {/* Top-level tabs */}
        <div className="flex gap-1 border-b border-gray-200 shrink-0 -mx-1 px-1 overflow-x-auto scrollbar-hide flex-nowrap">
          <button onClick={() => setPickerTab("catalog")} className={cn("px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5", pickerTab === "catalog" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
            <Plus className="w-3.5 h-3.5" /> New Block
          </button>
          <button onClick={() => setPickerTab("from_pages")} className={cn("px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5", pickerTab === "from_pages" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
            <BookOpen className="w-3.5 h-3.5" /> Copy from Other Pages
          </button>
          <button onClick={() => setPickerTab("templates")} className={cn("px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5", pickerTab === "templates" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
            <Layers className="w-3.5 h-3.5" /> Block Templates
          </button>
        </div>
        {/* ── Catalog tab ── */}
        {pickerTab === "catalog" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex border-b border-gray-200 overflow-x-auto bg-gray-50 shrink-0">
              {CATALOG_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)} className={cn("px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors", activeCat === cat ? "text-teal-700 border-b-2 border-teal-500 bg-white" : "text-gray-500 hover:text-gray-700")}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 p-1 overflow-y-auto flex-1">
              {catalogByCat.map(b => (
                <button key={b.type} onClick={() => { addBlock(b.type); setAddMenuOpen(false); }} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 text-gray-600 hover:text-teal-700 transition-all text-center">
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
            <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto border-r border-gray-100 pr-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Course Page</label>
                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" value={selectedSourceCourseId ?? ""} onChange={e => { setSelectedSourceCourseId(e.target.value ? Number(e.target.value) : null); setSelectedSourceProductId(null); setSelectedSourceDownloadId(null); setSelectedSourceFunnelId(null); setSelectedSourceFunnelPageId(null); setBlockSearch(""); }}>
                  <option value="">— select course —</option>
                  {coursesWithBlocks?.map((c: any) => <option key={c.id} value={c.id} title={c.title}>{c.title}</option>)}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Download Product</label>
                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" value={selectedSourceDownloadId ?? ""} onChange={e => { setSelectedSourceDownloadId(e.target.value ? Number(e.target.value) : null); setSelectedSourceCourseId(null); setSelectedSourceProductId(null); setSelectedSourceFunnelId(null); setSelectedSourceFunnelPageId(null); setBlockSearch(""); }}>
                  <option value="">— select product —</option>
                  {downloadsWithBlocks?.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Physical Product</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                  value={selectedSourceProductId ?? ""}
                  onChange={e => { setSelectedSourceProductId(e.target.value ? Number(e.target.value) : null); setSelectedSourceCourseId(null); setSelectedSourceDownloadId(null); setSelectedSourceFunnelId(null); setSelectedSourceFunnelPageId(null); setBlockSearch(""); }}
                >
                  <option value="">— select product —</option>
                  {productsWithBlocks?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Funnel Page</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                  value={selectedSourceFunnelId ?? ""}
                  onChange={e => { setSelectedSourceFunnelId(e.target.value ? Number(e.target.value) : null); setSelectedSourceFunnelPageId(null); setSelectedSourceProductId(null); setSelectedSourceCourseId(null); setSelectedSourceDownloadId(null); setBlockSearch(""); }}
                >
                  <option value="">— select funnel —</option>
                  {funnelsWithPages?.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {selectedSourceFunnelId && (() => {
                  const pages = funnelsWithPages?.find((f: any) => f.id === selectedSourceFunnelId)?.pages ?? [];
                  return pages.length === 0 ? (
                    <p className="text-xs text-gray-400 mt-1">No pages with blocks.</p>
                  ) : (
                    <div className="space-y-1 mt-1">
                      {pages.map((p: any) => (
                        <button key={p.id} onClick={() => { setSelectedSourceFunnelPageId(p.id); setBlockSearch(""); }}
                          className={cn("w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors", selectedSourceFunnelPageId === p.id ? "bg-teal-50 text-teal-700 font-semibold border border-teal-200" : "text-gray-600 hover:bg-gray-50")}>
                          {p.title}<span className="text-[10px] text-gray-400 ml-1 capitalize">({p.pageType})</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {!selectedSourceProductId && !selectedSourceFunnelPageId && !selectedSourceCourseId && !selectedSourceDownloadId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p>Select a product or funnel page to browse its blocks</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2 shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input value={blockSearch} onChange={e => setBlockSearch(e.target.value)} placeholder="Search blocks…" className="pl-7 h-7 text-xs" />
                    </div>
                    {activeSourceBlocks.length > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0" onClick={copyAllBlocksFromSource}>
                        <Copy className="w-3 h-3 mr-1" /> Copy All ({activeSourceBlocks.length})
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {filteredSourceBlocks.length === 0 ? (
                      <p className="text-xs text-gray-400 py-4 text-center">No blocks found.</p>
                    ) : filteredSourceBlocks.map((b: Block) => {
                      const catalogEntry = BLOCK_CATALOG.find(c => c.type === b.type);
                      return (
                        <div key={b.id} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {catalogEntry && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">{catalogEntry?.label ?? b.type}</p>
                              <p className="text-xs text-gray-400 truncate">{b.type}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => copyBlockFromSource(b)}>
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
          <ProductTemplatesTab onInsertBlocks={(newBlocks) => { setBlocks(prev => [...prev, ...newBlocks]); if (newBlocks.length > 0) setSelectedId(newBlocks[0].id); toast.success(newBlocks.length === 1 ? "Template inserted!" : `${newBlocks.length} blocks inserted!`); setAddMenuOpen(false); }} />
        )}
      </DialogContent>
    </Dialog>
    {/* ── Save Block as Template Dialog ── */}
    <Dialog open={!!saveTemplateDialogBlock} onOpenChange={(open) => { if (!open) setSaveTemplateDialogBlock(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-teal-700 flex items-center gap-2">
            <BookmarkPlus className="w-4 h-4" /> Save Block as Template
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Template Name <span className="text-red-500">*</span></label>
            <input type="text" value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)} placeholder="e.g. Hero Banner — Teal" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Description <span className="text-gray-400">(optional)</span></label>
            <input type="text" value={saveTemplateDesc} onChange={e => setSaveTemplateDesc(e.target.value)} placeholder="Brief description" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => setSaveTemplateDialogBlock(null)} className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg border border-gray-200 transition-colors">Cancel</button>
          <button disabled={!saveTemplateName.trim() || saveBlockTemplateMutation.isPending} onClick={() => { if (!saveTemplateDialogBlock || !saveTemplateName.trim()) return; saveBlockTemplateMutation.mutate({ name: saveTemplateName.trim(), description: saveTemplateDesc.trim() || undefined, blockType: saveTemplateDialogBlock.type, blockData: JSON.parse(JSON.stringify(saveTemplateDialogBlock.data ?? {})) }); }} className="text-sm bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{saveBlockTemplateMutation.isPending ? "Saving…" : "Save Template"}</button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function ProductTemplatesTab({ onInsertBlocks }: { onInsertBlocks: (blocks: Block[]) => void }) {
  const [subTab, setSubTab] = useState<"page" | "block">("page");
  const [search, setSearch] = useState("");
  const { data: pageTemplates, isLoading: pageLoading, refetch: refetchPage } = trpc.lmsAdmin.listPageTemplates.useQuery({});
  const deletePageTpl = trpc.lmsAdmin.deletePageTemplate.useMutation({ onSuccess: () => { toast.success("Template deleted"); refetchPage(); } });
  const { data: blockTemplates, isLoading: blockLoading } = trpc.blockTemplates.list.useQuery({ search: search || undefined });
  const deleteBlockTpl = trpc.blockTemplates.delete.useMutation({ onSuccess: () => { toast.success("Template deleted"); } });
  const utils = trpc.useUtils();
  const filteredPage = (pageTemplates ?? []).filter((t: any) => !search || t.name?.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="flex flex-col flex-1 overflow-hidden gap-3">
      <div className="flex border-b border-gray-100 shrink-0">
        {(["page", "block"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)} className={cn("flex-1 py-1.5 text-xs font-semibold capitalize transition-colors", subTab === t ? "border-b-2 border-teal-500 text-teal-700" : "text-gray-400 hover:text-gray-600")}>
            {t === "page" ? "Page Templates" : "Block Templates"}
          </button>
        ))}
      </div>
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…" className="pl-8 h-8 text-xs" />
      </div>
      {subTab === "page" && (pageLoading ? <p className="text-xs text-gray-400 text-center py-6">Loading…</p> : !filteredPage.length ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
          <Layers className="w-8 h-8 opacity-30" /><p className="text-xs">No page templates saved yet.</p>
          <p className="text-xs text-gray-300">Use "Save as Template" in any page editor to create one.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredPage.map((tpl: any) => {
            const tplBlocks: Block[] = (() => { try { const b = typeof tpl.blocks === "string" ? JSON.parse(tpl.blocks) : tpl.blocks; return Array.isArray(b) ? b : []; } catch { return []; } })();
            return (
              <div key={tpl.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                <div className="min-w-0"><p className="text-xs font-semibold text-gray-700 truncate">{tpl.name}</p>{tpl.description && <p className="text-xs text-gray-400 truncate">{tpl.description}</p>}<p className="text-xs text-gray-300">{tplBlocks.length} block{tplBlocks.length !== 1 ? "s" : ""}</p></div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onInsertBlocks(tplBlocks.map(b => ({ ...b, id: uid() })))}><Plus className="w-3 h-3 mr-1" /> Insert</Button>
                  <button className="w-6 h-6 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onClick={() => { if (confirm("Delete this template?")) deletePageTpl.mutate({ id: tpl.id }); }}><X className="w-3 h-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {subTab === "block" && (blockLoading ? <p className="text-xs text-gray-400 text-center py-6">Loading…</p> : !blockTemplates?.length ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
          <Layers className="w-8 h-8 opacity-30" /><p className="text-xs">No saved block templates yet.</p>
          <p className="text-xs text-gray-300">Hover a block and click the bookmark icon to save it as a template.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {blockTemplates.map((tpl: any) => {
            let blockData: Record<string, any> = {};
            try { blockData = typeof tpl.blockData === "string" ? JSON.parse(tpl.blockData) : (tpl.blockData ?? {}); } catch { /* ignore */ }
            const catalogEntry = BLOCK_CATALOG.find(c => c.type === tpl.blockType);
            const block: Block = { id: uid(), type: tpl.blockType as any, data: blockData };
            return (
              <div key={tpl.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  {catalogEntry && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>}
                  <div className="min-w-0"><p className="text-xs font-semibold text-gray-700 truncate">{tpl.name}</p>{tpl.description && <p className="text-xs text-gray-400 truncate">{tpl.description}</p>}<p className="text-xs text-gray-300">{catalogEntry?.label ?? tpl.blockType}</p></div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onInsertBlocks([{ ...block, id: uid() }])}><Plus className="w-3 h-3 mr-1" /> Insert</Button>
                  <button className="w-6 h-6 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onClick={() => { if (confirm("Delete this template?")) deleteBlockTpl.mutate({ id: tpl.id }, { onSuccess: () => utils.blockTemplates.list.invalidate() }); }}><X className="w-3 h-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}


// ─── Default blocks for a new product sales page ─────────────────────────────
function getDefaultBlocks(title: string): Block[] {
  return [
    {
      id: uid(), type: "hero",
      data: {
        headline: title || "Your Product Headline",
        subheadline: "A compelling subtitle that explains the value",
        bgType: "gradient", gradientFrom: "#179ca3", gradientTo: "#0e4a50",
        gradientDir: "to bottom right", textColor: "#ffffff", align: "left",
        buttons: [{ text: "Buy Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }],
      },
    },
    {
      id: uid(), type: "bullets",
      data: { headline: "What's Included", items: ["Feature one", "Feature two", "Feature three"], iconColor: "#179ca3", bgColor: "#f8fffe" },
    },
    {
      id: uid(), type: "pricing_cta",
      data: { headline: "Order Now", subtext: "Ships within 3-5 business days.", ctaText: "Buy Now", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true },
    },
  ];
}

// ─── Apply Template Modal ─────────────────────────────────────────────────────
function ProductApplyTemplateModal({ onClose, onApply }: { onClose: () => void; onApply: (blocks: Block[]) => void }) {
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();
  const { data: pageTemplates = [], isLoading } = trpc.lmsAdmin.listPageTemplates.useQuery({});
  const deletePageTpl = trpc.lmsAdmin.deletePageTemplate.useMutation({
    onSuccess: () => utils.lmsAdmin.listPageTemplates.invalidate(),
  });

  const filtered = (pageTemplates as any[]).filter((t: any) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || (t.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><FolderOpen size={18} className="text-teal-600" /> Apply Page Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading templates…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
              <FolderOpen className="w-10 h-10 opacity-30" />
              <p className="text-sm">No page templates saved yet.</p>
              <p className="text-xs text-gray-300">Use "Save as Template" in any page editor to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((tpl: any) => {
                const tplBlocks: Block[] = (() => {
                  try { const b = typeof tpl.blocks === "string" ? JSON.parse(tpl.blocks) : tpl.blocks; return Array.isArray(b) ? b : []; } catch { return []; }
                })();
                return (
                  <div key={tpl.id} className="border border-gray-200 rounded-xl p-4 hover:border-teal-300 hover:bg-teal-50/30 transition-colors group">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{tpl.name}</h3>
                    {tpl.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{tpl.description}</p>}
                    <p className="text-xs text-gray-400 mb-3">{tplBlocks.length} block{tplBlocks.length !== 1 ? "s" : ""}</p>
                    <div className="flex gap-2">
                      <Button onClick={() => onApply(tplBlocks)} className="flex-1 h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white">Apply Template</Button>
                      <button onClick={() => { if (confirm("Delete this template?")) deletePageTpl.mutate({ id: tpl.id }); }} className="w-7 h-7 border border-gray-200 rounded text-gray-400 hover:text-red-500 flex items-center justify-center flex-shrink-0"><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
