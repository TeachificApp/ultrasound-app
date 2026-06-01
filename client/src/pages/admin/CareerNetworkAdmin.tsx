import { useState } from "react";
import { trpc } from "@/lib/trpc";
import RichTextEditor from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit2, Save, X, Loader2, RefreshCw, Rss, Globe, Briefcase,
  Users, Settings, Star, Eye, EyeOff, CheckCircle2, XCircle, FileText,
  ChevronDown, ChevronUp, Tag, Search, ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { getAdminUrl } from "@/hooks/useSubdomain";

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" }, { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" }, { value: "per_diem", label: "Per Diem" },
  { value: "travel", label: "Travel" }, { value: "prn", label: "PRN" },
];
const LOCATION_TYPES = [
  { value: "remote", label: "Remote" }, { value: "onsite", label: "On-site" }, { value: "hybrid", label: "Hybrid" },
];
const SALARY_PERIODS = [
  { value: "hourly", label: "Per Hour" }, { value: "daily", label: "Per Day" },
  { value: "weekly", label: "Per Week" }, { value: "annual", label: "Per Year" },
];

// ─── Job Source Manager ───────────────────────────────────────────────────────
function JobSourcesTab() {
  const utils = trpc.useUtils();
  const { data: sources = [], isLoading } = trpc.careerNetwork.adminListSources.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", url: "", type: "rss" as "rss" | "url", isActive: true, fetchIntervalHours: 24 });

  const createMutation = trpc.careerNetwork.adminSaveSource.useMutation({
    onSuccess: () => { toast.success("Source saved!"); utils.careerNetwork.adminListSources.invalidate(); setShowForm(false); resetForm(); },
    onError: (e) => { toast.error(e.message); },
  });
  const deleteMutation = trpc.careerNetwork.adminDeleteSource.useMutation({
    onSuccess: () => { toast.success("Source deleted."); utils.careerNetwork.adminListSources.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });
  const refreshMutation = trpc.careerNetwork.adminFetchSource.useMutation({
    onSuccess: (data) => { toast.success(`Fetched ${data.newJobs} new jobs from source.`); utils.careerNetwork.adminListSources.invalidate(); utils.careerNetwork.listJobs.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });
  const refreshAllMutation = trpc.careerNetwork.adminFetchAllSources.useMutation({
    onSuccess: (data) => { toast.success(`Refreshed all sources. ${data.total} new jobs imported.`); utils.careerNetwork.adminListSources.invalidate(); utils.careerNetwork.listJobs.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });

  const resetForm = () => setForm({ name: "", url: "", type: "rss", isActive: true, fetchIntervalHours: 24 });

  const startEdit = (source: typeof sources[0]) => {
    setEditId(source.id);
    setForm({ name: source.name, url: source.url, type: source.type as "rss" | "url", isActive: source.isActive ?? true, fetchIntervalHours: source.fetchIntervalHours ?? 24 });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Configure RSS feeds and web URLs to automatically import job postings.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshAllMutation.mutate()} disabled={refreshAllMutation.isPending}>
            {refreshAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh All
          </Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { resetForm(); setEditId(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Source
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-teal-200 bg-teal-50/30">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">{editId ? "Edit Source" : "New Job Source"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Name</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Indeed Sonography Jobs" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as "rss" | "url" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rss"><span className="flex items-center gap-2"><Rss className="h-3.5 w-3.5" />RSS Feed</span></SelectItem>
                    <SelectItem value="url"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Web URL</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">URL</label>
                <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Refresh Every (hours)</label>
                <Input type="number" value={form.fetchIntervalHours} onChange={e => setForm(f => ({ ...f, fetchIntervalHours: Number(e.target.value) }))} min={1} max={168} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
                <span className="text-sm text-gray-600">Active</span>
              </div>

            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate({ ...form, id: editId ?? undefined })} disabled={createMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Source
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); resetForm(); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Rss className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No job sources configured</p>
          <p className="text-xs text-gray-400">Add RSS feeds or web URLs to automatically import job postings.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map(source => (
            <Card key={source.id} className={`border ${source.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${source.type === "rss" ? "bg-orange-50" : "bg-blue-50"}`}>
                  {source.type === "rss" ? <Rss className="h-4 w-4 text-orange-500" /> : <Globe className="h-4 w-4 text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900 truncate">{source.name}</p>
                    {!source.isActive && <Badge variant="secondary" className="text-xs">Paused</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{source.url}</p>
                  <p className="text-xs text-gray-400">Refreshes every {source.fetchIntervalHours}h{source.lastFetchedAt ? ` · Last: ${new Date(source.lastFetchedAt).toLocaleDateString()}` : ""}{source.totalFetched ? ` · ${source.totalFetched} total imported` : ""}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refreshMutation.mutate({ id: source.id })} disabled={refreshMutation.isPending}>
                    <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(source)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" onClick={() => { if (confirm("Delete this source?")) deleteMutation.mutate({ id: source.id }); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Internal Job Posting Editor ──────────────────────────────────────────────
function JobPostingsTab() {
  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.careerNetwork.listCategories.useQuery();
  const [adminSearch, setAdminSearch] = useState("");
  const { data: jobsData, isLoading } = trpc.careerNetwork.adminListJobs.useQuery({ search: adminSearch || undefined, page: 1, pageSize: 100 });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [recatJobId, setRecatJobId] = useState<number | null>(null);
  const [recatCategoryId, setRecatCategoryId] = useState<string>("");

  const moderateMutation = trpc.careerNetwork.adminModerateJob.useMutation({
    onSuccess: () => { toast.success("Job updated."); utils.careerNetwork.adminListJobs.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });
  const recatMutation = trpc.careerNetwork.adminRecategorizeJob.useMutation({
    onSuccess: () => { toast.success("Category updated."); setRecatJobId(null); utils.careerNetwork.adminListJobs.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });
  const autoCatMutation = trpc.careerNetwork.adminRunAutoCategorize.useMutation({
    onSuccess: (r) => { toast.success(`Auto-categorized ${r.updated} job(s).`); utils.careerNetwork.adminListJobs.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });
  const [form, setForm] = useState({
    title: "", company: "", companyLogoUrl: "", location: "", locationType: "onsite",
    employmentType: "full_time", salary: "", salaryMin: "", salaryMax: "", salaryPeriod: "annual",
    description: "", tags: "", categoryId: "", applyUrl: "", applyEmail: "",
    isInternal: true, isFeatured: false, status: "published",
  });

  const saveMutation = trpc.careerNetwork.adminSaveJob.useMutation({
    onSuccess: () => { toast.success("Job saved!"); utils.careerNetwork.listJobs.invalidate(); setShowForm(false); resetForm(); },
    onError: (e) => { toast.error(e.message); },
  });
  const deleteMutation = trpc.careerNetwork.adminDeleteJob.useMutation({
    onSuccess: () => { toast.success("Job deleted."); utils.careerNetwork.listJobs.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });

  const resetForm = () => setForm({ title: "", company: "", companyLogoUrl: "", location: "", locationType: "onsite", employmentType: "full_time", salary: "", salaryMin: "", salaryMax: "", salaryPeriod: "annual", description: "", tags: "", categoryId: "", applyUrl: "", applyEmail: "", isInternal: true, isFeatured: false, status: "published" });

  const startEdit = (job: NonNullable<typeof jobsData>["jobs"][0]) => {
    setEditId(job.id);
    const tags = job.tags ? (() => { try { return JSON.parse(job.tags!).join(", "); } catch { return ""; } })() : "";
    setForm({
      title: job.title, company: job.company, companyLogoUrl: job.companyLogoUrl ?? "",
      location: job.location ?? "", locationType: job.locationType ?? "onsite",
      employmentType: job.employmentType ?? "full_time", salary: job.salary ?? "",
      salaryMin: String(job.salaryMin ?? ""), salaryMax: String(job.salaryMax ?? ""),
      salaryPeriod: job.salaryPeriod ?? "annual", description: job.description ?? "",
      tags, categoryId: String(job.categoryId ?? ""), applyUrl: job.applyUrl ?? "",
      applyEmail: job.applyEmail ?? "", isInternal: job.isInternal ?? true,
      isFeatured: job.isFeatured ?? false, status: job.status ?? "published",
    });
    setShowForm(true);
  };

  const handleSave = () => {
    const tagsArr = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    saveMutation.mutate({
      id: editId ?? undefined, title: form.title, company: form.company,
      companyLogoUrl: form.companyLogoUrl || undefined, location: form.location || undefined,
      locationType: form.locationType as "remote" | "onsite" | "hybrid",
      employmentType: form.employmentType as "full_time" | "part_time" | "contract" | "per_diem" | "travel" | "prn",
      salary: form.salary || undefined, salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
      salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
      salaryPeriod: form.salaryPeriod as "hourly" | "daily" | "weekly" | "annual",
      description: form.description || undefined, tags: tagsArr,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      applyUrl: form.applyUrl || undefined, applyEmail: form.applyEmail || undefined,
      isInternal: form.isInternal, isFeatured: form.isFeatured,
      status: form.status as "draft" | "published" | "closed",
    });
  };

  const jobs = jobsData?.jobs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={adminSearch} onChange={e => setAdminSearch(e.target.value)} placeholder="Search jobs..." className="pl-8" />
        </div>
        <Button size="sm" variant="outline" onClick={() => autoCatMutation.mutate()} disabled={autoCatMutation.isPending} title="Auto-categorize uncategorized jobs based on keyword rules">
          {autoCatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
          <span className="ml-1.5 hidden sm:inline">Auto-Categorize</span>
        </Button>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { resetForm(); setEditId(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Posting
        </Button>
      </div>
      <p className="text-xs text-gray-400">{jobsData?.total ?? 0} total jobs (showing {jobs.length})</p>

      {showForm && (
        <Card className="border-teal-200 bg-teal-50/30">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-sm text-gray-900">{editId ? "Edit Job Posting" : "New Job Posting"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Job Title *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Cardiac Sonographer" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Company *</label>
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Company Logo URL</label>
                <Input value={form.companyLogoUrl} onChange={e => setForm(f => ({ ...f, companyLogoUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, State or Remote" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Location Type</label>
                <Select value={form.locationType} onValueChange={v => setForm(f => ({ ...f, locationType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOCATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Employment Type</label>
                <Select value={form.employmentType} onValueChange={v => setForm(f => ({ ...f, employmentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPLOYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
                <Select value={form.categoryId || "none"} onValueChange={v => setForm(f => ({ ...f, categoryId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Salary (text, e.g. "$80k–$100k/yr")</label>
                <Input value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="Optional free-text salary" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Salary Min</label>
                <Input type="number" value={form.salaryMin} onChange={e => setForm(f => ({ ...f, salaryMin: e.target.value }))} placeholder="60000" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Salary Max</label>
                <Input type="number" value={form.salaryMax} onChange={e => setForm(f => ({ ...f, salaryMax: e.target.value }))} placeholder="100000" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Salary Period</label>
                <Select value={form.salaryPeriod} onValueChange={v => setForm(f => ({ ...f, salaryPeriod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SALARY_PERIODS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Apply URL (external)</label>
                <Input value={form.applyUrl} onChange={e => setForm(f => ({ ...f, applyUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Apply Email</label>
                <Input value={form.applyEmail} onChange={e => setForm(f => ({ ...f, applyEmail: e.target.value }))} placeholder="jobs@company.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tags (comma-separated)</label>
                <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="Echocardiography, RDCS, Pediatric" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={6} placeholder="Full job description..." className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.isInternal} onCheckedChange={v => setForm(f => ({ ...f, isInternal: v }))} />
                <span className="text-sm text-gray-600">Internal posting (apply via platform)</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isFeatured} onCheckedChange={v => setForm(f => ({ ...f, isFeatured: v }))} />
                <span className="text-sm text-gray-600">Featured</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Posting
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); resetForm(); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Briefcase className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No job postings yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => (
            <Card key={job.id} className={`border ${job.isHidden ? "border-orange-200 bg-orange-50/30 opacity-70" : "border-gray-200"}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-gray-900 truncate">{job.title}</p>
                      {job.isFeatured && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                      {job.isInternal && <Badge className="bg-teal-50 text-teal-700 text-xs">Internal</Badge>}
                      {job.isHidden && <Badge className="bg-orange-100 text-orange-700 text-xs">Hidden</Badge>}
                      {job.blockedFromSource && <Badge className="bg-red-100 text-red-700 text-xs">Blocked</Badge>}
                      <Badge className={`text-xs ${job.status === "published" ? "bg-green-50 text-green-700" : job.status === "draft" ? "bg-gray-50 text-gray-600" : "bg-red-50 text-red-700"}`}>{job.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
                    {job.categoryId && <p className="text-xs text-teal-600 mt-0.5">{categories.find(c => c.id === job.categoryId)?.name ?? ""}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit" onClick={() => startEdit(job)}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title={job.isHidden ? "Unhide" : "Hide"} onClick={() => moderateMutation.mutate({ id: job.id, action: job.isHidden ? "unhide" : "hide" })}>
                      {job.isHidden ? <Eye className="h-4 w-4 text-orange-500" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Recategorize" onClick={() => { setRecatJobId(job.id); setRecatCategoryId(String(job.categoryId ?? "")); }}><Tag className="h-4 w-4 text-blue-400" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" title="Block future imports of this job" onClick={() => { if (confirm("Block this job from being re-imported? It will be hidden and its external ID blocked.")) moderateMutation.mutate({ id: job.id, action: "block" }); }}><XCircle className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" title="Delete permanently" onClick={() => { if (confirm("Permanently delete this job?")) deleteMutation.mutate({ id: job.id }); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {recatJobId === job.id && (
                  <div className="mt-3 flex items-center gap-2 bg-blue-50 rounded-lg p-3">
                    <Tag className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <Select value={recatCategoryId || "none"} onValueChange={setRecatCategoryId}>
                      <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Category</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => recatMutation.mutate({ id: job.id, categoryId: recatCategoryId && recatCategoryId !== "none" ? Number(recatCategoryId) : null })} disabled={recatMutation.isPending}>
                      {recatMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRecatJobId(null)}><X className="h-3 w-3" /></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Categories Manager ───────────────────────────────────────────────────────
function CategoriesTab() {
  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } = trpc.careerNetwork.listCategories.useQuery();
  const [form, setForm] = useState({ name: "", color: "#0d9488", description: "" });
  const [editId, setEditId] = useState<number | null>(null);

  const saveMutation = trpc.careerNetwork.adminSaveCategory.useMutation({
    onSuccess: () => { toast.success("Category saved!"); utils.careerNetwork.listCategories.invalidate(); setForm({ name: "", color: "#0d9488", description: "" }); setEditId(null); },
    onError: (e) => { toast.error(e.message); },
  });
  const deleteMutation = trpc.careerNetwork.adminDeleteCategory.useMutation({
    onSuccess: () => { toast.success("Category deleted."); utils.careerNetwork.listCategories.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });

  return (
    <div className="space-y-4">
      <Card className="border-teal-200 bg-teal-50/30">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm text-gray-900">{editId ? "Edit Category" : "New Category"}</h3>
          <div className="flex gap-3">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Category name" className="flex-1" />
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="flex-1" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Color</label>
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border" />
            </div>
            <Button onClick={() => saveMutation.mutate({ id: editId ?? undefined, ...form })} disabled={saveMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-24"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <Card key={cat.id} className="border border-gray-200">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color ?? "#0d9488" }} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                  {cat.description && <p className="text-xs text-gray-400">{cat.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditId(cat.id); setForm({ name: cat.name, color: cat.color ?? "#0d9488", description: cat.description ?? "" }); }}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => { if (confirm("Delete category?")) deleteMutation.mutate({ id: cat.id }); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Candidate Browser ────────────────────────────────────────────────────────
function CandidatesTab() {
  const [search, setSearch] = useState("");
  const { data: candidates = [], isLoading } = trpc.careerNetwork.adminListCandidates.useQuery({ search: search || undefined });
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates by name, specialty, certification..." className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No public candidate profiles yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map(candidate => {
            const specialties: string[] = candidate.specialties ? (() => { try { return JSON.parse(candidate.specialties!); } catch { return []; } })() : [];
            const certs: string[] = candidate.certifications ? (() => { try { return JSON.parse(candidate.certifications!); } catch { return []; } })() : [];
            const isOpen = expanded === candidate.id;
            return (
              <Card key={candidate.id} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-teal-700 font-semibold text-sm">{candidate.userName?.charAt(0).toUpperCase() ?? "?"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-gray-900">{candidate.userName}</p>
                        {candidate.availability && candidate.availability !== "not_looking" && (
                          <Badge className="bg-green-50 text-green-700 text-xs">Open to Work</Badge>
                        )}
                      </div>
                      {candidate.headline && <p className="text-xs text-gray-600">{candidate.headline}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {specialties.slice(0, 3).map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                        {certs.slice(0, 3).map(c => <Badge key={c} className="bg-blue-50 text-blue-700 text-xs">{c}</Badge>)}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExpanded(isOpen ? null : candidate.id)}>
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                      {candidate.bio && <p className="text-gray-600">{candidate.bio}</p>}
                      {candidate.location && <p className="text-gray-500"><span className="font-medium">Location:</span> {candidate.location}</p>}
                      {candidate.yearsExperience && <p className="text-gray-500"><span className="font-medium">Experience:</span> {candidate.yearsExperience} years</p>}
                      {candidate.desiredSalary && <p className="text-gray-500"><span className="font-medium">Desired Salary:</span> {candidate.desiredSalary}</p>}
                      {candidate.linkedinUrl && <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline text-xs">LinkedIn Profile</a>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.careerNetwork.getSettings.useQuery();
  const [form, setForm] = useState({
    heroTitle: "", heroSubtitle: "", pageIntro: "",
    rightSideHtml: "", bottomHtml: "", headerBadgeHtml: "",
    seoTitle: "", seoDescription: "",
  });
  const [loaded, setLoaded] = useState(false);

  if (settings && !loaded) {
    setForm({
      heroTitle: settings.heroTitle ?? "",
      heroSubtitle: settings.heroSubtitle ?? "",
      pageIntro: settings.pageIntro ?? "",
      rightSideHtml: (settings as Record<string, unknown>).rightSideHtml as string ?? "",
      bottomHtml: (settings as Record<string, unknown>).bottomHtml as string ?? "",
      headerBadgeHtml: (settings as Record<string, unknown>).headerBadgeHtml as string ?? "",
      seoTitle: settings.seoTitle ?? "",
      seoDescription: settings.seoDescription ?? "",
    });
    setLoaded(true);
  }

  const saveMutation = trpc.careerNetwork.adminSaveSettings.useMutation({
    onSuccess: () => { toast.success("Settings saved!"); utils.careerNetwork.getSettings.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });

  if (isLoading) return <div className="flex items-center justify-center h-24"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Hero Section */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500" /> Hero Section
          </CardTitle>
          <p className="text-xs text-gray-400">The banner shown at the top of the Career Network page.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Hero Title</label>
            <Input value={form.heroTitle} onChange={e => setForm(f => ({ ...f, heroTitle: e.target.value }))} placeholder="Ultrasound Career Network" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Hero Subtitle</label>
            <Input value={form.heroSubtitle} onChange={e => setForm(f => ({ ...f, heroSubtitle: e.target.value }))} placeholder="Find your next opportunity in ultrasound and echocardiography" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Header Badge / Announcement</label>
            <p className="text-xs text-gray-400 mb-1">Optional banner inside the hero area (announcements, featured links).</p>
            <RichTextEditor value={form.headerBadgeHtml} onChange={v => setForm(f => ({ ...f, headerBadgeHtml: v }))} placeholder="Optional announcement or badge..." />
          </div>
        </CardContent>
      </Card>

      {/* Page Content */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Page Content
          </CardTitle>
          <p className="text-xs text-gray-400">Content areas shown below the hero on the job listing page.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Page Intro (shown below hero, above job listings)</label>
            <RichTextEditor value={form.pageIntro} onChange={v => setForm(f => ({ ...f, pageIntro: v }))} placeholder="Brief intro text shown above the job listings..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Right Side Content</label>
            <p className="text-xs text-gray-400 mb-1">Appears in the right column on desktop — great for sponsor logos, CTAs, or resources.</p>
            <RichTextEditor value={form.rightSideHtml} onChange={v => setForm(f => ({ ...f, rightSideHtml: v }))} placeholder="Sidebar content: sponsor logos, links, CTAs..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Bottom Page Content</label>
            <p className="text-xs text-gray-400 mb-1">Full-width section at the bottom — great for about text, employer info, or resources.</p>
            <RichTextEditor value={form.bottomHtml} onChange={v => setForm(f => ({ ...f, bottomHtml: v }))} placeholder="Bottom section: about text, employer resources..." />
          </div>
        </CardContent>
      </Card>

      {/* SEO */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> SEO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">SEO Title</label>
            <Input value={form.seoTitle} onChange={e => setForm(f => ({ ...f, seoTitle: e.target.value }))} placeholder="Ultrasound Jobs | Career Network" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">SEO Description</label>
            <textarea value={form.seoDescription} onChange={e => setForm(f => ({ ...f, seoDescription: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" placeholder="A brief description for search engines..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white px-6">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}


// ─── Moderation / Auto-Categorization Tab ──────────────────────────────────────
function ModerationTab() {
  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.careerNetwork.listCategories.useQuery();
  const { data: rules = [], isLoading } = trpc.careerNetwork.adminListCategoryRules.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ categoryId: "", keywords: "", matchField: "both", priority: "0" });

  const saveMutation = trpc.careerNetwork.adminSaveCategoryRule.useMutation({
    onSuccess: () => { toast.success("Rule saved!"); utils.careerNetwork.adminListCategoryRules.invalidate(); setShowForm(false); resetForm(); },
    onError: (e) => { toast.error(e.message); },
  });
  const deleteMutation = trpc.careerNetwork.adminDeleteCategoryRule.useMutation({
    onSuccess: () => { toast.success("Rule deleted."); utils.careerNetwork.adminListCategoryRules.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });
  const autoCatMutation = trpc.careerNetwork.adminRunAutoCategorize.useMutation({
    onSuccess: (r) => { toast.success(`Auto-categorized ${r.updated} job(s).`); },
    onError: (e) => { toast.error(e.message); },
  });

  const resetForm = () => { setForm({ categoryId: "", keywords: "", matchField: "both", priority: "0" }); setEditId(null); };

  const handleSave = () => {
    const keywords = form.keywords.split(",").map(k => k.trim()).filter(Boolean);
    if (!form.categoryId || keywords.length === 0) { toast.error("Category and at least one keyword are required."); return; }
    saveMutation.mutate({ id: editId ?? undefined, categoryId: Number(form.categoryId), keywords, matchField: form.matchField as "title" | "description" | "both", priority: Number(form.priority) });
  };

  const startEdit = (rule: (typeof rules)[0]) => {
    setEditId(rule.id);
    let kws: string[] = [];
    try { kws = JSON.parse(rule.keywords); } catch { kws = []; }
    setForm({ categoryId: String(rule.categoryId), keywords: kws.join(", "), matchField: rule.matchField ?? "both", priority: String(rule.priority ?? 0) });
    setShowForm(true);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="border border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Tag className="h-4 w-4 text-blue-500" /> Auto-Categorization Rules
          </CardTitle>
          <p className="text-xs text-gray-400">Define keyword rules to automatically assign categories to imported jobs. Higher priority rules are checked first.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Rule
            </Button>
            <Button size="sm" variant="outline" onClick={() => autoCatMutation.mutate()} disabled={autoCatMutation.isPending}>
              {autoCatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Run Auto-Categorize Now
            </Button>
          </div>

          {showForm && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">{editId ? "Edit Rule" : "New Rule"}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Category *</label>
                    <Select value={form.categoryId || "none"} onValueChange={v => setForm(f => ({ ...f, categoryId: v === "none" ? "" : v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select category</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Match In</label>
                    <Select value={form.matchField} onValueChange={v => setForm(f => ({ ...f, matchField: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Title &amp; Description</SelectItem>
                        <SelectItem value="title">Title Only</SelectItem>
                        <SelectItem value="description">Description Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Keywords (comma-separated) *</label>
                    <Input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="echo, echocardiography, cardiac sonographer" />
                    <p className="text-xs text-gray-400 mt-1">If any keyword matches, the category is assigned.</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Priority (higher = checked first)</label>
                    <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} placeholder="0" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save Rule
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-24"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed">
              <Tag className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No rules yet. Add a rule to start auto-categorizing imported jobs.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => {
                let kws: string[] = [];
                try { kws = JSON.parse(rule.keywords); } catch { kws = []; }
                const cat = categories.find(c => c.id === rule.categoryId);
                return (
                  <Card key={rule.id} className="border border-gray-200">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">{cat?.name ?? "Unknown"}</span>
                          <Badge className="bg-blue-50 text-blue-700 text-xs">{rule.matchField ?? "both"}</Badge>
                          {rule.priority !== 0 && <Badge className="bg-gray-50 text-gray-600 text-xs">Priority {rule.priority}</Badge>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{kws.join(", ")}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(rule)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => { if (confirm("Delete this rule?")) deleteMutation.mutate({ id: rule.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function CareerNetworkAdmin() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href={getAdminUrl("/admin")} className="hover:text-teal-600 transition-colors font-medium">Platform Admin</Link>
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />
        <span className="text-gray-700 font-medium">Career Network</span>
      </nav>

      {/* Page Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
        <div className="h-10 w-10 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
          <Briefcase className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Career Network</h1>
          <p className="text-sm text-gray-500">Manage job postings, RSS sources, candidate profiles, and page settings.</p>
        </div>
      </div>

      <Tabs defaultValue="postings">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="postings"><Briefcase className="h-4 w-4 mr-1.5" />Job Postings</TabsTrigger>
          <TabsTrigger value="sources"><Rss className="h-4 w-4 mr-1.5" />Feed Sources</TabsTrigger>
          <TabsTrigger value="categories"><Tag className="h-4 w-4 mr-1.5" />Categories</TabsTrigger>
          <TabsTrigger value="candidates"><Users className="h-4 w-4 mr-1.5" />Candidates</TabsTrigger>
          <TabsTrigger value="moderation"><EyeOff className="h-4 w-4 mr-1.5" />Moderation</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1.5" />Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="postings" className="mt-4"><JobPostingsTab /></TabsContent>
        <TabsContent value="sources" className="mt-4"><JobSourcesTab /></TabsContent>
        <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
        <TabsContent value="candidates" className="mt-4"><CandidatesTab /></TabsContent>
        <TabsContent value="moderation" className="mt-4"><ModerationTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
