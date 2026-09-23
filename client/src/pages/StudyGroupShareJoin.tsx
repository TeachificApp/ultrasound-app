import { useMemo } from "react";
import { useLocation } from "wouter";
import { Link2, Users } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function StudyGroupShareJoin() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const token = useMemo(() => new URLSearchParams(location.split("?")[1] || "").get("token") || "", [location]);
  const accept = trpc.studyGroups.acceptShareLink.useMutation({
    onSuccess: ({ groupId }) => {
      toast.success("Welcome to the study group");
      navigate(`/study-groups/${groupId}`);
    },
    onError: error => toast.error(error.message),
  });

  if (!token) {
    return <div className="grid min-h-[60vh] place-items-center px-4"><Card className="max-w-md text-center"><CardHeader><CardTitle>Member link unavailable</CardTitle><CardDescription>This share link is incomplete or has been removed.</CardDescription></CardHeader><CardContent><Button onClick={() => navigate("/study-groups")}>Return to Study Groups</Button></CardContent></Card></div>;
  }
  if (!user) {
    return <div className="grid min-h-[60vh] place-items-center px-4"><Card className="max-w-md text-center"><CardHeader><Link2 className="mx-auto h-10 w-10 text-teal-600" /><CardTitle>Sign in to join this Study Group</CardTitle><CardDescription>Share links are private. Sign in or create a free account, then return here to join as a group participant.</CardDescription></CardHeader><CardContent><Button className="bg-teal-600 hover:bg-teal-700" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(location)}`)}>Sign in to join</Button></CardContent></Card></div>;
  }
  return <div className="grid min-h-[60vh] place-items-center px-4"><Card className="max-w-md text-center"><CardHeader><Users className="mx-auto h-10 w-10 text-teal-600" /><CardTitle>Join this private Study Group</CardTitle><CardDescription>Joining gives this account participant access to the group’s private discussion, tasks, and shared documents. This link never grants administrator access.</CardDescription></CardHeader><CardContent><Button disabled={accept.isPending} className="bg-teal-600 hover:bg-teal-700" onClick={() => accept.mutate({ token })}>{accept.isPending ? "Joining…" : "Join Study Group"}</Button></CardContent></Card></div>;
}
