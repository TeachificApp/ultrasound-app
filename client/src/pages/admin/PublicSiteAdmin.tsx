import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
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
import { ExternalLink, FilePlus2, Globe2, Loader2, RefreshCw, Rss, Search, Sparkles, Upload } from "lucide-react";
import { resolveToolBrand } from "@/lib/brandToolPresentation";
import { getPublicSiteTenantForBrand, type PublicSiteTenantKey } from "@shared/publicSiteTenants";

function adminRoot(brand: "aaus" | "iheartecho") {
  return `/admin/public-site-${brand === "iheartecho" ? "ihe" : "aaus"}`;
}

function editorPath(brand: "aaus" | "iheartecho", pageId: number) {
  return `/admin/public-site/page/${pageId}/edit-${brand === "iheartecho" ? "ihe" : "aaus"}`;
}

export default function PublicSiteAdmin() {
  const [, navigate] = useLocation();
  const brand = resolveToolBrand(window.location.pathname, window.location.hostname) === "iheartecho" ? "iheartecho" : "aaus";
  const tenant = getPublicSiteTenantForBrand(brand)!;
  const tenantKey = tenant.key as PublicSiteTenantKey;
  const [tab, setTab] = useState<"pages" | "blog">("pages");
  const [search, setSearch] = useState("");
  const [bulkScope, setBulkScope] = useState<"all" | "pages" | "blog">("all");
  const [bulkLimit, setBulkLimit] = useState(25);
  const [reimportExisting, setReimportExisting] = useState(false);
  const [importUrl, setImportUrl] = useState(`${tenant.sourceOrigin}/`);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPath, setNewPath] = useState(tab === "blog" ? tenant.blogPathPrefix : "/");

  const pageType = tab === "blog" ? "blog" : "page";
  const { data: status, refetch: refetchStatus } = trpc.marketingSiteAdmin.getImportStatus.useQuery({ tenantKey });
  const { data: pages, refetch: refetchPages, isLoading: pagesLoading } = trpc.marketingSiteAdmin.listPages.useQuery({
    tenantKey,
    type: pageType,
    search: search || undefined,
    limit: 500,
  });

  const refresh = () => { void refetchStatus(); void refetchPages(); };
  const importOne = trpc.marketingSiteAdmin.importUrl.useMutation({
    onSuccess: (result) => { toast.success(result.status === "imported" ? `Imported ${result.path}` : `Import ${result.status}`); refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const bulkImport = trpc.marketingSiteAdmin.runBulkImport.useMutation({
    onSuccess: (result) => {
      const imported = result.results.filter((item) => item.status === "imported").length;
      const failed = result.results.filter((item) => item.status === "failed").length;
      toast.success(`Imported ${imported} of ${result.total} source URLs${failed ? `; ${failed} need review` : ""}.`);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const createPage = trpc.marketingSiteAdmin.createPage.useMutation({
    onSuccess: (result) => {
      toast.success("Draft created in the visual editor.");
      setCreateOpen(false);
      navigate(editorPath(brand, result.id));
    },
    onError: (error) => toast.error(error.message),
  });

  const counters = useMemo(() => ({
    pages: (pages ?? []).filter((page) => page.pageType === "page").length,
    blogs: (pages ?? []).filter((page) => page.pageType === "blog_post").length,
  }), [pages]);

  const beginCreate = () => {
    setNewTitle("");
    setNewPath(tab === "blog" ? tenant.blogPathPrefix : "/");
    setCreateOpen(true);
  };

  const runBulk = () => bulkImport.mutate({ tenantKey, scope: bulkScope, limit: bulkLimit, reimportExisting });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
              <Globe2 className="w-4 h-4" /> Per-brand public website tools
            </div>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">{tenant.siteName} website &amp; blog</h1>
            <p className="max-w-3xl text-sm text-slate-600 mt-2">
              Build and edit each public page with the visual block editor. The active review tenant publishes at <strong>{tenant.currentHost}</strong> now and keeps the same paths for the planned <strong>{tenant.promotionHost}</strong> promotion.
            </p>
          </div>
          <a href={`https://${tenant.currentHost}`} target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2"><ExternalLink className="w-4 h-4" /> View public site</Button>
          </a>
        </div>

        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <strong className="text-amber-950">Promotion-safe architecture.</strong>{" "}
              <span className="text-amber-900">The .net tenant is noindex while it is reviewed. When DNS moves to .com, this same tenant becomes self-canonical, retains every URL, and produces its .com sitemap.</span>
            </div>
            <Badge variant="outline" className="border-amber-400 text-amber-800">.net now → .com later</Badge>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Imported public records</p><p className="text-2xl font-bold">{status?.totalPages ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Selected {tab === "pages" ? "pages" : "articles"}</p><p className="text-2xl font-bold">{tab === "pages" ? counters.pages : counters.blogs}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Last source import</p><p className="text-sm font-semibold mt-1">{status?.settings?.lastImportAt ? new Date(status.settings.lastImportAt).toLocaleString() : "Not imported yet"}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4 text-teal-600" /> Import the current public site</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">Import is controlled by a Platform Admin and creates editable copies; it never changes the currently live source site.</p>
            <div className="flex flex-col lg:flex-row gap-2">
              <Input value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder={`${tenant.sourceOrigin}/page.html`} />
              <Button onClick={() => importOne.mutate({ tenantKey, url: importUrl, reimportExisting })} disabled={importOne.isPending} className="gap-2 whitespace-nowrap">
                {importOne.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import URL
              </Button>
            </div>
            <div className="border-t pt-4 flex flex-wrap items-end gap-3">
              <div><Label className="text-xs">Sitemap scope</Label><select className="block mt-1 h-9 rounded-md border bg-white px-3 text-sm" value={bulkScope} onChange={(event) => setBulkScope(event.target.value as typeof bulkScope)}><option value="all">Pages and blog</option><option value="pages">Pages only</option><option value="blog">Blog posts only</option></select></div>
              <div><Label className="text-xs">Batch size</Label><Input className="mt-1 w-24" type="number" min={1} max={500} value={bulkLimit} onChange={(event) => setBulkLimit(Math.max(1, Number(event.target.value) || 25))} /></div>
              <label className="flex items-center gap-2 text-sm pt-5"><Checkbox checked={reimportExisting} onCheckedChange={(checked) => setReimportExisting(checked === true)} /> Refresh existing copies</label>
              <Button variant="secondary" onClick={runBulk} disabled={bulkImport.isPending} className="gap-2">
                {bulkImport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Run sitemap import
              </Button>
            </div>
            <p className="text-xs text-slate-500">Legacy <code>member.allaboutultrasound.com</code> links are rewritten to <code>learn.allaboutultrasound.com</code> as content is imported. Links to the other public brand use its current .net tenant until promotion.</p>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "pages" | "blog")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList><TabsTrigger value="pages">Website pages</TabsTrigger><TabsTrigger value="blog" className="gap-2"><Rss className="w-3.5 h-3.5" /> Blog posts</TabsTrigger></TabsList>
            <div className="flex gap-2"><div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9 w-56" placeholder="Search path" /></div><Button onClick={beginCreate} className="gap-2"><FilePlus2 className="w-4 h-4" /> New {tab === "blog" ? "post" : "page"}</Button></div>
          </div>
        </Tabs>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{tab === "blog" ? "Blog post editor" : "Website page editor"}</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {pagesLoading && <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>}
              {!pagesLoading && !(pages?.length) && <div className="py-12 text-center text-slate-500">No {tab === "blog" ? "blog posts" : "pages"} yet. Import the sitemap or create an editable draft.</div>}
              {(pages ?? []).map((page) => (
                <div key={page.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0"><p className="font-medium text-slate-900 truncate">{page.title || page.path}</p><p className="font-mono text-xs text-teal-700 truncate">{page.path}</p></div>
                  <div className="flex items-center gap-2"><Badge variant={page.isPublished ? "default" : "secondary"}>{page.isPublished ? "Published" : "Draft"}</Badge><Badge variant="outline">{page.importStatus}</Badge><Link href={editorPath(brand, page.id)}><Button size="sm" variant="outline" className="gap-1"><Sparkles className="w-3.5 h-3.5" /> Visual editor</Button></Link></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create {tab === "blog" ? "a blog post" : "a website page"}</DialogTitle><DialogDescription>Drafts are private until published from the visual editor.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2"><div><Label>Title</Label><Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={tab === "blog" ? "Article title" : "Page title"} /></div><div><Label>Path</Label><Input value={newPath} onChange={(event) => setNewPath(event.target.value)} placeholder={tab === "blog" ? `${tenant.blogPathPrefix}article-slug` : "/about"} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!newTitle.trim() || !newPath.trim() || createPage.isPending} onClick={() => createPage.mutate({ tenantKey, title: newTitle, path: newPath, pageType: tab === "blog" ? "blog_post" : "page" })}>{createPage.isPending ? "Creating…" : "Create draft"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
