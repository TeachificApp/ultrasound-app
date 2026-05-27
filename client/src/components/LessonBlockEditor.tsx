/**
 * LessonBlockEditor.tsx
 * WYSIWYG page-builder-style editor for per-lesson content blocks.
 * Shown to admins inside the CoursePlayer via a slide-over panel.
 * Reuses the same Block system (BLOCK_CATALOG, BlockPreview, BlockSettings, SortableBlock)
 * as the LandingPageBuilder.
 */
import { useState, useCallback, useMemo, useRef } from "react";
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
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Block, BlockType, BlockPreview } from "@/components/BlockPreview";
import { BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock, uid } from "@/pages/admin/LandingPageBuilder";
import {
  X, Plus, Save, Eye, EyeOff, Copy, BookOpen, Search, ExternalLink, Layers, Globe, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { BlockTemplateLibraryProvider, OpenTemplateLibraryButton, SaveAsTemplateButton } from "@/components/BlockTemplateLibrary";
import { cn } from "@/lib/utils";

interface LessonBlockEditorProps {
  lessonId: number;
  courseId?: number;
  courseSlug: string;
  initialBlocks: Block[];
  onClose: () => void;
  onSaved: () => void;
  onSavedAndClose?: () => void;
  prevLesson?: { id: number; title: string } | null;
  nextLesson?: { id: number; title: string } | null;
  onNavigateLesson?: (lesson: { id: number; title: string }) => void;
  /** When true, renders as a flex-fill panel (no fixed overlay). Use when embedded inside another full-screen modal. */
  embedded?: boolean;
}

// Picker tab type
type PickerTab = "catalog" | "from_lessons" | "templates" | "import_url";

export default function LessonBlockEditor({
  lessonId,
  courseId,
  courseSlug,
  initialBlocks,
  onClose,
  onSaved,
  onSavedAndClose,
  prevLesson,
  nextLesson,
  onNavigateLesson,
  embedded = false,
}: LessonBlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATALOG_CATEGORIES[0]);
  const [pickerTab, setPickerTab] = useState<PickerTab>("catalog");
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Refs for scroll-to-new-block
  const canvasRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Block-from-lessons state
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(courseId ?? null);
  const [selectedSourceLessonId, setSelectedSourceLessonId] = useState<number | null>(null);
  const [selectedSourceFunnelId, setSelectedSourceFunnelId] = useState<number | null>(null);
  const [selectedSourceFunnelPageId, setSelectedSourceFunnelPageId] = useState<number | null>(null);
  const [blockSearch, setBlockSearch] = useState("");
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

  const updateLesson = trpc.lmsAdmin.updateLesson.useMutation();

  // Save-as-template state
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

  // Fetch all courses for the course picker
  const { data: coursesData } = trpc.lmsAdmin.listCourses.useQuery(
    { status: "all", type: "all", page: 1, pageSize: 100 },
    { enabled: addMenuOpen && pickerTab === "from_lessons" }
  );

  // Fetch lessons with blocks for the selected source course
  const { data: sourceLessons, isLoading: loadingSourceLessons } = trpc.lmsAdmin.getLessonsWithBlocks.useQuery(
    { courseId: selectedSourceCourseId! },
    { enabled: addMenuOpen && pickerTab === "from_lessons" && !!selectedSourceCourseId }
  );

  // Fetch funnels with pages (for funnel page source)
  const { data: funnelsWithPages } = trpc.funnelAdmin.getFunnelsWithPages.useQuery(
    undefined,
    { enabled: addMenuOpen && pickerTab === "from_lessons" }
  );

  // Parse blocks for the selected source lesson
  const sourceLessonBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceLessonId || !sourceLessons) return [];
    const lesson = sourceLessons.find(l => l.id === selectedSourceLessonId);
    if (!lesson?.contentBlocks) return [];
    try {
      const parsed = typeof lesson.contentBlocks === "string"
        ? JSON.parse(lesson.contentBlocks)
        : lesson.contentBlocks;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [selectedSourceLessonId, sourceLessons]);

  // Parse blocks for the selected funnel page
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

  const activeSourceBlocks = selectedSourceFunnelPageId ? sourceFunnelPageBlocks : sourceLessonBlocks;
  const filteredSourceBlocks = useMemo(() => {
    if (!blockSearch.trim()) return activeSourceBlocks;
    const q = blockSearch.toLowerCase();
    return activeSourceBlocks.filter(b =>
      b.type.toLowerCase().includes(q) ||
      JSON.stringify(b.data).toLowerCase().includes(q)
    );
  }, [activeSourceBlocks, blockSearch]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks(bs => {
        const oldIdx = bs.findIndex(b => b.id === active.id);
        const newIdx = bs.findIndex(b => b.id === over.id);
        return arrayMove(bs, oldIdx, newIdx);
      });
    }
  }, []);

  /** Scroll the canvas to a specific block id after a short delay (for React to render it first) */
  const scrollToBlock = (blockId: string) => {
    setTimeout(() => {
      const el = blockRefs.current.get(blockId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (canvasRef.current) {
        canvasRef.current.scrollTo({ top: canvasRef.current.scrollHeight, behavior: "smooth" });
      }
    }, 80);
  };

  const addBlock = (type: BlockType) => {
    const catalog = BLOCK_CATALOG.find(c => c.type === type);
    if (!catalog) return;
    const newBlock: Block = { id: uid(), type, data: { ...catalog.defaultData } };
    setBlocks(bs => [...bs, newBlock]);
    setSelectedBlockId(newBlock.id);
    setAddMenuOpen(false);
    scrollToBlock(newBlock.id);
  };

  const copyBlockFromLesson = (block: Block) => {
    const copy: Block = { ...block, id: uid() };
    setBlocks(bs => [...bs, copy]);
    setSelectedBlockId(copy.id);
    toast.success("Block copied!");
    setAddMenuOpen(false);
    scrollToBlock(copy.id);
  };

  const copyAllBlocksFromLesson = () => {
    if (!activeSourceBlocks.length) return;
    const copies = activeSourceBlocks.map(b => ({ ...b, id: uid() }));
    setBlocks(bs => [...bs, ...copies]);
    toast.success(`${copies.length} block${copies.length > 1 ? "s" : ""} copied!`);
    setAddMenuOpen(false);
    if (copies.length > 0) scrollToBlock(copies[copies.length - 1].id);
  };

  const updateBlock = (id: string, data: Record<string, any>) => {
    setBlocks(bs => bs.map(b => {
      if (b.id === id) return { ...b, data: { ...b.data, ...data } };
      // Also update child blocks inside column_layout
      if (b.type === "column_layout") {
        const leftBlocks: Block[] = b.data?.leftBlocks ?? [];
        const rightBlocks: Block[] = b.data?.rightBlocks ?? [];
        const newLeft = leftBlocks.map((cb: Block) => cb.id === id ? { ...cb, data: { ...cb.data, ...data } } : cb);
        const newRight = rightBlocks.map((cb: Block) => cb.id === id ? { ...cb, data: { ...cb.data, ...data } } : cb);
        if (newLeft !== leftBlocks || newRight !== rightBlocks) {
          return { ...b, data: { ...b.data, leftBlocks: newLeft, rightBlocks: newRight } };
        }
      }
      return b;
    }));
  };

  const deleteBlock = (id: string) => {
    setBlocks(bs => bs.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const copy: Block = { ...blocks[idx], id: uid() };
    setBlocks(bs => [...bs.slice(0, idx + 1), copy, ...bs.slice(idx + 1)]);
    setSelectedBlockId(copy.id);
    scrollToBlock(copy.id);
  };

  const handleSave = async (andClose = false) => {
    setSaving(true);
    try {
      await updateLesson.mutateAsync({
        id: lessonId,
        contentBlocks: JSON.stringify(blocks),
      });
      toast.success("Lesson content saved!");
      if (andClose && onSavedAndClose) {
        onSavedAndClose();
      } else {
        onSaved();
      }
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Also search column_layout children so clicking a child block opens its settings
  const selectedBlock = blocks.find(b => b.id === selectedBlockId) ??
    blocks.flatMap(b => b.type === "column_layout" ? [...(b.data?.leftBlocks ?? []), ...(b.data?.rightBlocks ?? [])] : []).find(b => b.id === selectedBlockId) ??
    null;

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks(bs => {
      const idx = bs.findIndex(b => b.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= bs.length) return bs;
      return arrayMove(bs, idx, newIdx);
    });
  };

  // Helper: strip HTML tags and return plain text
  const stripHtml = (html: string): string => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  };

  // Helper: get a short preview label for a block (first ~60 chars of meaningful content)
  const blockPreviewLabel = (b: Block): string => {
    const d = b.data as any;
    const truncate = (s: string, n = 60) => s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
    switch (b.type) {
      case "hero":
        return truncate(d?.headline || d?.subheadline || "Hero banner");
      case "text":
        return truncate(stripHtml(d?.html || "") || "Rich text block");
      case "two_column":
        return truncate(stripHtml(d?.leftHtml || d?.rightHtml || "") || "Two-column layout");
      case "divided_columns": {
        const cols: any[] = d?.columns ?? [];
        return truncate(stripHtml(cols[0]?.html || "") || "Divided columns");
      }
      case "three_column":
        return truncate(stripHtml(d?.col1Html || d?.col2Html || "") || "Three-column layout");
      case "image":
        return d?.alt ? truncate(d.alt) : d?.caption ? truncate(d.caption) : d?.url ? "Image" : "Image (no URL)";
      case "video":
        return d?.caption ? truncate(d.caption) : d?.embedUrl ? truncate(d.embedUrl, 50) : "Video embed";
      case "embed":
        return d?.caption ? truncate(d.caption) : "Embed / iFrame";
      case "gallery": {
        const imgs: any[] = d?.images ?? [];
        return `Image gallery (${imgs.length} images)`;
      }
      case "bullets": {
        const items: string[] = d?.items ?? [];
        return truncate(d?.headline || items[0] || "Feature list");
      }
      case "numbered_list": {
        const items: string[] = d?.items ?? [];
        return truncate(d?.headline || items[0] || "Numbered list");
      }
      case "checklist": {
        const items: string[] = d?.items ?? [];
        return truncate(d?.headline || items[0] || "Checklist");
      }
      case "carousel":
        return `Carousel (${d?.items?.length ?? 0} slides)`;
      case "icon_grid":
        return truncate(d?.headline || "Icon grid");
      case "testimonial":
        return truncate(d?.quote || d?.author || "Testimonial");
      case "reviews":
        return truncate(d?.headline || "Reviews");
      case "faq": {
        const items: any[] = d?.items ?? [];
        return truncate(d?.headline || items[0]?.q || "FAQ");
      }
      case "alert":
        return truncate(stripHtml(d?.text || "") || "Alert / callout");
      case "flip_cards":
        return truncate(d?.headline || "Flip cards");
      case "instructor":
        return truncate(d?.name || "Instructor profile");
      case "countdown":
        return truncate(d?.headline || "Countdown timer");
      case "pricing_cta":
      case "cta_standalone":
        return truncate(d?.headline || d?.ctaText || "Call to action");
      case "lead_capture":
        return truncate(d?.headline || "Lead capture form");
      case "logos":
        return truncate(d?.headline || "Logos / social proof");
      case "spacer":
        return `Spacer (${d?.height ?? 48}px)`;
      case "divider":
        return "Divider";
      case "logo_strip":
        return truncate(d?.headline || "Logo strip");
      case "footer":
        return "Footer";
      case "curriculum_auto":
        return "Curriculum (auto)";
      case "pricing_options_auto":
        return "Pricing options (auto)";
      case "related_products":
        return "Related products";
      default: {
        // Fallback: try common keys
        const text = d?.headline || d?.title || d?.heading || d?.text || d?.html || d?.quote || "";
        return truncate(stripHtml(String(text)) || b.type.replace(/_/g, " "));
      }
    }
  };

  return (
    <BlockTemplateLibraryProvider onInsert={(block) => {
      const newBlock = { ...block, id: uid() };
      setBlocks(prev => [...prev, newBlock]);
      setSelectedBlockId(newBlock.id);
      scrollToBlock(newBlock.id);
    }}>
    <>
    <div className={embedded ? "flex flex-col flex-1 overflow-hidden" : "fixed inset-0 z-40 flex bg-black/40"}>
      {/* Main editor panel */}
      <div className={embedded ? "flex flex-col flex-1 overflow-hidden" : "flex flex-col w-full max-w-6xl mx-auto bg-white shadow-2xl overflow-hidden"}>
        {/* Header — hidden when embedded inside LessonEditorPage (which has its own header) */}
        {!embedded && <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-teal-700 font-bold text-sm uppercase tracking-wide">Lesson Editor</span>
            <span className="text-gray-400 text-xs hidden sm:inline">Blocks appear below the video in the player</span>
            {(prevLesson || nextLesson) && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => prevLesson && onNavigateLesson?.(prevLesson)}
                  disabled={!prevLesson}
                  title={prevLesson ? `← ${prevLesson.title}` : "No previous lesson"}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-500 hover:text-teal-700 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline max-w-[100px] truncate">{prevLesson?.title ?? "Prev"}</span>
                </button>
                <button
                  onClick={() => nextLesson && onNavigateLesson?.(nextLesson)}
                  disabled={!nextLesson}
                  title={nextLesson ? `${nextLesson.title} →` : "No next lesson"}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-500 hover:text-teal-700 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <span className="hidden md:inline max-w-[100px] truncate">{nextLesson?.title ?? "Next"}</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!previewMode && (
              <Button
                size="sm"
                className="bg-teal-500 hover:bg-teal-600 text-white text-xs h-7 font-semibold"
                onClick={() => setAddMenuOpen(true)}
              >
                <Plus className="w-3 h-3 mr-1" /> Add Block
              </Button>
            )}
            {/* Preview in course player — opens new window at this lesson */}
            {courseSlug && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = `https://learn.allaboutultrasound.com/courses/${courseSlug}/player?lesson=${lessonId}&preview=admin`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                className="text-xs h-7 border-teal-300 text-teal-700 hover:bg-teal-50"
                title="Open lesson in course player (new window)"
              >
                <ExternalLink className="w-3 h-3 mr-1" /> Preview
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewMode(p => !p)}
              className={cn(
                "text-xs h-7",
                previewMode ? "border-teal-500 text-teal-700 bg-teal-50" : "text-gray-500 hover:text-teal-700"
              )}
            >
              {previewMode ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
              {previewMode ? "Edit" : "Preview Blocks"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-teal-300 text-teal-700 hover:bg-teal-50 text-xs h-7 font-semibold"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              <Save className="w-3 h-3 mr-1" />
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-7 font-semibold"
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save & Close"}
            </Button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>}

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Canvas */}
          <div ref={canvasRef} className="flex-1 overflow-y-auto bg-gray-50 p-4">
            {/* Blocks canvas */}
            {previewMode ? (
              <div className="space-y-4">
                {blocks.map(block => (
                  <div key={block.id} className="bg-white rounded-xl overflow-hidden shadow-sm">
                    <BlockPreview block={block} />
                  </div>
                ))}
                {blocks.length === 0 && (
                  <div className="text-center text-gray-400 py-12">No content blocks yet. Switch to Edit mode to add blocks.</div>
                )}
              </div>
            ) : (
              <DndContext sensors={sensors} modifiers={[restrictToFirstScrollableAncestor]} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={[
                  ...blocks.map(b => b.id),
                  ...blocks.flatMap(b => b.type === "column_layout" ? [...(b.data?.leftBlocks ?? []), ...(b.data?.rightBlocks ?? [])].map((cb: any) => cb.id) : []),
                ]} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <div
                      key={block.id}
                      ref={el => {
                        if (el) blockRefs.current.set(block.id, el);
                        else blockRefs.current.delete(block.id);
                      }}
                    >
                      <SortableBlock
                        block={block}
                        isSelected={block.id === selectedBlockId}
                        onSelect={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
                        onDelete={() => deleteBlock(block.id)}
                        onDuplicate={() => duplicateBlock(block.id)}
                        onMoveUp={idx > 0 ? () => moveBlock(block.id, -1) : undefined}
                        onMoveDown={idx < blocks.length - 1 ? () => moveBlock(block.id, 1) : undefined}
                        onSaveAsTemplate={handleSaveBlockAsTemplate}
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
                          setSelectedBlockId(newBlock.id);
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
                          if (selectedBlockId === childBlockId) setSelectedBlockId(null);
                        }}
                        onReorderChildInColumn={(colBlockId, side, childBlockId, direction) => {
                          setBlocks(prev => prev.map(b => {
                            if (b.id !== colBlockId) return b;
                            const colKey = side === "left" ? "leftBlocks" : "rightBlocks";
                            const arr: Block[] = [...(b.data[colKey] ?? [])];
                            const idx = arr.findIndex(cb => cb.id === childBlockId);
                            if (idx === -1) return b;
                            const newIdx = direction === "up" ? idx - 1 : idx + 1;
                            if (newIdx < 0 || newIdx >= arr.length) return b;
                            [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
                            return { ...b, data: { ...b.data, [colKey]: arr } };
                          }));
                        }}
                      />
                    </div>
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Add block button — opens modal picker */}
            {!previewMode && (
              <div className="mt-4">
                <button
                  onClick={() => setAddMenuOpen(true)}
                  className="w-full border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-xl py-3 text-teal-600 hover:text-teal-700 text-sm flex items-center justify-center gap-2 transition-colors bg-white"
                >
                  <Plus className="w-4 h-4" /> Add Block
                </button>
              </div>
            )}
          </div>

          {/* Right: Settings panel */}
          {!previewMode && selectedBlock && (
            <div className="w-72 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <span className="text-gray-700 text-xs font-bold uppercase tracking-wide">Block Settings</span>
                <button onClick={() => setSelectedBlockId(null)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3">
                <BlockSettings
                  block={selectedBlock}
                  onChange={data => updateBlock(selectedBlock.id, data)}
                  lessonId={lessonId}
                  courseId={courseId}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Block Picker Modal */}
    <Dialog open={addMenuOpen} onOpenChange={open => { setAddMenuOpen(open); if (!open) setBlockSearch(""); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-teal-700 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add Content Block
          </DialogTitle>
        </DialogHeader>

        {/* Top-level tabs: Catalog vs From Lessons */}
        <div className="flex gap-1 border-b border-gray-200 shrink-0 -mx-1 px-1 overflow-x-auto">
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
            onClick={() => setPickerTab("from_lessons")}
            className={cn(
              "px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5",
              pickerTab === "from_lessons"
                ? "text-teal-700 border-b-2 border-teal-500"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <BookOpen className="w-3.5 h-3.5" /> Copy from Other Lessons
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
          <button
            onClick={() => { setPickerTab("import_url"); setImportPreview(null); }}
            className={cn(
              "px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5",
              pickerTab === "import_url"
                ? "text-teal-700 border-b-2 border-teal-500"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Globe className="w-3.5 h-3.5" /> Import from URL
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
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                    activeCategory === cat
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
              {BLOCK_CATALOG.filter(b => b.category === activeCategory).map(b => (
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

        {/* ── From Lessons tab ── */}
        {pickerTab === "from_lessons" && (
          <div className="flex flex-1 overflow-hidden gap-3 min-h-0">
            {/* Left: Course + Lesson picker */}
            <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto border-r border-gray-100 pr-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Course</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                  value={selectedSourceCourseId ?? ""}
                  onChange={e => {
                    setSelectedSourceCourseId(e.target.value ? Number(e.target.value) : null);
                    setSelectedSourceLessonId(null);
                  }}
                >
                  <option value="">— select course —</option>
                  {coursesData?.courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              {selectedSourceCourseId && (
                <div className="flex-1 overflow-y-auto">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Lesson</label>
                  {loadingSourceLessons ? (
                    <p className="text-xs text-gray-400 py-2">Loading…</p>
                  ) : !sourceLessons?.length ? (
                    <p className="text-xs text-gray-400 py-2">No lessons with blocks in this course.</p>
                  ) : (
                    <div className="space-y-1">
                      {sourceLessons.map(l => (
                        <button
                          key={l.id}
                          onClick={() => { setSelectedSourceLessonId(l.id); setSelectedSourceFunnelId(null); setSelectedSourceFunnelPageId(null); setBlockSearch(""); }}
                          className={cn(
                            "w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors",
                            selectedSourceLessonId === l.id
                              ? "bg-teal-50 text-teal-700 font-semibold border border-teal-200"
                              : "text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          {l.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-gray-100 pt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Funnel Page</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                  value={selectedSourceFunnelId ?? ""}
                  onChange={e => { setSelectedSourceFunnelId(e.target.value ? Number(e.target.value) : null); setSelectedSourceFunnelPageId(null); setSelectedSourceCourseId(null); setSelectedSourceLessonId(null); setBlockSearch(""); }}
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

            {/* Right: Block list */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {!selectedSourceLessonId && !selectedSourceFunnelPageId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p>Select a lesson or funnel page to browse its blocks</p>
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
                        onClick={copyAllBlocksFromLesson}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy All ({activeSourceBlocks.length})
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {filteredSourceBlocks.length === 0 ? (
                      <p className="text-xs text-gray-400 py-4 text-center">No blocks found.</p>
                    ) : filteredSourceBlocks.map((b, i) => {
                      const catalogEntry = BLOCK_CATALOG.find(c => c.type === b.type);
                      const preview = blockPreviewLabel(b);
                      return (
                      <div
                        key={b.id}
                        className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* Position number */}
                          <span className="text-gray-300 text-xs font-mono w-5 shrink-0 mt-0.5 text-right">{i + 1}</span>
                          {/* Block icon */}
                          {catalogEntry && (
                            <span className="shrink-0 text-teal-500 mt-0.5" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>
                          )}
                          <div className="min-w-0 flex-1">
                            {/* Block type label */}
                            <p className="text-xs font-semibold text-gray-700 leading-tight">
                              {catalogEntry?.label ?? b.type.replace(/_/g, " ")}
                            </p>
                            {/* Content preview */}
                            {preview && (
                              <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{preview}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs shrink-0 border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                          onClick={() => copyBlockFromLesson(b)}
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
          <BlockTemplatesTabContent
            onInsert={(block) => {
              setBlocks(prev => [...prev, block]);
              setAddMenuOpen(false);
              toast.success("Block template inserted!");
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
          <DialogTitle className="text-teal-700 flex items-center gap-2">
            Save Block as Template
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Template Name <span className="text-red-500">*</span></label>
            <input type="text" value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)} placeholder="e.g. Hero Banner" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Description <span className="text-gray-400">(optional)</span></label>
            <input type="text" value={saveTemplateDesc} onChange={e => setSaveTemplateDesc(e.target.value)} placeholder="Brief description" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => setSaveTemplateDialogBlock(null)} className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg border border-gray-200 transition-colors">Cancel</button>
          <button
            disabled={!saveTemplateName.trim() || saveBlockTemplateMutation.isPending}
            onClick={() => {
              if (!saveTemplateDialogBlock || !saveTemplateName.trim()) return;
              saveBlockTemplateMutation.mutate({
                name: saveTemplateName.trim(),
                description: saveTemplateDesc.trim() || undefined,
                blockType: saveTemplateDialogBlock.type,
                blockData: JSON.parse(JSON.stringify(saveTemplateDialogBlock.data ?? {})),
              });
            }}
            className="text-sm bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveBlockTemplateMutation.isPending ? "Saving..." : "Save Template"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
    </BlockTemplateLibraryProvider>
  );
}

function BlockTemplatesTabContent({ onInsert }: { onInsert: (block: Block) => void }) {
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
            // blockTemplates schema uses blockType + blockData (JSON string), not tpl.blocks
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
