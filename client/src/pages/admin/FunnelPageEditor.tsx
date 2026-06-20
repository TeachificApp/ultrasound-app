/**
 * FunnelPageEditor.tsx
 * Full-screen drag-and-drop WYSIWYG block editor for funnel pages.
 * Route: /admin/funnels/:funnelId/pages/:pageId/edit
 * Reuses the same block system as the LMS LandingPageBuilder.
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
  DragStartEvent,
  UniqueIdentifier,
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
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { type Block, type BlockType, BlockPreview } from "@/components/BlockPreview";
import { uid, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock } from "./LandingPageBuilder";
import {
  ArrowLeft, Save, Eye, Plus, Palette, X, FolderOpen, Layers, Settings, GitBranch, Trash2, ChevronDown, ChevronUp, GripVertical, Bookmark, BookOpen, Copy, Search, Globe, Loader2,
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
  const blocksLoadedRef = useRef(false);
  const [activeCat, setActiveCat] = useState<string>("Layout");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"catalog" | "from_pages" | "templates" | "import_url">("catalog");
  const [importUrl, setImportUrl] = useState("");
  const [importPreview, setImportPreview] = useState<{ blocks: any[]; pageTitle: string; blockCount: number } | null>(null);
  const [importSelectedBlocks, setImportSelectedBlocks] = useState<Set<number>>(new Set());
  const scrapeUrlMutation = trpc.pageScraper.scrapeUrl.useMutation({
    onSuccess: (data) => {
      setImportPreview(data);
      setImportSelectedBlocks(new Set(data.blocks.map((_: any, i: number) => i)));
    },
    onError: (err: any) => toast.error(err.message || "Failed to scrape URL"),
  });
  const [selectedSourceFunnelId, setSelectedSourceFunnelId] = useState<number | null>(null);
  const [selectedSourcePageId, setSelectedSourcePageId] = useState<number | null>(null);
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [selectedSourceDownloadId, setSelectedSourceDownloadId] = useState<number | null>(null);
  const [selectedSourceProductId, setSelectedSourceProductId] = useState<number | null>(null);
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

  // Auto-scroll preview canvas to the selected block
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Column drag state
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
  const [activeColumnTarget, setActiveColumnTarget] = useState<{ blockId: string; side: "left" | "right" } | null>(null);
  const activeColumnTargetRef = useRef<{ blockId: string; side: "left" | "right" } | null>(null);
  const pointerMoveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const blocksRef = useRef<Block[]>([]);

  const parseColId = (id: UniqueIdentifier): { blockId: string; side: "left" | "right" } | null => {
    const s = String(id);
    if (!s.startsWith("col:")) return null;
    const parts = s.split(":");
    if (parts.length < 3) return null;
    return { blockId: parts[1], side: parts[2] as "left" | "right" };
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id);
    setActiveColumnTarget(null);
    activeColumnTargetRef.current = null;
    const handler = (e: PointerEvent) => {
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      let found: { blockId: string; side: "left" | "right" } | null = null;
      for (const el of els) {
        const zoneId = (el as HTMLElement).dataset?.colZone;
        if (zoneId && zoneId.startsWith("col:")) {
          const parsed = parseColId(zoneId);
          if (parsed) { found = parsed; break; }
        }
      }
      if (JSON.stringify(found) !== JSON.stringify(activeColumnTargetRef.current)) {
        activeColumnTargetRef.current = found;
        setActiveColumnTarget(found);
      }
    };
    pointerMoveHandlerRef.current = handler;
    document.addEventListener("pointermove", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load page data
  const { data: platformSettings } = trpc.lmsGroup.getPlatformSettings.useQuery();
  const funnelBase = (customDomain?: string | null) =>
    customDomain ? `https://${customDomain}` :
    platformSettings?.funnelPublishDomain ? `https://${platformSettings.funnelPublishDomain}` :
    window.location.origin;
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
    blocksLoadedRef.current = true;
  }, [pageData, numericPageId, loadedPageId]);

  const utils = trpc.useUtils();

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
      autoSave.markClean();
      // Invalidate the cache so the NEXT mount of this page loads fresh data from DB.
      utils.funnel.getPageById.invalidate({ id: numericPageId });
    } finally {
      setIsSaving(false);
    }
  };

  const autoSave = useAutoSave({
    onSave: async () => {
      await updatePage.mutateAsync({ id: numericPageId, blocks: JSON.stringify(blocks) });
      utils.funnel.getPageById.invalidate({ id: numericPageId });
    },
    intervalMs: 60_000,
  });

  // Mark dirty whenever blocks change after initial load
  useEffect(() => {
    if (blocksLoadedRef.current) autoSave.markDirty();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (pointerMoveHandlerRef.current) {
      document.removeEventListener("pointermove", pointerMoveHandlerRef.current);
      pointerMoveHandlerRef.current = null;
    }
    const currentTarget = activeColumnTargetRef.current;
    setActiveDragId(null);
    setActiveColumnTarget(null);
    activeColumnTargetRef.current = null;

    const { active, over } = event;
    const activeIdStr = String(active.id);
    const currentBlocks = blocksRef.current;

    // Case 1: Dropping onto a column zone
    if (currentTarget) {
      let draggedBlock = currentBlocks.find(b => b.id === activeIdStr);
      let sourceColBlockId: string | null = null;
      let sourceSide: "left" | "right" | null = null;
      if (!draggedBlock) {
        for (const colBlock of currentBlocks) {
          if (colBlock.type !== "column_layout") continue;
          for (const side of ["leftBlocks", "rightBlocks"] as const) {
            const col: Block[] = colBlock.data[side] ?? [];
            const found = col.find(cb => cb.id === activeIdStr);
            if (found) { draggedBlock = found; sourceColBlockId = colBlock.id; sourceSide = side === "leftBlocks" ? "left" : "right"; break; }
          }
          if (draggedBlock) break;
        }
      }
      if (!draggedBlock || draggedBlock.type === "column_layout") return;
      if (sourceColBlockId === currentTarget.blockId && sourceSide === currentTarget.side) return;
      setBlocks(prev => {
        let next = prev;
        if (sourceColBlockId) {
          next = next.map(b => {
            if (b.id !== sourceColBlockId) return b;
            const srcKey = sourceSide === "left" ? "leftBlocks" : "rightBlocks";
            return { ...b, data: { ...b.data, [srcKey]: (b.data[srcKey] ?? []).filter((cb: Block) => cb.id !== activeIdStr) } };
          });
        } else {
          next = next.filter(b => b.id !== activeIdStr);
        }
        return next.map(b => {
          if (b.id !== currentTarget.blockId) return b;
          const colKey = currentTarget.side === "left" ? "leftBlocks" : "rightBlocks";
          const existing: Block[] = b.data[colKey] ?? [];
          return { ...b, data: { ...b.data, [colKey]: [...existing, draggedBlock!] } };
        });
      });
      return;
    }

    if (!over) return;
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    // Case 4: Drag column child out to main canvas
    {
      let sourceColBlockId: string | null = null;
      let sourceSide: "left" | "right" | null = null;
      let draggedChildBlock: Block | null = null;
      for (const colBlock of currentBlocks) {
        if (colBlock.type !== "column_layout") continue;
        for (const side of ["leftBlocks", "rightBlocks"] as const) {
          const col: Block[] = colBlock.data[side] ?? [];
          const found = col.find(cb => cb.id === activeIdStr);
          if (found) { draggedChildBlock = found; sourceColBlockId = colBlock.id; sourceSide = side === "leftBlocks" ? "left" : "right"; break; }
        }
        if (draggedChildBlock) break;
      }
      if (draggedChildBlock && sourceColBlockId && sourceSide) {
        const overIsMainBlock = currentBlocks.some(b => b.id === overIdStr);
        if (overIsMainBlock) {
          setBlocks(prev => {
            let movedBlock: Block | null = null;
            let next = prev.map(b => {
              if (b.id !== sourceColBlockId) return b;
              const colKey = sourceSide === "left" ? "leftBlocks" : "rightBlocks";
              const col: Block[] = b.data[colKey] ?? [];
              const child = col.find(cb => cb.id === activeIdStr);
              if (child) movedBlock = child;
              return { ...b, data: { ...b.data, [colKey]: col.filter(cb => cb.id !== activeIdStr) } };
            });
            if (!movedBlock) return prev;
            const overIdx = next.findIndex(b => b.id === overIdStr);
            if (overIdx === -1) return [...next, movedBlock];
            return [...next.slice(0, overIdx), movedBlock, ...next.slice(overIdx)];
          });
          return;
        }
      }
    }

    // Case 2: Reorder within same column
    for (const colBlock of currentBlocks) {
      if (colBlock.type !== "column_layout") continue;
      for (const side of ["leftBlocks", "rightBlocks"] as const) {
        const col: Block[] = colBlock.data[side] ?? [];
        const activeIdx = col.findIndex(cb => cb.id === activeIdStr);
        const overIdx = col.findIndex(cb => cb.id === overIdStr);
        if (activeIdx !== -1 && overIdx !== -1) {
          setBlocks(prev => prev.map(b => {
            if (b.id !== colBlock.id) return b;
            const c: Block[] = b.data[side] ?? [];
            return { ...b, data: { ...b.data, [side]: arrayMove(c, activeIdx, overIdx) } };
          }));
          return;
        }
      }
    }

    // Case 3: Reorder main canvas
    setBlocks(prev => {
      const oldIndex = prev.findIndex(b => b.id === activeIdStr);
      const newIndex = prev.findIndex(b => b.id === overIdStr);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const addBlock = useCallback((type: BlockType) => {
    const catalog = BLOCK_CATALOG.find(c => c.type === type);
    if (!catalog) return;
    const newBlock: Block = { id: uid(), type, data: { ...catalog.defaultData } };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedId(newBlock.id);
  }, []);

  const updateBlock = useCallback((id: string, data: Record<string, any>) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === id) return { ...b, data };
      // Also update child blocks inside column_layout
      if (b.type === "column_layout") {
        const leftBlocks: Block[] = b.data?.leftBlocks ?? [];
        const rightBlocks: Block[] = b.data?.rightBlocks ?? [];
        const newLeft = leftBlocks.map((cb: Block) => cb.id === id ? { ...cb, data } : cb);
        const newRight = rightBlocks.map((cb: Block) => cb.id === id ? { ...cb, data } : cb);
        if (newLeft !== leftBlocks || newRight !== rightBlocks) {
          return { ...b, data: { ...b.data, leftBlocks: newLeft, rightBlocks: newRight } };
        }
      }
      return b;
    }));
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

  // Also search column_layout children so clicking a child block opens its settings
  const selectedBlock = blocks.find(b => b.id === selectedId) ??
    blocks.flatMap(b => b.type === "column_layout" ? [...(b.data?.leftBlocks ?? []), ...(b.data?.rightBlocks ?? [])] : []).find(b => b.id === selectedId);
  const catalogByCat = BLOCK_CATALOG.filter(c => c.category === activeCat);

  // Block picker: fetch funnels with pages (for "Copy from Other Pages" tab)
    const { data: funnelsWithPages } = trpc.funnelAdmin.getFunnelsWithPages.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: coursesWithBlocks } = trpc.lmsAdmin.getCoursesWithLandingBlocks.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: downloadsWithBlocks } = trpc.lmsAdmin.getDownloadsWithLandingBlocks.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  const { data: productsWithBlocks } = trpc.lmsAdmin.getProductsWithLandingBlocks.useQuery(undefined, { enabled: addMenuOpen && pickerTab === "from_pages" });
  // Parse blocks for the selected source page
  const sourcePageBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceFunnelId || !selectedSourcePageId || !funnelsWithPages) return [];
    const funnel = funnelsWithPages.find(f => f.id === selectedSourceFunnelId);
    const page = funnel?.pages.find(p => p.id === selectedSourcePageId);
    if (!page?.blocks) return [];
    try { const parsed = typeof page.blocks === "string" ? JSON.parse(page.blocks) : page.blocks; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }, [selectedSourceFunnelId, selectedSourcePageId, funnelsWithPages]);
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
  const activeSourceBlocks = selectedSourcePageId ? sourcePageBlocks : selectedSourceCourseId ? sourceCourseBlocks : selectedSourceDownloadId ? sourceDownloadBlocks : sourceProductBlocks;
  const filteredSourceBlocks = useMemo(() => {
    if (!blockSearch.trim()) return activeSourceBlocks;
    const q = blockSearch.toLowerCase();
    return activeSourceBlocks.filter(b =>
      b.type.toLowerCase().includes(q) ||
      JSON.stringify(b.data).toLowerCase().includes(q)
    );
  }, [activeSourceBlocks, blockSearch]);

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
  // Track whether SEO fields have been initialized so block-save invalidations
  // don't overwrite user-edited SEO fields.
  const seoInitialized = useRef(false);

  // Populate SEO fields only once when page data first loads (not on every invalidation)
  useEffect(() => {
    if (!pageData) return;
    if (seoInitialized.current) return; // already initialized — don't overwrite user edits
    seoInitialized.current = true;
    setSeoTitle(pageData.page.seoTitle ?? "");
    setSeoDescription(pageData.page.seoDescription ?? "");
    setSeoImage(pageData.page.seoImage ?? "");
  }, [pageData]);

  // Reset seoInitialized when navigating to a different page
  useEffect(() => {
    seoInitialized.current = false;
  }, [numericPageId]);

  // Separate mutation for SEO saves so it doesn't conflict with block saves
  const updateSeoMutation = trpc.funnel.updatePage.useMutation({
    onSuccess: () => {
      setSeoSaved(true);
      setTimeout(() => setSeoSaved(false), 2000);
      // Refresh page data so the saved values are reflected
      utils.funnel.getPageById.invalidate({ id: numericPageId });
      // Keep seoInitialized true so the useEffect doesn't reset fields after invalidation
    },
    onError: (e: any) => toast.error(`SEO save failed: ${e.message}`),
  });

  const handleSaveSeo = () => {
    updateSeoMutation.mutate({
      id: numericPageId,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      seoImage: seoImage.trim() || null,
    });
  };

  // Branch rules state
  const [showBranchRules, setShowBranchRules] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
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
              href={currentPage?.slug ? `${funnelBase(pageData.funnel?.customDomain)}/${pageData.funnel.slug}/${currentPage.slug}` : `${funnelBase(pageData.funnel?.customDomain)}/${pageData.funnel.slug}?preview=${numericPageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 border border-teal-200 bg-teal-50 hover:bg-teal-100 rounded-lg px-3 py-1.5 transition-colors font-medium"
            >
              <Eye size={14} /> Preview Page
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
            onClick={() => { setSaveTemplateName(currentPage?.title ? `${currentPage.title} Template` : ""); setShowSaveTemplate(true); }}
            className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-lg px-3 py-1.5 transition-colors"
            title="Save current page as a reusable template"
          >
            <Bookmark size={14} /> Save as Template
          </button>
          <AutoSaveIndicator status={autoSave.status} />
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

      {/* Apply Template Modal */}
      {showApplyTemplate && (
        <FunnelApplyTemplateModal
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
                        href={`${funnelBase(pageData.funnel?.customDomain)}/${pageData.funnel.slug}/${p.slug}`}
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
                  disabled={updateSeoMutation.isPending}
                  className="w-full text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg py-1.5 transition-colors disabled:opacity-50"
                >
                  {seoSaved ? "✓ Saved!" : updateSeoMutation.isPending ? "Saving…" : "Save Preview Settings"}
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
              <DndContext sensors={sensors} modifiers={[restrictToFirstScrollableAncestor]} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={[
                  ...blocks.map(b => b.id),
                  ...blocks.flatMap(b => b.type === "column_layout" ? [...(b.data?.leftBlocks ?? []), ...(b.data?.rightBlocks ?? [])].map((cb: any) => cb.id) : []),
                ]} strategy={verticalListSortingStrategy}>
                  {(blocksRef.current = blocks, blocks).map((block, idx) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onSaveAsTemplate={handleSaveBlockAsTemplate}
                      activeDragId={activeDragId}
                      activeColumnTarget={activeColumnTarget}
                      onMoveUp={idx > 0 ? () => setBlocks(prev => arrayMove(prev, idx, idx - 1)) : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => setBlocks(prev => arrayMove(prev, idx, idx + 1)) : undefined}
                      onMoveBlockOutOfColumn={(colBlockId, side, childBlockId) => {
                        setBlocks(prev => {
                          let movedBlock: Block | null = null;
                          const next = prev.map(b => {
                            if (b.id !== colBlockId) return b;
                            const colKey = side === "left" ? "leftBlocks" : "rightBlocks";
                            const col: Block[] = b.data[colKey] ?? [];
                            const child = col.find((cb: Block) => cb.id === childBlockId);
                            if (child) movedBlock = child;
                            return { ...b, data: { ...b.data, [colKey]: col.filter((cb: Block) => cb.id !== childBlockId) } };
                          });
                          if (!movedBlock) return prev;
                          const colIdx = next.findIndex(b => b.id === colBlockId);
                          return [...next.slice(0, colIdx + 1), movedBlock, ...next.slice(colIdx + 1)];
                        });
                      }}
                      onAddBlockToColumn={(colBlockId, side, newBlock) => {
                        setBlocks(prev => prev.map(b => {
                          if (b.id !== colBlockId) return b;
                          const colKey = side === "left" ? "leftBlocks" : "rightBlocks";
                          const existing: Block[] = b.data[colKey] ?? [];
                          return { ...b, data: { ...b.data, [colKey]: [...existing, newBlock] } };
                        }));
                        setSelectedId(newBlock.id);
                      }}
                      onMoveChildToOtherColumn={(colBlockId, fromSide, childBlockId) => {
                        setBlocks(prev => prev.map(b => {
                          if (b.id !== colBlockId) return b;
                          const fromKey = fromSide === "left" ? "leftBlocks" : "rightBlocks";
                          const toKey = fromSide === "left" ? "rightBlocks" : "leftBlocks";
                          const fromCol: Block[] = b.data[fromKey] ?? [];
                          const toCol: Block[] = b.data[toKey] ?? [];
                          const child = fromCol.find((cb: Block) => cb.id === childBlockId);
                          if (!child) return b;
                          return { ...b, data: { ...b.data, [fromKey]: fromCol.filter((cb: Block) => cb.id !== childBlockId), [toKey]: [...toCol, child] } };
                        }));
                      }}
                      onDeleteChildFromColumn={(colBlockId, side, childBlockId) => {
                        setBlocks(prev => prev.map(b => {
                          if (b.id !== colBlockId) return b;
                          const colKey = side === "left" ? "leftBlocks" : "rightBlocks";
                          const col: Block[] = b.data[colKey] ?? [];
                          return { ...b, data: { ...b.data, [colKey]: col.filter((cb: Block) => cb.id !== childBlockId) } };
                        }));
                        if (selectedId === childBlockId) setSelectedId(null);
                      }}
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
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
              <Palette size={24} className="mb-2 opacity-50" />
              <p className="text-sm">Click any block on the canvas to edit its settings</p>
            </div>
          )}
          </div>
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
        <div className="flex border-b border-gray-200 shrink-0 overflow-x-auto scrollbar-none -mx-4 sm:-mx-6 px-4 sm:px-6">
          {([
            { id: "catalog", icon: <Plus className="w-3.5 h-3.5" />, label: "New Block" },
            { id: "templates", icon: <Layers className="w-3.5 h-3.5" />, label: "Templates" },
            { id: "from_pages", icon: <BookOpen className="w-3.5 h-3.5" />, label: "Copy" },
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
            {/* Category tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none bg-gray-50 shrink-0 -mx-4 sm:-mx-6 px-4 sm:px-6">
              {CATALOG_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0",
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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1 overflow-y-auto flex-1">
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
            {/* Left: All page source pickers */}
            <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto border-r border-gray-100 pr-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Course Page</label>
                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" value={selectedSourceCourseId ?? ""} onChange={e => { setSelectedSourceCourseId(e.target.value ? Number(e.target.value) : null); setSelectedSourceDownloadId(null); setSelectedSourceProductId(null); setSelectedSourceFunnelId(null); setSelectedSourcePageId(null); setBlockSearch(""); }}>
                  <option value="">— select course —</option>
                  {coursesWithBlocks?.map((c: any) => <option key={c.id} value={c.id} title={c.title}>{c.title}</option>)}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Download Product</label>
                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" value={selectedSourceDownloadId ?? ""} onChange={e => { setSelectedSourceDownloadId(e.target.value ? Number(e.target.value) : null); setSelectedSourceCourseId(null); setSelectedSourceProductId(null); setSelectedSourceFunnelId(null); setSelectedSourcePageId(null); setBlockSearch(""); }}>
                  <option value="">— select product —</option>
                  {downloadsWithBlocks?.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Physical Product</label>
                <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" value={selectedSourceProductId ?? ""} onChange={e => { setSelectedSourceProductId(e.target.value ? Number(e.target.value) : null); setSelectedSourceCourseId(null); setSelectedSourceDownloadId(null); setSelectedSourceFunnelId(null); setSelectedSourcePageId(null); setBlockSearch(""); }}>
                  <option value="">— select product —</option>
                  {productsWithBlocks?.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Funnel</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                  value={selectedSourceFunnelId ?? ""}
                  onChange={e => {
                    setSelectedSourceFunnelId(e.target.value ? Number(e.target.value) : null);
                    setSelectedSourcePageId(null); setSelectedSourceCourseId(null); setSelectedSourceDownloadId(null); setSelectedSourceProductId(null);
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
              {!selectedSourcePageId && !selectedSourceCourseId && !selectedSourceDownloadId && !selectedSourceProductId ? (
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

        {/* ── Templates tab ── */}
        {pickerTab === "templates" && (
          <FunnelTemplatesTab
            onInsertBlocks={(newBlocks) => {
              setBlocks(prev => [...prev, ...newBlocks]);
              setAddMenuOpen(false);
              toast.success(newBlocks.length === 1 ? "Template inserted!" : `${newBlocks.length} blocks inserted!`);
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

// ─── Unified Templates Tab (page + block templates, shared pool) ─────────────

function FunnelTemplatesTab({ onInsertBlocks }: { onInsertBlocks: (blocks: Block[]) => void }) {
  const [subTab, setSubTab] = useState<"page" | "block">("page");
  const [search, setSearch] = useState("");

  // Page templates (shared pool — includes funnel, landing, download, product pages)
  const { data: pageTemplates, isLoading: pageLoading, refetch: refetchPage } = trpc.lmsAdmin.listPageTemplates.useQuery({});
  const deletePageTpl = trpc.lmsAdmin.deletePageTemplate.useMutation({
    onSuccess: () => { toast.success("Template deleted"); refetchPage(); },
  });

  // Block templates
  const { data: blockTemplates, isLoading: blockLoading } = trpc.blockTemplates.list.useQuery({ search: search || undefined });
  const deleteBlockTpl = trpc.blockTemplates.delete.useMutation({
    onSuccess: () => { toast.success("Template deleted"); },
  });
  const utils = trpc.useUtils();

  const filteredPageTemplates = (pageTemplates ?? []).filter((t: any) =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden gap-3">
      {/* Sub-tabs */}
      <div className="flex border-b border-gray-100 shrink-0">
        {(["page", "block"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold capitalize transition-colors",
              subTab === t ? "border-b-2 border-teal-500 text-teal-700" : "text-gray-400 hover:text-gray-600"
            )}>
            {t === "page" ? "Page Templates" : "Block Templates"}
          </button>
        ))}
      </div>
      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…" className="pl-8 h-8 text-xs" />
      </div>

      {/* Page Templates */}
      {subTab === "page" && (
        pageLoading ? (
          <p className="text-xs text-gray-400 text-center py-6">Loading templates…</p>
        ) : !filteredPageTemplates.length ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
            <FolderOpen className="w-8 h-8 opacity-30" />
            <p className="text-xs">No page templates saved yet.</p>
            <p className="text-xs text-gray-300">Use "Save as Template" in any page editor to create one.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredPageTemplates.map((tpl: any) => {
              const tplBlocks: Block[] = (() => {
                try { const b = typeof tpl.blocks === "string" ? JSON.parse(tpl.blocks) : tpl.blocks; return Array.isArray(b) ? b : []; } catch { return []; }
              })();
              return (
                <div key={tpl.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{tpl.name}</p>
                    {tpl.description && <p className="text-xs text-gray-400 truncate">{tpl.description}</p>}
                    <p className="text-xs text-gray-300">{tplBlocks.length} block{tplBlocks.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onInsertBlocks(tplBlocks.map(b => ({ ...b, id: uid() })))}>
                      <Plus className="w-3 h-3 mr-1" /> Insert
                    </Button>
                    <button className="w-6 h-6 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      onClick={() => { if (confirm("Delete this template?")) deletePageTpl.mutate({ id: tpl.id }); }} title="Delete template">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Block Templates */}
      {subTab === "block" && (
        blockLoading ? (
          <p className="text-xs text-gray-400 text-center py-6">Loading templates…</p>
        ) : !blockTemplates?.length ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
            <Layers className="w-8 h-8 opacity-30" />
            <p className="text-xs">No saved block templates yet.</p>
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
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{tpl.name}</p>
                      {tpl.description && <p className="text-xs text-gray-400 truncate">{tpl.description}</p>}
                      <p className="text-xs text-gray-300">{catalogEntry?.label ?? tpl.blockType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onInsertBlocks([{ ...block, id: uid() }])}>
                      <Plus className="w-3 h-3 mr-1" /> Insert
                    </Button>
                    <button className="w-6 h-6 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      onClick={() => { if (confirm("Delete this template?")) deleteBlockTpl.mutate({ id: tpl.id }, { onSuccess: () => utils.blockTemplates.list.invalidate() }); }} title="Delete template">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ─── Apply Template Modal ────────────────────────────────────────────────────

function FunnelApplyTemplateModal({ onClose, onApply }: { onClose: () => void; onApply: (blocks: Block[]) => void }) {
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
                      <button onClick={() => { if (confirm("Delete this template?")) deletePageTpl.mutate({ id: tpl.id }); }} className="w-7 h-7 border border-gray-200 rounded text-gray-400 hover:text-red-500 flex items-center justify-center flex-shrink-0 group-hover:opacity-100"><Trash2 size={12} /></button>
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

