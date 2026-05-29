/**
 * CommunityPageEditor.tsx
 * Embeddable block-based page editor for community pages.
 * Reuses BLOCK_CATALOG, BlockSettings, SortableBlock, BlockPreview from LandingPageBuilder.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BLOCK_CATALOG,
  BlockSettings,
  SortableBlock,
  BlockPreview,
  uid,
  type Block,
  type BlockType,
} from "@/pages/admin/LandingPageBuilder";
import {
  Plus, Save, LayoutTemplate, ChevronDown, ChevronUp, Trash2,
  Copy, Eye, EyeOff, GripVertical,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface CommunityPageEditorProps {
  communityId: number;
  /** "page" = main community page blocks, "landing" = public landing page blocks */
  pageType?: "page" | "landing";
}

const CATEGORIES = Array.from(new Set(BLOCK_CATALOG.map(b => b.category)));

export default function CommunityPageEditor({ communityId, pageType = "page" }: CommunityPageEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
  const [addCategory, setAddCategory] = useState<string>(CATEGORIES[0] ?? "");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const rightPanelDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const utils = trpc.useUtils();

  // Load page blocks
  const { data: pageData, isLoading } = trpc.community.admin.getCommunityPageBlocks.useQuery(
    { communityId, pageType },
    { enabled: !!communityId }
  );

  // Save page blocks
  const saveBlocks = trpc.community.admin.saveCommunityPageBlocks.useMutation({
    onSuccess: () => {
      toast.success("Page saved!");
      setIsSaving(false);
      utils.community.admin.getCommunityPageBlocks.invalidate({ communityId, pageType });
    },
    onError: (e) => {
      toast.error(e.message);
      setIsSaving(false);
    },
  });

  useEffect(() => {
    if (pageData && !hasLoaded) {
      try {
        const parsed = typeof pageData.blocks === "string"
          ? JSON.parse(pageData.blocks)
          : (pageData.blocks ?? []);
        setBlocks(Array.isArray(parsed) ? parsed : []);
      } catch {
        setBlocks([]);
      }
      setHasLoaded(true);
    }
  }, [pageData, hasLoaded]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  function handleSave() {
    setIsSaving(true);
    saveBlocks.mutate({ communityId, pageType, blocks: JSON.stringify(blocks) });
  }

  function addBlock(type: BlockType) {
    const catalog = BLOCK_CATALOG.find(b => b.type === type);
    if (!catalog) return;
    const newBlock: Block = { id: uid(), type, data: { ...catalog.defaultData } };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedId(newBlock.id);
    setShowAddPanel(false);
  }

  function updateBlock(id: string, data: Record<string, any>) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, data } : b));
  }

  function deleteBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateBlock(id: string) {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const copy: Block = { ...blocks[idx], id: uid(), data: { ...blocks[idx].data } };
    const next = [...blocks];
    next.splice(idx + 1, 0, copy);
    setBlocks(next);
    setSelectedId(copy.id);
  }

  function moveBlock(id: string, dir: "up" | "down") {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const next = [...blocks];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setBlocks(next);
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex(b => b.id === active.id);
    const newIdx = blocks.findIndex(b => b.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      setBlocks(prev => arrayMove(prev, oldIdx, newIdx));
    }
  }

  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    rightPanelDragRef.current = { startX: e.clientX, startWidth: rightPanelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!rightPanelDragRef.current) return;
      const delta = rightPanelDragRef.current.startX - ev.clientX;
      const newWidth = Math.min(600, Math.max(240, rightPanelDragRef.current.startWidth + delta));
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

  const activeDragBlock = activeDragId ? blocks.find(b => b.id === activeDragId) : null;

  const filteredCatalog = BLOCK_CATALOG.filter(b => !addCategory || b.category === addCategory);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mr-2" />
        Loading page editor...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] border rounded-xl overflow-hidden bg-gray-50">
      {/* Left: Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b flex-shrink-0">
          <LayoutTemplate className="w-4 h-4 text-teal-600" />
          <span className="font-semibold text-gray-800 text-sm">
            {pageType === "landing" ? "Landing Page Editor" : "Community Page Editor"}
          </span>
          <Badge variant="secondary" className="text-xs">{blocks.length} blocks</Badge>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddPanel(s => !s)}
            className="text-teal-600 border-teal-200"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />Add Block
          </Button>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            {isSaving ? "Saving..." : "Save Page"}
          </Button>
        </div>

        {/* Add Block Panel */}
        {showAddPanel && (
          <div className="bg-white border-b px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-medium text-gray-600">Category:</span>
              <div className="flex gap-1 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAddCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      addCategory === cat
                        ? "bg-teal-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {filteredCatalog.map(b => (
                <button
                  key={b.type}
                  onClick={() => addBlock(b.type)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors text-center group"
                >
                  <span className="text-teal-600 group-hover:text-teal-700">{b.icon}</span>
                  <span className="text-xs text-gray-600 leading-tight">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-4">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <LayoutTemplate className="w-12 h-12 text-gray-200" />
              <p className="text-sm">No blocks yet. Click "Add Block" to start building your page.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddPanel(true)}
                className="text-teal-600 border-teal-200"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />Add First Block
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={({ active }) => setActiveDragId(active.id)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveDragId(null)}
            >
              <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 max-w-4xl mx-auto">
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
                      activeDragId={activeDragId}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragBlock && (
                  <div className="opacity-80 shadow-2xl border-2 border-teal-400 rounded-lg overflow-hidden">
                    <BlockPreview block={activeDragBlock} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>

      {/* Resize handle */}
      {selectedBlock && (
        <div
          className="w-1 bg-gray-200 hover:bg-teal-400 cursor-col-resize flex-shrink-0 transition-colors"
          onMouseDown={handleRightPanelMouseDown}
        />
      )}

      {/* Right: Settings Panel */}
      {selectedBlock && (
        <div
          className="flex-shrink-0 bg-white border-l overflow-y-auto"
          style={{ width: rightPanelWidth }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Block Settings</p>
              <p className="text-sm font-semibold text-gray-800 capitalize mt-0.5">
                {BLOCK_CATALOG.find(b => b.type === selectedBlock.type)?.label ?? selectedBlock.type}
              </p>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
          <div className="p-4">
            <BlockSettings
              block={selectedBlock}
              onChange={(data) => updateBlock(selectedBlock.id, data)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
