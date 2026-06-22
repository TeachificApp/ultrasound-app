/**
 * BundleLandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG page editor.
 * Route: /admin/bundles/:bundleId/landing-builder
 *
 * Thin wrapper — all block catalog, BlockPreview, BlockSettings, and SortableBlock
 * are imported from LandingPageBuilder.tsx so all builders stay in sync.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type Block, type BlockType } from "@/components/BlockPreview";
import { uid, BLOCK_CATALOG, BlockSettings, SortableBlock } from "./LandingPageBuilder";
import { FUNNEL_TEMPLATES, getFunnelTemplateBlocks } from "@/lib/funnelTemplates";
import {
  ArrowLeft, Save, Eye, Plus, X, Layers, Copy, Search, BookmarkPlus, Bookmark, FolderOpen, Trash2,
} from "lucide-react";

export default function BundleLandingPageBuilder() {
  const { bundleId } = useParams<{ bundleId: string }>();
  const [, navigate] = useLocation();
  const numericId = Number(bundleId);
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
  const [pickerTab, setPickerTab] = useState<"catalog" | "from_pages" | "templates">("catalog");
  const [blockSearch, setBlockSearch] = useState("");
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [selectedSourceDownloadId, setSelectedSourceDownloadId] = useState<number | null>(null);
  const [selectedSourceProductId, setSelectedSourceProductId] = useState<number | null>(null);
  const [selectedSourceFunnelId, setSelectedSourceFunnelId] = useState<number | null>(null);
  const [selectedSourceFunnelPageId, setSelectedSourceFunnelPageId] = useState<number | null>(null);
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
    const onUp = () => { rightPanelDragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  // Save-as-template
  const [saveTemplateDialogBlock, setSaveTemplateDialogBlock] = useState<Block | null>(null);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const utils = trpc.useUtils();
  // Save page as template
  const [savePageTemplateName, setSavePageTemplateName] = useState("");
  const [savePageTemplateDesc, setSavePageTemplateDesc] = useState("");
  const [isSavingPageTemplate, setIsSavingPageTemplate] = useState(false);
  const savePageTemplateMutation = trpc.lmsAdmin.savePageTemplate.useMutation({
    onSuccess: () => { toast.success("Page template saved!"); setSavePageTemplateName(""); setSavePageTemplateDesc(""); refetchPageTemplates(); },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });
  const handleSavePageAsTemplate = async () => {
    if (!savePageTemplateName.trim()) { toast.error("Please enter a template name"); return; }
    setIsSavingPageTemplate(true);
    try {
      await savePageTemplateMutation.mutateAsync({ name: savePageTemplateName.trim(), description: savePageTemplateDesc.trim() || undefined, templateType: "page", blocks });
    } finally { setIsSavingPageTemplate(false); }
  };
  const saveBlockTemplateMutation = trpc.blockTemplates.save.useMutation({
    onSuccess: () => { toast.success("Block saved as template!"); utils.blockTemplates.list.invalidate(); setSaveTemplateDialogBlock(null); setSaveTemplateName(""); setSaveTemplateDesc(""); },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });
  const handleSaveBlockAsTemplate = useCallback((block: Block) => {
    setSaveTemplateName(""); setSaveTemplateDesc(""); setSaveTemplateDialogBlock(block);
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Load data ──
  const { isLoading, data: lpData } = trpc.bundlesAdmin.getById.useQuery(
    { id: numericId },
    { enabled: !isNaN(numericId) }
  );
  useEffect(() => {
    if (!lpData || hasLoaded) return;
    setHasLoaded(true);
    const bundle = lpData.bundle;
    setPageInfo({ title: bundle.title, slug: bundle.slug });
    if (bundle.landingPageBlocks) {
      try { setBlocks(JSON.parse(bundle.landingPageBlocks) as Block[]); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpData]);

  // ── Save blocks ──
  const saveBlocks = trpc.bundlesAdmin.update.useMutation({
    onSuccess: () => toast.success("Bundle landing page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  // ── Save SEO ──
  const seoSavePending = false;

  const handleSaveSeo = () => {
    toast.info('SEO settings coming soon.');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveBlocks.mutateAsync({ id: numericId, landingPageBlocks: JSON.stringify(blocks) });
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

  // ── Block picker queries ──
  const { data: coursesWithBlocks } = trpc.lmsAdmin.getCoursesWithLandingBlocks.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: downloadsWithBlocks } = trpc.lmsAdmin.getDownloadsWithLandingBlocks.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: productsWithBlocks } = trpc.lmsAdmin.getProductsWithLandingBlocks.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: funnelsWithPages } = trpc.funnelAdmin.getFunnelsWithPages.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: pageTemplates = [], isLoading: pageTemplatesLoading, refetch: refetchPageTemplates } = trpc.lmsAdmin.listPageTemplates.useQuery({});
  const deletePageTpl = trpc.lmsAdmin.deletePageTemplate.useMutation({ onSuccess: () => { toast.success("Template deleted"); refetchPageTemplates(); } });
  const { data: blockTemplates } = trpc.blockTemplates.list.useQuery({ search: blockSearch || undefined });
  const deleteBlockTpl = trpc.blockTemplates.delete.useMutation({ onSuccess: () => { toast.success("Template deleted"); } });

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;
  const backPath = `/admin/lms?tab=bundles&editBundle=${numericId}`;
  const previewPath = pageInfo?.slug ? `/bundles/${pageInfo.slug}` : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400">Bundle Landing Page</p>
            <h1 className="text-sm font-semibold text-gray-900 leading-tight">{pageInfo?.title ?? "Loading…"}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {previewPath && (
            <a href={previewPath} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 text-sm px-4 py-1.5 h-8">
                <Eye size={14} /> Preview
              </Button>
            </a>
          )}
          <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-1.5 text-sm px-4 py-1.5 h-8 bg-teal-600 hover:bg-teal-700 text-white">
            <Save size={14} /> {isSaving ? "Saving…" : "Save Page"}
          </Button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
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

        {/* Center Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center"><Plus size={24} /></div>
              <button onClick={() => { setPickerTab("catalog"); setAddMenuOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
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

        {/* Right Panel */}
        <div className="flex-shrink-0 flex flex-row" style={{ width: rightPanelWidth }}>
          <div
            onMouseDown={handleRightPanelMouseDown}
            className="w-2 flex-shrink-0 cursor-col-resize bg-gray-100 hover:bg-teal-400 active:bg-teal-500 transition-colors flex items-center justify-center group border-l border-gray-200"
            title="Drag to resize panel"
          />
          <div className="flex-1 overflow-y-auto bg-white border-l border-gray-200">
            {selectedBlock ? (
              <BlockSettings
                block={selectedBlock}
                onChange={(data) => updateBlock(selectedBlock.id, data)}
              />
            ) : (
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">SEO / Link Preview</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Meta Title</label>
                      <Input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="Page title for search engines" className="text-sm h-8" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Meta Description</label>
                      <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} placeholder="Brief description for search results" className="w-full text-sm border rounded-md p-2 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Social Preview Image URL</label>
                      <Input value={seoImage} onChange={e => setSeoImage(e.target.value)} placeholder="https://…" className="text-sm h-8" />
                    </div>
                    <Button onClick={handleSaveSeo} size="sm" variant="outline" className="w-full h-8 text-xs gap-1">
                      {seoSaved ? "✓ Saved" : "Save SEO Settings"}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">Click a block on the canvas to edit its settings.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Block Picker Modal */}
      {addMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Add Block</h2>
              <button onClick={() => setAddMenuOpen(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex border-b border-gray-100">
              {["catalog", "from_pages", "templates"].map(t => (
                <button key={t} onClick={() => setPickerTab(t as any)} className={cn("flex-1 py-2 text-xs font-medium capitalize transition-colors", pickerTab === t ? "border-b-2 border-teal-500 text-teal-600" : "text-gray-500 hover:text-gray-700")}>
                  {t === "catalog" ? "All Blocks" : t === "from_pages" ? "Copy from Page" : "Templates"}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {pickerTab === "catalog" && (
                <div>
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                    <input value={blockSearch} onChange={e => setBlockSearch(e.target.value)} placeholder="Search blocks…" className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {BLOCK_CATALOG.filter(b => !blockSearch || b.label.toLowerCase().includes(blockSearch.toLowerCase())).map(b => (
                      <button key={b.type} onClick={() => { addBlock(b.type as BlockType); setAddMenuOpen(false); }}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors text-center">
                        <span className="text-lg">{b.icon ?? "📦"}</span>
                        <span className="text-xs font-medium text-gray-700 leading-tight">{b.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {pickerTab === "from_pages" && (
                <div className="space-y-4">
                  {/* Course blocks */}
                  {coursesWithBlocks && coursesWithBlocks.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Courses</p>
                      <select value={selectedSourceCourseId ?? ""} onChange={e => setSelectedSourceCourseId(e.target.value ? Number(e.target.value) : null)} className="w-full text-sm border rounded-lg p-2 mb-2">
                        <option value="">Select a course…</option>
                        {coursesWithBlocks.map((c: any) => <option key={c.id} value={c.id} title={c.title}>{c.title}</option>)}
                      </select>
                      {selectedSourceCourseId && (() => {
                        const course = coursesWithBlocks.find((c: any) => c.id === selectedSourceCourseId);
                        const courseBlocks: Block[] = course?.landingBlocks ? JSON.parse(course.landingBlocks) : [];
                        return courseBlocks.length > 0 ? (
                          <div className="grid grid-cols-1 gap-1.5">
                            {courseBlocks.map((b: Block) => (
                              <button key={b.id} onClick={() => { addBlock(b.type); setBlocks(prev => { const last = prev[prev.length - 1]; return prev.map(x => x.id === last.id ? { ...b, id: uid() } : x); }); setAddMenuOpen(false); }}
                                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-teal-50 hover:border-teal-400 transition-colors text-left">
                                <Copy size={12} className="text-gray-400 flex-shrink-0" />
                                <span className="truncate">{b.type}: {(b.data as any)?.title ?? (b.data as any)?.heading ?? "Block"}</span>
                              </button>
                            ))}
                          </div>
                        ) : <p className="text-xs text-gray-400">No blocks on this course page.</p>;
                      })()}
                    </div>
                  )}
                  {/* Download blocks */}
                  {downloadsWithBlocks && downloadsWithBlocks.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Downloads</p>
                      <select value={selectedSourceDownloadId ?? ""} onChange={e => setSelectedSourceDownloadId(e.target.value ? Number(e.target.value) : null)} className="w-full text-sm border rounded-lg p-2 mb-2">
                        <option value="">Select a download…</option>
                        {downloadsWithBlocks.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
                      </select>
                    </div>
                  )}
                  {/* Product blocks */}
                  {productsWithBlocks && productsWithBlocks.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Products</p>
                      <select value={selectedSourceProductId ?? ""} onChange={e => setSelectedSourceProductId(e.target.value ? Number(e.target.value) : null)} className="w-full text-sm border rounded-lg p-2 mb-2">
                        <option value="">Select a product…</option>
                        {productsWithBlocks.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </div>
                  )}
                  {/* Funnel pages */}
                  {funnelsWithPages && funnelsWithPages.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Funnel Pages</p>
                      <select value={selectedSourceFunnelId ?? ""} onChange={e => { setSelectedSourceFunnelId(e.target.value ? Number(e.target.value) : null); setSelectedSourceFunnelPageId(null); }} className="w-full text-sm border rounded-lg p-2 mb-2">
                        <option value="">Select a funnel…</option>
                        {funnelsWithPages.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      {selectedSourceFunnelId && (() => {
                        const funnel = funnelsWithPages.find((f: any) => f.id === selectedSourceFunnelId);
                        return funnel?.pages?.length > 0 ? (
                          <select value={selectedSourceFunnelPageId ?? ""} onChange={e => setSelectedSourceFunnelPageId(e.target.value ? Number(e.target.value) : null)} className="w-full text-sm border rounded-lg p-2">
                            <option value="">Select a page…</option>
                            {funnel.pages.map((p: any) => <option key={p.id} value={p.id}>{p.title ?? `Page ${p.id}`}</option>)}
                          </select>
                        ) : <p className="text-xs text-gray-400">No pages in this funnel.</p>;
                      })()}
                    </div>
                  )}
                </div>
              )}
              {pickerTab === "templates" && (
                <div className="space-y-4">
                  {/* Built-in sales funnel templates */}
                  <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/70">
                    <p className="text-xs font-semibold text-amber-700 mb-3">Built-in Sales Funnel Templates</p>
                    <div className="space-y-2">
                      {FUNNEL_TEMPLATES.map((template, index) => (
                        <div key={template.name} className="bg-white border border-amber-100 rounded-lg p-3">
                          <h3 className="font-semibold text-gray-900 text-sm">{template.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                          <Button
                            onClick={() => {
                              const tplBlocks = getFunnelTemplateBlocks(index);
                              setBlocks(tplBlocks.map(b => ({ ...b, id: uid() })));
                              setSelectedId(null);
                              setAddMenuOpen(false);
                            }}
                            className="mt-3 h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                          >
                            Insert funnel page
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Save current page as template */}
                  <div className="border border-dashed border-teal-300 rounded-xl p-4 bg-teal-50/50">
                    <p className="text-xs font-semibold text-teal-700 mb-3">Save Current Page as Template</p>
                    <div className="space-y-2">
                      <Input value={savePageTemplateName} onChange={e => setSavePageTemplateName(e.target.value)} className="h-8 text-sm" placeholder="Template name…" />
                      <Input value={savePageTemplateDesc} onChange={e => setSavePageTemplateDesc(e.target.value)} className="h-8 text-sm" placeholder="Description (optional)" />
                      <Button onClick={handleSavePageAsTemplate} disabled={isSavingPageTemplate || !savePageTemplateName.trim()} className="w-full h-8 text-sm bg-teal-600 hover:bg-teal-700 text-white">
                        {isSavingPageTemplate ? "Saving…" : "Save as Template"}
                      </Button>
                    </div>
                  </div>
                  {/* Saved page templates */}
                  {pageTemplatesLoading ? (
                    <p className="text-sm text-gray-400">Loading templates…</p>
                  ) : pageTemplates.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Saved Page Templates</p>
                      <div className="space-y-2">
                        {pageTemplates.map((tpl: any) => (
                          <div key={tpl.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{tpl.name}</p>
                              {tpl.description && <p className="text-xs text-gray-500">{tpl.description}</p>}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                const tplBlocks = JSON.parse(tpl.blocksJson);
                                setBlocks(tplBlocks.map((b: any) => ({ ...b, id: uid() })));
                                setSelectedId(null);
                                setAddMenuOpen(false);
                              }}>Apply</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => deletePageTpl.mutate({ id: tpl.id })}>
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Block templates */}
                  {blockTemplates && blockTemplates.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Block Templates</p>
                      <div className="space-y-2">
                        {blockTemplates.map((tpl: any) => (
                          <div key={tpl.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{tpl.name}</p>
                              {tpl.description && <p className="text-xs text-gray-500">{tpl.description}</p>}
                              <p className="text-xs text-gray-400">{tpl.blockType}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                const block = { id: uid(), type: tpl.blockType, data: JSON.parse(tpl.blockDataJson) };
                                setBlocks(prev => [...prev, block]);
                                setSelectedId(block.id);
                                setAddMenuOpen(false);
                              }}>Add</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => deleteBlockTpl.mutate({ id: tpl.id })}>
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Save-as-template dialog */}
      {saveTemplateDialogBlock && (
        <Dialog open onOpenChange={() => setSaveTemplateDialogBlock(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Save Block as Template</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Template Name *</label>
                <Input value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)} placeholder="e.g. Hero with CTA" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
                <Input value={saveTemplateDesc} onChange={e => setSaveTemplateDesc(e.target.value)} placeholder="Brief description" className="text-sm" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 h-8 text-xs" onClick={() => setSaveTemplateDialogBlock(null)}>Cancel</Button>
                <Button className="flex-1 h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white" disabled={!saveTemplateName.trim()} onClick={() => {
                  saveBlockTemplateMutation.mutate({ name: saveTemplateName.trim(), description: saveTemplateDesc.trim() || undefined, blockType: saveTemplateDialogBlock.type, blockDataJson: JSON.stringify(saveTemplateDialogBlock.data) });
                }}>Save Template</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
