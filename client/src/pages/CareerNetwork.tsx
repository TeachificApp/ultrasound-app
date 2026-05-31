import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Search, MapPin, Briefcase, Clock, DollarSign, ExternalLink, Building2,
  Filter, ChevronRight, Star, User, FileText, Loader2, X, Globe, Mail,
  ArrowLeft, Send
} from "lucide-react";

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full Time", part_time: "Part Time", contract: "Contract",
  per_diem: "Per Diem", travel: "Travel", prn: "PRN",
};
const LOCATION_LABELS: Record<string, string> = {
  remote: "Remote", onsite: "On-site", hybrid: "Hybrid",
};
const SALARY_PERIOD_LABELS: Record<string, string> = {
  hourly: "/hr", daily: "/day", weekly: "/wk", annual: "/yr",
};

function formatSalary(job: { salary?: string | null; salaryMin?: number | null; salaryMax?: number | null; salaryPeriod?: string | null }) {
  if (job.salary) return job.salary;
  if (job.salaryMin && job.salaryMax) {
    const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
    return `${fmt(job.salaryMin)}–${fmt(job.salaryMax)}${SALARY_PERIOD_LABELS[job.salaryPeriod ?? "annual"] ?? ""}`;
  }
  return null;
}

// ─── Job Detail Modal ─────────────────────────────────────────────────────────
function JobDetailModal({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const { user } = useAuth();
  const { data: job, isLoading } = trpc.careerNetwork.getJob.useQuery({ id: jobId });
  const { data: myResumes } = trpc.careerNetwork.getMyResumes.useQuery(undefined, { enabled: !!user });
  const { data: myApps } = trpc.careerNetwork.getMyApplications.useQuery(undefined, { enabled: !!user });
  const applyMutation = trpc.careerNetwork.applyToJob.useMutation({
    onSuccess: () => { toast.success("Application submitted!"); },
    onError: (e) => { toast.error(e.message); },
  });
  const [coverLetter, setCoverLetter] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState<number | undefined>();
  const [showApplyForm, setShowApplyForm] = useState(false);

  const alreadyApplied = myApps?.some(a => a.jobId === jobId);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
    </div>
  );
  if (!job) return null;

  const salary = formatSalary(job);
  const tags: string[] = job.tags ? JSON.parse(job.tags) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        {job.companyLogoUrl ? (
          <img src={job.companyLogoUrl} alt={job.company} className="w-16 h-16 rounded-xl object-contain border bg-white p-1 flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-8 w-8 text-teal-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
          <p className="text-base text-teal-700 font-medium">{job.company}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {job.location && <span className="flex items-center gap-1 text-sm text-gray-500"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
            {job.locationType && <Badge variant="outline" className="text-xs">{LOCATION_LABELS[job.locationType]}</Badge>}
            {job.employmentType && <Badge variant="outline" className="text-xs">{EMPLOYMENT_LABELS[job.employmentType]}</Badge>}
            {salary && <span className="flex items-center gap-1 text-sm font-medium text-green-700"><DollarSign className="h-3.5 w-3.5" />{salary}</span>}
          </div>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => <Badge key={t} className="bg-teal-50 text-teal-700 border-teal-200 text-xs">{t}</Badge>)}
        </div>
      )}

      <Separator />

      {/* Description */}
      {job.descriptionHtml ? (
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: job.descriptionHtml }} />
      ) : job.description ? (
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{job.description}</div>
      ) : (
        <p className="text-sm text-gray-400 italic">No description provided.</p>
      )}

      <Separator />

      {/* Apply section */}
      {job.isInternal ? (
        <div className="space-y-4">
          {alreadyApplied ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
              <Send className="h-4 w-4" />
              <span className="text-sm font-medium">You have already applied to this position.</span>
            </div>
          ) : !user ? (
            <p className="text-sm text-gray-500">Please log in to apply for this position.</p>
          ) : !showApplyForm ? (
            <Button onClick={() => setShowApplyForm(true)} className="bg-teal-600 hover:bg-teal-700 text-white w-full">
              Apply Now
            </Button>
          ) : (
            <div className="space-y-3 border rounded-xl p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Submit Application</h3>
              {myResumes && myResumes.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Select Resume</label>
                  <Select onValueChange={v => setSelectedResumeId(Number(v))}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Choose a resume (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {myResumes.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Cover Letter (optional)</label>
                <textarea
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  rows={5}
                  placeholder="Tell them why you're a great fit..."
                  className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-white"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => applyMutation.mutate({ jobId: job.id, resumeId: selectedResumeId, coverLetter: coverLetter || undefined })}
                  disabled={applyMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white flex-1"
                >
                  {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Submit Application
                </Button>
                <Button variant="outline" onClick={() => setShowApplyForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          {job.applyUrl && (
            <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                <ExternalLink className="h-4 w-4 mr-2" /> Apply Now
              </Button>
            </a>
          )}
          {job.applyEmail && (
            <a href={`mailto:${job.applyEmail}`} className="flex-1">
              <Button variant="outline" className="w-full">
                <Mail className="h-4 w-4 mr-2" /> Email to Apply
              </Button>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, categories, onClick }: {
  job: { id: number; title: string; company: string; companyLogoUrl?: string | null; location?: string | null; locationType?: string | null; employmentType?: string | null; salary?: string | null; salaryMin?: number | null; salaryMax?: number | null; salaryPeriod?: string | null; categoryId?: number | null; tags?: string | null; isInternal?: boolean | null; isFeatured?: boolean | null; applyUrl?: string | null; publishedAt?: Date | null };
  categories: Array<{ id: number; name: string; color: string | null }>;
  onClick: () => void;
}) {
  const category = categories.find(c => c.id === job.categoryId);
  const salary = formatSalary(job);
  const tags: string[] = job.tags ? (() => { try { return JSON.parse(job.tags!); } catch { return []; } })() : [];

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all border group ${job.isFeatured ? "border-teal-300 bg-teal-50/30" : "border-gray-200 bg-white"}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {job.companyLogoUrl ? (
            <img src={job.companyLogoUrl} alt={job.company} className="w-12 h-12 rounded-lg object-contain border bg-white p-1 flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-6 w-6 text-teal-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors line-clamp-1">{job.title}</h3>
                <p className="text-sm text-gray-600">{job.company}</p>
              </div>
              {job.isFeatured && <Star className="h-4 w-4 text-amber-400 fill-amber-400 flex-shrink-0 mt-0.5" />}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {job.location && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3 w-3" />{job.location}
                </span>
              )}
              {job.locationType && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">{LOCATION_LABELS[job.locationType]}</Badge>
              )}
              {job.employmentType && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">{EMPLOYMENT_LABELS[job.employmentType]}</Badge>
              )}
              {salary && (
                <span className="flex items-center gap-0.5 text-xs font-medium text-green-700">
                  <DollarSign className="h-3 w-3" />{salary}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {category && (
                <Badge className="text-xs px-1.5 py-0" style={{ backgroundColor: `${category.color}20`, color: category.color ?? "#0d9488", borderColor: `${category.color}40` }}>
                  {category.name}
                </Badge>
              )}
              {tags.slice(0, 3).map(t => (
                <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0 bg-gray-100 text-gray-600">{t}</Badge>
              ))}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 transition-colors flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CareerNetwork() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [locationType, setLocationType] = useState<string | undefined>();
  const [employmentType, setEmploymentType] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: settings } = trpc.careerNetwork.getSettings.useQuery();
  const { data: categories = [] } = trpc.careerNetwork.listCategories.useQuery();
  const { data: jobsData, isLoading } = trpc.careerNetwork.listJobs.useQuery({
    search: debouncedSearch || undefined,
    categoryId,
    locationType: locationType as "remote" | "onsite" | "hybrid" | undefined,
    employmentType: employmentType as "full_time" | "part_time" | "contract" | "per_diem" | "travel" | "prn" | undefined,
    page,
    pageSize: 20,
  });

  const totalPages = Math.ceil((jobsData?.total ?? 0) / 20);
  const featuredJobs = jobsData?.jobs.filter(j => j.isFeatured) ?? [];
  const regularJobs = jobsData?.jobs.filter(j => !j.isFeatured) ?? [];

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as unknown as { _searchTimer: ReturnType<typeof setTimeout> })._searchTimer);
    (window as unknown as { _searchTimer: ReturnType<typeof setTimeout> })._searchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
  };

  const clearFilters = () => {
    setCategoryId(undefined);
    setLocationType(undefined);
    setEmploymentType(undefined);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const hasFilters = !!(categoryId || locationType || employmentType || debouncedSearch);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold mb-2">{settings?.heroTitle ?? "Ultrasound Career Network"}</h1>
            <p className="text-teal-100 text-lg mb-6">{settings?.heroSubtitle ?? "Find your next opportunity in ultrasound and echocardiography"}</p>
            {/* Search bar */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search jobs, companies, keywords..."
                  className="pl-9 bg-white text-gray-900 border-0 h-11 rounded-xl"
                />
              </div>
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 h-11 px-4 rounded-xl"
              >
                <Filter className="h-4 w-4 mr-2" /> Filters {hasFilters && <span className="ml-1 bg-white text-teal-700 rounded-full w-4 h-4 text-xs flex items-center justify-center font-bold">!</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar filters */}
          <aside className={`${showFilters ? "block" : "hidden lg:block"} w-56 flex-shrink-0 space-y-4`}>
            <div className="bg-white rounded-xl border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-700">Filters</h3>
                {hasFilters && <button onClick={clearFilters} className="text-xs text-teal-600 hover:underline flex items-center gap-1"><X className="h-3 w-3" />Clear</button>}
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Category</label>
                <div className="space-y-1">
                  <button
                    onClick={() => { setCategoryId(undefined); setPage(1); }}
                    className={`w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors ${!categoryId ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    All Categories
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setCategoryId(cat.id); setPage(1); }}
                      className={`w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${categoryId === cat.id ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color ?? "#0d9488" }} />
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location type */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Location Type</label>
                <Select value={locationType ?? "all"} onValueChange={v => { setLocationType(v === "all" ? undefined : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Employment type */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Employment Type</label>
                <Select value={employmentType ?? "all"} onValueChange={v => { setEmploymentType(v === "all" ? undefined : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="per_diem">Per Diem</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="prn">PRN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-white rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">My Career</h3>
              {user ? (
                <>
                  <Link href="/career/profile">
                    <button className="w-full text-left text-sm px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                      <User className="h-4 w-4 text-teal-500" /> My Profile
                    </button>
                  </Link>
                  <Link href="/career/resumes">
                    <button className="w-full text-left text-sm px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-teal-500" /> My Resumes
                    </button>
                  </Link>
                  <Link href="/career/applications">
                    <button className="w-full text-left text-sm px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-teal-500" /> My Applications
                    </button>
                  </Link>
                </>
              ) : (
                <p className="text-xs text-gray-400">Log in to manage your career profile and applications.</p>
              )}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {isLoading ? "Loading..." : `${jobsData?.total ?? 0} job${(jobsData?.total ?? 0) !== 1 ? "s" : ""} found`}
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                  <X className="h-3 w-3" /> Clear all filters
                </button>
              )}
            </div>

            {/* Featured jobs */}
            {featuredJobs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 uppercase tracking-wide">
                  <Star className="h-3.5 w-3.5 fill-amber-400" /> Featured
                </div>
                {featuredJobs.map(job => (
                  <JobCard key={job.id} job={job} categories={categories} onClick={() => setSelectedJobId(job.id)} />
                ))}
              </div>
            )}

            {/* Regular jobs */}
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              </div>
            ) : regularJobs.length === 0 && featuredJobs.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border">
                <Briefcase className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-700 mb-1">No jobs found</h3>
                <p className="text-sm text-gray-400">Try adjusting your filters or search terms.</p>
                {hasFilters && <Button variant="outline" onClick={clearFilters} className="mt-4 text-sm">Clear Filters</Button>}
              </div>
            ) : (
              <div className="space-y-2">
                {regularJobs.map(job => (
                  <JobCard key={job.id} job={job} categories={categories} onClick={() => setSelectedJobId(job.id)} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Job Detail Modal */}
      <Dialog open={!!selectedJobId} onOpenChange={open => { if (!open) setSelectedJobId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Job Details</DialogTitle>
          </DialogHeader>
          {selectedJobId && <JobDetailModal jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
