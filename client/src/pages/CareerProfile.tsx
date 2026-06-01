import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
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
  User, FileText, Briefcase, Sparkles, Upload, Trash2, Star, StarOff,
  Loader2, Plus, X, Download, Eye, ArrowLeft, CheckCircle2, Edit2, Save
} from "lucide-react";

const AVAILABILITY_LABELS: Record<string, string> = {
  immediately: "Available Immediately",
  "2_weeks": "2 Weeks Notice",
  "1_month": "1 Month Notice",
  "3_months": "3 Months Notice",
  not_looking: "Not Currently Looking",
};

// ─── AI Resume Builder Dialog ─────────────────────────────────────────────────
function AiResumeBuilderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    currentRole: "", yearsExperience: "", specialties: [] as string[], certifications: [] as string[],
    education: "", workHistory: "", targetJobTitle: "", targetJobDescription: "", additionalInfo: "",
  });
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const [result, setResult] = useState<{ id: number; resume: { summary: string; skills: string[]; experience: Array<{ title: string; company: string; dates: string; bullets: string[] }>; education: Array<{ degree: string; institution: string; year: string }>; certifications: Array<{ name: string; issuer: string; year: string }> } } | null>(null);

  const buildMutation = trpc.careerNetwork.buildResumeWithAi.useMutation({
    onSuccess: (data) => { setResult(data); setStep(3); onCreated(); },
    onError: (e) => { toast.error(e.message); },
  });

  const addSpecialty = () => {
    if (specialtyInput.trim()) { setForm(f => ({ ...f, specialties: [...f.specialties, specialtyInput.trim()] })); setSpecialtyInput(""); }
  };
  const addCert = () => {
    if (certInput.trim()) { setForm(f => ({ ...f, certifications: [...f.certifications, certInput.trim()] })); setCertInput(""); }
  };

  return (
    <div className="space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex items-center gap-1 ${s < step ? "text-teal-600" : s === step ? "text-teal-700 font-semibold" : "text-gray-300"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${s < step ? "bg-teal-100 text-teal-600" : s === step ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-400"}`}>
              {s < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
            </div>
            <span className="text-xs hidden sm:block">{s === 1 ? "Background" : s === 2 ? "Target Role" : "Review"}</span>
            {s < 3 && <div className="w-8 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Your Background</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Current Role</label>
              <Input value={form.currentRole} onChange={e => setForm(f => ({ ...f, currentRole: e.target.value }))} placeholder="e.g. Cardiac Sonographer" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Years of Experience</label>
              <Input type="number" value={form.yearsExperience} onChange={e => setForm(f => ({ ...f, yearsExperience: e.target.value }))} placeholder="e.g. 8" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Specialties</label>
            <div className="flex gap-2 mb-2">
              <Input value={specialtyInput} onChange={e => setSpecialtyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addSpecialty()} placeholder="e.g. Echocardiography" className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={addSpecialty}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.specialties.map(s => <Badge key={s} className="bg-teal-50 text-teal-700 gap-1">{s}<button onClick={() => setForm(f => ({ ...f, specialties: f.specialties.filter(x => x !== s) }))}><X className="h-3 w-3" /></button></Badge>)}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Certifications</label>
            <div className="flex gap-2 mb-2">
              <Input value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addCert()} placeholder="e.g. RDCS, RVT, RDMS" className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={addCert}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.certifications.map(c => <Badge key={c} className="bg-blue-50 text-blue-700 gap-1">{c}<button onClick={() => setForm(f => ({ ...f, certifications: f.certifications.filter(x => x !== c) }))}><X className="h-3 w-3" /></button></Badge>)}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Education</label>
            <Input value={form.education} onChange={e => setForm(f => ({ ...f, education: e.target.value }))} placeholder="e.g. AS in Diagnostic Medical Sonography, XYZ College, 2016" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Work History Summary</label>
            <textarea value={form.workHistory} onChange={e => setForm(f => ({ ...f, workHistory: e.target.value }))} rows={4} placeholder="Briefly describe your work history, key responsibilities, and achievements..." className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <Button onClick={() => setStep(2)} className="w-full bg-teal-600 hover:bg-teal-700 text-white">Continue</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Target Role (Optional)</h3>
          <p className="text-sm text-gray-500">Providing a target role helps the AI tailor your resume for that specific position.</p>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Target Job Title</label>
            <Input value={form.targetJobTitle} onChange={e => setForm(f => ({ ...f, targetJobTitle: e.target.value }))} placeholder="e.g. Senior Echocardiographer" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Job Description (paste if available)</label>
            <textarea value={form.targetJobDescription} onChange={e => setForm(f => ({ ...f, targetJobDescription: e.target.value }))} rows={5} placeholder="Paste the job description here for a tailored resume..." className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Additional Information</label>
            <textarea value={form.additionalInfo} onChange={e => setForm(f => ({ ...f, additionalInfo: e.target.value }))} rows={3} placeholder="Awards, publications, volunteer work, languages..." className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button
              onClick={() => buildMutation.mutate({ ...form, yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined })}
              disabled={buildMutation.isPending}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {buildMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Building Resume...</> : <><Sparkles className="h-4 w-4 mr-2" />Build with AI</>}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Resume Created!</p>
              <p className="text-xs">Your AI-generated resume has been saved to your profile.</p>
            </div>
          </div>
          <div className="border rounded-xl p-4 space-y-3 max-h-80 overflow-y-auto bg-gray-50">
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Summary</h4>
              <p className="text-sm text-gray-700">{result.resume.summary}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Skills</h4>
              <div className="flex flex-wrap gap-1">{result.resume.skills.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div>
            </div>
            {result.resume.experience.map((e, i) => (
              <div key={i}>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Experience</h4>
                <p className="text-sm font-medium">{e.title} — {e.company} ({e.dates})</p>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5 mt-1">{e.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
              </div>
            ))}
          </div>
          <Button onClick={onClose} className="w-full bg-teal-600 hover:bg-teal-700 text-white">Done</Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CareerProfile({ defaultTab = "profile" }: { defaultTab?: string }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading: profileLoading } = trpc.careerNetwork.getMyCandidateProfile.useQuery();
  const { data: myResumes = [], isLoading: resumesLoading } = trpc.careerNetwork.getMyResumes.useQuery();
  const { data: myApps = [] } = trpc.careerNetwork.getMyApplications.useQuery();

  const [profileForm, setProfileForm] = useState({
    headline: "", bio: "", location: "", phone: "", linkedinUrl: "", portfolioUrl: "",
    yearsExperience: "", specialties: [] as string[], certifications: [] as string[],
    availability: "not_looking", desiredSalary: "", desiredLocationType: "any", isPublic: false,
  });
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [certInput, setCertInput] = useState("");

  const saveProfileMutation = trpc.careerNetwork.saveCandidateProfile.useMutation({
    onSuccess: () => { toast.success("Profile saved!"); utils.careerNetwork.getMyCandidateProfile.invalidate(); setEditingProfile(false); },
    onError: (e) => { toast.error(e.message); },
  });

  const deleteResumeMutation = trpc.careerNetwork.deleteResume.useMutation({
    onSuccess: () => { toast.success("Resume deleted."); utils.careerNetwork.getMyResumes.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });

  const saveResumeMutation = trpc.careerNetwork.saveResume.useMutation({
    onSuccess: () => { utils.careerNetwork.getMyResumes.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });

  const uploadResumeMutation = trpc.careerNetwork.uploadResumePdf.useMutation({
    onSuccess: () => { toast.success("Resume uploaded!"); utils.careerNetwork.getMyResumes.invalidate(); },
    onError: (e) => { toast.error(e.message); },
  });

  const startEditProfile = () => {
    if (profile) {
      setProfileForm({
        headline: profile.headline ?? "",
        bio: profile.bio ?? "",
        location: profile.location ?? "",
        phone: profile.phone ?? "",
        linkedinUrl: profile.linkedinUrl ?? "",
        portfolioUrl: profile.portfolioUrl ?? "",
        yearsExperience: String(profile.yearsExperience ?? ""),
        specialties: profile.specialties ? (() => { try { return JSON.parse(profile.specialties!); } catch { return []; } })() : [],
        certifications: profile.certifications ? (() => { try { return JSON.parse(profile.certifications!); } catch { return []; } })() : [],
        availability: profile.availability ?? "not_looking",
        desiredSalary: profile.desiredSalary ?? "",
        desiredLocationType: profile.desiredLocationType ?? "any",
        isPublic: profile.isPublic ?? false,
      });
    }
    setEditingProfile(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error("File must be under 16 MB"); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadResumeMutation.mutate({ fileName: file.name, fileBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!user) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <User className="h-12 w-12 text-gray-200 mx-auto mb-3" />
        <h2 className="font-semibold text-gray-700 mb-1">Sign in to manage your career profile</h2>
        <p className="text-sm text-gray-400">Track applications, upload resumes, and build your profile.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/career-network">
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Career Network
            </button>
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="font-semibold text-gray-900">My Career Profile</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="profile"><User className="h-4 w-4 mr-1.5" />Profile</TabsTrigger>
            <TabsTrigger value="resumes"><FileText className="h-4 w-4 mr-1.5" />Resumes ({myResumes.length})</TabsTrigger>
            <TabsTrigger value="applications"><Briefcase className="h-4 w-4 mr-1.5" />Applications ({myApps.length})</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Candidate Profile</CardTitle>
                {!editingProfile && (
                  <Button variant="outline" size="sm" onClick={startEditProfile}>
                    <Edit2 className="h-4 w-4 mr-1.5" /> Edit Profile
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {profileLoading ? (
                  <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
                ) : editingProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Professional Headline</label>
                        <Input value={profileForm.headline} onChange={e => setProfileForm(f => ({ ...f, headline: e.target.value }))} placeholder="e.g. Registered Cardiac Sonographer | 10+ Years Experience" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
                        <Input value={profileForm.location} onChange={e => setProfileForm(f => ({ ...f, location: e.target.value }))} placeholder="City, State" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Phone</label>
                        <Input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Years of Experience</label>
                        <Input type="number" value={profileForm.yearsExperience} onChange={e => setProfileForm(f => ({ ...f, yearsExperience: e.target.value }))} placeholder="0" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Availability</label>
                        <Select value={profileForm.availability} onValueChange={v => setProfileForm(f => ({ ...f, availability: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(AVAILABILITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">LinkedIn URL</label>
                        <Input value={profileForm.linkedinUrl} onChange={e => setProfileForm(f => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Portfolio / Website</label>
                        <Input value={profileForm.portfolioUrl} onChange={e => setProfileForm(f => ({ ...f, portfolioUrl: e.target.value }))} placeholder="https://..." />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Desired Salary</label>
                        <Input value={profileForm.desiredSalary} onChange={e => setProfileForm(f => ({ ...f, desiredSalary: e.target.value }))} placeholder="e.g. $80k–$100k/yr" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Desired Work Type</label>
                        <Select value={profileForm.desiredLocationType} onValueChange={v => setProfileForm(f => ({ ...f, desiredLocationType: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            <SelectItem value="remote">Remote</SelectItem>
                            <SelectItem value="onsite">On-site</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Bio</label>
                      <textarea value={profileForm.bio} onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))} rows={4} placeholder="Tell employers about yourself..." className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Specialties</label>
                      <div className="flex gap-2 mb-2">
                        <Input value={specialtyInput} onChange={e => setSpecialtyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (setProfileForm(f => ({ ...f, specialties: [...f.specialties, specialtyInput.trim()] })), setSpecialtyInput(""))} placeholder="Add specialty" className="flex-1" />
                        <Button type="button" variant="outline" size="sm" onClick={() => { if (specialtyInput.trim()) { setProfileForm(f => ({ ...f, specialties: [...f.specialties, specialtyInput.trim()] })); setSpecialtyInput(""); } }}><Plus className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex flex-wrap gap-1">{profileForm.specialties.map(s => <Badge key={s} className="bg-teal-50 text-teal-700 gap-1">{s}<button onClick={() => setProfileForm(f => ({ ...f, specialties: f.specialties.filter(x => x !== s) }))}><X className="h-3 w-3" /></button></Badge>)}</div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Certifications</label>
                      <div className="flex gap-2 mb-2">
                        <Input value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (setProfileForm(f => ({ ...f, certifications: [...f.certifications, certInput.trim()] })), setCertInput(""))} placeholder="e.g. RDCS, RVT" className="flex-1" />
                        <Button type="button" variant="outline" size="sm" onClick={() => { if (certInput.trim()) { setProfileForm(f => ({ ...f, certifications: [...f.certifications, certInput.trim()] })); setCertInput(""); } }}><Plus className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex flex-wrap gap-1">{profileForm.certifications.map(c => <Badge key={c} className="bg-blue-50 text-blue-700 gap-1">{c}<button onClick={() => setProfileForm(f => ({ ...f, certifications: f.certifications.filter(x => x !== c) }))}><X className="h-3 w-3" /></button></Badge>)}</div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Switch checked={profileForm.isPublic} onCheckedChange={v => setProfileForm(f => ({ ...f, isPublic: v }))} />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Make profile visible to employers</p>
                        <p className="text-xs text-gray-400">Employers and admins can browse your profile when enabled.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => saveProfileMutation.mutate({ ...profileForm, yearsExperience: profileForm.yearsExperience ? Number(profileForm.yearsExperience) : undefined })}
                        disabled={saveProfileMutation.isPending}
                        className="bg-teal-600 hover:bg-teal-700 text-white flex-1"
                      >
                        {saveProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Profile
                      </Button>
                      <Button variant="outline" onClick={() => setEditingProfile(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : profile ? (
                  <div className="space-y-4">
                    {profile.headline && <p className="font-medium text-gray-900">{profile.headline}</p>}
                    {profile.bio && <p className="text-sm text-gray-600">{profile.bio}</p>}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {profile.location && <div><span className="text-gray-400">Location:</span> <span className="text-gray-700">{profile.location}</span></div>}
                      {profile.yearsExperience && <div><span className="text-gray-400">Experience:</span> <span className="text-gray-700">{profile.yearsExperience} years</span></div>}
                      {profile.availability && <div><span className="text-gray-400">Availability:</span> <span className="text-gray-700">{AVAILABILITY_LABELS[profile.availability]}</span></div>}
                      {profile.desiredSalary && <div><span className="text-gray-400">Desired Salary:</span> <span className="text-gray-700">{profile.desiredSalary}</span></div>}
                    </div>
                    {profile.specialties && (() => { try { const s = JSON.parse(profile.specialties!); return s.length > 0 ? <div className="flex flex-wrap gap-1">{s.map((x: string) => <Badge key={x} className="bg-teal-50 text-teal-700">{x}</Badge>)}</div> : null; } catch { return null; } })()}
                    {profile.certifications && (() => { try { const c = JSON.parse(profile.certifications!); return c.length > 0 ? <div className="flex flex-wrap gap-1">{c.map((x: string) => <Badge key={x} className="bg-blue-50 text-blue-700">{x}</Badge>)}</div> : null; } catch { return null; } })()}
                    <div className={`flex items-center gap-2 text-xs ${profile.isPublic ? "text-green-600" : "text-gray-400"}`}>
                      <div className={`w-2 h-2 rounded-full ${profile.isPublic ? "bg-green-500" : "bg-gray-300"}`} />
                      {profile.isPublic ? "Profile visible to employers" : "Profile hidden from employers"}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <User className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-3">You haven't set up your career profile yet.</p>
                    <Button onClick={() => setEditingProfile(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
                      <Plus className="h-4 w-4 mr-2" /> Create Profile
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resumes Tab */}
          <TabsContent value="resumes">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={() => setShowAiBuilder(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
                  <Sparkles className="h-4 w-4 mr-2" /> Build with AI
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadResumeMutation.isPending}>
                  {uploadResumeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload PDF / DOCX
                </Button>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
              </div>

              {resumesLoading ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
              ) : myResumes.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border">
                  <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-1">No resumes yet</p>
                  <p className="text-xs text-gray-400">Upload a PDF or let AI build one for you.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myResumes.map(resume => (
                    <Card key={resume.id} className={`border ${resume.isPrimary ? "border-teal-300 bg-teal-50/20" : "border-gray-200"}`}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <FileText className={`h-8 w-8 flex-shrink-0 ${resume.isAiGenerated ? "text-purple-400" : "text-teal-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-gray-900 truncate">{resume.name}</p>
                            {resume.isAiGenerated && <Badge className="bg-purple-50 text-purple-700 text-xs">AI Generated</Badge>}
                            {resume.isPrimary && <Badge className="bg-teal-50 text-teal-700 text-xs">Primary</Badge>}
                          </div>
                          <p className="text-xs text-gray-400">{new Date(resume.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-1">
                          {resume.fileUrl && (
                            <a href={resume.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Download className="h-4 w-4" /></Button>
                            </a>
                          )}
                          <Button
                            variant="ghost" size="sm" className="h-8 w-8 p-0"
                            onClick={() => saveResumeMutation.mutate({ id: resume.id, name: resume.name, isPrimary: !resume.isPrimary })}
                          >
                            {resume.isPrimary ? <Star className="h-4 w-4 text-amber-400 fill-amber-400" /> : <StarOff className="h-4 w-4 text-gray-300" />}
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                            onClick={() => { if (confirm("Delete this resume?")) deleteResumeMutation.mutate({ id: resume.id }); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications">
            {myApps.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border">
                <Briefcase className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No applications yet.</p>
                <Link href="/career-network">
                  <Button variant="outline" className="mt-3 text-sm">Browse Jobs</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myApps.map(app => (
                  <Card key={app.id} className="border border-gray-200">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Briefcase className="h-8 w-8 text-teal-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{app.jobTitle}</p>
                        <p className="text-xs text-gray-500">{app.jobCompany} {app.jobLocation ? `• ${app.jobLocation}` : ""}</p>
                        <p className="text-xs text-gray-400">Applied {new Date(app.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge className={
                        app.status === "offer" ? "bg-green-50 text-green-700" :
                        app.status === "rejected" ? "bg-red-50 text-red-700" :
                        app.status === "interview" ? "bg-blue-50 text-blue-700" :
                        "bg-gray-50 text-gray-600"
                      }>
                        {app.status?.replace("_", " ") ?? "Submitted"}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Resume Builder Dialog */}
      <Dialog open={showAiBuilder} onOpenChange={setShowAiBuilder}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" /> AI Resume Builder
            </DialogTitle>
          </DialogHeader>
          <AiResumeBuilderDialog
            onClose={() => setShowAiBuilder(false)}
            onCreated={() => utils.careerNetwork.getMyResumes.invalidate()}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
