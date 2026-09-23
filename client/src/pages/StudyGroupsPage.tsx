import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Building2, CalendarDays, ChevronRight, Crown, LockKeyhole, Plus, Users, Video } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function StudyGroupsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: groups, isLoading } = trpc.studyGroups.listMine.useQuery(undefined, { enabled: Boolean(user) });
  const { data: pricing } = trpc.studyGroups.pricing.useQuery(undefined, { enabled: Boolean(user) });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<"zoom" | "teams" | "other" | "">("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [accessSignupIntent, setAccessSignupIntent] = useState<"organization" | "group_learning" | null>(null);
  const createGroup = trpc.studyGroups.create.useMutation({
    onSuccess: ({ groupId }) => {
      toast.success("Study group created");
      void utils.studyGroups.listMine.invalidate();
      setOpen(false);
      const setup = accessSignupIntent === "organization" ? "organization" : accessSignupIntent === "group_learning" ? "group-learning" : null;
      setAccessSignupIntent(null);
      navigate(`/study-groups/${groupId}${setup ? `?setup=${setup}` : ""}`);
    },
    onError: error => toast.error(error.message),
  });

  const create = () => createGroup.mutate({
    name,
    description: description || undefined,
    meetingProvider: provider || null,
    meetingUrl: meetingUrl || null,
  });

  const beginAccessSignup = (intent: "organization" | "group_learning") => {
    setAccessSignupIntent(intent);
    setOpen(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen overflow-hidden bg-slate-50">
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-teal-950 to-teal-700 text-white">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,rgba(94,234,212,.75),transparent_28%),radial-gradient(circle_at_85%_65%,rgba(45,212,191,.55),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Badge className="border border-white/20 bg-white/10 text-teal-50">Learn collaboration</Badge>
              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Study together. Keep every learner on track.</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-teal-100">Create a private Study Group for focused ultrasound education. Bring learners together with protected discussion, live meeting links, shared documents, tasks, and course access.</p>
              <div className="mt-8 flex flex-wrap gap-3"><Button size="lg" className="bg-white text-teal-900 hover:bg-teal-50" onClick={() => navigate("/login?returnTo=/study-groups")}>Sign in to create a group</Button><Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => navigate("/login?returnTo=/study-groups")}>Explore group access</Button></div>
              <p className="mt-4 text-sm text-teal-100">Already a learner? Sign in to see only the groups you belong to.</p>
            </div>
            <Card className="border-white/20 bg-white/95 text-slate-900 shadow-2xl"><CardHeader><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100"><Users className="h-6 w-6 text-teal-700" /></div><CardTitle className="mt-3">A private learning space</CardTitle><CardDescription>Designed for real study partners—not a public learner directory.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm text-slate-600"><div className="rounded-lg bg-teal-50 p-3"><strong className="block text-teal-900">Plan together</strong>Tasks, discussion, protected documents, and Zoom or Microsoft Teams links.</div><div className="rounded-lg bg-slate-50 p-3"><strong className="block text-slate-900">Learn together</strong>Assign eligible course, quiz, and download access to active participants.</div><div className="rounded-lg bg-amber-50 p-3"><strong className="block text-amber-900">Grow together</strong>Organization Access adds administrative controls and editable learning modules.</div></CardContent></Card>
          </div>
        </section>
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto mb-9 max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-[.18em] text-teal-700">Choose your starting point</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Study Groups that scale with your learners</h2><p className="mt-3 text-slate-600">Start free, build your participant list when you are ready, or add Organization Access for a managed learning environment.</p></div>
          <div className="grid gap-5 md:grid-cols-3">
            <Card className="border-teal-100"><CardHeader><Users className="h-6 w-6 text-teal-600" /><CardTitle className="mt-3">Free for up to 5</CardTitle><CardDescription>Private collaboration for a small study team.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>Invite by exact email, share protected documents, discuss material, and add a live meeting link.</p><Button variant="outline" className="w-full" onClick={() => navigate("/login?returnTo=/study-groups")}>Create a free group</Button></CardContent></Card>
            <Card className="border-amber-200 shadow-sm"><CardHeader><Crown className="h-6 w-6 text-amber-600" /><CardTitle className="mt-3">Organization Access</CardTitle><CardDescription>$49/month for one group of up to 20 members, or $99/month for up to three groups with unlimited members.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>Add organization administrators, editable group learning modules, and managed participant seats. Additional groups remain free with free-group limits.</p><Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => navigate("/login?returnTo=/study-groups")}>Sign in to choose a plan</Button></CardContent></Card>
            <Card className="border-indigo-100"><CardHeader><BookOpen className="h-6 w-6 text-indigo-600" /><CardTitle className="mt-3">Group Learning Access</CardTitle><CardDescription>Purchase eligible content seats for your active group.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>You may create the group first and invite participants later. The 10% group discount activates once three participants have actively joined.</p><Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/login?returnTo=/study-groups")}>Sign in to set up access</Button></CardContent></Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <section className="bg-gradient-to-br from-slate-950 via-teal-950 to-teal-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <Badge className="mb-4 bg-white/10 text-teal-100 border border-white/20">Learn collaboration</Badge>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Study Groups</h1>
              <p className="mt-3 text-base leading-7 text-teal-100">Build your learning community: create a private study group to share resources, organize tasks, and meet with fellow learners.</p>
            </div>
            <Button className="bg-white text-teal-800 hover:bg-teal-50" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Create a study group</Button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="border-teal-100"><CardHeader className="pb-3"><Users className="h-5 w-5 text-teal-600" /><CardTitle className="text-base">Free for up to {pricing?.freeSeatLimit ?? 5}</CardTitle></CardHeader><CardContent className="text-sm text-slate-600">Create a private group, invite participants by email, share documents, discuss material, set tasks, and add a Zoom or Teams link.</CardContent></Card>
          <Card className="border-amber-200"><CardHeader className="pb-3"><Crown className="h-5 w-5 text-amber-600" /><CardTitle className="text-base">Organization access</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>Choose one group with up to {pricing?.organizationUpToTwentySeatLimit ?? 20} members for ${((pricing?.organizationUpToTwentyMonthlyCents ?? 4900) / 100).toFixed(2)}/month, or up to three groups with unlimited members for ${((pricing?.organizationMonthlyCents ?? 9900) / 100).toFixed(2)}/month. Both include organization administrators, editable learning modules, and seat management; further groups stay free with free-group limits.</p><Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => beginAccessSignup("organization")}><Building2 className="mr-2 h-4 w-4" />Sign up for Organization access</Button></CardContent></Card>
          <Card className="border-indigo-100"><CardHeader className="pb-3"><BookOpen className="h-5 w-5 text-indigo-600" /><CardTitle className="text-base">Group learning access</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>Group and organization admins can purchase eligible course, quiz, and download seats. Create the group now and add at least three participants later; the 10% group discount activates once three participants have actively joined.</p><Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => beginAccessSignup("group_learning")}><BookOpen className="mr-2 h-4 w-4" />Set up Group Learning Access</Button></CardContent></Card>
        </div>

        <div className="mt-10 flex items-center justify-between"><div><h2 className="text-xl font-bold text-slate-900">My Study Groups</h2><p className="mt-1 text-sm text-slate-500">Only the groups you belong to are shown.</p></div><Button variant="outline" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New group</Button></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-xl bg-white border" />)}
          {!isLoading && groups?.map(group => (
            <Link key={group.id} href={`/study-groups/${group.id}`}>
              <Card className="h-full cursor-pointer border-slate-200 transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md">
                <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{group.name}</CardTitle><CardDescription className="mt-1 line-clamp-2">{group.description || "Private learner collaboration space"}</CardDescription></div>{group.isOrganizationActive ? <Badge className="bg-amber-100 text-amber-800"><Crown className="mr-1 h-3 w-3" />Organization</Badge> : <Badge variant="secondary">Free</Badge>}</div></CardHeader>
                <CardContent><div className="flex items-center justify-between text-sm text-slate-500"><span className="flex items-center gap-1"><Video className="h-4 w-4" />{group.meetingProvider === "teams" ? "Teams" : group.meetingProvider === "zoom" ? "Zoom" : "No meeting link"}</span><span className="flex items-center text-teal-700 font-medium">Open <ChevronRight className="h-4 w-4" /></span></div></CardContent>
              </Card>
            </Link>
          ))}
          {!isLoading && !groups?.length && <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><CalendarDays className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-800">Create your first private study group</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Bring together your study partners by their full email address and keep your collaboration in one place.</p><Button className="mt-5 bg-teal-600 hover:bg-teal-700" onClick={() => setOpen(true)}>Create study group</Button></div>}
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{accessSignupIntent === "organization" ? "Create a group for Organization Access" : accessSignupIntent === "group_learning" ? "Create a group for Group Learning Access" : "Create a private study group"}</DialogTitle><DialogDescription>{accessSignupIntent === "organization" ? "Create the private group first, then choose the Organization plan in the next step." : accessSignupIntent === "group_learning" ? "Create the private group first. You can invite the required three participants after it is created; the group discount applies once three participants have actively joined." : "The creator is the group admin. Free groups include up to five total active or invited participants."}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="sg-name">Group name</Label><Input id="sg-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., RVT Registry Review – Spring" /></div><div className="space-y-2"><Label htmlFor="sg-description">Description <span className="text-slate-400">(optional)</span></Label><Textarea id="sg-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this group preparing for?" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Live meeting platform <span className="text-slate-400">(optional)</span></Label><Select value={provider} onValueChange={(value: "zoom" | "teams" | "other") => setProvider(value)}><SelectTrigger><SelectValue placeholder="Choose a platform" /></SelectTrigger><SelectContent><SelectItem value="zoom">Zoom</SelectItem><SelectItem value="teams">Microsoft Teams</SelectItem><SelectItem value="other">Other secure link</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="sg-meeting">Meeting link</Label><Input id="sg-meeting" value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://…" /></div></div></div>
          <DialogFooter><Button variant="outline" onClick={() => { setOpen(false); setAccessSignupIntent(null); }}>Cancel</Button><Button disabled={name.trim().length < 2 || createGroup.isPending} className="bg-teal-600 hover:bg-teal-700" onClick={create}>{createGroup.isPending ? "Creating…" : accessSignupIntent ? "Create group and continue" : "Create group"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
