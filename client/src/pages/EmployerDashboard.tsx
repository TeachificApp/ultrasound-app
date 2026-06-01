import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, Briefcase, Users, CreditCard, CheckCircle2, ArrowLeft,
  ExternalLink, Loader2, Plus, Settings, Star, Globe, Mail, Phone,
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function EmployerDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  // Parse ?plan= and ?success= from URL
  const params = new URLSearchParams(window.location.search);
  const planParam = params.get("plan");
  const successParam = params.get("success");

  useEffect(() => {
    if (successParam === "job_post") {
      toast.success("Payment successful! You can now post a job.");
      setActiveTab("post-job");
    } else if (successParam === "subscription") {
      toast.success("Subscription activated! Welcome to the Employer Network.");
      setActiveTab("overview");
    }
  }, [successParam]);

  useEffect(() => {
    if (planParam && user) {
      setActiveTab("billing");
    }
  }, [planParam, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <Building2 className="h-12 w-12 text-teal-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Employer Dashboard</h2>
          <p className="text-gray-500 mb-6">Please log in to access your employer dashboard.</p>
          <Button
            onClick={() => { window.location.href = getLoginUrl("/employer/dashboard"); }}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            Log In to Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/career-network">
              <button className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
                <ArrowLeft className="h-4 w-4" /> Career Network
              </button>
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-600" /> Employer Dashboard
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="post-job">Post a Job</TabsTrigger>
            <TabsTrigger value="my-jobs">My Listings</TabsTrigger>
            <TabsTrigger value="candidates">Browse Candidates</TabsTrigger>
            <TabsTrigger value="profile">Company Profile</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab onTabChange={setActiveTab} planParam={planParam} /></TabsContent>
          <TabsContent value="post-job"><PostJobTab /></TabsContent>
          <TabsContent value="my-jobs"><MyJobsTab /></TabsContent>
          <TabsContent value="candidates"><CandidatesTab /></TabsContent>
          <TabsContent value="profile"><CompanyProfileTab /></TabsContent>
          <TabsContent value="billing"><BillingTab planParam={planParam} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ onTabChange, planParam }: { onTabChange: (t: string) => void; planParam: string | null }) {
  const { data: profile, isLoading } = trpc.careerNetwork.getMyEmployerProfile.useQuery();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;

  if (!profile) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <Building2 className="h-12 w-12 text-teal-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Set Up Your Employer Profile</h2>
            <p className="text-gray-500 mb-6">Create your company profile to start posting jobs and connecting with ultrasound professionals.</p>
            <Button onClick={() => onTabChange("profile")} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Create Company Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {profile.hasActiveSubscription ? (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-teal-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-teal-800">Employer Subscription Active</p>
            <p className="text-sm text-teal-600">Unlimited job posts + full candidate access</p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-800">No Active Subscription</p>
            <p className="text-sm text-amber-600">Upgrade to post unlimited jobs and browse all candidates</p>
          </div>
          <Button onClick={() => onTabChange("billing")} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0">
            View Plans
          </Button>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <button onClick={() => onTabChange("post-job")} className="bg-white border-2 border-dashed border-teal-200 hover:border-teal-400 rounded-xl p-6 text-center transition-colors group">
          <Plus className="h-8 w-8 text-teal-400 group-hover:text-teal-600 mx-auto mb-2" />
          <p className="font-semibold text-gray-700">Post a Job</p>
          <p className="text-xs text-gray-400 mt-1">$39/post or unlimited with subscription</p>
        </button>
        <button onClick={() => onTabChange("candidates")} className="bg-white border rounded-xl p-6 text-center hover:border-teal-300 transition-colors group">
          <Users className="h-8 w-8 text-teal-400 group-hover:text-teal-600 mx-auto mb-2" />
          <p className="font-semibold text-gray-700">Browse Candidates</p>
          <p className="text-xs text-gray-400 mt-1">Subscription required</p>
        </button>
        <button onClick={() => onTabChange("profile")} className="bg-white border rounded-xl p-6 text-center hover:border-teal-300 transition-colors group">
          <Settings className="h-8 w-8 text-teal-400 group-hover:text-teal-600 mx-auto mb-2" />
          <p className="font-semibold text-gray-700">Edit Profile</p>
          <p className="text-xs text-gray-400 mt-1">{profile.companyName}</p>
        </button>
      </div>
    </div>
  );
}

// ─── Post Job Tab ─────────────────────────────────────────────────────────────
function PostJobTab() {
  const { data: profile } = trpc.careerNetwork.getMyEmployerProfile.useQuery();
  const { data: categories = [] } = trpc.careerNetwork.listCategories.useQuery();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    title: "", company: "", location: "", locationType: "onsite",
    employmentType: "full_time", salary: "", description: "", applyUrl: "",
    applyEmail: "", categoryId: "", tags: "",
  });

  const createJobMutation = trpc.careerNetwork.createJob.useMutation({
    onSuccess: () => {
      toast.success("Job posted successfully!");
      utils.careerNetwork.getMyPostedJobs.invalidate();
      setForm({ title: "", company: "", location: "", locationType: "onsite", employmentType: "full_time", salary: "", description: "", applyUrl: "", applyEmail: "", categoryId: "", tags: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const checkoutMutation = trpc.careerNetwork.createJobPostCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => {
      if (checkoutUrl) window.open(checkoutUrl, "_blank");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Please set up your company profile first.</p>
        <Link href="/employer/dashboard?tab=profile">
          <Button variant="outline">Set Up Profile</Button>
        </Link>
      </div>
    );
  }

  const canPost = profile.hasActiveSubscription;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) {
      checkoutMutation.mutate();
      return;
    }
    createJobMutation.mutate({
      title: form.title,
      company: form.company || profile.companyName,
      location: form.location,
      locationType: form.locationType as any,
      employmentType: form.employmentType as any,
      salary: form.salary || undefined,
      description: form.description,
      applyUrl: form.applyUrl || undefined,
      applyEmail: form.applyEmail || undefined,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      tags: form.tags || undefined,
      isInternal: false,
    });
  };

  return (
    <div className="max-w-2xl">
      {!canPost && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <CreditCard className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Payment Required</p>
            <p className="text-sm text-amber-600">Posting a job costs $39 (30-day listing) or subscribe for unlimited posts at $199/mo.</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Post a New Job</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Job Title *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Cardiac Sonographer" required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Company</label>
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder={profile.companyName} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Location</label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, State or Remote" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Work Type</label>
                <select value={form.locationType} onChange={e => setForm(f => ({ ...f, locationType: e.target.value }))} className="w-full h-9 border rounded-md px-3 text-sm">
                  <option value="onsite">On-site</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Employment Type</label>
                <select value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))} className="w-full h-9 border rounded-md px-3 text-sm">
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="per_diem">Per Diem</option>
                  <option value="travel">Travel</option>
                  <option value="prn">PRN</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Salary / Rate</label>
                <Input value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="e.g. $35-42/hr or $75,000/yr" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
              <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className="w-full h-9 border rounded-md px-3 text-sm">
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Job Description *</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the role, requirements, and benefits..." rows={6} required />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Apply URL</label>
                <Input value={form.applyUrl} onChange={e => setForm(f => ({ ...f, applyUrl: e.target.value }))} placeholder="https://..." type="url" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Apply Email</label>
                <Input value={form.applyEmail} onChange={e => setForm(f => ({ ...f, applyEmail: e.target.value }))} placeholder="hr@company.com" type="email" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Tags</label>
              <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. echo, vascular, pediatric (comma separated)" />
            </div>
            <Button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11"
              disabled={createJobMutation.isPending || checkoutMutation.isPending}
            >
              {createJobMutation.isPending || checkoutMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                : canPost
                  ? <><Plus className="h-4 w-4 mr-2" /> Post Job</>
                  : <><CreditCard className="h-4 w-4 mr-2" /> Pay $39 &amp; Post Job</>
              }
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── My Jobs Tab ──────────────────────────────────────────────────────────────
function MyJobsTab() {
  const { data: myJobs = [], isLoading } = trpc.careerNetwork.getMyPostedJobs.useQuery();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;

  if (myJobs.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border">
        <Briefcase className="h-12 w-12 text-gray-200 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-700 mb-1">No job listings yet</h3>
        <p className="text-sm text-gray-400">Post your first job to start attracting candidates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {myJobs.map(job => (
        <div key={job.id} className="bg-white border rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{job.title}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-gray-500">{job.company}</span>
              {job.location && <span className="text-sm text-gray-400">{job.location}</span>}
              <Badge variant={job.status === "active" ? "default" : "secondary"} className="text-xs">
                {job.status}
              </Badge>
              {job.isFeatured && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200"><Star className="h-3 w-3 mr-1 fill-amber-400" />Featured</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 text-sm text-gray-400">
            <span>{job.viewCount ?? 0} views</span>
            <span>·</span>
            <span>{job.applyCount ?? 0} applies</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Candidates Tab ───────────────────────────────────────────────────────────
function CandidatesTab() {
  const { data: profile } = trpc.careerNetwork.getMyEmployerProfile.useQuery();
  const { data: candidates = [], isLoading } = trpc.careerNetwork.listCandidates.useQuery(
    { page: 1, pageSize: 20 },
    { enabled: !!profile?.hasActiveSubscription }
  );

  if (!profile?.hasActiveSubscription) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border max-w-lg mx-auto">
        <Users className="h-12 w-12 text-gray-200 mx-auto mb-4" />
        <h3 className="font-semibold text-gray-900 mb-2">Subscription Required</h3>
        <p className="text-gray-500 mb-6 text-sm">Browse and contact our full database of credentialed sonographers and echocardiographers with an Employer Subscription.</p>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-left mb-6">
          <p className="font-semibold text-teal-800 mb-2">$199/month includes:</p>
          <ul className="space-y-1 text-sm text-teal-700">
            {["Unlimited job listings", "Full candidate database access", "Direct candidate outreach", "Featured job placement"].map(f => (
              <li key={f} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0" />{f}</li>
            ))}
          </ul>
        </div>
        <SubscribeButton />
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;

  if (candidates.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border">
        <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-700 mb-1">No candidates yet</h3>
        <p className="text-sm text-gray-400">Candidates will appear here as they create profiles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {candidates.map((c: any) => (
        <div key={c.id} className="bg-white border rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{c.displayName || "Anonymous Candidate"}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {c.location && <span className="text-sm text-gray-500">{c.location}</span>}
              {c.credentials && <Badge variant="outline" className="text-xs">{c.credentials}</Badge>}
              {c.yearsExperience && <span className="text-sm text-gray-400">{c.yearsExperience} yrs exp</span>}
            </div>
          </div>
          {c.isOpenToWork && (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs flex-shrink-0">Open to Work</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Company Profile Tab ──────────────────────────────────────────────────────
function CompanyProfileTab() {
  const { data: profile, isLoading } = trpc.careerNetwork.getMyEmployerProfile.useQuery();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    companyName: "", companyWebsite: "", companyDescription: "",
    companyLogoUrl: "", contactEmail: "", contactName: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        companyName: profile.companyName ?? "",
        companyWebsite: profile.companyWebsite ?? "",
        companyDescription: profile.companyDescription ?? "",
        companyLogoUrl: profile.companyLogoUrl ?? "",
        contactEmail: profile.contactEmail ?? "",
        contactName: profile.contactName ?? "",
      });
    }
  }, [profile]);

  const upsertMutation = trpc.careerNetwork.upsertEmployerProfile.useMutation({
    onSuccess: () => {
      toast.success("Company profile saved!");
      utils.careerNetwork.getMyEmployerProfile.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Company Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={e => { e.preventDefault(); upsertMutation.mutate(form); }} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Company Name *</label>
              <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Your company name" required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Company Website</label>
              <Input value={form.companyWebsite} onChange={e => setForm(f => ({ ...f, companyWebsite: e.target.value }))} placeholder="https://..." type="url" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Company Logo URL</label>
              <Input value={form.companyLogoUrl} onChange={e => setForm(f => ({ ...f, companyLogoUrl: e.target.value }))} placeholder="https://..." type="url" />
              {form.companyLogoUrl && (
                <img src={form.companyLogoUrl} alt="Logo preview" className="mt-2 h-12 w-auto object-contain rounded border p-1" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Company Description</label>
              <Textarea value={form.companyDescription} onChange={e => setForm(f => ({ ...f, companyDescription: e.target.value }))} placeholder="Tell candidates about your organization..." rows={4} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Contact Name</label>
                <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="HR contact name" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Contact Email</label>
                <Input value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="hr@company.com" type="email" />
              </div>
            </div>
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────
function BillingTab({ planParam }: { planParam: string | null }) {
  const { data: profile } = trpc.careerNetwork.getMyEmployerProfile.useQuery();

  return (
    <div className="max-w-3xl space-y-6">
      {/* Current status */}
      {profile?.hasActiveSubscription ? (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 flex items-center gap-4">
          <CheckCircle2 className="h-8 w-8 text-teal-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-teal-800">Employer Subscription Active</p>
            <p className="text-sm text-teal-600">You have unlimited job posts and full candidate access.</p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border rounded-xl p-5">
          <p className="font-semibold text-gray-700 mb-1">No active subscription</p>
          <p className="text-sm text-gray-500">Choose a plan below to start hiring.</p>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid sm:grid-cols-2 gap-5">
        {/* Single post */}
        <div className="border-2 border-gray-200 rounded-2xl p-6 flex flex-col">
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Single Job Post</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">$39</span>
              <span className="text-gray-400 text-sm">/ post</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">One-time · 30-day listing</p>
          </div>
          <ul className="space-y-2 flex-1 mb-5 text-sm text-gray-600">
            {["1 active job listing", "30-day visibility", "Company branding", "Application notifications"].map(f => (
              <li key={f} className="flex items-center gap-2"><span className="text-teal-500 font-bold">✓</span>{f}</li>
            ))}
          </ul>
          <SinglePostButton />
        </div>

        {/* Subscription */}
        <div className="border-2 border-teal-500 rounded-2xl p-6 flex flex-col relative bg-gradient-to-br from-teal-50/40 to-white">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-teal-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">Most Popular</span>
          </div>
          <div className="mb-4">
            <div className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Employer Subscription</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">$199</span>
              <span className="text-gray-400 text-sm">/ month</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">Cancel anytime</p>
          </div>
          <ul className="space-y-2 flex-1 mb-5 text-sm text-gray-600">
            {["Unlimited job listings", "Browse all candidate profiles", "Direct outreach to candidates", "Featured job placement", "Priority support"].map(f => (
              <li key={f} className="flex items-center gap-2"><span className="text-teal-500 font-bold">✓</span>{f}</li>
            ))}
          </ul>
          {!profile?.hasActiveSubscription && <SubscribeButton />}
          {profile?.hasActiveSubscription && (
            <div className="text-center text-sm text-teal-600 font-medium">✓ Currently subscribed</div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Payments processed securely via Stripe. &nbsp;·&nbsp; Questions? <a href="mailto:info@allaboutultrasound.com" className="text-teal-600 hover:underline">Contact us</a>
      </p>
    </div>
  );
}

function SinglePostButton() {
  const mutation = trpc.careerNetwork.createJobPostCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => { if (checkoutUrl) window.open(checkoutUrl, "_blank"); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Button onClick={() => { toast.info("Redirecting to checkout..."); mutation.mutate(); }} variant="outline" className="w-full border-teal-600 text-teal-700 hover:bg-teal-50 font-semibold" disabled={mutation.isPending}>
      {mutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : "Pay $39 & Post"}
    </Button>
  );
}

function SubscribeButton() {
  const mutation = trpc.careerNetwork.createEmployerSubscriptionCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => { if (checkoutUrl) window.open(checkoutUrl, "_blank"); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Button onClick={() => { toast.info("Redirecting to checkout..."); mutation.mutate(); }} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold" disabled={mutation.isPending}>
      {mutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : "Subscribe — $199/mo"}
    </Button>
  );
}
