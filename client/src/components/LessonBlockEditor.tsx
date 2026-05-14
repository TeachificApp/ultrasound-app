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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Block, BlockType, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockPreview, BlockSettings, SortableBlock, uid,
} from "@/pages/admin/LandingPageBuilder";
import {
  X, Plus, Save, Trash2, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LessonBlockEditorProps {
  lessonId: number;
  courseSlug: string;
  initialBlocks: Block[];
  onClose: () => void;
  onSaved: () => void;
  onSavedAndClose?: () => void;
}

export default function LessonBlockEditor({
  lessonId,
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

  return (
    <>
    <div className="fixed inset-0 z-50 flex bg-black/40">
      {/* Main editor panel */}
      <div className="flex flex-col w-full max-w-6xl mx-auto bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-teal-700 font-bold text-sm uppercase tracking-wide">Lesson Content Editor</span>
            <span className="text-gray-400 text-xs">Blocks appear below the video in the player</span>
          </div>
          <div className="flex items-center gap-2">
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
      <Dialog open={addMenuOpen} onOpenChange={setAddMenuOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-teal-700 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Add Content Block
            </DialogTitle>
          </DialogHeader>
          {/* Category tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto bg-gray-50 rounded-t-lg -mx-1">
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
          <div className="grid grid-cols-4 gap-2 p-1 max-h-80 overflow-y-auto">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
