/**
 * LessonBlockEditor.tsx
 * WYSIWYG page-builder-style editor for per-lesson content blocks.
 * Shown to admins inside the CoursePlayer via a slide-over panel.
 * Reuses the same Block system (BLOCK_CATALOG, BlockPreview, BlockSettings, SortableBlock)
 * as the LandingPageBuilder.
 */
import { useState, useCallback } from "react";
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
  Block, BlockType, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockPreview, BlockSettings, SortableBlock, uid,
} from "@/pages/admin/LandingPageBuilder";
import {
  X, Plus, Save, ChevronDown, ChevronUp, Trash2, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LessonBlockEditorProps {
  lessonId: number;
  courseSlug: string;
  initialBlocks: Block[];
  initialObjectives: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function LessonBlockEditor({
  lessonId,
  courseSlug,
  initialBlocks,
  initialObjectives,
  onClose,
  onSaved,
}: LessonBlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [objectives, setObjectives] = useState<string[]>(initialObjectives.length ? initialObjectives : [""]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATALOG_CATEGORIES[0]);
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateLesson = trpc.lmsAdmin.updateLesson.useMutation();

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanObjectives = objectives.filter(o => o.trim());
      await updateLesson.mutateAsync({
        id: lessonId,
        contentBlocks: JSON.stringify(blocks),
        learningObjectives: JSON.stringify(cleanObjectives),
      });
      toast.success("Lesson content saved!");
      onSaved();
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60">
      {/* Main editor panel */}
      <div className="flex flex-col w-full max-w-6xl mx-auto bg-[#0a2a2f] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#071e22] border-b border-teal-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-teal-300 font-bold text-sm uppercase tracking-wide">Lesson Content Editor</span>
            <span className="text-gray-500 text-xs">WYSIWYG — blocks appear below the video in the player</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewMode(p => !p)}
              className={cn(
                "text-xs h-7 border-teal-700 bg-transparent",
                previewMode ? "text-teal-300 bg-teal-900/30" : "text-gray-400 hover:text-teal-300"
              )}
            >
              {previewMode ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
              {previewMode ? "Edit" : "Preview"}
            </Button>
            <Button
              size="sm"
              className="bg-teal-500 hover:bg-teal-400 text-white text-xs h-7 font-semibold"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-3 h-3 mr-1" />
              {saving ? "Saving..." : "Save"}
            </Button>
            <button onClick={onClose} className="text-gray-400 hover:text-white ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Canvas */}
          <div className="flex-1 overflow-y-auto bg-[#0c2e33] p-4">
            {/* Learning Objectives section */}
            <div className="mb-6 bg-teal-900/20 border border-teal-800/40 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-teal-300 text-xs font-bold uppercase tracking-wide">
                  "In This Lesson" Objectives
                </h3>
                <button
                  onClick={() => setObjectives(o => [...o, ""])}
                  className="text-teal-400 hover:text-teal-300 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-teal-500 text-xs">✓</span>
                    <Input
                      value={obj}
                      onChange={e => {
                        const next = [...objectives];
                        next[i] = e.target.value;
                        setObjectives(next);
                      }}
                      placeholder={`Objective ${i + 1}...`}
                      className="h-7 text-xs bg-white/5 border-teal-800/50 text-white placeholder:text-gray-600 flex-1"
                    />
                    <button
                      onClick={() => setObjectives(o => o.filter((_, j) => j !== i))}
                      className="text-gray-600 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Blocks canvas */}
            {previewMode ? (
              <div className="space-y-4">
                {blocks.map(block => (
                  <div key={block.id} className="bg-white rounded-xl overflow-hidden">
                    <BlockPreview block={block} />
                  </div>
                ))}
                {blocks.length === 0 && (
                  <div className="text-center text-gray-500 py-12">No content blocks yet. Switch to Edit mode to add blocks.</div>
                )}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map(block => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={block.id === selectedBlockId}
                      onSelect={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
                      onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Add block button */}
            {!previewMode && (
              <div className="mt-4">
                <button
                  onClick={() => setAddMenuOpen(o => !o)}
                  className="w-full border-2 border-dashed border-teal-800/50 hover:border-teal-500/60 rounded-xl py-3 text-teal-500 hover:text-teal-400 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Block
                </button>

                {addMenuOpen && (
                  <div className="mt-2 bg-[#071e22] border border-teal-900/50 rounded-xl overflow-hidden shadow-2xl">
                    {/* Category tabs */}
                    <div className="flex border-b border-teal-900/40 overflow-x-auto">
                      {CATALOG_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className={cn(
                            "px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                            activeCategory === cat
                              ? "text-teal-300 border-b-2 border-teal-400 bg-teal-900/20"
                              : "text-gray-500 hover:text-gray-300"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    {/* Block grid */}
                    <div className="grid grid-cols-3 gap-1 p-2 max-h-48 overflow-y-auto">
                      {BLOCK_CATALOG.filter(b => b.category === activeCategory).map(b => (
                        <button
                          key={b.type}
                          onClick={() => addBlock(b.type)}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-teal-900/30 text-gray-400 hover:text-teal-300 transition-colors text-center"
                        >
                          <span className="text-teal-500">{b.icon}</span>
                          <span className="text-[10px] leading-tight">{b.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Settings panel */}
          {!previewMode && selectedBlock && (
            <div className="w-72 shrink-0 bg-[#071e22] border-l border-teal-900/40 overflow-y-auto">
              <div className="px-4 py-3 border-b border-teal-900/40 flex items-center justify-between">
                <span className="text-teal-300 text-xs font-bold uppercase tracking-wide">Block Settings</span>
                <button onClick={() => setSelectedBlockId(null)} className="text-gray-500 hover:text-white">
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
  );
}
