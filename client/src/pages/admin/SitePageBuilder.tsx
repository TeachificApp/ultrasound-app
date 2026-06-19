/**
 * SitePageBuilder — full-screen block editor for site_pages rows.
 * Route: /admin/lms/site-pages/:pageId/edit
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { type Block, type BlockType } from "@/components/BlockPreview";
import {
  uid,
  BLOCK_CATALOG,
  CATALOG_CATEGORIES,
  BlockSettings,
  SortableBlock,
} from "@/pages/admin/LandingPageBuilder";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SitePageBuilder() {
  const { pageId } = useParams<{ pageId: string }>();
  const [, navigate] = useLocation();
  const numericId = Number(pageId);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeCat, setActiveCat] = useState("Layout");
  const [addOpen, setAddOpen] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoImage, setSeoImage] = useState("");
  const [showInHeaderNav, setShowInHeaderNav] = useState(false);
  const [showInSidebarNav, setShowInSidebarNav] = useState(false);
  const [showInProfileNav, setShowInProfileNav] = useState(false);
  const [isHiddenFromNav, setIsHiddenFromNav] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const rightPanelDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const { data: page, isLoading } = trpc.sitePages.admin.getPage.useQuery(
    { pageId: numericId },
    { enabled: Number.isFinite(numericId) },
  );

  const saveBlocks = trpc.sitePages.admin.saveBlocks.useMutation({
    onSuccess: () => toast.success("Page content saved"),
    onError: (e) => toast.error(e.message),
  });
  const saveSeo = trpc.sitePages.admin.saveSeo.useMutation({
    onSuccess: () => toast.success("SEO saved"),
    onError: (e) => toast.error(e.message),
  });
  const updateMeta = trpc.sitePages.admin.updatePageMeta.useMutation({
    onSuccess: () => toast.success("Page settings saved"),
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!page || hasLoaded) return;
    try {
      const parsed = page.blocks ? JSON.parse(page.blocks) : [];
      setBlocks(Array.isArray(parsed) ? parsed : []);
    } catch {
      setBlocks([]);
    }
    setSeoTitle(page.seoTitle ?? "");
    setSeoDescription(page.seoDescription ?? "");
    setSeoImage(page.seoImage ?? "");
    setShowInHeaderNav(page.showInHeaderNav);
    setShowInSidebarNav(page.showInSidebarNav);
    setShowInProfileNav(page.showInProfileNav);
    setIsHiddenFromNav(page.isHiddenFromNav);
    setHasLoaded(true);
  }, [page, hasLoaded]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIdx = prev.findIndex((b) => b.id === active.id);
      const newIdx = prev.findIndex((b) => b.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  const addBlock = (type: BlockType) => {
    const catalog = BLOCK_CATALOG.find((b) => b.type === type);
    if (!catalog) return;
    const block: Block = { id: uid(), type, data: { ...catalog.defaultData } };
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
    setAddOpen(false);
  };

  const handleSaveAll = async () => {
    await saveBlocks.mutateAsync({ pageId: numericId, blocks: JSON.stringify(blocks) });
    await saveSeo.mutateAsync({ pageId: numericId, seoTitle, seoDescription, seoImage });
    await updateMeta.mutateAsync({
      pageId: numericId,
      showInHeaderNav,
      showInSidebarNav,
      showInProfileNav,
      isHiddenFromNav,
    });
  };

  const handlePublish = async () => {
    await handleSaveAll();
    await updateMeta.mutateAsync({ pageId: numericId, status: "published" });
    toast.success("Page published");
  };

  if (isLoading || !page) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const backUrl = `/admin/lms/site-pages?domain=${encodeURIComponent(page.domain)}&edit=${page.id}`;
  const previewUrl = `/${page.slug}`;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(backUrl)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Pages
          </Button>
          <div>
            <h1 className="font-semibold text-sm">{page.title}</h1>
            <p className="text-xs text-gray-500">/{page.slug} · {page.domain}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Eye className="w-4 h-4 mr-1" /> Preview
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveAll} disabled={saveBlocks.isPending}>
            <Save className="w-4 h-4 mr-1" /> Save
          </Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handlePublish}>
            Publish
          </Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Block catalog */}
        <aside className="w-52 border-r bg-white overflow-y-auto shrink-0 p-2">
          {CATALOG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCat(cat)}
              className={cn(
                "w-full text-left text-xs px-2 py-1.5 rounded mb-0.5",
                activeCat === cat ? "bg-teal-100 text-teal-800 font-medium" : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {cat}
            </button>
          ))}
          <div className="mt-2 space-y-1">
            {BLOCK_CATALOG.filter((b) => b.category === activeCat).map((b) => (
              <button
                key={b.type}
                type="button"
                onClick={() => addBlock(b.type)}
                className="w-full text-left text-xs px-2 py-2 rounded border border-dashed border-gray-200 hover:border-teal-400 hover:bg-teal-50"
              >
                + {b.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToFirstScrollableAncestor]}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg overflow-hidden min-h-[400px]">
                {blocks.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 border-2 border-dashed m-4 rounded-lg">
                    Drag blocks from the left or click + to add content
                  </div>
                ) : (
                  blocks.map((block, idx) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDelete={() => {
                        setBlocks((prev) => prev.filter((b) => b.id !== block.id));
                        if (selectedId === block.id) setSelectedId(null);
                      }}
                      onDuplicate={() => {
                        const copy: Block = { ...block, id: uid(), data: { ...block.data } };
                        setBlocks((prev) => [...prev, copy]);
                      }}
                      onMoveUp={idx > 0 ? () => setBlocks((prev) => arrayMove(prev, idx, idx - 1)) : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => setBlocks((prev) => arrayMove(prev, idx, idx + 1)) : undefined}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </main>

        {/* Settings */}
        <aside className="border-l bg-white overflow-y-auto shrink-0 p-4 space-y-4" style={{ width: rightPanelWidth }}>
          <h3 className="font-semibold text-sm">Page settings</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <Label>Show in header nav</Label>
              <Switch checked={showInHeaderNav} onCheckedChange={setShowInHeaderNav} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show in sidebar nav</Label>
              <Switch checked={showInSidebarNav} onCheckedChange={setShowInSidebarNav} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show in profile nav</Label>
              <Switch checked={showInProfileNav} onCheckedChange={setShowInProfileNav} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Hidden from menus</Label>
              <Switch checked={isHiddenFromNav} onCheckedChange={setIsHiddenFromNav} />
            </div>
          </div>
          <hr />
          <h3 className="font-semibold text-sm">SEO</h3>
          <div className="space-y-2">
            <Label className="text-xs">Title</Label>
            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="h-8 text-sm" />
            <Label className="text-xs">Description</Label>
            <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={3} className="text-sm" />
            <Label className="text-xs">Image URL</Label>
            <Input value={seoImage} onChange={(e) => setSeoImage(e.target.value)} className="h-8 text-sm" />
          </div>
          {selectedBlock && (
            <>
              <hr />
              <h3 className="font-semibold text-sm">Block settings</h3>
              <BlockSettings
                block={selectedBlock}
                onChange={(data) =>
                  setBlocks((prev) => prev.map((b) => (b.id === selectedBlock.id ? { ...b, data } : b)))
                }
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
