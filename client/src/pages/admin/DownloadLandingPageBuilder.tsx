/**
 * DownloadLandingPageBuilder.tsx
 * Full-screen drag-and-drop WYSIWYG landing page editor for digital download products.
 * Route: /admin/downloads/:productId/landing-builder
 *
 * Thin wrapper — all block catalog, BlockPreview, BlockSettings, and SortableBlock
 * are imported from LandingPageBuilder.tsx so all three builders stay in sync.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type Block, type BlockType } from "@/components/BlockPreview";
import { uid, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock } from "./LandingPageBuilder";
import {
  ArrowLeft, Save, Eye, Plus, Palette, X, Layers, BookOpen, Copy, Search,
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

  // Block picker modal state
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"catalog" | "from_pages" | "templates">("catalog");
  const [selectedSourceDownloadId, setSelectedSourceDownloadId] = useState<number | null>(null);
  const [blockSearch, setBlockSearch] = useState("");

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

  // Block picker: fetch downloads with landing blocks (for "Copy from Other Pages" tab)
  const { data: downloadsWithBlocks } = trpc.lmsAdmin.getDownloadsWithLandingBlocks.useQuery(
    undefined,
    { enabled: addMenuOpen && pickerTab === "from_pages" }
  );
  const sourceDownloadBlocks = useMemo<Block[]>(() => {
    if (!selectedSourceDownloadId || !downloadsWithBlocks) return [];
    const download = downloadsWithBlocks.find((d: any) => d.id === selectedSourceDownloadId);
    if (!download?.landingBlocks) return [];
    try {
      const parsed = typeof download.landingBlocks === "string" ? JSON.parse(download.landingBlocks) : download.landingBlocks;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [selectedSourceDownloadId, downloadsWithBlocks]);
  const filteredSourceBlocks = useMemo(() => {
    if (!blockSearch.trim()) return sourceDownloadBlocks;
    const q = blockSearch.toLowerCase();
    return sourceDownloadBlocks.filter((b: Block) =>
      b.type.toLowerCase().includes(q) ||
      JSON.stringify(b.data).toLowerCase().includes(q)
    );
  }, [sourceDownloadBlocks, blockSearch]);
  const copyBlockFromSource = (block: Block) => {
    const copy: Block = { ...block, id: uid() };
    setBlocks(prev => [...prev, copy]);
    setSelectedId(copy.id);
    toast.success("Block copied!");
    setAddMenuOpen(false);
  };
  const copyAllBlocksFromSource = () => {
    if (!sourceDownloadBlocks.length) return;
    const copies = sourceDownloadBlocks.map((b: Block) => ({ ...b, id: uid() }));
    setBlocks(prev => [...prev, ...copies]);
    toast.success(`${copies.length} block${copies.length > 1 ? "s" : ""} copied!`);
    setAddMenuOpen(false);
  };

  return (
    <>
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
        {/* Left Panel: Add Block button */}
        <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3">
            <button
              onClick={() => { setPickerTab("catalog"); setAddMenuOpen(true); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
            >
              <Plus size={14} /> Add Block
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs text-gray-400 text-center mt-4 px-2">Click "Add Block" to open the block picker with all block types, copy blocks from other pages, or insert saved templates.</p>
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
            </div>
          ) : (
            <div className="bg-white min-h-full shadow-sm mx-auto" style={{ maxWidth: "900px" }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onMoveUp={idx > 0 ? () => setBlocks(prev => arrayMove(prev, idx, idx - 1)) : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => setBlocks(prev => arrayMove(prev, idx, idx + 1)) : undefined}
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
    {/* ── Block Picker Modal ── */}
    <Dialog open={addMenuOpen} onOpenChange={open => { setAddMenuOpen(open); if (!open) setBlockSearch(""); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-teal-700 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add Content Block
          </DialogTitle>
        </DialogHeader>
        {/* Top-level tabs */}
        <div className="flex gap-1 border-b border-gray-200 shrink-0 -mx-1 px-1">
          <button onClick={() => setPickerTab("catalog")} className={cn("px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5", pickerTab === "catalog" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
            <Plus className="w-3.5 h-3.5" /> New Block
          </button>
          <button onClick={() => setPickerTab("from_pages")} className={cn("px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5", pickerTab === "from_pages" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
            <BookOpen className="w-3.5 h-3.5" /> Copy from Other Pages
          </button>
          <button onClick={() => setPickerTab("templates")} className={cn("px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5", pickerTab === "templates" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>
            <Layers className="w-3.5 h-3.5" /> Block Templates
          </button>
        </div>
        {/* ── Catalog tab ── */}
        {pickerTab === "catalog" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex border-b border-gray-200 overflow-x-auto bg-gray-50 shrink-0">
              {CATALOG_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)} className={cn("px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors", activeCat === cat ? "text-teal-700 border-b-2 border-teal-500 bg-white" : "text-gray-500 hover:text-gray-700")}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 p-1 overflow-y-auto flex-1">
              {catalogByCat.map(b => (
                <button key={b.type} onClick={() => { addBlock(b.type); setAddMenuOpen(false); }} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 text-gray-600 hover:text-teal-700 transition-all text-center">
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
            <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto border-r border-gray-100 pr-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Download Product</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                  value={selectedSourceDownloadId ?? ""}
                  onChange={e => { setSelectedSourceDownloadId(e.target.value ? Number(e.target.value) : null); setBlockSearch(""); }}
                >
                  <option value="">— select product —</option>
                  {downloadsWithBlocks?.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {!selectedSourceDownloadId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p>Select a download product to browse its landing page blocks</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2 shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input value={blockSearch} onChange={e => setBlockSearch(e.target.value)} placeholder="Search blocks…" className="pl-7 h-7 text-xs" />
                    </div>
                    {sourceDownloadBlocks.length > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0" onClick={copyAllBlocksFromSource}>
                        <Copy className="w-3 h-3 mr-1" /> Copy All ({sourceDownloadBlocks.length})
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {filteredSourceBlocks.length === 0 ? (
                      <p className="text-xs text-gray-400 py-4 text-center">No blocks found.</p>
                    ) : filteredSourceBlocks.map((b: Block) => {
                      const catalogEntry = BLOCK_CATALOG.find(c => c.type === b.type);
                      return (
                        <div key={b.id} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {catalogEntry && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">{catalogEntry?.label ?? b.type}</p>
                              <p className="text-xs text-gray-400 truncate">{b.type}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="h-6 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => copyBlockFromSource(b)}>
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
          <DownloadBlockTemplatesTab onInsert={(block) => { setBlocks(prev => [...prev, block]); setSelectedId(block.id); toast.success("Block template inserted!"); setAddMenuOpen(false); }} />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

// ─── Block Templates Tab ──────────────────────────────────────────────────────
function DownloadBlockTemplatesTab({ onInsert }: { onInsert: (block: Block) => void }) {
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
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search saved templates…" className="pl-8 h-8 text-xs" />
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
