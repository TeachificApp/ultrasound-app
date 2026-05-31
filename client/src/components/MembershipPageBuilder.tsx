/**
 * MembershipPageBuilder — embedded block editor for membership sales and member pages.
 * Reuses BLOCK_CATALOG, BlockSettings, SortableBlock, and BlockPreview from LandingPageBuilder.
 */
import { useState, useCallback, useRef, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BLOCK_CATALOG,
  CATALOG_CATEGORIES,
  BlockSettings,
  SortableBlock,
  type Block,
  type BlockType,
} from "@/pages/admin/LandingPageBuilder";
import { BlockPreview } from "@/components/BlockPreview";
import { Plus, Save, Eye, EyeOff, ChevronDown, ChevronRight, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultBlock(type: BlockType): Block {
  const catalog = BLOCK_CATALOG.find((b) => b.type === type);
  return {
    id: generateId(),
    type,
    data: catalog?.defaultData ?? {},
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MembershipPageBuilderProps {
  initialBlocks: Block[];
  onSave: (blocksJson: string) => void;
  isSaving?: boolean;
  context?: string;
}

export default function MembershipPageBuilder({
  initialBlocks,
  onSave,
  isSaving,
  context,
}: MembershipPageBuilderProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(CATALOG_CATEGORIES));
  const [rightPanelWidth, setRightPanelWidth] = useState(288);
  const rightPanelDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Sync initialBlocks when parent re-fetches
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && initialBlocks.length > 0) {
      setBlocks(initialBlocks);
      initialized.current = true;
    }
  }, [initialBlocks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const oldIdx = prev.findIndex((b) => b.id === active.id);
        const newIdx = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const addBlock = (type: BlockType) => {
    const block = defaultBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
    setCatalogOpen(false);
  };

  const updateBlock = useCallback((id: string, data: Record<string, unknown>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b))
    );
  }, []);

  const deleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const newBlock = { ...block, id: generateId() };
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setSelectedId(newBlock.id);
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (dir === "up" && idx === 0) return prev;
      if (dir === "down" && idx === prev.length - 1) return prev;
      return arrayMove(prev, idx, dir === "up" ? idx - 1 : idx + 1);
    });
  };

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

  // Upload helper for block settings
  const uploadMediaMutation = trpc.auth.uploadPageMedia.useMutation();
  const uploadMedia = useCallback(
    async (dataUri: string, mimeType: string, fileName: string) => {
      const result = await uploadMediaMutation.mutateAsync({ dataUri, mimeType, fileName, context: context ?? "membership" });
      return result.url;
    },
    [uploadMediaMutation, context]
  );

  const filteredCatalog = BLOCK_CATALOG.filter(
    (b) =>
      !catalogSearch ||
      b.label.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      b.category.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const grouped = CATALOG_CATEGORIES.map((cat) => ({
    cat,
    items: filteredCatalog.filter((b) => b.category === cat),
  })).filter((g) => g.items.length > 0);

  if (previewMode) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          <span className="text-sm font-medium text-gray-700">Preview</span>
          <Button size="sm" variant="outline" onClick={() => setPreviewMode(false)}>
            <EyeOff className="w-4 h-4 mr-1" /> Exit Preview
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto bg-white">
          {blocks.map((block) => (
            <BlockPreview key={block.id} block={block} />
          ))}
          {blocks.length === 0 && (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No blocks yet.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <Button
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => setCatalogOpen((v) => !v)}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Block
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setPreviewMode(true)}>
          <Eye className="w-4 h-4 mr-1" /> Preview
        </Button>
        <Button
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          disabled={isSaving}
          onClick={() => onSave(JSON.stringify(blocks))}
        >
          <Save className="w-4 h-4 mr-1" /> {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Block catalog sidebar */}
        {catalogOpen && (
          <div className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col shrink-0 overflow-hidden">
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search blocks…"
                  className="pl-7 h-7 text-xs"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {grouped.map(({ cat, items }) => (
                <div key={cat}>
                  <button
                    className="flex items-center gap-1 w-full text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 py-1 hover:text-gray-700"
                    onClick={() =>
                      setOpenCategories((prev) => {
                        const next = new Set(prev);
                        next.has(cat) ? next.delete(cat) : next.add(cat);
                        return next;
                      })
                    }
                  >
                    {openCategories.has(cat) ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    {cat}
                  </button>
                  {openCategories.has(cat) && (
                    <div className="space-y-0.5 ml-1">
                      {items.map((b) => (
                        <button
                          key={b.type}
                          className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                          onClick={() => addBlock(b.type)}
                        >
                          <span className="text-gray-400 shrink-0">{b.icon}</span>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          className="flex-1 overflow-y-auto bg-gray-100 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          {blocks.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 cursor-pointer hover:border-teal-400 hover:text-teal-500 transition-colors"
              onClick={() => setCatalogOpen(true)}
            >
              <Plus className="w-8 h-8 mb-2" />
              <p className="text-sm font-medium">Click to add your first block</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map((block, idx) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    isSelected={selectedId === block.id}
                    onSelect={() => setSelectedId(block.id)}
                    onDelete={() => deleteBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onMoveUp={idx > 0 ? () => moveBlock(block.id, "up") : undefined}
                    onMoveDown={idx < blocks.length - 1 ? () => moveBlock(block.id, "down") : undefined}
                    activeDragId={null}
                    activeColumnTarget={null}
                    onMoveBlockOutOfColumn={() => {}}
                    onAddBlockToColumn={() => {}}
                    onMoveChildToOtherColumn={() => {}}
                    onDeleteChildFromColumn={() => {}}
                    onReorderChildInColumn={() => {}}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Right panel — settings */}
        {selectedBlock && (
          <>
            {/* Drag handle */}
            <div
              className="w-1 cursor-col-resize bg-gray-200 hover:bg-teal-400 transition-colors shrink-0"
              onMouseDown={handleRightPanelMouseDown}
            />
            <div
              className="border-l border-gray-200 bg-white overflow-y-auto shrink-0"
              style={{ width: rightPanelWidth }}
            >
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Block Settings
                </span>
                <button
                  className="text-gray-400 hover:text-gray-700 text-xs"
                  onClick={() => setSelectedId(null)}
                >
                  ✕
                </button>
              </div>
              <div className="p-3">
                <BlockSettings
                  block={selectedBlock}
                  onChange={(data) => updateBlock(selectedBlock.id, data)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
