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
      <div className="min-h-screen overflow-hidden bg-[#f7fbfb]">
        <section className="relative isolate overflow-hidden border-b-4 border-teal-200 bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-600 text-white">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,rgba(94,234,212,.75),transparent_28%),radial-gradient(circle_at_85%_65%,rgba(45,212,191,.55),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Badge className="border border-white/35 bg-white/10 text-teal-50">Education Library · Learn together</Badge>
              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Make study time count.</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-teal-50">Turn individual preparation into shared momentum. Bring the people who help you stay accountable, build confidence, and reach the next milestone together.</p>
              <div className="mt-8 flex flex-wrap gap-3"><Button size="lg" className="bg-white text-teal-900 hover:bg-teal-50" onClick={() => navigate("/login?returnTo=/study-groups")}>Create your Study Group</Button><Button size="lg" variant="outline" className="border-white/60 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => navigate("/login?returnTo=/study-groups")}>See group options</Button></div>
              <p className="mt-4 text-sm text-teal-50">Already a learner? Sign in to continue with your Study Groups.</p>
            </div>
            <Card className="border-white/30 bg-white/95 text-slate-900 shadow-2xl"><CardHeader><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100"><Users className="h-6 w-6 text-teal-700" /></div><CardTitle className="mt-3">Your goals deserve a team</CardTitle><CardDescription>One focused place for the learners who want more from every study session.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm text-slate-600"><div className="rounded-lg bg-teal-50 p-3"><strong className="block text-teal-900">Show up stronger</strong>Create the rhythm that turns “someday” into steady progress.</div><div className="rounded-lg bg-slate-50 p-3"><strong className="block text-slate-900">Learn with purpose</strong>Keep the right people close to each goal, course, and milestone.</div><div className="rounded-lg bg-teal-50 p-3"><strong className="block text-teal-900">Grow what matters</strong>Give a learning community the energy and structure to go further.</div></CardContent></Card>
          </div>
        </section>
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto mb-9 max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-[.18em] text-teal-700">Choose your next step</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Built for learners who are going places</h2><p className="mt-3 text-slate-600">Start with your closest study partners, or create a standout learning experience for a larger community.</p></div>
          <div className="grid gap-5 md:grid-cols-3">
            <Card className="border-teal-100 bg-white"><CardHeader><Users className="h-6 w-6 text-teal-600" /><CardTitle className="mt-3">Start your winning circle</CardTitle><CardDescription>Free for up to five learners.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>Bring together the people who keep you motivated, focused, and ready for the next breakthrough.</p><Button variant="outline" className="w-full border-teal-300 text-teal-800 hover:bg-teal-50" onClick={() => navigate("/login?returnTo=/study-groups")}>Start free</Button></CardContent></Card>
            <Card className="border-teal-300 bg-white shadow-sm"><CardHeader><Crown className="h-6 w-6 text-teal-600" /><CardTitle className="mt-3">Lead a learning community</CardTitle><CardDescription>Organization Access from $49/month.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>Create a high-touch learning experience that keeps your people engaged, aligned, and moving toward the next milestone.</p><Button className="w-full bg-teal-700 hover:bg-teal-800" onClick={() => navigate("/login?returnTo=/study-groups")}>Choose Organization Access</Button></CardContent></Card>
            <Card className="border-teal-100 bg-white"><CardHeader><BookOpen className="h-6 w-6 text-teal-600" /><CardTitle className="mt-3">Share the finish line</CardTitle><CardDescription>Group Learning Access for shared goals.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>Give your team a clearer path to the course, quiz, and resource experiences that move learning forward together.</p><Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => navigate("/login?returnTo=/study-groups")}>Explore Group Learning</Button></CardContent></Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <section className="border-b-4 border-teal-200 bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <Badge className="mb-4 border border-white/35 bg-white/10 text-teal-50">Education Library · Learn together</Badge>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Study together. Go further.</h1>
              <p className="mt-3 text-base leading-7 text-teal-50">Your learning goals get more powerful when the right people are moving toward them with you.</p>
            </div>
            <Button className="bg-white text-teal-800 hover:bg-teal-50" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Create a study group</Button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="border-teal-100 bg-white"><CardHeader className="pb-3"><Users className="h-5 w-5 text-teal-600" /><CardTitle className="text-base">Start your winning circle</CardTitle></CardHeader><CardContent className="text-sm text-slate-600">Create a focused home base for up to {pricing?.freeSeatLimit ?? 5} people who want to make every study session matter.</CardContent></Card>
          <Card className="border-teal-300 bg-white"><CardHeader className="pb-3"><Crown className="h-5 w-5 text-teal-600" /><CardTitle className="text-base">Lead a learning community</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>Give your people a standout learning experience with Organization Access from ${((pricing?.organizationUpToTwentyMonthlyCents ?? 4900) / 100).toFixed(2)}/month.</p><Button className="w-full bg-teal-700 hover:bg-teal-800" onClick={() => beginAccessSignup("organization")}><Building2 className="mr-2 h-4 w-4" />Choose Organization Access</Button></CardContent></Card>
          <Card className="border-teal-100 bg-white"><CardHeader className="pb-3"><BookOpen className="h-5 w-5 text-teal-600" /><CardTitle className="text-base">Share the finish line</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>Bring a group into the course, quiz, and resource experiences that move shared goals forward.</p><Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => beginAccessSignup("group_learning")}><BookOpen className="mr-2 h-4 w-4" />Explore Group Learning</Button></CardContent></Card>
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
