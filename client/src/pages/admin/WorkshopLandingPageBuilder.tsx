/**
 * WorkshopLandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG page editor for workshop sales pages.
 * Route: /admin/workshops/:workshopId/landing-builder
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
import {
  ArrowLeft, Save, Eye, Plus, X, Layers, Copy, Search, BookmarkPlus, Bookmark, FolderOpen, Trash2,
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
    setBlocks(prev => [...prev, newBlock]);
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

  // Block templates
  const { data: blockTemplates } = trpc.blockTemplates.list.useQuery({ type: "block" });
  const { data: pageTemplates } = trpc.blockTemplates.list.useQuery({ type: "page" });
  const deletePageTpl = trpc.blockTemplates.delete.useMutation({
    onSuccess: () => { toast.success("Template deleted"); utils.blockTemplates.list.invalidate(); },
  });
  const deleteBlockTpl = trpc.blockTemplates.delete.useMutation({
    onSuccess: () => { toast.success("Template deleted"); utils.blockTemplates.list.invalidate(); },
  });

  // Source page data for "copy from pages"
  const { data: allCourses } = trpc.lms.listCourses.useQuery({ page: 1, pageSize: 100 });
  const { data: allDownloads } = trpc.downloadAdmin.list.useQuery({ page: 1, pageSize: 100 });
  const { data: allProducts } = trpc.productAdmin.list.useQuery({ page: 1, pageSize: 100 });
  const { data: allFunnels } = trpc.funnelAdmin.list.useQuery({ page: 1, pageSize: 100 });
  const { data: selectedFunnelPages } = trpc.funnelAdmin.getPages.useQuery(
    { funnelId: selectedSourceFunnelId! },
    { enabled: !!selectedSourceFunnelId }
  );
  const { data: sourceCourseData } = trpc.lms.getCourse.useQuery(
    { id: selectedSourceCourseId! },
    { enabled: !!selectedSourceCourseId }
  );
  const { data: sourceDownloadData } = trpc.downloadAdmin.getById.useQuery(
    { id: selectedSourceDownloadId! },
    { enabled: !!selectedSourceDownloadId }
  );
  const { data: sourceProductData } = trpc.productAdmin.getById.useQuery(
    { id: selectedSourceProductId! },
    { enabled: !!selectedSourceProductId }
  );
  const { data: sourceFunnelPageData } = trpc.funnelAdmin.getPage.useQuery(
    { pageId: selectedSourceFunnelPageId! },
    { enabled: !!selectedSourceFunnelPageId }
  );

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  const filteredCatalog = blockSearch
    ? BLOCK_CATALOG.filter(c =>
        c.label.toLowerCase().includes(blockSearch.toLowerCase()) ||
        c.type.toLowerCase().includes(blockSearch.toLowerCase())
      )
    : BLOCK_CATALOG;

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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToFirstScrollableAncestor]}
          >
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <div className="max-w-4xl mx-auto space-y-2">
                {blocks.length === 0 && (
                  <div
                    className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-xl bg-white text-gray-400 cursor-pointer hover:border-teal-400 hover:text-teal-500 transition-colors"
                    onClick={() => setAddMenuOpen(true)}
                  >
                    <Layers className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm font-medium">Click to add your first block</p>
                  </div>
                )}
                {blocks.map(block => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    isSelected={selectedId === block.id}
                    onSelect={() => setSelectedId(block.id)}
                    onDuplicate={() => duplicateBlock(block)}
                    onDelete={() => deleteBlock(block.id)}
                    onSaveAsTemplate={handleSaveBlockAsTemplate}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add block button */}
          <div className="max-w-4xl mx-auto mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-dashed border-gray-300 text-gray-500 hover:border-teal-400 hover:text-teal-600"
              onClick={() => setAddMenuOpen(true)}
            >
              <Plus className="w-4 h-4" /> Add Block
            </Button>
          </div>
        </div>

        {/* Right panel — block settings */}
        <div
          className="shrink-0 border-l bg-white overflow-y-auto"
          style={{ width: rightPanelWidth }}
        >
          {/* Drag handle */}
          <div
            className="absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-teal-300 transition-colors z-10"
            style={{ right: rightPanelWidth - 2 }}
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
                onChange={updated => setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))}
              />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* SEO panel */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">SEO / Meta</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">Meta Title</label>
                    <Input
                      value={seoTitle}
                      onChange={e => setSeoTitle(e.target.value)}
                      placeholder="Page title for search engines"
                      className="mt-1 text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Meta Description</label>
                    <textarea
                      value={seoDescription}
                      onChange={e => setSeoDescription(e.target.value)}
                      placeholder="Brief description for search results"
                      rows={3}
                      className="mt-1 w-full text-xs border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn("w-full h-7 text-xs", seoSaved && "border-green-500 text-green-600")}
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

      {/* Block picker modal */}
      {addMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-gray-800">Add Block</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setAddMenuOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {/* Tabs */}
            <div className="flex border-b px-5">
              {(["catalog", "from_pages", "templates"] as const).map(tab => (
                <button
                  key={tab}
                  className={cn(
                    "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                    pickerTab === tab
                      ? "border-teal-500 text-teal-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                  onClick={() => setPickerTab(tab)}
                >
                  {tab === "catalog" ? "Block Catalog" : tab === "from_pages" ? "Copy from Pages" : "Templates"}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {pickerTab === "catalog" && (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      value={blockSearch}
                      onChange={e => setBlockSearch(e.target.value)}
                      placeholder="Search blocks…"
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {filteredCatalog.map(item => (
                      <button
                        key={item.type}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg border hover:border-teal-400 hover:bg-teal-50 transition-colors text-center"
                        onClick={() => addBlock(item.type as BlockType)}
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-xs font-medium text-gray-700 leading-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {pickerTab === "from_pages" && (
                <div className="space-y-4">
                  {/* Source: Courses */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">From Course</p>
                    <select
                      className="w-full text-sm border rounded-md px-2 py-1.5 mb-2"
                      value={selectedSourceCourseId ?? ""}
                      onChange={e => setSelectedSourceCourseId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Select a course…</option>
                      {(allCourses?.courses ?? []).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    {sourceCourseData?.landingBlocks && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs gap-1"
                        onClick={() => {
                          try {
                            const courseBlocks: Block[] = JSON.parse(sourceCourseData.landingBlocks!);
                            if (blocks.length > 0 && !confirm(`Replace all ${blocks.length} block(s) with blocks from this course?`)) return;
                            setBlocks(courseBlocks.map(b => ({ ...b, id: uid() })));
                            setSelectedId(null);
                            setAddMenuOpen(false);
                            toast.success("Blocks copied from course!");
                          } catch { toast.error("Failed to parse course blocks"); }
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy All Blocks from Course
                      </Button>
                    )}
                  </div>
                  {/* Source: Downloads */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">From Download</p>
                    <select
                      className="w-full text-sm border rounded-md px-2 py-1.5 mb-2"
                      value={selectedSourceDownloadId ?? ""}
                      onChange={e => setSelectedSourceDownloadId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Select a download…</option>
                      {(allDownloads?.items ?? []).map((d: any) => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </select>
                    {sourceDownloadData?.landingBlocks && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs gap-1"
                        onClick={() => {
                          try {
                            const dlBlocks: Block[] = JSON.parse(sourceDownloadData.landingBlocks!);
                            if (blocks.length > 0 && !confirm(`Replace all ${blocks.length} block(s)?`)) return;
                            setBlocks(dlBlocks.map(b => ({ ...b, id: uid() })));
                            setSelectedId(null);
                            setAddMenuOpen(false);
                            toast.success("Blocks copied from download!");
                          } catch { toast.error("Failed to parse download blocks"); }
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy All Blocks from Download
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {pickerTab === "templates" && (
                <div className="space-y-4">
                  {(!pageTemplates || pageTemplates.length === 0) && (!blockTemplates || blockTemplates.length === 0) && (
                    <p className="text-sm text-gray-400 text-center py-8">No templates saved yet. Right-click a block on the canvas to save it as a template.</p>
                  )}
                  {pageTemplates && pageTemplates.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Page Templates</p>
                      {pageTemplates.map((tpl: any) => (
                        <div key={tpl.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{tpl.name}</p>
                            {tpl.description && <p className="text-xs text-gray-500">{tpl.description}</p>}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                              const tplBlocks: Block[] = JSON.parse(tpl.blocksJson);
                              if (blocks.length > 0 && !confirm(`Replace all ${blocks.length} block(s) with this template?`)) return;
                              setBlocks(tplBlocks.map(b => ({ ...b, id: uid() })));
                              setSelectedId(null);
                              setAddMenuOpen(false);
                              toast.success("Template applied!");
                            }}>Apply</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => deletePageTpl.mutate({ id: tpl.id })}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                                const block: Block = { id: uid(), type: tpl.blockType as BlockType, data: JSON.parse(tpl.blockDataJson) };
                                setBlocks(prev => [...prev, block]);
                                setSelectedId(block.id);
                                setAddMenuOpen(false);
                                toast.success("Block added!");
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
                <Button
                  className="flex-1 h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={!saveTemplateName.trim()}
                  onClick={() => {
                    saveBlockTemplateMutation.mutate({
                      name: saveTemplateName.trim(),
                      description: saveTemplateDesc.trim() || undefined,
                      blockType: saveTemplateDialogBlock.type,
                      blockDataJson: JSON.stringify(saveTemplateDialogBlock.data),
                    });
                  }}
                >
                  Save Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
