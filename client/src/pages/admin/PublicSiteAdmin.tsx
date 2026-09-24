import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { DndContext, PointerSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { buildPublicSitePageTree, flattenPublicSitePageTree } from "@shared/publicSitePageTree";
import { Eye, EyeOff, ExternalLink, FilePlus2, FolderPlus, Globe2, GripVertical, KeyRound, Loader2, LockKeyhole, PanelRightOpen, RefreshCw, Rss, Search, Settings2, ShieldCheck, Upload } from "lucide-react";
import { resolveToolBrand } from "@/lib/brandToolPresentation";
import { getPublicSiteTenantForBrand, type PublicSiteTenantKey } from "@shared/publicSiteTenants";
import { type Block } from "@/components/BlockPreview";
import { BlogSidebarBlockEditor } from "@/components/public-site/BlogSidebarBlockEditor";

function adminRoot(brand: "aaus" | "iheartecho") { return `/admin/public-site-${brand === "iheartecho" ? "ihe" : "aaus"}`; }
function editorPath(brand: "aaus" | "iheartecho", pageId: number) { return `/admin/public-site/page/${pageId}/edit-${brand === "iheartecho" ? "ihe" : "aaus"}`; }

type PageRow = { id: number; parentId: number | null; path: string; title: string | null; pageType: "page" | "blog_post" | "redirect"; isPublished: boolean; hideInNavigation: boolean; visibility: "public" | "site_password" | "members_or_groups"; headerType: "standard" | "splash" | "no_header"; hideFromSearch: boolean; sortOrder: number; importStatus: string; sourceUrl: string | null; blogPublishedAt: Date | null; updatedAt: Date | null };

function TreeRow({ node, brand, onCreateChild }: { node: any; brand: "aaus" | "iheartecho"; onCreateChild: (page: PageRow) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `page:${node.id}` });
  const { setNodeRef: setNestRef, isOver } = useDroppable({ id: `nest:${node.id}` });
  const page = node as PageRow & { children: any[]; depth: number };
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return <div ref={setNodeRef} style={style} className="select-none">
    <div className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-teal-100 hover:bg-teal-50" style={{ marginLeft: `${page.depth * 18}px` }}>
      <button type="button" {...attributes} {...listeners} className="shrink-0 cursor-grab rounded p-1 text-slate-400 hover:bg-white hover:text-teal-700 active:cursor-grabbing" aria-label={`Drag ${page.title || page.path}`}><GripVertical className="h-4 w-4" /></button>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{page.title || page.path}</p><p className="truncate font-mono text-[11px] text-teal-700">{page.path}</p></div>
      <div className="hidden items-center gap-1 group-hover:flex">{page.hideInNavigation && <span title="Hidden in navigation"><EyeOff className="h-3.5 w-3.5 text-slate-400" /></span>}{page.visibility === "site_password" && <span title="Password protected"><KeyRound className="h-3.5 w-3.5 text-amber-600" /></span>}{page.visibility === "members_or_groups" && <span title="Signed-in members"><LockKeyhole className="h-3.5 w-3.5 text-teal-600" /></span>}</div>
      <Link href={editorPath(brand, page.id)}><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Edit</Button></Link>
      <Button size="sm" variant="ghost" className="h-7 px-1.5 text-xs" onClick={() => onCreateChild(page)} title="Add subpage"><FolderPlus className="h-3.5 w-3.5" /></Button>
    </div>
    <div ref={setNestRef} className={`ml-8 mr-2 h-1 rounded transition-colors ${isOver ? "bg-teal-500 h-6 border border-dashed border-teal-500 bg-teal-50" : "bg-transparent group-hover:bg-teal-100"}`} aria-label={`Drop to nest inside ${page.title || page.path}`}>
      {isOver && <span className="block px-2 py-1 text-xs font-medium text-teal-800">Drop to make a subpage of {page.title || page.path}</span>}
    </div>
    {page.children.map((child: any) => <TreeRow key={child.id} node={child} brand={brand} onCreateChild={onCreateChild} />)}
  </div>;
}

function RootDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "root-pages" });
  return <div ref={setNodeRef} className={`rounded-xl transition-colors ${isOver ? "bg-teal-50 ring-2 ring-teal-400 ring-offset-2" : ""}`}>{children}{isOver && <div className="m-2 rounded-lg border border-dashed border-teal-400 px-3 py-2 text-xs font-semibold text-teal-800">Drop as a top-level page</div>}</div>;
}

export default function PublicSiteAdmin() {
  const [, navigate] = useLocation();
  const brand = resolveToolBrand(window.location.pathname, window.location.hostname) === "iheartecho" ? "iheartecho" : "aaus";
  const tenant = getPublicSiteTenantForBrand(brand)!;
  const tenantKey = tenant.key as PublicSiteTenantKey;
  const [tab, setTab] = useState<"pages" | "blog" | "settings">("pages");
  const [search, setSearch] = useState("");
  const [bulkScope, setBulkScope] = useState<"all" | "pages" | "blog">("all");
  const [bulkLimit, setBulkLimit] = useState(25);
  const [reimportExisting, setReimportExisting] = useState(false);
  const [importUrl, setImportUrl] = useState(`${tenant.sourceOrigin}/`);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newParentId, setNewParentId] = useState<number | null>(null);
  const [blogSidebarOpen, setBlogSidebarOpen] = useState(false);
  const [blogSidebarBlocks, setBlogSidebarBlocks] = useState<Block[]>([]);
  const [sidebarHydratedFor, setSidebarHydratedFor] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { data: status, refetch: refetchStatus } = trpc.marketingSiteAdmin.getImportStatus.useQuery({ tenantKey });
  const { data: websitePages = [], refetch: refetchWebsitePages, isLoading: websitePagesLoading } = trpc.marketingSiteAdmin.listPages.useQuery({ tenantKey, type: "page", search: search || undefined, limit: 500 });
  const { data: blogPosts = [], refetch: refetchBlogPosts, isLoading: blogsLoading } = trpc.marketingSiteAdmin.listPages.useQuery({ tenantKey, type: "blog", search: search || undefined, limit: 500 });
  const savePageTree = trpc.marketingSiteAdmin.savePageTree.useMutation({ onError: (error) => toast.error(error.message) });
  const saveBlogSidebar = trpc.marketingSiteAdmin.saveBlogSidebar.useMutation({ onSuccess: () => { toast.success("Brand blog sidebar saved."); setBlogSidebarOpen(false); setSidebarHydratedFor(null); void refetchStatus(); }, onError: (error) => toast.error(error.message) });

  useEffect(() => {
    if (!status || sidebarHydratedFor === tenantKey) return;
    try { setBlogSidebarBlocks(status.settings?.blogSidebarBlocks ? JSON.parse(status.settings.blogSidebarBlocks) : []); } catch { setBlogSidebarBlocks([]); }
    setSidebarHydratedFor(tenantKey);
  }, [status, sidebarHydratedFor, tenantKey]);

  const refresh = () => { void refetchStatus(); void refetchWebsitePages(); void refetchBlogPosts(); };
  const importOne = trpc.marketingSiteAdmin.importUrl.useMutation({ onSuccess: (result) => { toast.success(result.status === "imported" ? `Imported ${result.path}` : `Import ${result.status}`); refresh(); }, onError: (error) => toast.error(error.message) });
  const bulkImport = trpc.marketingSiteAdmin.runBulkImport.useMutation({ onSuccess: (result) => { const imported = result.results.filter((item) => item.status === "imported").length; const failed = result.results.filter((item) => item.status === "failed").length; toast.success(`Imported ${imported} of ${result.total} source URLs${failed ? `; ${failed} need review` : ""}.`); refresh(); }, onError: (error) => toast.error(error.message) });
  const createPage = trpc.marketingSiteAdmin.createPage.useMutation({ onSuccess: (result) => { toast.success("Draft created in the visual editor."); setCreateOpen(false); navigate(editorPath(brand, result.id)); }, onError: (error) => toast.error(error.message) });

  const typedWebsitePages = websitePages as PageRow[];
  const pageTree = useMemo(() => buildPublicSitePageTree(typedWebsitePages), [typedWebsitePages]);
  const visibleTree = useMemo(() => search.trim() ? buildPublicSitePageTree(typedWebsitePages) : pageTree, [pageTree, search, typedWebsitePages]);
  const pageOrderIds = useMemo(() => flattenPublicSitePageTree(pageTree).map((page) => `page:${page.id}`), [pageTree]);

  const beginCreate = (parent?: PageRow) => {
    setNewTitle(""); setNewPath(tab === "blog" ? tenant.blogPathPrefix : ""); setNewParentId(parent?.id ?? null); setCreateOpen(true);
  };

  const persistMove = async (draggedId: number, destination: { parentId: number | null; afterId?: number }) => {
    const pageById = new Map(typedWebsitePages.map((page) => [page.id, page]));
    const parentById = new Map(typedWebsitePages.map((page) => [page.id, page.parentId && pageById.has(page.parentId) ? page.parentId : null]));
    parentById.set(draggedId, destination.parentId);
    const childrenOf = (parent: number | null) => typedWebsitePages.filter((page) => parentById.get(page.id) === parent && page.id !== draggedId).sort((a, b) => a.sortOrder - b.sortOrder).map((page) => page.id);
    const siblings = childrenOf(destination.parentId);
    const insertAt = destination.afterId ? Math.max(0, siblings.indexOf(destination.afterId) + 1) : siblings.length;
    siblings.splice(insertAt, 0, draggedId);
    const siblingOverride = new Map<string, number[]>(); siblingOverride.set(String(destination.parentId), siblings);
    const ordered: number[] = []; const visited = new Set<number>();
    const visit = (parent: number | null) => {
      const ids = siblingOverride.get(String(parent)) ?? childrenOf(parent);
      for (const childId of ids) { if (visited.has(childId)) continue; visited.add(childId); ordered.push(childId); visit(childId); }
    };
    visit(null);
    for (const page of typedWebsitePages) if (!visited.has(page.id)) { ordered.push(page.id); visit(page.id); }
    await savePageTree.mutateAsync({ tenantKey, placements: ordered.map((pageId, sortOrder) => ({ id: pageId, parentId: parentById.get(pageId) ?? null, sortOrder })) });
    toast.success("Page order saved."); void refetchWebsitePages();
  };

  const onPageTreeDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const draggedId = Number(String(event.active.id).replace(/^page:/, ""));
    if (!Number.isFinite(draggedId)) return;
    const over = String(event.over.id);
    if (over === "root-pages") { void persistMove(draggedId, { parentId: null }); return; }
    if (over.startsWith("nest:")) { const parentId = Number(over.replace(/^nest:/, "")); if (parentId !== draggedId) void persistMove(draggedId, { parentId }); return; }
    if (over.startsWith("page:")) { const targetId = Number(over.replace(/^page:/, "")); const target = typedWebsitePages.find((page) => page.id === targetId); if (target && target.id !== draggedId) void persistMove(draggedId, { parentId: target.parentId, afterId: target.id }); }
  };

  const runBulk = () => bulkImport.mutate({ tenantKey, scope: bulkScope, limit: bulkLimit, reimportExisting });
  const counters = { pages: typedWebsitePages.length, blogs: blogPosts.length };

  return <div className="min-h-screen bg-slate-50"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700"><Globe2 className="w-4 h-4" /> Per-brand public website tools</div><h1 className="text-3xl font-bold text-slate-950 mt-1">{tenant.siteName} website &amp; blog</h1><p className="max-w-3xl text-sm text-slate-600 mt-2">Use the Weebly-style Pages tree to organize and order your website. Each page opens in a visual Build editor with its own page, visibility, SEO, and advanced settings.</p></div><a href={`https://${tenant.currentHost}`} target="_blank" rel="noreferrer"><Button variant="outline" className="gap-2"><ExternalLink className="w-4 h-4" /> View public site</Button></a></div>
    <Card className="border-amber-200 bg-amber-50/70"><CardContent className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm"><div><strong className="text-amber-950">Promotion-safe architecture.</strong> <span className="text-amber-900">The .net tenant is noindex while it is reviewed. When DNS moves to .com, this same tenant becomes self-canonical, retains every URL, and produces its .com sitemap.</span></div><Badge variant="outline" className="border-amber-400 text-amber-800">.net now → .com later</Badge></CardContent></Card>
    <div className="grid sm:grid-cols-3 gap-4"><Card><CardContent className="p-4"><p className="text-xs text-slate-500">Imported public records</p><p className="text-2xl font-bold">{status?.totalPages ?? 0}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-slate-500">Website pages</p><p className="text-2xl font-bold">{counters.pages}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-slate-500">Last source import</p><p className="text-sm font-semibold mt-1">{status?.settings?.lastImportAt ? new Date(status.settings.lastImportAt).toLocaleString() : "Not imported yet"}</p></CardContent></Card></div>

    <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}><div className="flex flex-wrap items-center justify-between gap-3"><TabsList><TabsTrigger value="pages" className="gap-2"><Globe2 className="w-3.5 h-3.5" /> Pages</TabsTrigger><TabsTrigger value="blog" className="gap-2"><Rss className="w-3.5 h-3.5" /> Blog</TabsTrigger><TabsTrigger value="settings" className="gap-2"><Settings2 className="w-3.5 h-3.5" /> Site setup</TabsTrigger></TabsList><div className="flex flex-wrap gap-2"><div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9 w-56" placeholder="Search path" /></div>{tab === "blog" && <Button variant="outline" onClick={() => setBlogSidebarOpen(true)} className="gap-2"><PanelRightOpen className="w-4 h-4" /> Blog sidebar</Button>}{tab !== "settings" && <Button onClick={() => beginCreate()} className="gap-2"><FilePlus2 className="w-4 h-4" /> New {tab === "blog" ? "post" : "page"}</Button>}</div></div></Tabs>

    {tab === "pages" && <Card><CardHeader className="pb-3"><CardTitle className="text-base">Website page tree</CardTitle><p className="text-sm text-slate-600">Drag a page onto the line below another page to make it a subpage. Drop onto a page to place it after that page at the same level. Hidden, password, and member-only indicators remain visible to editors.</p></CardHeader><CardContent>{websitePagesLoading ? <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : typedWebsitePages.length === 0 ? <div className="py-12 text-center text-slate-500">No website pages yet. Import the source sitemap or create an editable draft.</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPageTreeDragEnd}><SortableContext items={pageOrderIds} strategy={verticalListSortingStrategy}><RootDropZone>{visibleTree.map((node) => <TreeRow key={node.id} node={node} brand={brand} onCreateChild={beginCreate} />)}</RootDropZone></SortableContext></DndContext>}</CardContent></Card>}

    {tab === "blog" && <Card><CardHeader className="pb-3"><CardTitle className="text-base">Blog post editor</CardTitle></CardHeader><CardContent><div className="divide-y">{blogsLoading && <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>}{!blogsLoading && !blogPosts.length && <div className="py-12 text-center text-slate-500">No blog posts yet. Import the sitemap or create an editable draft.</div>}{(blogPosts as PageRow[]).map((page) => <div key={page.id} className="py-3 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="font-medium text-slate-900 truncate">{page.title || page.path}</p><p className="font-mono text-xs text-teal-700 truncate">{page.path}</p></div><div className="flex items-center gap-2"><Badge variant={page.isPublished ? "default" : "secondary"}>{page.isPublished ? "Published" : "Draft"}</Badge>{page.visibility !== "public" && <Badge variant="outline">{page.visibility === "site_password" ? "Password" : "Members"}</Badge>}<Link href={editorPath(brand, page.id)}><Button size="sm" variant="outline">Visual editor</Button></Link></div></div>)}</div></CardContent></Card>}

    {tab === "settings" && <><Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-teal-600" /> Site setup</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-slate-700"><p><strong>Review host:</strong> <a className="text-teal-700 underline" href={`https://${tenant.currentHost}`} target="_blank" rel="noreferrer">{tenant.currentHost}</a> remains noindex during review.</p><p><strong>Promotion host:</strong> {tenant.promotionHost} uses the same content, paths, page tree, and canonical URL plan when DNS is promoted.</p><p><strong>Navigation:</strong> the public navigation is generated from published website pages that are not hidden from navigation. Imported source navigation remains available as a fallback when no eligible page records exist.</p></CardContent></Card><Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4 text-teal-600" /> Controlled source import</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-600">Import creates editable copies only; it never changes the current public source site. Existing records are untouched unless “Refresh existing copies” is selected.</p><div className="flex flex-col lg:flex-row gap-2"><Input value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder={`${tenant.sourceOrigin}/page.html`} /><Button onClick={() => importOne.mutate({ tenantKey, url: importUrl, reimportExisting })} disabled={importOne.isPending} className="gap-2 whitespace-nowrap">{importOne.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import URL</Button></div><div className="border-t pt-4 flex flex-wrap items-end gap-3"><div><Label className="text-xs">Sitemap scope</Label><select className="block mt-1 h-9 rounded-md border bg-white px-3 text-sm" value={bulkScope} onChange={(event) => setBulkScope(event.target.value as typeof bulkScope)}><option value="all">Pages and blog</option><option value="pages">Pages only</option><option value="blog">Blog posts only</option></select></div><div><Label className="text-xs">Batch size</Label><Input className="mt-1 w-24" type="number" min={1} max={500} value={bulkLimit} onChange={(event) => setBulkLimit(Math.max(1, Number(event.target.value) || 25))} /></div><label className="flex items-center gap-2 text-sm pt-5"><Checkbox checked={reimportExisting} onCheckedChange={(checked) => setReimportExisting(checked === true)} /> Refresh existing copies</label><Button variant="secondary" onClick={runBulk} disabled={bulkImport.isPending} className="gap-2">{bulkImport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Run sitemap import</Button></div></CardContent></Card></>}
  </div>

  <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Create {tab === "blog" ? "a blog post" : "a website page"}</DialogTitle><DialogDescription>Drafts are private until published from the visual editor.</DialogDescription></DialogHeader><div className="space-y-3 py-2"><div><Label>Title</Label><Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={tab === "blog" ? "Article title" : "Page title"} /></div><div><Label>Path</Label><Input value={newPath} onChange={(event) => setNewPath(event.target.value)} placeholder={tab === "blog" ? `${tenant.blogPathPrefix}article-slug` : "/about"} /></div>{tab === "pages" && <div><Label>Parent folder / page</Label><select className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={newParentId ?? ""} onChange={(event) => setNewParentId(event.target.value ? Number(event.target.value) : null)}><option value="">Top-level page</option>{typedWebsitePages.map((page) => <option key={page.id} value={page.id}>{page.title || page.path}</option>)}</select></div>}</div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!newTitle.trim() || !newPath.trim() || createPage.isPending} onClick={() => createPage.mutate({ tenantKey, title: newTitle, path: newPath, pageType: tab === "blog" ? "blog_post" : "page", parentId: tab === "pages" ? newParentId : null })}>{createPage.isPending ? "Creating…" : "Create draft"}</Button></DialogFooter></DialogContent></Dialog>
  <Dialog open={blogSidebarOpen} onOpenChange={setBlogSidebarOpen}><DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto"><DialogHeader><DialogTitle>Brand blog sidebar</DialogTitle><DialogDescription>This block editor controls promotional content beside the archive and recent-post lists on every {tenant.siteName} blog page. Individual article editors may replace it when needed.</DialogDescription></DialogHeader><BlogSidebarBlockEditor label="Brand-wide sidebar content" description="Archive and recent-post navigation are always included. Add editable promos, images, calls to action, or other content below them." blocks={blogSidebarBlocks} onChange={setBlogSidebarBlocks} /><DialogFooter><Button variant="outline" onClick={() => setBlogSidebarOpen(false)}>Cancel</Button><Button disabled={saveBlogSidebar.isPending} onClick={() => saveBlogSidebar.mutate({ tenantKey, blocks: JSON.stringify(blogSidebarBlocks) })}>{saveBlogSidebar.isPending ? "Saving…" : "Save sidebar"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
