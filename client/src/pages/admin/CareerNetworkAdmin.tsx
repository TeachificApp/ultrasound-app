import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
  const { data: sources = [], isLoading } = trpc.careerNetwork.adminListJobSources.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", url: "", type: "rss" as "rss" | "web", isActive: true, refreshIntervalHours: 24, mapping: "" });

  const createMutation = trpc.careerNetwork.adminSaveJobSource.useMutation({
    onSuccess: () => { toast.success("Source saved!"); utils.careerNetwork.adminListJobSources.invalidate(); setShowForm(false); resetForm(); },
    onError: (e) => { toast.error(e.message); },
  });
  const deleteMutation = trpc.careerNetwork.adminDeleteJobSource.useMutation({
    onSuccess: () => { toast.success("Source deleted."); utils.careerNetwork.adminListJobSources.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });
  const refreshMutation = trpc.careerNetwork.adminRefreshJobSource.useMutation({
    onSuccess: (data) => { toast.success(`Fetched ${data.count} jobs from source.`); utils.careerNetwork.adminListJobSources.invalidate(); utils.careerNetwork.listJobs.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });
  const refreshAllMutation = trpc.careerNetwork.adminRefreshAllSources.useMutation({
    onSuccess: (data) => { toast.success(`Refreshed all sources. ${data.total} jobs imported.`); utils.careerNetwork.adminListJobSources.invalidate(); utils.careerNetwork.listJobs.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });

  const resetForm = () => setForm({ name: "", url: "", type: "rss", isActive: true, refreshIntervalHours: 24, mapping: "" });

  const startEdit = (source: typeof sources[0]) => {
    setEditId(source.id);
    setForm({ name: source.name, url: source.url, type: source.type as "rss" | "web", isActive: source.isActive ?? true, refreshIntervalHours: source.refreshIntervalHours ?? 24, mapping: source.mapping ?? "" });
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
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as "rss" | "web" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rss"><span className="flex items-center gap-2"><Rss className="h-3.5 w-3.5" />RSS Feed</span></SelectItem>
                    <SelectItem value="web"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Web URL</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">URL</label>
                <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Refresh Every (hours)</label>
                <Input type="number" value={form.refreshIntervalHours} onChange={e => setForm(f => ({ ...f, refreshIntervalHours: Number(e.target.value) }))} min={1} max={168} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
                <span className="text-sm text-gray-600">Active</span>
              </div>
              {form.type === "web" && (
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">CSS Selector Mapping (JSON, optional)</label>
                  <Input value={form.mapping} onChange={e => setForm(f => ({ ...f, mapping: e.target.value }))} placeholder='{"title": ".job-title", "company": ".company-name", "location": ".location"}' />
                  <p className="text-xs text-gray-400 mt-1">Map CSS selectors to job fields. Leave empty for auto-detection.</p>
                </div>
              )}
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
                  <p className="text-xs text-gray-400">Refreshes every {source.refreshIntervalHours}h{source.lastFetchedAt ? ` · Last: ${new Date(source.lastFetchedAt).toLocaleDateString()}` : ""}{source.jobCount != null ? ` · ${source.jobCount} jobs` : ""}</p>
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
  const { data: jobsData, isLoading } = trpc.careerNetwork.listJobs.useQuery({ page: 1, pageSize: 100 });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{jobs.length} job posting{jobs.length !== 1 ? "s" : ""}</p>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { resetForm(); setEditId(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Posting
        </Button>
      </div>

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
            <Card key={job.id} className="border border-gray-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900 truncate">{job.title}</p>
                    {job.isFeatured && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                    {job.isInternal && <Badge className="bg-teal-50 text-teal-700 text-xs">Internal</Badge>}
                    <Badge className={`text-xs ${job.status === "published" ? "bg-green-50 text-green-700" : job.status === "draft" ? "bg-gray-50 text-gray-600" : "bg-red-50 text-red-700"}`}>
                      {job.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(job)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" onClick={() => { if (confirm("Delete this job?")) deleteMutation.mutate({ id: job.id }); }}>
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
  const [form, setForm] = useState({ heroTitle: "", heroSubtitle: "", pageIntro: "", seoTitle: "", seoDescription: "" });
  const [loaded, setLoaded] = useState(false);

  if (settings && !loaded) {
    setForm({ heroTitle: settings.heroTitle ?? "", heroSubtitle: settings.heroSubtitle ?? "", pageIntro: settings.pageIntro ?? "", seoTitle: settings.seoTitle ?? "", seoDescription: settings.seoDescription ?? "" });
    setLoaded(true);
  }

  const saveMutation = trpc.careerNetwork.adminSaveSettings.useMutation({
    onSuccess: () => { toast.success("Settings saved!"); utils.careerNetwork.getSettings.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });

  return (
    <div className="space-y-4 max-w-xl">
      {isLoading ? <div className="flex items-center justify-center h-24"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div> : (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Hero Title</label>
            <Input value={form.heroTitle} onChange={e => setForm(f => ({ ...f, heroTitle: e.target.value }))} placeholder="Ultrasound Career Network" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Hero Subtitle</label>
            <Input value={form.heroSubtitle} onChange={e => setForm(f => ({ ...f, heroSubtitle: e.target.value }))} placeholder="Find your next opportunity..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Page Intro (shown below hero)</label>
            <textarea value={form.pageIntro} onChange={e => setForm(f => ({ ...f, pageIntro: e.target.value }))} rows={3} className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">SEO Title</label>
            <Input value={form.seoTitle} onChange={e => setForm(f => ({ ...f, seoTitle: e.target.value }))} placeholder="Ultrasound Jobs | Career Network" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">SEO Description</label>
            <textarea value={form.seoDescription} onChange={e => setForm(f => ({ ...f, seoDescription: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function CareerNetworkAdmin() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href={getAdminUrl("/admin")} className="hover:text-teal-600 transition-colors">Platform Admin</Link>
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-gray-900 font-medium">Career Network</span>
      </nav>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Career Network</h1>
        <p className="text-sm text-gray-500">Manage job postings, RSS sources, candidate profiles, and page settings.</p>
      </div>

      <Tabs defaultValue="postings">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="postings"><Briefcase className="h-4 w-4 mr-1.5" />Job Postings</TabsTrigger>
          <TabsTrigger value="sources"><Rss className="h-4 w-4 mr-1.5" />Feed Sources</TabsTrigger>
          <TabsTrigger value="categories"><Tag className="h-4 w-4 mr-1.5" />Categories</TabsTrigger>
          <TabsTrigger value="candidates"><Users className="h-4 w-4 mr-1.5" />Candidates</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1.5" />Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="postings" className="mt-4"><JobPostingsTab /></TabsContent>
        <TabsContent value="sources" className="mt-4"><JobSourcesTab /></TabsContent>
        <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
        <TabsContent value="candidates" className="mt-4"><CandidatesTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
