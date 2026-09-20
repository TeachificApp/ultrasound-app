import { useMemo } from "react";
import { useLocation } from "wouter";
import { MailCheck, Users } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function StudyGroupInvite() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const token = useMemo(() => new URLSearchParams(location.split("?")[1] || "").get("token") || "", [location]);
  const accept = trpc.studyGroups.acceptInvite.useMutation({
    onSuccess: ({ groupId }) => { toast.success("Welcome to the study group"); navigate(`/study-groups/${groupId}`); },
    onError: error => toast.error(error.message),
  });
  if (!token) return <div className="grid min-h-[60vh] place-items-center px-4"><Card className="max-w-md text-center"><CardHeader><CardTitle>Invitation link unavailable</CardTitle></CardHeader><CardContent><Button onClick={() => navigate("/study-groups")}>Browse Study Groups</Button></CardContent></Card></div>;
  if (!user) return <div className="grid min-h-[60vh] place-items-center px-4"><Card className="max-w-md text-center"><CardHeader><MailCheck className="mx-auto h-10 w-10 text-teal-600" /><CardTitle>Sign in with your invited email</CardTitle><CardDescription>Study Group invitations are private. Sign in using the full email address that received this invitation.</CardDescription></CardHeader><CardContent><Button className="bg-teal-600 hover:bg-teal-700" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(location)}`)}>Sign in to accept</Button></CardContent></Card></div>;
  return <div className="grid min-h-[60vh] place-items-center px-4"><Card className="max-w-md text-center"><CardHeader><Users className="mx-auto h-10 w-10 text-teal-600" /><CardTitle>Join your private Study Group</CardTitle><CardDescription>Accepting gives this account access to the group’s private discussion, tasks, and shared documents.</CardDescription></CardHeader><CardContent><Button disabled={accept.isPending} className="bg-teal-600 hover:bg-teal-700" onClick={() => accept.mutate({ token })}>{accept.isPending ? "Joining…" : "Accept invitation"}</Button></CardContent></Card></div>;
}
