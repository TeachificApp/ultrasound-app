import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
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
import { ArrowLeft, ChevronDown, Eye, FileText, Globe2, Layers3, LockKeyhole, PenLine, Save, Send, ShieldCheck, Sparkles } from "lucide-react";
import { resolveToolBrand } from "@/lib/brandToolPresentation";
import { getPublicSiteTenantForBrand, type PublicSiteTenantKey } from "@shared/publicSiteTenants";
import { BlogSidebarBlockEditor } from "@/components/public-site/BlogSidebarBlockEditor";

type ColumnSide = "left" | "right";
type BlockLocation =
  | { kind: "root"; index: number }
  | { kind: "column"; parentId: string; side: ColumnSide; index: number };

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

function cloneBlockWithFreshIds(block: Block, depth = 0): Block {
  const data = { ...block.data };
  if (block.type === "column_layout" && depth < 4) {
    data.leftBlocks = (Array.isArray(data.leftBlocks) ? data.leftBlocks : []).map((child: Block) => cloneBlockWithFreshIds(child, depth + 1));
    data.rightBlocks = (Array.isArray(data.rightBlocks) ? data.rightBlocks : []).map((child: Block) => cloneBlockWithFreshIds(child, depth + 1));
  }
  return { ...block, id: uid(), data };
}

function findBlockLocation(blocks: Block[], id: string): BlockLocation | null {
  const rootIndex = blocks.findIndex((block) => block.id === id);
  if (rootIndex >= 0) return { kind: "root", index: rootIndex };
  for (const parent of blocks) {
    if (parent.type !== "column_layout") continue;
    for (const side of ["left", "right"] as const) {
      const children: Block[] = parent.data?.[side === "left" ? "leftBlocks" : "rightBlocks"] ?? [];
      const index = children.findIndex((block) => block.id === id);
      if (index >= 0) return { kind: "column", parentId: parent.id, side, index };
    }
  }
  return null;
}

function findBlock(blocks: Block[], id: string | null): Block | null {
  if (!id) return null;
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.type === "column_layout") {
      const nested = [...(block.data?.leftBlocks ?? []), ...(block.data?.rightBlocks ?? [])].find((child: Block) => child.id === id);
      if (nested) return nested;
    }
  }
  return null;
}

function updateNestedBlock(blocks: Block[], id: string, updater: (block: Block) => Block): Block[] {
  return blocks.map((block) => {
    if (block.id === id) return updater(block);
    if (block.type !== "column_layout") return block;
    const rewrite = (children: Block[]) => children.map((child) => child.id === id ? updater(child) : child);
    return {
      ...block,
      data: {
        ...block.data,
        leftBlocks: rewrite(block.data?.leftBlocks ?? []),
        rightBlocks: rewrite(block.data?.rightBlocks ?? []),
      },
    };
  });
}

function SettingsSection({ title, icon, children, open = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; open?: boolean }) {
  return <details className="border-b border-slate-200 pb-3" open={open}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-semibold text-slate-800 marker:content-none">
      <span className="flex items-center gap-2">{icon}{title}</span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform [[open]_&]:rotate-180" />
    </summary>
    <div className="space-y-3 pt-2">{children}</div>
  </details>;
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
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Layout");
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [pageType, setPageType] = useState<"page" | "blog_post" | "redirect">("page");
  const [published, setPublished] = useState(false);
  const [parentId, setParentId] = useState<number | null>(null);
  const [hideInNavigation, setHideInNavigation] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "site_password" | "members_or_groups">("public");
  const [sitePassword, setSitePassword] = useState("");
  const [sitePasswordConfigured, setSitePasswordConfigured] = useState(false);
  const [clearSitePassword, setClearSitePassword] = useState(false);
  const [headerType, setHeaderType] = useState<"standard" | "splash" | "no_header">("standard");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [seoImage, setSeoImage] = useState("");
  const [hideFromSearch, setHideFromSearch] = useState(false);
  const [headerCode, setHeaderCode] = useState("");
  const [footerCode, setFooterCode] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [blogExcerpt, setBlogExcerpt] = useState("");
  const [blogAuthor, setBlogAuthor] = useState("");
  const [blogCategory, setBlogCategory] = useState("");
  const [blogPublishedAt, setBlogPublishedAt] = useState("");
  const [blogSidebarMode, setBlogSidebarMode] = useState<"inherit" | "override">("inherit");
  const [blogSidebarBlocks, setBlogSidebarBlocks] = useState<Block[]>([]);

  const { data: page, isLoading } = trpc.marketingSiteAdmin.getPage.useQuery({ id, tenantKey }, { enabled: Number.isFinite(id) });
  const { data: allPages = [] } = trpc.marketingSiteAdmin.listPages.useQuery({ tenantKey, type: "all", limit: 500 });
  const save = trpc.marketingSiteAdmin.savePage.useMutation({
    onSuccess: () => toast.success("Page saved"),
    onError: (error) => toast.error(error.message),
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const selectedBlock = useMemo(() => findBlock(blocks, selectedId), [blocks, selectedId]);
  const parentOptions = useMemo(() => allPages.filter((candidate) => candidate.id !== id && candidate.pageType === "page"), [allPages, id]);

  useEffect(() => {
    if (!page || loadedId === page.id) return;
    try { setBlocks(page.blocks ? JSON.parse(page.blocks) : []); } catch { setBlocks([]); }
    setTitle(page.title ?? ""); setPath(page.path ?? ""); setPageType(page.pageType ?? "page"); setPublished(page.isPublished);
    setParentId(page.parentId ?? null); setHideInNavigation(page.hideInNavigation ?? false); setVisibility(page.visibility ?? "public");
    setSitePasswordConfigured(Boolean(page.sitePasswordConfigured)); setSitePassword(""); setClearSitePassword(false);
    setHeaderType(page.headerType ?? "standard"); setSeoTitle(page.seoTitle ?? ""); setSeoDescription(page.seoDescription ?? "");
    setSeoKeywords(page.seoKeywords ?? ""); setSeoImage(page.seoImage ?? ""); setHideFromSearch(page.hideFromSearch ?? false);
    setHeaderCode(page.headerCode ?? ""); setFooterCode(page.footerCode ?? ""); setRedirectUrl(page.redirectUrl ?? "");
    setBlogExcerpt(page.blogExcerpt ?? ""); setBlogAuthor(page.blogAuthor ?? ""); setBlogCategory(page.blogCategory ?? "");
    setBlogPublishedAt(toDateInput(page.blogPublishedAt)); setBlogSidebarMode(page.blogSidebarMode ?? "inherit");
    try { setBlogSidebarBlocks(page.blogSidebarBlocks ? JSON.parse(page.blogSidebarBlocks) : []); } catch { setBlogSidebarBlocks([]); }
    setLoadedId(page.id);
  }, [page, loadedId]);

  const savePage = async (publishOverride?: boolean) => {
    if (!title.trim() || !path.trim()) { toast.error("A title and URL path are required."); return; }
    if (visibility === "site_password" && !sitePasswordConfigured && !sitePassword.trim()) { toast.error("Create a page password before enabling password protection."); return; }
    await save.mutateAsync({
      id, tenantKey, title: title.trim(), path: path.trim(), pageType, blocks: JSON.stringify(blocks),
      parentId: pageType === "page" ? parentId : null, hideInNavigation: pageType === "page" ? hideInNavigation : true,
      visibility, sitePassword: clearSitePassword ? null : (sitePassword.trim() ? sitePassword : undefined), headerType,
      seoTitle: seoTitle.trim() || null, seoDescription: seoDescription.trim() || null, seoKeywords: seoKeywords.trim() || null,
      seoImage: seoImage.trim() || null, hideFromSearch, headerCode: headerCode || null, footerCode: footerCode || null,
      redirectUrl: pageType === "redirect" ? redirectUrl.trim() || null : null,
      blogExcerpt: pageType === "blog_post" ? blogExcerpt.trim() || null : null,
      blogAuthor: pageType === "blog_post" ? blogAuthor.trim() || null : null,
      blogCategory: pageType === "blog_post" ? blogCategory.trim() || null : null,
      blogPublishedAt: pageType === "blog_post" && blogPublishedAt ? new Date(blogPublishedAt) : null,
      blogSidebarMode: pageType === "blog_post" ? blogSidebarMode : "inherit",
      blogSidebarBlocks: pageType === "blog_post" && blogSidebarMode === "override" ? JSON.stringify(blogSidebarBlocks) : null,
      isPublished: publishOverride ?? published,
    });
    if (sitePassword.trim()) { setSitePasswordConfigured(true); setSitePassword(""); }
    if (clearSitePassword) { setSitePasswordConfigured(false); setClearSitePassword(false); }
    if (publishOverride !== undefined) setPublished(publishOverride);
  };

  const addBlock = (type: BlockType) => {
    const definition = BLOCK_CATALOG.find((item) => item.type === type);
    if (!definition) return;
    const block: Block = { id: uid(), type, data: { ...definition.defaultData } };
    setBlocks((items) => [...items, block]); setSelectedId(block.id);
  };

  const addBlockToColumn = (parentBlockId: string, side: ColumnSide, newBlock: Block) => {
    setBlocks((items) => items.map((item) => {
      if (item.id !== parentBlockId) return item;
      const key = side === "left" ? "leftBlocks" : "rightBlocks";
      return { ...item, data: { ...item.data, [key]: [...(item.data[key] ?? []), newBlock] } };
    }));
    setSelectedId(newBlock.id);
  };

  const removeChild = (parentBlockId: string, side: ColumnSide, childId: string, extract = false) => {
    setBlocks((items) => {
      let moved: Block | undefined;
      const next = items.map((item) => {
        if (item.id !== parentBlockId) return item;
        const key = side === "left" ? "leftBlocks" : "rightBlocks";
        const children: Block[] = item.data[key] ?? [];
        moved = children.find((child) => child.id === childId);
        return { ...item, data: { ...item.data, [key]: children.filter((child) => child.id !== childId) } };
      });
      if (!extract || !moved) return next;
      const parentIndex = next.findIndex((item) => item.id === parentBlockId);
      return [...next.slice(0, parentIndex + 1), moved, ...next.slice(parentIndex + 1)];
    });
    if (!extract && selectedId === childId) setSelectedId(null);
  };

  const onDragStart = (event: DragStartEvent) => setActiveDragId(String(event.active.id));
  const onDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    if (!event.over || event.active.id === event.over.id) return;
    const activeId = String(event.active.id); const overId = String(event.over.id);
    setBlocks((items) => {
      const source = findBlockLocation(items, activeId);
      if (!source) return items;
      const activeBlock = findBlock(items, activeId);
      if (!activeBlock) return items;
      let target: BlockLocation | null = null;
      if (overId.startsWith("col:")) {
        const [, parentId, side] = overId.split(":");
        const parent = items.find((item) => item.id === parentId);
        if (!parent || parent.type !== "column_layout" || activeBlock.type === "column_layout") return items;
        target = { kind: "column", parentId, side: side as ColumnSide, index: (parent.data[side === "left" ? "leftBlocks" : "rightBlocks"] ?? []).length };
      } else {
        const over = findBlockLocation(items, overId);
        if (!over) return items;
        target = over;
      }
      if (source.kind === "column" && target.kind === "column" && source.parentId === target.parentId && source.side === target.side && source.index === target.index) return items;
      if (activeBlock.type === "column_layout" && target.kind === "column") return items;

      let next = [...items];
      if (source.kind === "root") next.splice(source.index, 1);
      else next = next.map((item) => item.id !== source.parentId ? item : {
        ...item, data: { ...item.data, [source.side === "left" ? "leftBlocks" : "rightBlocks"]: (item.data[source.side === "left" ? "leftBlocks" : "rightBlocks"] ?? []).filter((child: Block) => child.id !== activeId) },
      });

      if (target.kind === "root") {
        let index = target.index;
        if (source.kind === "root" && source.index < index) index -= 1;
        next.splice(index, 0, activeBlock);
        return next;
      }
      return next.map((item) => {
        if (item.id !== target!.parentId) return item;
        const key = target!.side === "left" ? "leftBlocks" : "rightBlocks";
        const children: Block[] = [...(item.data[key] ?? [])];
        let index = target!.index;
        if (source.kind === "column" && source.parentId === target!.parentId && source.side === target!.side && source.index < index) index -= 1;
        children.splice(index, 0, activeBlock);
        return { ...item, data: { ...item.data, [key]: children } };
      });
    });
  }, []);

  if (isLoading || !page) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  const previewUrl = `https://${tenant.currentHost}${path === "/" ? "" : path}`;
  const isBlog = pageType === "blog_post"; const isRedirect = pageType === "redirect";
  const sortableIds = [
    ...blocks.map((block) => block.id),
    ...blocks.flatMap((block) => block.type === "column_layout" ? [...(block.data?.leftBlocks ?? []), ...(block.data?.rightBlocks ?? [])].map((child: Block) => child.id) : []),
  ];

  return <div className="min-h-screen bg-slate-100 flex flex-col">
    <header className="h-16 shrink-0 bg-white border-b px-4 flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3"><Button size="sm" variant="ghost" onClick={() => navigate(adminRoot(brand))}><ArrowLeft className="w-4 h-4 mr-1" /> Pages</Button><div className="min-w-0"><p className="font-semibold text-sm truncate">{title || "Untitled page"}</p><p className="font-mono text-xs text-slate-500 truncate">{tenant.currentHost}{path}</p></div></div>
      <div className="flex items-center gap-2"><a href={previewUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Eye className="w-4 h-4 mr-1" /> Preview</Button></a><Button size="sm" variant="outline" disabled={save.isPending} onClick={() => void savePage()}><Save className="w-4 h-4 mr-1" /> Save</Button><Button size="sm" disabled={save.isPending} onClick={() => void savePage(!published)} className={published ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700"}>{published ? "Unpublish" : <><Send className="w-4 h-4 mr-1" /> Publish</>}</Button></div>
    </header>

    <div className="flex-1 min-h-0 flex">
      <aside className="w-56 shrink-0 bg-white border-r overflow-y-auto p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2"><Layers3 className="w-4 h-4 text-teal-600" /> Build</div>
        <p className="text-[11px] leading-relaxed text-slate-500 mb-3">Drag blocks onto the page or add modules inside a Columns block.</p>
        <div className="space-y-1">{CATALOG_CATEGORIES.map((category) => <button type="button" key={category} onClick={() => setActiveCategory(category)} className={`w-full text-left px-2 py-1.5 rounded text-xs ${activeCategory === category ? "bg-teal-100 text-teal-900 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>{category}</button>)}</div>
        <div className="mt-3 space-y-1">{BLOCK_CATALOG.filter((item) => item.category === activeCategory).map((item) => <button type="button" key={item.type} onClick={() => addBlock(item.type)} className="w-full text-left border border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50 rounded px-2 py-2 text-xs text-slate-700">+ {item.label}</button>)}</div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-7">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="max-w-5xl min-h-[540px] mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
              {blocks.length === 0 ? <div className="m-5 py-24 border-2 border-dashed rounded-lg text-center text-slate-400"><FileText className="w-7 h-7 mx-auto mb-2" />Add blocks from the left to compose this page.</div> : blocks.map((block, index) => <SortableBlock key={block.id} block={block} isSelected={block.id === selectedId} onSelect={() => setSelectedId(block.id)} onSelectChild={(child) => setSelectedId(child.id)} selectedChildId={selectedId} activeDragId={activeDragId}
                onDelete={() => { setBlocks((items) => items.filter((item) => item.id !== block.id)); if (selectedId === block.id) setSelectedId(null); }}
                onDuplicate={() => { const copy = cloneBlockWithFreshIds(block); setBlocks((items) => [...items.slice(0, index + 1), copy, ...items.slice(index + 1)]); setSelectedId(copy.id); }}
                onMoveUp={index > 0 ? () => setBlocks((items) => arrayMove(items, index, index - 1)) : undefined}
                onMoveDown={index < blocks.length - 1 ? () => setBlocks((items) => arrayMove(items, index, index + 1)) : undefined}
                onMoveBlockOutOfColumn={(parent, side, child) => removeChild(parent, side, child, true)}
                onAddBlockToColumn={addBlockToColumn}
                onMoveChildToOtherColumn={(parent, fromSide, childId) => setBlocks((items) => items.map((item) => { if (item.id !== parent) return item; const fromKey = fromSide === "left" ? "leftBlocks" : "rightBlocks"; const toKey = fromSide === "left" ? "rightBlocks" : "leftBlocks"; const child = (item.data[fromKey] ?? []).find((entry: Block) => entry.id === childId); return child ? { ...item, data: { ...item.data, [fromKey]: (item.data[fromKey] ?? []).filter((entry: Block) => entry.id !== childId), [toKey]: [...(item.data[toKey] ?? []), child] } } : item; }))}
                onDeleteChildFromColumn={(parent, side, child) => removeChild(parent, side, child, false)}
                onReorderChildInColumn={(parent, side, child, direction) => setBlocks((items) => items.map((item) => { if (item.id !== parent) return item; const key = side === "left" ? "leftBlocks" : "rightBlocks"; const children: Block[] = [...(item.data[key] ?? [])]; const childIndex = children.findIndex((entry) => entry.id === child); const nextIndex = direction === "up" ? childIndex - 1 : childIndex + 1; return childIndex >= 0 && nextIndex >= 0 && nextIndex < children.length ? { ...item, data: { ...item.data, [key]: arrayMove(children, childIndex, nextIndex) } } : item; }))} />)}
            </div>
          </SortableContext>
        </DndContext>
      </main>

      <aside className="w-[350px] shrink-0 bg-white border-l overflow-y-auto p-4 space-y-1">
        <div className="mb-2"><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Settings</p><p className="text-xs text-slate-500 mt-1">Expand a section to control this page.</p></div>
        <SettingsSection title="Page" icon={<Globe2 className="w-4 h-4 text-teal-600" />} open>
          <div><Label className="text-xs">Title</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div>
          <div><Label className="text-xs">URL path / permalink</Label><Input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/about" /></div>
          <div><Label className="text-xs">Content type</Label><Select value={pageType} onValueChange={(value) => setPageType(value as typeof pageType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="page">Website page</SelectItem><SelectItem value="blog_post">Blog post</SelectItem><SelectItem value="redirect">Redirect</SelectItem></SelectContent></Select></div>
          {pageType === "page" && <><div><Label className="text-xs">Parent folder / page</Label><Select value={parentId ? String(parentId) : "root"} onValueChange={(value) => setParentId(value === "root" ? null : Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="root">Top-level page</SelectItem>{parentOptions.map((candidate) => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.title || candidate.path}</SelectItem>)}</SelectContent></Select></div><div className="flex items-center justify-between gap-3"><div><Label className="text-sm">Hide in navigation</Label><p className="text-xs text-slate-500">Keeps its direct link live.</p></div><Switch checked={hideInNavigation} onCheckedChange={setHideInNavigation} /></div></>}
          <div><Label className="text-xs">Header format</Label><Select value={headerType} onValueChange={(value) => setHeaderType(value as typeof headerType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard site header</SelectItem><SelectItem value="splash">Splash header</SelectItem><SelectItem value="no_header">No header</SelectItem></SelectContent></Select></div>
          <div className="flex items-center justify-between pt-1"><Label className="text-sm">Published</Label><Switch checked={published} onCheckedChange={setPublished} /></div>
        </SettingsSection>

        <SettingsSection title="Visibility" icon={<LockKeyhole className="w-4 h-4 text-teal-600" />}>
          <Select value={visibility} onValueChange={(value) => setVisibility(value as typeof visibility)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public — everyone can view</SelectItem><SelectItem value="site_password">Site password — password required</SelectItem><SelectItem value="members_or_groups">Signed-in members — sign-in required</SelectItem></SelectContent></Select>
          {visibility === "site_password" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2"><p className="text-xs text-amber-900">{sitePasswordConfigured ? "A secure password is already set. Enter a new one only to replace it." : "Enter a password of at least 8 characters. It is hashed on the server and never returned."}</p><Input type="password" value={sitePassword} onChange={(event) => { setSitePassword(event.target.value); setClearSitePassword(false); }} placeholder={sitePasswordConfigured ? "Replace password (optional)" : "Set password"} />{sitePasswordConfigured && <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={clearSitePassword} onChange={(event) => { setClearSitePassword(event.target.checked); if (event.target.checked) setSitePassword(""); }} /> Clear saved password</label>}</div>}
          {visibility === "members_or_groups" && <p className="rounded-lg bg-teal-50 p-3 text-xs text-teal-900">This release requires a signed-in platform member. It does not claim or infer group-specific access until a real site-group entitlement is configured.</p>}
        </SettingsSection>

        <SettingsSection title="SEO" icon={<Sparkles className="w-4 h-4 text-teal-600" />}>
          <div><Label className="text-xs">SEO title</Label><Input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} /></div><div><Label className="text-xs">Meta description</Label><Textarea rows={3} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} /></div><div><Label className="text-xs">Keywords</Label><Input value={seoKeywords} onChange={(event) => setSeoKeywords(event.target.value)} placeholder="ultrasound, clinical education" /></div><div><Label className="text-xs">Open Graph image URL</Label><Input value={seoImage} onChange={(event) => setSeoImage(event.target.value)} /></div><div className="flex items-center justify-between gap-3"><div><Label className="text-sm">Hide from search</Label><p className="text-xs text-slate-500">Sends noindex to crawlers.</p></div><Switch checked={hideFromSearch} onCheckedChange={setHideFromSearch} /></div>
        </SettingsSection>

        <SettingsSection title="Advanced code" icon={<ShieldCheck className="w-4 h-4 text-teal-600" />}>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Platform Admin use only. Header and footer HTML is included only for public pages; verify external scripts for privacy, accessibility, and security before publishing.</p><div><Label className="text-xs">Header HTML</Label><Textarea rows={4} value={headerCode} onChange={(event) => setHeaderCode(event.target.value)} placeholder="Optional approved tracking or markup" /></div><div><Label className="text-xs">Footer HTML</Label><Textarea rows={4} value={footerCode} onChange={(event) => setFooterCode(event.target.value)} placeholder="Optional approved tracking or markup" /></div>
        </SettingsSection>

        {isRedirect && <SettingsSection title="Redirect" icon={<ArrowLeft className="w-4 h-4 text-teal-600" />} open><div><Label className="text-xs">Redirect destination</Label><Input value={redirectUrl} onChange={(event) => setRedirectUrl(event.target.value)} placeholder="https://…" /></div></SettingsSection>}
        {isBlog && <SettingsSection title="Blog metadata" icon={<PenLine className="w-4 h-4 text-teal-600" />}><div><Label className="text-xs">Excerpt</Label><Textarea rows={3} value={blogExcerpt} onChange={(event) => setBlogExcerpt(event.target.value)} /></div><div><Label className="text-xs">Author</Label><Input value={blogAuthor} onChange={(event) => setBlogAuthor(event.target.value)} /></div><div><Label className="text-xs">Category</Label><Input value={blogCategory} onChange={(event) => setBlogCategory(event.target.value)} /></div><div><Label className="text-xs">Publication date</Label><Input type="datetime-local" value={blogPublishedAt} onChange={(event) => setBlogPublishedAt(event.target.value)} /></div><div><Label className="text-xs">Article sidebar</Label><Select value={blogSidebarMode} onValueChange={(value) => setBlogSidebarMode(value as "inherit" | "override")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Use brand blog sidebar</SelectItem><SelectItem value="override">Use this article’s sidebar</SelectItem></SelectContent></Select></div></SettingsSection>}
        {selectedBlock && <SettingsSection title={`Selected block: ${BLOCK_CATALOG.find((item) => item.type === selectedBlock.type)?.label ?? selectedBlock.type}`} icon={<Layers3 className="w-4 h-4 text-teal-600" />} open><BlockSettings block={selectedBlock} onChange={(data) => setBlocks((items) => updateNestedBlock(items, selectedBlock.id, (block) => ({ ...block, data })))} /></SettingsSection>}
        <section className="pt-3"><a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-teal-700"><Globe2 className="w-3.5 h-3.5" /> Open .net preview</a><p className="text-xs text-slate-500 mt-2">This path is retained when the tenant is promoted to {tenant.promotionHost}.</p></section>
      </aside>
    </div>
    {isBlog && blogSidebarMode === "override" && <div className="border-t bg-slate-50 px-4 py-5"><div className="max-w-6xl mx-auto"><BlogSidebarBlockEditor label="Article-specific sidebar" description="Replace the brand’s normal archive, recent-post, and promotional sidebar blocks only for this article." blocks={blogSidebarBlocks} onChange={setBlogSidebarBlocks} /></div></div>}
  </div>;
}
