/**
 * LessonBlockEditor.tsx
 * WYSIWYG page-builder-style editor for per-lesson content blocks.
 * Shown to admins inside the CoursePlayer via a slide-over panel.
 * Reuses the same Block system (BLOCK_CATALOG, BlockPreview, BlockSettings, SortableBlock)
 * as the LandingPageBuilder.
 */
import { useState, useCallback, useMemo } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Block, BlockType, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockPreview, BlockSettings, SortableBlock, uid,
} from "@/pages/admin/LandingPageBuilder";
import {
  X, Plus, Save, Eye, EyeOff, Copy, BookOpen, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LessonBlockEditorProps {
  lessonId: number;
  courseId?: number;
  courseSlug: string;
  initialBlocks: Block[];
  onClose: () => void;
  onSaved: () => void;
  onSavedAndClose?: () => void;
}

// Picker tab type
type PickerTab = "catalog" | "from_lessons";

export default function LessonBlockEditor({
  lessonId,
  courseId,
  courseSlug,
  initialBlocks,
  onClose,
  onSaved,
  onSavedAndClose,
}: LessonBlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATALOG_CATEGORIES[0]);
  const [pickerTab, setPickerTab] = useState<PickerTab>("catalog");
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Block-from-lessons state
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(courseId ?? null);
  const [selectedSourceLessonId, setSelectedSourceLessonId] = useState<number | null>(null);
  const [blockSearch, setBlockSearch] = useState("");

  const updateLesson = trpc.lmsAdmin.updateLesson.useMutation();

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

  const filteredSourceBlocks = useMemo(() => {
    if (!blockSearch.trim()) return sourceLessonBlocks;
    const q = blockSearch.toLowerCase();
    return sourceLessonBlocks.filter(b =>
      b.type.toLowerCase().includes(q) ||
      JSON.stringify(b.data).toLowerCase().includes(q)
    );
  }, [sourceLessonBlocks, blockSearch]);

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

  const addBlock = (type: BlockType) => {
    const catalog = BLOCK_CATALOG.find(c => c.type === type);
    if (!catalog) return;
    const newBlock: Block = { id: uid(), type, data: { ...catalog.defaultData } };
    setBlocks(bs => [...bs, newBlock]);
    setSelectedBlockId(newBlock.id);
    setAddMenuOpen(false);
  };

  const copyBlockFromLesson = (block: Block) => {
    const copy: Block = { ...block, id: uid() };
    setBlocks(bs => [...bs, copy]);
    toast.success("Block copied!");
    setAddMenuOpen(false);
  };

  const copyAllBlocksFromLesson = () => {
    if (!sourceLessonBlocks.length) return;
    const copies = sourceLessonBlocks.map(b => ({ ...b, id: uid() }));
    setBlocks(bs => [...bs, ...copies]);
    toast.success(`${copies.length} block${copies.length > 1 ? "s" : ""} copied!`);
    setAddMenuOpen(false);
  };

  const updateBlock = (id: string, data: Record<string, any>) => {
    setBlocks(bs => bs.map(b => b.id === id ? { ...b, data: { ...b.data, ...data } } : b));
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

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) ?? null;

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
    <>
    <div className="fixed inset-0 z-50 flex bg-black/40">
      {/* Main editor panel */}
      <div className="flex flex-col w-full max-w-6xl mx-auto bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-teal-700 font-bold text-sm uppercase tracking-wide">Lesson Editor</span>
            <span className="text-gray-400 text-xs">Blocks appear below the video in the player</span>
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
              {previewMode ? "Edit" : "Preview"}
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
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Canvas */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={block.id === selectedBlockId}
                      onSelect={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
                      onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onMoveUp={idx > 0 ? () => moveBlock(block.id, -1) : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => moveBlock(block.id, 1) : undefined}
                    />
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
                          onClick={() => { setSelectedSourceLessonId(l.id); setBlockSearch(""); }}
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
            </div>

            {/* Right: Block list */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {!selectedSourceLessonId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p>Select a lesson to browse its blocks</p>
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
                    {sourceLessonBlocks.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0"
                        onClick={copyAllBlocksFromLesson}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy All ({sourceLessonBlocks.length})
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
      </DialogContent>
    </Dialog>
    </>
  );
}
