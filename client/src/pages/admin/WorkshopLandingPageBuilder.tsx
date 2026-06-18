/**
 * WorkshopLandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG page editor for workshop sales pages.
 * Route: /admin/workshops/:workshopId/landing-builder
 *
 * Thin wrapper — all block catalog, BlockPreview, BlockSettings, and SortableBlock
 * are imported from LandingPageBuilder.tsx so all builders stay in sync.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type Block, type BlockType } from "@/components/BlockPreview";
import {
  uid, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock, LandingBlockTemplatesTab,
} from "./LandingPageBuilder";
import {
  ArrowLeft, Save, Eye, Plus, X, Layers, Copy, Search, Bookmark, FolderOpen,
  Globe, BookOpen, Loader2,
} from "lucide-react";

export default function WorkshopLandingPageBuilder() {
  const { workshopId } = useParams<{ workshopId: string }>();
  const [, navigate] = useLocation();
  const numericId = Number(workshopId);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pageInfo, setPageInfo] = useState<{ title: string; slug?: string } | null>(null);

  // SEO state
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoImage, setSeoImage] = useState("");
  const [seoSaved, setSeoSaved] = useState(false);

  // Block picker modal
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"catalog" | "from_pages" | "templates" | "import_url">("catalog");
  const [activeCat, setActiveCat] = useState<string>("Layout");
  const [blockSearch, setBlockSearch] = useState("");

  // from_pages tab state
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [selectedSourceFunnelId, setSelectedSourceFunnelId] = useState<number | null>(null);
  const [selectedSourceFunnelPageId, setSelectedSourceFunnelPageId] = useState<number | null>(null);

  // import_url tab state
  const [importUrl, setImportUrl] = useState("");
  const [importPreview, setImportPreview] = useState<{ blocks: any[]; pageTitle: string; blockCount: number } | null>(null);
  const [importSelectedBlocks, setImportSelectedBlocks] = useState<Set<number>>(new Set());

  // Right panel resizable
  const [rightPanelWidth, setRightPanelWidth] = useState(288);
  const rightPanelDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    rightPanelDragRef.current = { startX: e.clientX, startWidth: rightPanelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!rightPanelDragRef.current) return;
      const delta = rightPanelDragRef.current.startX - ev.clientX;
      setRightPanelWidth(Math.min(700, Math.max(240, rightPanelDragRef.current.startWidth + delta)));
    };
    const onUp = () => {
      rightPanelDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Save-as-template
  const [saveTemplateDialogBlock, setSaveTemplateDialogBlock] = useState<Block | null>(null);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const utils = trpc.useUtils();
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

  // ── Load data ──
  const { isLoading, data: lpData } = trpc.workshopAdmin.getById.useQuery(
    { id: numericId },
    { enabled: !isNaN(numericId) }
  );
  useEffect(() => {
    if (!lpData || hasLoaded) return;
    setHasLoaded(true);
    const w = lpData.workshop;
    setPageInfo({ title: w.title, slug: w.slug });
    if (w.landingBlocks) {
      try { setBlocks(JSON.parse(w.landingBlocks) as Block[]); } catch {}
    }
    if ((w as any).metaTitle) setSeoTitle((w as any).metaTitle);
    if ((w as any).metaDescription) setSeoDescription((w as any).metaDescription);
    if ((w as any).seoImage) setSeoImage((w as any).seoImage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpData]);

  // ── Save blocks ──
  const saveBlocksMutation = trpc.workshopAdmin.saveLandingBlocks.useMutation({
    onSuccess: () => toast.success("Workshop landing page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  // ── Save SEO ──
  const saveSeoMutation = trpc.workshopAdmin.update.useMutation({
    onSuccess: () => { setSeoSaved(true); setTimeout(() => setSeoSaved(false), 2000); },
    onError: (e: any) => toast.error(`SEO save failed: ${e.message}`),
  });
  const handleSaveSeo = () => {
    saveSeoMutation.mutate({ id: numericId, metaTitle: seoTitle, metaDescription: seoDescription, seoImage });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveBlocksMutation.mutateAsync({ id: numericId, blocks: JSON.stringify(blocks) });
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

  const addBlock = (type: BlockType) => {
    const newBlock: Block = { id: uid(), type, data: {} };
    setBlocks(prev => insertPosition === "top" ? [newBlock, ...prev] : [...prev, newBlock]);
    setSelectedId(newBlock.id);
    setAddMenuOpen(false);
  };

  const duplicateBlock = (block: Block) => {
    const copy: Block = { ...block, id: uid(), data: { ...block.data } };
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === block.id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setSelectedId(copy.id);
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ── Catalog filtered by category ──
  const catalogByCat = useMemo(() => BLOCK_CATALOG.filter(c => c.category === activeCat), [activeCat]);

  // ── from_pages: courses with landing blocks ──
  const { data: coursesWithBlocks } = trpc.lmsAdmin.getCoursesWithLandingBlocks.useQuery(
    undefined,
    { enabled: addMenuOpen && pickerTab === "from_pages" }
  );
  const sourceCourseBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceCourseId || !coursesWithBlocks) return [];
    const course = coursesWithBlocks.find((c: any) => c.id === selectedSourceCourseId);
    if (!course?.blocks) return [];
    try {
      const parsed = typeof course.blocks === "string" ? JSON.parse(course.blocks) : course.blocks;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [selectedSourceCourseId, coursesWithBlocks]);

  // ── from_pages: funnels with pages ──
  const { data: funnelsWithPages } = trpc.funnelAdmin.getFunnelsWithPages.useQuery(
    undefined,
    { enabled: addMenuOpen && pickerTab === "from_pages" }
  );
  const sourceFunnelPageBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceFunnelId || !selectedSourceFunnelPageId || !funnelsWithPages) return [];
    const funnel = funnelsWithPages.find((f: any) => f.id === selectedSourceFunnelId);
    const page = funnel?.pages.find((p: any) => p.id === selectedSourceFunnelPageId);
    if (!page?.blocks) return [];
    try {
      const parsed = typeof page.blocks === "string" ? JSON.parse(page.blocks) : page.blocks;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [selectedSourceFunnelId, selectedSourceFunnelPageId, funnelsWithPages]);

  const activeSourceBlocks = selectedSourceFunnelPageId ? sourceFunnelPageBlocks : sourceCourseBlocks;
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
    setBlocks(prev => insertPosition === "top" ? [copy, ...prev] : [...prev, copy]);
    setSelectedId(copy.id);
    setAddMenuOpen(false);
    toast.success(`Block "${BLOCK_CATALOG.find(c => c.type === block.type)?.label ?? block.type}" copied!`);
  };
  const copyAllBlocksFromSource = () => {
    if (activeSourceBlocks.length === 0) return;
    if (blocks.length > 0 && !confirm(`Replace all ${blocks.length} block(s) with ${activeSourceBlocks.length} blocks from this source?`)) return;
    setBlocks(activeSourceBlocks.map(b => ({ ...b, id: uid() })));
    setSelectedId(null);
    setAddMenuOpen(false);
    toast.success(`Copied ${activeSourceBlocks.length} blocks!`);
  };

  // ── import_url ──
  const scrapeUrlMutation = trpc.pageScraper.scrapeUrl.useMutation({
    onSuccess: (data) => {
      setImportPreview(data);
      setImportSelectedBlocks(new Set(data.blocks.map((_: any, i: number) => i)));
    },
    onError: (err: any) => toast.error(err.message || "Failed to scrape URL"),
  });

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  const [insertPosition, setInsertPosition] = useState<"top" | "bottom">("bottom");
  const openPicker = (pos: "top" | "bottom" = "bottom") => { setInsertPosition(pos); setPickerTab("catalog"); setAddMenuOpen(true); };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-gray-600"
            onClick={() => navigate(`/admin/lms?tab=workshops`)}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <span className="text-sm font-semibold text-gray-800">{pageInfo?.title ?? "Workshop"}</span>
            {pageInfo?.slug && (
              <span className="text-xs text-gray-400 ml-2">/workshops/{pageInfo.slug}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => window.open(`/workshops/${pageInfo?.slug}`, "_blank")}
            disabled={!pageInfo?.slug}
          >
            <Eye className="w-4 h-4" /> Preview
          </Button>
          <Button
            size="sm"
            className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <Plus size={24} />
              </div>
              <button
                onClick={openPicker}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
              >
                <Plus size={16} /> Add Your First Block
              </button>
              <p className="text-sm">Open the block picker to add content</p>
            </div>
          ) : (
            <div className="bg-white min-h-full shadow-sm mx-auto" style={{ maxWidth: "900px" }}>
              {/* Add block at TOP */}
              <div className="flex justify-center py-4 border-b border-dashed border-gray-200">
                <button
                  onClick={() => openPicker("top")}
                  className="w-full max-w-xs border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-xl py-2.5 text-teal-600 hover:text-teal-700 text-sm flex items-center justify-center gap-2 transition-colors bg-white"
                >
                  <Plus size={15} /> Add Block at Top
                </button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToFirstScrollableAncestor]}
              >
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDuplicate={() => duplicateBlock(block)}
                      onDelete={() => deleteBlock(block.id)}
                      onSaveAsTemplate={handleSaveBlockAsTemplate}
                      onMoveUp={idx > 0 ? () => { setBlocks(prev => arrayMove(prev, idx, idx - 1)); setSelectedId(block.id); } : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => { setBlocks(prev => arrayMove(prev, idx, idx + 1)); setSelectedId(block.id); } : undefined}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {/* Add block at BOTTOM */}
              <div className="flex justify-center py-6 border-t border-dashed border-gray-200">
                <button
                  onClick={() => openPicker("bottom")}
                  className="w-full max-w-xs border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-xl py-3 text-teal-600 hover:text-teal-700 text-sm flex items-center justify-center gap-2 transition-colors bg-white"
                >
                  <Plus size={16} /> Add Block
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel — block settings */}
        <div
          className="shrink-0 border-l bg-white overflow-y-auto relative"
          style={{ width: rightPanelWidth }}
        >
          {/* Drag handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400 active:bg-teal-500 z-10 transition-colors"
            onMouseDown={handleRightPanelMouseDown}
          />

          {selectedBlock ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {selectedBlock.type.replace(/_/g, " ")}
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedId(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <BlockSettings
                block={selectedBlock}
                onChange={data => setBlocks(prev => prev.map(b => b.id === selectedId ? { ...b, data } : b))}
              />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Add Block button */}
              <button
                onClick={openPicker}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-teal-300 hover:border-teal-500 text-teal-600 hover:text-teal-700 text-sm font-medium transition-colors"
              >
                <Plus size={14} /> Add Block
              </button>
              <p className="text-xs text-gray-400 text-center">Click "Add Block" to open the block picker with all block types, copy blocks from other pages, or insert saved templates.</p>

              {/* SEO panel */}
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">SEO / Meta</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Meta Title</Label>
                    <Input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="Page title for search engines" className="text-xs h-8" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Meta Description</Label>
                    <textarea
                      value={seoDescription}
                      onChange={e => setSeoDescription(e.target.value)}
                      placeholder="Brief description for search results"
                      className="w-full text-xs border rounded-md px-2 py-1.5 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-teal-400"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">OG Image URL</Label>
                    <Input value={seoImage} onChange={e => setSeoImage(e.target.value)} placeholder="https://..." className="text-xs h-8" />
                  </div>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={handleSaveSeo}
                    disabled={saveSeoMutation.isPending}
                  >
                    {seoSaved ? "✓ SEO Saved" : "Save SEO"}
                  </Button>
                </div>
              </div>
              <div className="text-xs text-gray-400 text-center pt-2">
                Click a block to edit its settings
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Block Picker Modal ── */}
      <Dialog open={addMenuOpen} onOpenChange={open => { setAddMenuOpen(open); if (!open) setBlockSearch(""); }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-teal-700 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Add Content Block
            </DialogTitle>
          </DialogHeader>
          {/* Top-level tabs */}
          <div className="flex border-b border-gray-200 shrink-0 overflow-x-auto scrollbar-none -mx-4 sm:-mx-6 px-4 sm:px-6">
            {([
              { id: "catalog", icon: <Plus className="w-3.5 h-3.5" />, label: "New Block" },
              { id: "from_pages", icon: <BookOpen className="w-3.5 h-3.5" />, label: "Copy" },
              { id: "templates", icon: <Layers className="w-3.5 h-3.5" />, label: "Templates" },
              { id: "import_url", icon: <Globe className="w-3.5 h-3.5" />, label: "Import URL" },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => { setPickerTab(tab.id); if (tab.id === "import_url") setImportPreview(null); }}
                className={cn(
                  "px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 shrink-0",
                  pickerTab === tab.id
                    ? "text-teal-700 border-b-2 border-teal-500"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {/* ── Catalog tab ── */}
          {pickerTab === "catalog" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none bg-gray-50 shrink-0 -mx-4 sm:-mx-6 px-4 sm:px-6">
                {CATALOG_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCat(cat)}
                    className={cn(
                      "px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                      activeCat === cat ? "text-teal-700 border-b-2 border-teal-500 bg-white" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1 overflow-y-auto flex-1">
                {catalogByCat.map(b => (
                  <button
                    key={b.type}
                    onClick={() => { addBlock(b.type as BlockType); setAddMenuOpen(false); }}
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
              {/* Left: source selectors */}
              <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto border-r border-gray-100 pr-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Course Landing Page</label>
                  <select
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                    value={selectedSourceCourseId ?? ""}
                    onChange={e => {
                      setSelectedSourceCourseId(e.target.value ? Number(e.target.value) : null);
                      setSelectedSourceFunnelId(null);
                      setSelectedSourceFunnelPageId(null);
                      setBlockSearch("");
                    }}
                  >
                    <option value="">— select course —</option>
                    {coursesWithBlocks?.map((c: any) => (
                      <option key={c.id} value={c.id} title={c.title}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Funnel Page</label>
                  <select
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                    value={selectedSourceFunnelId ?? ""}
                    onChange={e => {
                      setSelectedSourceFunnelId(e.target.value ? Number(e.target.value) : null);
                      setSelectedSourceFunnelPageId(null);
                      setSelectedSourceCourseId(null);
                      setBlockSearch("");
                    }}
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
                          <button
                            key={p.id}
                            onClick={() => { setSelectedSourceFunnelPageId(p.id); setBlockSearch(""); }}
                            className={cn(
                              "w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors",
                              selectedSourceFunnelPageId === p.id
                                ? "bg-teal-50 text-teal-700 font-semibold border border-teal-200"
                                : "text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            {p.title}<span className="text-[10px] text-gray-400 ml-1 capitalize">({p.pageType})</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {/* Right: block list */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {!selectedSourceCourseId && !selectedSourceFunnelPageId ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                    <BookOpen className="w-8 h-8 opacity-30" />
                    <p>Select a course or funnel page to browse its blocks</p>
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
                      {activeSourceBlocks.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0"
                          onClick={copyAllBlocksFromSource}
                        >
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
                          <div
                            key={b.id}
                            className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {catalogEntry && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-700 truncate">{catalogEntry?.label ?? b.type}</p>
                                <p className="text-xs text-gray-400 truncate">{b.type}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={() => copyBlockFromSource(b)}
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
            <LandingBlockTemplatesTab
              onInsert={(block) => {
                setBlocks(prev => [...prev, block]);
                setSelectedId(block.id);
                toast.success("Block template inserted!");
                setAddMenuOpen(false);
              }}
            />
          )}

          {/* ── Import from URL tab ── */}
          {pickerTab === "import_url" && (
            <div className="flex flex-col flex-1 overflow-hidden gap-3 p-1">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && importUrl.trim()) scrapeUrlMutation.mutate({ url: importUrl.trim() }); }}
                  placeholder="https://example.com/page-to-import"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <button
                  onClick={() => { if (importUrl.trim()) scrapeUrlMutation.mutate({ url: importUrl.trim() }); }}
                  disabled={!importUrl.trim() || scrapeUrlMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {scrapeUrlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  {scrapeUrlMutation.isPending ? "Scraping..." : "Scrape"}
                </button>
              </div>
              {importPreview && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Found <strong>{importPreview.blockCount}</strong> blocks from <em>{importPreview.pageTitle || importUrl}</em>. Select which to import:
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setImportSelectedBlocks(new Set(importPreview.blocks.map((_: any, i: number) => i)))} className="text-xs text-teal-600 hover:underline">All</button>
                      <button onClick={() => setImportSelectedBlocks(new Set())} className="text-xs text-gray-500 hover:underline">None</button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-2">
                    {importPreview.blocks.map((block: any, i: number) => (
                      <label key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={importSelectedBlocks.has(i)}
                          onChange={e => {
                            const next = new Set(importSelectedBlocks);
                            if (e.target.checked) next.add(i); else next.delete(i);
                            setImportSelectedBlocks(next);
                          }}
                          className="mt-0.5 accent-teal-600"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">{block.type}</span>
                          <p className="text-xs text-gray-500 truncate">
                            {block.type === "hero" ? block.data?.headline :
                             block.type === "text" ? (block.data?.html || "").replace(/<[^>]+>/g, "").slice(0, 80) :
                             block.type === "bullets" || block.type === "numbered_list" ? (block.data?.items?.[0] || "") :
                             block.type === "image" ? (block.data?.alt || block.data?.url || "Image") :
                             JSON.stringify(block.data).slice(0, 80)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    disabled={importSelectedBlocks.size === 0}
                    onClick={() => {
                      const toAdd = importPreview.blocks
                        .filter((_: any, i: number) => importSelectedBlocks.has(i))
                        .map((b: any) => ({ ...b, id: uid() }));
                      setBlocks(prev => [...prev, ...toAdd]);
                      setAddMenuOpen(false);
                      toast.success(`Imported ${toAdd.length} block${toAdd.length !== 1 ? "s" : ""} from URL!`);
                    }}
                    className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Import {importSelectedBlocks.size} Selected Block{importSelectedBlocks.size !== 1 ? "s" : ""}
                  </button>
                </>
              )}
              {!importPreview && !scrapeUrlMutation.isPending && (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-gray-400">
                  <Globe className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Enter a URL above and click Scrape to import page content as blocks.</p>
                  <p className="text-xs">Headings, paragraphs, images, and lists will be converted to content blocks automatically.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Save Block as Template Dialog ── */}
      <Dialog open={!!saveTemplateDialogBlock} onOpenChange={(open) => { if (!open) setSaveTemplateDialogBlock(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-teal-700 flex items-center gap-2">
              <Bookmark className="w-4 h-4" /> Save Block as Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1 block">Template Name <span className="text-red-500">*</span></Label>
              <Input
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                placeholder="e.g. Hero Banner — Teal"
                className="text-sm"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1 block">Description <span className="text-gray-400">(optional)</span></Label>
              <Input
                value={saveTemplateDesc}
                onChange={e => setSaveTemplateDesc(e.target.value)}
                placeholder="Brief description of this block template"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateDialogBlock(null)} className="text-sm">Cancel</Button>
            <Button
              disabled={!saveTemplateName.trim() || saveBlockTemplateMutation.isPending}
              onClick={() => {
                if (!saveTemplateDialogBlock || !saveTemplateName.trim()) return;
                saveBlockTemplateMutation.mutate(
                  {
                    name: saveTemplateName.trim(),
                    description: saveTemplateDesc.trim() || undefined,
                    blockType: saveTemplateDialogBlock.type,
                    blockData: JSON.parse(JSON.stringify(saveTemplateDialogBlock.data ?? {})),
                  },
                  { onSuccess: () => { setSaveTemplateDialogBlock(null); } }
                );
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white text-sm"
            >
              {saveBlockTemplateMutation.isPending ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
