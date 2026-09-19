import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { type Block, type BlockType } from "@/components/BlockPreview";
import { BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock, uid } from "@/pages/admin/LandingPageBuilder";
import { ArrowLeft, Eye, FileText, Globe2, PenLine, Save, Send, Trash2 } from "lucide-react";
import { resolveToolBrand } from "@/lib/brandToolPresentation";
import { getPublicSiteTenantForBrand, type PublicSiteTenantKey } from "@shared/publicSiteTenants";

function adminRoot(brand: "aaus" | "iheartecho") {
  return `/admin/public-site-${brand === "iheartecho" ? "ihe" : "aaus"}`;
}

function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const timezoneOffset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export default function PublicSitePageBuilder() {
  const { pageId } = useParams<{ pageId: string }>();
  const [, navigate] = useLocation();
  const id = Number(pageId);
  const brand = resolveToolBrand(window.location.pathname, window.location.hostname) === "iheartecho" ? "iheartecho" : "aaus";
  const tenant = getPublicSiteTenantForBrand(brand)!;
  const tenantKey = tenant.key as PublicSiteTenantKey;
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Layout");
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [pageType, setPageType] = useState<"page" | "blog_post" | "redirect">("page");
  const [published, setPublished] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoImage, setSeoImage] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [blogExcerpt, setBlogExcerpt] = useState("");
  const [blogAuthor, setBlogAuthor] = useState("");
  const [blogCategory, setBlogCategory] = useState("");
  const [blogPublishedAt, setBlogPublishedAt] = useState("");

  const { data: page, isLoading } = trpc.marketingSiteAdmin.getPage.useQuery({ id, tenantKey }, { enabled: Number.isFinite(id) });
  const save = trpc.marketingSiteAdmin.savePage.useMutation({
    onSuccess: () => toast.success("Page saved"),
    onError: (error) => toast.error(error.message),
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const selectedBlock = useMemo(() => blocks.find((block) => block.id === selectedId) ?? null, [blocks, selectedId]);

  useEffect(() => {
    if (!page || loadedId === page.id) return;
    try { setBlocks(page.blocks ? JSON.parse(page.blocks) : []); } catch { setBlocks([]); }
    setTitle(page.title ?? "");
    setPath(page.path ?? "");
    setPageType(page.pageType ?? "page");
    setPublished(page.isPublished);
    setSeoTitle(page.seoTitle ?? "");
    setSeoDescription(page.seoDescription ?? "");
    setSeoImage(page.seoImage ?? "");
    setRedirectUrl(page.redirectUrl ?? "");
    setBlogExcerpt(page.blogExcerpt ?? "");
    setBlogAuthor(page.blogAuthor ?? "");
    setBlogCategory(page.blogCategory ?? "");
    setBlogPublishedAt(toDateInput(page.blogPublishedAt));
    setLoadedId(page.id);
  }, [page, loadedId]);

  const savePage = async (publishOverride?: boolean) => {
    if (!title.trim() || !path.trim()) { toast.error("A title and URL path are required."); return; }
    await save.mutateAsync({
      id,
      tenantKey,
      title: title.trim(),
      path: path.trim(),
      pageType,
      blocks: JSON.stringify(blocks),
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      seoImage: seoImage.trim() || null,
      redirectUrl: pageType === "redirect" ? redirectUrl.trim() || null : null,
      blogExcerpt: pageType === "blog_post" ? blogExcerpt.trim() || null : null,
      blogAuthor: pageType === "blog_post" ? blogAuthor.trim() || null : null,
      blogCategory: pageType === "blog_post" ? blogCategory.trim() || null : null,
      blogPublishedAt: pageType === "blog_post" && blogPublishedAt ? new Date(blogPublishedAt) : null,
      isPublished: publishOverride ?? published,
    });
    if (publishOverride !== undefined) setPublished(publishOverride);
  };

  const onDragEnd = useCallback((event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    setBlocks((items) => {
      const from = items.findIndex((block) => block.id === event.active.id);
      const to = items.findIndex((block) => block.id === event.over?.id);
      return from < 0 || to < 0 ? items : arrayMove(items, from, to);
    });
  }, []);

  const addBlock = (type: BlockType) => {
    const definition = BLOCK_CATALOG.find((item) => item.type === type);
    if (!definition) return;
    const block: Block = { id: uid(), type, data: { ...definition.defaultData } };
    setBlocks((items) => [...items, block]);
    setSelectedId(block.id);
  };

  if (isLoading || !page) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  const previewUrl = `https://${tenant.currentHost}${path === "/" ? "" : path}`;
  const isBlog = pageType === "blog_post";
  const isRedirect = pageType === "redirect";

  return (
    <div className="h-screen bg-slate-100 flex flex-col">
      <header className="h-16 shrink-0 bg-white border-b px-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3"><Button size="sm" variant="ghost" onClick={() => navigate(adminRoot(brand))}><ArrowLeft className="w-4 h-4 mr-1" /> Website</Button><div className="min-w-0"><p className="font-semibold text-sm truncate">{title || "Untitled page"}</p><p className="font-mono text-xs text-slate-500 truncate">{tenant.currentHost}{path}</p></div></div>
        <div className="flex items-center gap-2"><a href={previewUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Eye className="w-4 h-4 mr-1" /> Preview</Button></a><Button size="sm" variant="outline" disabled={save.isPending} onClick={() => void savePage()}><Save className="w-4 h-4 mr-1" /> Save</Button><Button size="sm" disabled={save.isPending} onClick={() => void savePage(!published)} className={published ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700"}>{published ? "Unpublish" : <><Send className="w-4 h-4 mr-1" /> Publish</>}</Button></div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-56 shrink-0 bg-white border-r overflow-y-auto p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Add content</p>
          <div className="space-y-1">{CATALOG_CATEGORIES.map((category) => <button type="button" key={category} onClick={() => setActiveCategory(category)} className={`w-full text-left px-2 py-1.5 rounded text-xs ${activeCategory === category ? "bg-teal-100 text-teal-900 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>{category}</button>)}</div>
          <div className="mt-3 space-y-1">{BLOCK_CATALOG.filter((item) => item.category === activeCategory).map((item) => <button type="button" key={item.type} onClick={() => addBlock(item.type)} className="w-full text-left border border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50 rounded px-2 py-2 text-xs text-slate-700">+ {item.label}</button>)}</div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-7">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
              <div className="max-w-5xl min-h-[540px] mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
                {blocks.length === 0 ? <div className="m-5 py-24 border-2 border-dashed rounded-lg text-center text-slate-400"><FileText className="w-7 h-7 mx-auto mb-2" />Add blocks from the left to compose this page.</div> : blocks.map((block, index) => <SortableBlock key={block.id} block={block} isSelected={block.id === selectedId} onSelect={() => setSelectedId(block.id)} onDelete={() => { setBlocks((items) => items.filter((item) => item.id !== block.id)); if (selectedId === block.id) setSelectedId(null); }} onDuplicate={() => { const copy = { ...block, id: uid(), data: { ...block.data } }; setBlocks((items) => [...items.slice(0, index + 1), copy, ...items.slice(index + 1)]); }} onMoveUp={index > 0 ? () => setBlocks((items) => arrayMove(items, index, index - 1)) : undefined} onMoveDown={index < blocks.length - 1 ? () => setBlocks((items) => arrayMove(items, index, index + 1)) : undefined} />)}
              </div>
            </SortableContext>
          </DndContext>
        </main>

        <aside className="w-[330px] shrink-0 bg-white border-l overflow-y-auto p-4 space-y-4">
          <section><h2 className="font-semibold text-sm">Page details</h2><div className="space-y-2 mt-3"><div><Label className="text-xs">Title</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div><div><Label className="text-xs">URL path</Label><Input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/about" /></div><div><Label className="text-xs">Content type</Label><Select value={pageType} onValueChange={(value) => setPageType(value as typeof pageType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="page">Website page</SelectItem><SelectItem value="blog_post">Blog post</SelectItem><SelectItem value="redirect">Redirect</SelectItem></SelectContent></Select></div><div className="flex items-center justify-between pt-1"><Label className="text-sm">Published</Label><Switch checked={published} onCheckedChange={setPublished} /></div></div></section>
          {isRedirect && <section className="border-t pt-4"><Label className="text-sm font-semibold">Redirect destination</Label><Input className="mt-2" value={redirectUrl} onChange={(event) => setRedirectUrl(event.target.value)} placeholder="https://…" /></section>}
          {isBlog && <section className="border-t pt-4"><h2 className="font-semibold text-sm flex items-center gap-2"><PenLine className="w-4 h-4 text-teal-600" /> Blog metadata</h2><div className="space-y-2 mt-3"><div><Label className="text-xs">Excerpt</Label><Textarea rows={3} value={blogExcerpt} onChange={(event) => setBlogExcerpt(event.target.value)} /></div><div><Label className="text-xs">Author</Label><Input value={blogAuthor} onChange={(event) => setBlogAuthor(event.target.value)} /></div><div><Label className="text-xs">Category</Label><Input value={blogCategory} onChange={(event) => setBlogCategory(event.target.value)} /></div><div><Label className="text-xs">Publication date</Label><Input type="datetime-local" value={blogPublishedAt} onChange={(event) => setBlogPublishedAt(event.target.value)} /></div></div></section>}
          <section className="border-t pt-4"><h2 className="font-semibold text-sm">SEO</h2><div className="space-y-2 mt-3"><div><Label className="text-xs">SEO title</Label><Input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} /></div><div><Label className="text-xs">Meta description</Label><Textarea rows={3} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} /></div><div><Label className="text-xs">Open Graph image URL</Label><Input value={seoImage} onChange={(event) => setSeoImage(event.target.value)} /></div></div></section>
          {selectedBlock && <section className="border-t pt-4"><h2 className="font-semibold text-sm">Selected block</h2><div className="mt-3"><BlockSettings block={selectedBlock} onChange={(data) => setBlocks((items) => items.map((block) => block.id === selectedBlock.id ? { ...block, data } : block))} /></div></section>}
          <section className="border-t pt-4"><a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-teal-700"><Globe2 className="w-3.5 h-3.5" /> Open .net preview</a><p className="text-xs text-slate-500 mt-2">This path is retained when the tenant is promoted to {tenant.promotionHost}.</p></section>
        </aside>
      </div>
    </div>
  );
}
