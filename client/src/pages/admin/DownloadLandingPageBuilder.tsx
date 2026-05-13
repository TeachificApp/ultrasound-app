/**
 * DownloadLandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG landing page editor for digital download products.
 * Route: /admin/downloads/:productId/landing-builder
 *
 * Thin wrapper — all block catalog, BlockPreview, BlockSettings, and SortableBlock
 * are imported from LandingPageBuilder.tsx so all three builders stay in sync.
 */
import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
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
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  type Block,
  type BlockType,
  uid,
  BLOCK_CATALOG,
  CATALOG_CATEGORIES,
  BlockPreview,
  BlockSettings,
  SortableBlock,
} from "./LandingPageBuilder";
import {
  ArrowLeft, Save, Eye, Plus, Palette, X, Layers,
} from "lucide-react";

// ─── Main Editor ─────────────────────────────────────────────────────────────

export default function DownloadLandingPageBuilder() {
  const { productId } = useParams<{ productId: string }>();
  const [, navigate] = useLocation();
  const numericProductId = Number(productId);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("Layout");
  const [productInfo, setProductInfo] = useState<{ title: string; slug: string } | null>(null);

  // Auto-scroll preview canvas to the selected block
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load page data
  const { isLoading, data: lpData } = trpc.downloadsAdmin.getLandingBlocks.useQuery(
    { productId: numericProductId },
    { enabled: !isNaN(numericProductId) }
  );

  // Load blocks from page data
  if (lpData && !hasLoaded) {
    setHasLoaded(true);
    setProductInfo({ title: lpData.productTitle, slug: lpData.productSlug });
    if (lpData.blocks && lpData.blocks.length > 0) {
      setBlocks(lpData.blocks as Block[]);
    } else {
      setBlocks(getDefaultBlocks(lpData.productTitle));
    }
  }

  // Save blocks
  const saveBlocks = trpc.downloadsAdmin.saveLandingBlocks.useMutation({
    onSuccess: () => toast.success("Landing page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveBlocks.mutateAsync({ productId: numericProductId, blocks });
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

  const selectedBlock = blocks.find(b => b.id === selectedId);
  const catalogByCat = BLOCK_CATALOG.filter(c => c.category === activeCat);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/lms?tab=downloads&editDownload=${productId}`)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 font-medium transition-colors"
          >
            <ArrowLeft size={16} /> Back to Product
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
            {productInfo?.title ?? "Loading…"}
          </span>
          <span className="text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
            Download Landing Page
          </span>
        </div>
        <div className="flex items-center gap-2">
          {productInfo?.slug && (
            <a
              href={`/downloads/${productInfo.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Eye size={14} /> Preview
            </a>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-1.5 h-8"
          >
            <Save size={14} /> {isSaving ? "Saving…" : "Save Page"}
          </Button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Block Catalog */}
        <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          {/* Block catalog categories */}
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2 flex items-center gap-1">
              <Layers size={12} /> Add Blocks
            </p>
            <div className="flex flex-col gap-0.5">
              {CATALOG_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors ${
                    activeCat === cat
                      ? "bg-teal-50 text-teal-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {catalogByCat.map(item => (
              <button
                key={item.type}
                onClick={() => addBlock(item.type)}
                className="w-full flex items-center gap-2 px-2 py-2 text-xs text-gray-700 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-colors text-left"
              >
                <span className="text-gray-400 flex-shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
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
              <p className="text-sm">Click a block type on the left to get started</p>
            </div>
          ) : (
            <div className="bg-white min-h-full shadow-sm mx-auto" style={{ maxWidth: "900px" }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map(block => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex justify-center py-6 border-t border-dashed border-gray-200">
                <button
                  onClick={() => addBlock("text")}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600 transition-colors"
                >
                  <Plus size={16} /> Add a block
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Block Settings */}
        <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
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
  );
}

// ─── Default blocks for a new download landing page ──────────────────────────

function getDefaultBlocks(title: string): Block[] {
  return [
    {
      id: uid(), type: "hero",
      data: {
        headline: title || "Your Product Headline",
        subheadline: "A compelling subtitle that explains the value",
        bgType: "gradient", gradientFrom: "#179ca3", gradientTo: "#0e4a50",
        gradientDir: "to bottom right", textColor: "#ffffff", align: "left",
        buttons: [{ text: "Buy Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }],
      },
    },
    {
      id: uid(), type: "bullets",
      data: { headline: "What's Included", items: ["Feature one", "Feature two", "Feature three"], iconColor: "#179ca3", bgColor: "#f8fffe" },
    },
    {
      id: uid(), type: "pricing_cta",
      data: { headline: "Ready to Download?", subtext: "Get instant access to all files.", ctaText: "Buy Now", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true },
    },
  ];
}
