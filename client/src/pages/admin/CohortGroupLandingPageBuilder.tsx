/**
 * CohortGroupLandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG page editor for individual cohort group detail pages.
 * Route: /admin/lms/:courseId/cohorts/:cohortGroupId/page-builder
 *
 * Thin wrapper — all block catalog, BlockPreview, BlockSettings, and SortableBlock
 * are imported from LandingPageBuilder.tsx so all builders stay in sync.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type Block, type BlockType } from "@/components/BlockPreview";
import {
  uid, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock, LandingBlockTemplatesTab,
} from "./LandingPageBuilder";
import {
  ArrowLeft, Save, Eye, Plus, X, Layers, Copy, Search, Bookmark, BookOpen, Globe, FolderOpen, Trash2,
} from "lucide-react";

export default function CohortGroupLandingPageBuilder() {
  const { courseId, cohortGroupId } = useParams<{ courseId: string; cohortGroupId: string }>();
  const [, navigate] = useLocation();
  const numericCourseId = Number(courseId);
  const numericCohortGroupId = Number(cohortGroupId);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pageInfo, setPageInfo] = useState<{ name: string; courseSlug?: string } | null>(null);

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"catalog" | "from_pages" | "templates" | "import_url">("catalog");
  const [activeCat, setActiveCat] = useState<string>("Layout");
  const [blockSearch, setBlockSearch] = useState("");
  const [insertPosition, setInsertPosition] = useState<"top" | "bottom">("bottom");
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [selectedSourceFunnelId, setSelectedSourceFunnelId] = useState<number | null>(null);
  const [selectedSourceFunnelPageId, setSelectedSourceFunnelPageId] = useState<number | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importPreview, setImportPreview] = useState<{ blocks: any[]; pageTitle: string; blockCount: number } | null>(null);
  const [importSelectedBlocks, setImportSelectedBlocks] = useState<Set<number>>(new Set());

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

  // ── Page Template state ──
  const [pageTemplateOpen, setPageTemplateOpen] = useState(false);
  const [ptSaveName, setPtSaveName] = useState("");
  const [ptSaveDesc, setPtSaveDesc] = useState("");
  const [ptIsSaving, setPtIsSaving] = useState(false);

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
  const { data: pageTemplates, refetch: refetchPageTemplates } = trpc.lmsAdmin.listPageTemplates.useQuery(
    { templateType: "page" },
    { enabled: pageTemplateOpen }
  );
  const savePageTemplateMutation = trpc.lmsAdmin.savePageTemplate.useMutation({
    onSuccess: () => {
      toast.success("Page template saved!");
      setPtSaveName("");
      setPtSaveDesc("");
      refetchPageTemplates();
    },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });
  const deletePageTemplateMutation = trpc.lmsAdmin.deletePageTemplate.useMutation({
    onSuccess: () => { toast.success("Template deleted"); refetchPageTemplates(); },
    onError: (e: any) => toast.error(`Delete failed: ${e.message}`),
  });
  const handleSavePageTemplate = async () => {
    if (!ptSaveName.trim()) { toast.error("Please enter a template name"); return; }
    setPtIsSaving(true);
    try {
      await savePageTemplateMutation.mutateAsync({ name: ptSaveName, description: ptSaveDesc, templateType: "page", blocks });
    } finally { setPtIsSaving(false); }
  };
  const handleApplyPageTemplate = (tpl: any) => {
    const tplBlocks: Block[] = (Array.isArray(tpl.blocks) ? tpl.blocks : []).map((b: Block) => ({ ...b, id: uid() }));
    if (blocks.length > 0 && !confirm(`Replace all ${blocks.length} block(s) with ${tplBlocks.length} blocks from "${tpl.name}"?`)) return;
    setBlocks(tplBlocks);
    setSelectedId(null);
    setPageTemplateOpen(false);
    toast.success(`Applied template "${tpl.name}"!`);
  };

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

  const { isLoading, data: cohortGroupData } = trpc.lmsAdmin.getCohortGroupLandingBlocks.useQuery(
    { cohortGroupId: numericCohortGroupId },
    { enabled: !isNaN(numericCohortGroupId) }
  );
  const { data: courseData } = trpc.lmsAdmin.getCourse.useQuery(
    { id: numericCourseId },
    { enabled: !isNaN(numericCourseId) }
  );

  useEffect(() => {
    if (!cohortGroupData || hasLoaded) return;
    setHasLoaded(true);
    setPageInfo({ name: cohortGroupData.name });
    if (cohortGroupData.landingBlocks) {
      try { setBlocks(JSON.parse(cohortGroupData.landingBlocks) as Block[]); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortGroupData]);

  useEffect(() => {
    if (courseData) {
      setPageInfo(prev => prev ? { ...prev, courseSlug: courseData.slug } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseData]);

  const saveBlocksMutation = trpc.lmsAdmin.saveCohortGroupLandingBlocks.useMutation({
    onSuccess: () => toast.success("Cohort group page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveBlocksMutation.mutateAsync({ cohortGroupId: numericCohortGroupId, blocks: JSON.stringify(blocks) });
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

  const catalogByCat = useMemo(() => BLOCK_CATALOG.filter(c => c.category === activeCat), [activeCat]);

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
      b.type.toLowerCase().includes(q) || JSON.stringify(b.data).toLowerCase().includes(q)
    );
  }, [activeSourceBlocks, blockSearch]);

  const copyBlockFromSource = (block: Block) => {
    const copy: Block = { ...block, id: uid() };
    setBlocks(prev => insertPosition === "top" ? [copy, ...prev] : [...prev, copy]);
    setSelectedId(copy.id);
    setAddMenuOpen(false);
    toast.success("Block copied!");
  };
  const copyAllBlocksFromSource = () => {
    if (activeSourceBlocks.length === 0) return;
    if (blocks.length > 0 && !confirm(`Replace all ${blocks.length} block(s) with ${activeSourceBlocks.length} blocks?`)) return;
    setBlocks(activeSourceBlocks.map(b => ({ ...b, id: uid() })));
    setSelectedId(null);
    setAddMenuOpen(false);
    toast.success(`Copied ${activeSourceBlocks.length} blocks!`);
  };

  const scrapeUrlMutation = trpc.pageScraper.scrapeUrl.useMutation({
    onSuccess: (data) => {
      setImportPreview(data);
      setImportSelectedBlocks(new Set(data.blocks.map((_: any, i: number) => i)));
    },
    onError: (err: any) => toast.error(err.message || "Failed to scrape URL"),
  });

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;
  const openPicker = (pos: "top" | "bottom" = "bottom") => {
    setInsertPosition(pos);
    setPickerTab("catalog");
    setAddMenuOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1 text-gray-600"
            onClick={() => navigate(`/admin/lms/${numericCourseId}`)}>
            <ArrowLeft className="w-4 h-4" /> Back to Course
          </Button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <span className="text-xs text-gray-400">Cohort Group Page:</span>
            <span className="text-sm font-semibold text-gray-800 ml-1">{pageInfo?.name ?? "Loading..."}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pageInfo?.courseSlug && (
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => window.open(`/courses/${pageInfo.courseSlug}`, "_blank")}>
              <Eye className="w-4 h-4" /> Preview Course
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1 border-teal-300 text-teal-700 hover:bg-teal-50"
            onClick={() => setPageTemplateOpen(true)}>
            <FolderOpen className="w-4 h-4" /> Page Templates
          </Button>
          <Button size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <Plus size={24} />
              </div>
              <button onClick={openPicker}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
                <Plus size={16} /> Add Your First Block
              </button>
              <p className="text-sm">Build the detail page for this cohort group</p>
            </div>
          ) : (
            <div className="bg-white min-h-full shadow-sm mx-auto" style={{ maxWidth: "900px" }}>
              <div className="flex justify-center py-4 border-b border-dashed border-gray-200">
                <button onClick={() => openPicker("top")}
                  className="w-full max-w-xs border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-xl py-2.5 text-teal-600 hover:text-teal-700 text-sm flex items-center justify-center gap-2 transition-colors bg-white">
                  <Plus size={15} /> Add Block at Top
                </button>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}
                modifiers={[restrictToFirstScrollableAncestor]}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <SortableBlock key={block.id} block={block} isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)} onDuplicate={() => duplicateBlock(block)}
                      onDelete={() => deleteBlock(block.id)} onSaveAsTemplate={handleSaveBlockAsTemplate}
                      onMoveUp={idx > 0 ? () => { setBlocks(prev => arrayMove(prev, idx, idx - 1)); setSelectedId(block.id); } : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => { setBlocks(prev => arrayMove(prev, idx, idx + 1)); setSelectedId(block.id); } : undefined}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex justify-center py-6 border-t border-dashed border-gray-200">
                <button onClick={() => openPicker("bottom")}
                  className="w-full max-w-xs border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-xl py-3 text-teal-600 hover:text-teal-700 text-sm flex items-center justify-center gap-2 transition-colors bg-white">
                  <Plus size={16} /> Add Block
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-l bg-white overflow-y-auto relative" style={{ width: rightPanelWidth }}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-400 active:bg-teal-500 z-10 transition-colors"
            onMouseDown={handleRightPanelMouseDown} />
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
              <BlockSettings block={selectedBlock}
                onChange={data => setBlocks(prev => prev.map(b => b.id === selectedId ? { ...b, data } : b))} />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <button onClick={openPicker}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-teal-300 hover:border-teal-500 text-teal-600 hover:text-teal-700 text-sm font-medium transition-colors">
                <Plus size={14} /> Add Block
              </button>
              <p className="text-xs text-gray-400 text-center">
                Build the full detail page for this cohort group. Visitors see this when they click the cohort card.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={addMenuOpen} onOpenChange={open => { setAddMenuOpen(open); if (!open) setBlockSearch(""); }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-teal-700 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Add Content Block
            </DialogTitle>
          </DialogHeader>
          <div className="flex border-b border-gray-200 shrink-0 overflow-x-auto scrollbar-none -mx-4 sm:-mx-6 px-4 sm:px-6">
            {([
              { id: "catalog", icon: <Plus className="w-3.5 h-3.5" />, label: "New Block" },
              { id: "from_pages", icon: <BookOpen className="w-3.5 h-3.5" />, label: "Copy" },
              { id: "templates", icon: <Layers className="w-3.5 h-3.5" />, label: "Templates" },
              { id: "import_url", icon: <Globe className="w-3.5 h-3.5" />, label: "Import URL" },
            ] as const).map(tab => (
              <button key={tab.id}
                onClick={() => { setPickerTab(tab.id); if (tab.id === "import_url") setImportPreview(null); }}
                className={cn("px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 shrink-0",
                  pickerTab === tab.id ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {pickerTab === "catalog" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none bg-gray-50 shrink-0 -mx-4 sm:-mx-6 px-4 sm:px-6">
                {CATALOG_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCat(cat)}
                    className={cn("px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                      activeCat === cat ? "text-teal-700 border-b-2 border-teal-500 bg-white" : "text-gray-500 hover:text-gray-700")}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1 overflow-y-auto flex-1">
                {catalogByCat.map(b => (
                  <button key={b.type} onClick={() => { addBlock(b.type as BlockType); setAddMenuOpen(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 text-gray-600 hover:text-teal-700 transition-all text-center">
                    <span className="text-teal-600 text-2xl">{b.icon}</span>
                    <span className="text-xs leading-tight font-medium">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {pickerTab === "from_pages" && (
            <div className="flex flex-1 overflow-hidden gap-3 min-h-0">
              <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto border-r border-gray-100 pr-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Course Landing Page</label>
                  <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                    value={selectedSourceCourseId ?? ""}
                    onChange={e => { setSelectedSourceCourseId(e.target.value ? Number(e.target.value) : null); setSelectedSourceFunnelId(null); setSelectedSourceFunnelPageId(null); setBlockSearch(""); }}>
                    <option value="">-- select course --</option>
                    {coursesWithBlocks?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Funnel Page</label>
                  <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                    value={selectedSourceFunnelId ?? ""}
                    onChange={e => { setSelectedSourceFunnelId(e.target.value ? Number(e.target.value) : null); setSelectedSourceFunnelPageId(null); setSelectedSourceCourseId(null); setBlockSearch(""); }}>
                    <option value="">-- select funnel --</option>
                    {funnelsWithPages?.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  {selectedSourceFunnelId && (() => {
                    const pages = funnelsWithPages?.find((f: any) => f.id === selectedSourceFunnelId)?.pages ?? [];
                    return pages.length === 0 ? <p className="text-xs text-gray-400 mt-1">No pages with blocks.</p> : (
                      <div className="space-y-1 mt-1">
                        {pages.map((p: any) => (
                          <button key={p.id} onClick={() => { setSelectedSourceFunnelPageId(p.id); setBlockSearch(""); }}
                            className={cn("w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors",
                              selectedSourceFunnelPageId === p.id ? "bg-teal-50 text-teal-700 font-semibold border border-teal-200" : "text-gray-600 hover:bg-gray-50")}>
                            {p.title}<span className="text-[10px] text-gray-400 ml-1 capitalize">({p.pageType})</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
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
                        <Input value={blockSearch} onChange={e => setBlockSearch(e.target.value)} placeholder="Search blocks..." className="pl-7 h-7 text-xs" />
                      </div>
                      {activeSourceBlocks.length > 0 && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0" onClick={copyAllBlocksFromSource}>
                          <Copy className="w-3 h-3 mr-1" /> Copy All ({activeSourceBlocks.length})
                        </Button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1.5">
                      {filteredSourceBlocks.length === 0 ? <p className="text-xs text-gray-400 py-4 text-center">No blocks found.</p>
                        : filteredSourceBlocks.map((b: Block) => {
                          const ce = BLOCK_CATALOG.find(c => c.type === b.type);
                          return (
                            <div key={b.id} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {ce && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{ce.icon}</span>}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-gray-700 truncate">{ce?.label ?? b.type}</p>
                                  <p className="text-[10px] text-gray-400 truncate">{b.type}</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0" onClick={() => copyBlockFromSource(b)}>
                                <Copy className="w-2.5 h-2.5 mr-1" /> Copy
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

          {pickerTab === "templates" && (
            <LandingBlockTemplatesTab onInsert={(block: Block) => {
              const copy: Block = { ...block, id: uid() };
              setBlocks(prev => insertPosition === "top" ? [copy, ...prev] : [...prev, copy]);
              setSelectedId(copy.id);
              setAddMenuOpen(false);
            }} />
          )}

          {pickerTab === "import_url" && (
            <div className="flex flex-col flex-1 overflow-hidden gap-3">
              <div className="flex gap-2 shrink-0">
                <Input value={importUrl} onChange={e => setImportUrl(e.target.value)}
                  placeholder="https://example.com/page-to-import" className="text-xs h-8 flex-1"
                  onKeyDown={e => e.key === "Enter" && importUrl && scrapeUrlMutation.mutate({ url: importUrl })} />
                <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                  onClick={() => importUrl && scrapeUrlMutation.mutate({ url: importUrl })}
                  disabled={scrapeUrlMutation.isPending || !importUrl}>
                  {scrapeUrlMutation.isPending ? "Importing..." : "Import"}
                </Button>
              </div>
              {importPreview && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <p className="text-xs font-semibold text-gray-600">{importPreview.pageTitle} -- {importPreview.blockCount} blocks</p>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-teal-300 text-teal-700 hover:bg-teal-50"
                      onClick={() => {
                        const selected = importPreview.blocks.filter((_: any, i: number) => importSelectedBlocks.has(i));
                        if (selected.length === 0) return;
                        const newBlocks = selected.map((b: any) => ({ ...b, id: uid() }));
                        setBlocks(prev => insertPosition === "top" ? [...newBlocks, ...prev] : [...prev, ...newBlocks]);
                        setAddMenuOpen(false);
                        toast.success(`Imported ${newBlocks.length} blocks!`);
                      }}>
                      Insert Selected ({importSelectedBlocks.size})
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {importPreview.blocks.map((b: any, i: number) => {
                      const ce = BLOCK_CATALOG.find(c => c.type === b.type);
                      const isSel = importSelectedBlocks.has(i);
                      return (
                        <div key={i} onClick={() => setImportSelectedBlocks(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                          className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors",
                            isSel ? "bg-teal-50 border-teal-300" : "border-gray-100 hover:border-teal-200 hover:bg-teal-50")}>
                          <input type="checkbox" checked={isSel} readOnly className="shrink-0 accent-teal-600" />
                          {ce && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{ce.icon}</span>}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{ce?.label ?? b.type}</p>
                            <p className="text-[10px] text-gray-400 truncate">{b.type}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Page Template Library Dialog ── */}
      <Dialog open={pageTemplateOpen} onOpenChange={setPageTemplateOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-teal-700 flex items-center gap-2">
              <FolderOpen className="w-5 h-5" /> Page Template Library
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-1 space-y-4">
            {/* Save current page */}
            <div className="border border-dashed border-teal-300 rounded-xl p-4 bg-teal-50/50">
              <p className="text-xs font-semibold text-teal-700 mb-3">Save Current Page as Template</p>
              <div className="space-y-2">
                <input value={ptSaveName} onChange={e => setPtSaveName(e.target.value)}
                  className="w-full h-8 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  placeholder="Template name…" />
                <input value={ptSaveDesc} onChange={e => setPtSaveDesc(e.target.value)}
                  className="w-full h-8 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  placeholder="Description (optional)" />
                <Button onClick={handleSavePageTemplate} disabled={ptIsSaving || blocks.length === 0}
                  className="w-full h-8 text-sm bg-teal-600 hover:bg-teal-700 text-white">
                  {ptIsSaving ? "Saving…" : `Save as Template (${blocks.length} block${blocks.length !== 1 ? "s" : ""})`}
                </Button>
              </div>
            </div>
            {/* Template list */}
            {!pageTemplates || pageTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No page templates saved yet</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pageTemplates.map((tpl: any) => (
                  <div key={tpl.id} className="border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{tpl.name}</h3>
                    {tpl.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{tpl.description}</p>}
                    <p className="text-xs text-gray-400 mb-3">{Array.isArray(tpl.blocks) ? tpl.blocks.length : 0} block{Array.isArray(tpl.blocks) && tpl.blocks.length !== 1 ? "s" : ""}</p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleApplyPageTemplate(tpl)}
                        className="flex-1 h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white">Apply</Button>
                      <button onClick={() => deletePageTemplateMutation.mutate({ id: tpl.id })}
                        className="w-7 h-7 border border-gray-200 rounded text-gray-400 hover:text-red-500 flex items-center justify-center flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
              <Input value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)}
                placeholder="e.g. Hero Banner -- Teal" className="text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1 block">Description <span className="text-gray-400">(optional)</span></Label>
              <Input value={saveTemplateDesc} onChange={e => setSaveTemplateDesc(e.target.value)}
                placeholder="Brief description of this block template" className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateDialogBlock(null)} className="text-sm">Cancel</Button>
            <Button disabled={!saveTemplateName.trim() || saveBlockTemplateMutation.isPending}
              onClick={() => {
                if (!saveTemplateDialogBlock || !saveTemplateName.trim()) return;
                saveBlockTemplateMutation.mutate({
                  name: saveTemplateName.trim(),
                  description: saveTemplateDesc.trim() || undefined,
                  blockType: saveTemplateDialogBlock.type,
                  blockData: JSON.parse(JSON.stringify(saveTemplateDialogBlock.data ?? {})),
                }, { onSuccess: () => { setSaveTemplateDialogBlock(null); } });
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white text-sm">
              {saveBlockTemplateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
