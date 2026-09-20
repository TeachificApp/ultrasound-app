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
  const createGroup = trpc.studyGroups.create.useMutation({
    onSuccess: ({ groupId }) => {
      toast.success("Study group created");
      void utils.studyGroups.listMine.invalidate();
      setOpen(false);
      navigate(`/study-groups/${groupId}`);
    },
    onError: error => toast.error(error.message),
  });

  const create = () => createGroup.mutate({
    name,
    description: description || undefined,
    meetingProvider: provider || null,
    meetingUrl: meetingUrl || null,
  });

  if (!user) {
    return (
      <div className="min-h-[65vh] grid place-items-center bg-slate-50 px-4">
        <Card className="max-w-lg text-center border-teal-100 shadow-lg">
          <CardHeader><LockKeyhole className="mx-auto h-10 w-10 text-teal-600" /><CardTitle>Study together on Learn</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-slate-600">
            <p>Create a private group, invite other platform learners by full email, and collaborate around your education.</p>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => navigate("/login")}>Sign in to use Study Groups</Button>
          </CardContent>
        </Card>
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
              <p className="mt-3 text-base leading-7 text-teal-100">A private space to prepare, share resources, set tasks, and meet with other learners. Invite by their full email address—there is no learner directory lookup.</p>
            </div>
            <Button className="bg-white text-teal-800 hover:bg-teal-50" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Create a study group</Button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="border-teal-100"><CardHeader className="pb-3"><Users className="h-5 w-5 text-teal-600" /><CardTitle className="text-base">Free for up to {pricing?.freeSeatLimit ?? 5}</CardTitle></CardHeader><CardContent className="text-sm text-slate-600">Create a private group, invite participants by email, share documents, discuss material, set tasks, and add a Zoom or Teams link.</CardContent></Card>
          <Card className="border-amber-200"><CardHeader className="pb-3"><Crown className="h-5 w-5 text-amber-600" /><CardTitle className="text-base">Organization access</CardTitle></CardHeader><CardContent className="text-sm text-slate-600">Unlimited participants, organization administrators, editable learning modules, and seat management for $99/month.</CardContent></Card>
          <Card className="border-indigo-100"><CardHeader className="pb-3"><BookOpen className="h-5 w-5 text-indigo-600" /><CardTitle className="text-base">Group learning access</CardTitle></CardHeader><CardContent className="text-sm text-slate-600">Group and organization admins can purchase eligible course, quiz, and download seats at an automatic 10% group discount.</CardContent></Card>
        </div>

        <div className="mt-10 flex items-center justify-between"><div><h2 className="text-xl font-bold text-slate-900">Your study groups</h2><p className="mt-1 text-sm text-slate-500">Only the groups you belong to are shown.</p></div><Button variant="outline" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New group</Button></div>
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
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Create a private study group</DialogTitle><DialogDescription>The creator is the group admin. Free groups include up to five total active or invited participants.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="sg-name">Group name</Label><Input id="sg-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., RVT Registry Review – Spring" /></div><div className="space-y-2"><Label htmlFor="sg-description">Description <span className="text-slate-400">(optional)</span></Label><Textarea id="sg-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this group preparing for?" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Live meeting platform <span className="text-slate-400">(optional)</span></Label><Select value={provider} onValueChange={(value: "zoom" | "teams" | "other") => setProvider(value)}><SelectTrigger><SelectValue placeholder="Choose a platform" /></SelectTrigger><SelectContent><SelectItem value="zoom">Zoom</SelectItem><SelectItem value="teams">Microsoft Teams</SelectItem><SelectItem value="other">Other secure link</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="sg-meeting">Meeting link</Label><Input id="sg-meeting" value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://…" /></div></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={name.trim().length < 2 || createGroup.isPending} className="bg-teal-600 hover:bg-teal-700" onClick={create}>{createGroup.isPending ? "Creating…" : "Create group"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
