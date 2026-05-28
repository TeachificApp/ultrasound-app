import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Clock, Video, ExternalLink, PlayCircle, FileText,
  Upload, Link2, CheckCircle, AlertCircle, BookOpen, ChevronLeft
} from "lucide-react";

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "TBD";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(d: Date | string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isUpcoming(d: Date | string | null | undefined) {
  if (!d) return false;
  return new Date(d) > new Date();
}

function isPast(d: Date | string | null | undefined) {
  if (!d) return false;
  return new Date(d) < new Date();
}

function isDueSoon(d: Date | string | null | undefined) {
  if (!d) return false;
  const dt = new Date(d);
  const now = new Date();
  const diff = dt.getTime() - now.getTime();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // within 3 days
}

const submissionIcon = {
  text: <FileText className="w-4 h-4" />,
  file: <Upload className="w-4 h-4" />,
  url: <Link2 className="w-4 h-4" />,
  none: <CheckCircle className="w-4 h-4" />,
};

const submissionLabel = {
  text: "Text response",
  file: "File upload",
  url: "Link submission",
  none: "No submission required",
};

export default function CohortSchedule() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const id = parseInt(courseId ?? "0", 10);

  const { data, isLoading, error } = trpc.lmsLearner.getCohortSchedule.useQuery(
    { courseId: id },
    { enabled: !!user && id > 0 }
  );

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading cohort schedule…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <BookOpen className="w-12 h-12 text-teal-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to view your cohort</h2>
          <p className="text-gray-500 mb-6">You need to be signed in and enrolled to access this cohort schedule.</p>
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access denied</h2>
          <p className="text-gray-500 mb-6">
            {error?.message === "You are not enrolled in this cohort"
              ? "You are not enrolled in this cohort. Please purchase the course to gain access."
              : "This cohort could not be found or you do not have access."}
          </p>
          <Button asChild variant="outline">
            <Link href="/my-courses">Back to My Courses</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { course, sessions, assignments } = data;
  const upcomingSessions = sessions.filter(s => isUpcoming(s.sessionDate));
  const pastSessions = sessions.filter(s => isPast(s.sessionDate));
  const pendingAssignments = assignments.filter(a => a.dueDate && isUpcoming(a.dueDate));
  const overdueAssignments = assignments.filter(a => a.dueDate && isPast(a.dueDate));
  const noDeadlineAssignments = assignments.filter(a => !a.dueDate);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Link href="/my-courses" className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 mb-4">
            <ChevronLeft className="w-4 h-4" />
            Back to My Courses
          </Link>
          <div className="flex items-start gap-4">
            {course.thumbnailUrl && (
              <img src={course.thumbnailUrl} alt={course.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-xs">Cohort</Badge>
                {course.enrollmentCloseDate && (
                  <Badge variant="outline" className="text-xs text-gray-500">
                    Enrollment closed {fmtDate(course.enrollmentCloseDate)}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{course.title}</h1>
              {course.description && (
                <p className="text-gray-500 text-sm mt-1 line-clamp-2">{course.description}</p>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-600">{upcomingSessions.length}</p>
              <p className="text-xs text-gray-500">Upcoming Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-700">{pastSessions.length}</p>
              <p className="text-xs text-gray-500">Past Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{pendingAssignments.length}</p>
              <p className="text-xs text-gray-500">Pending Assignments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="sessions">
          <TabsList className="mb-6">
            <TabsTrigger value="sessions" className="flex items-center gap-1.5">
              <Video className="w-4 h-4" />
              Live Sessions
              {upcomingSessions.length > 0 && (
                <Badge className="ml-1 bg-teal-500 text-white text-xs px-1.5 py-0">{upcomingSessions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Assignments
              {pendingAssignments.length > 0 && (
                <Badge className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0">{pendingAssignments.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Sessions Tab ── */}
          <TabsContent value="sessions">
            {sessions.length === 0 ? (
              <Card className="text-center py-16">
                <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No sessions scheduled yet</p>
                <p className="text-gray-400 text-sm mt-1">Check back soon — live sessions will appear here once published.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingSessions.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
                    <div className="space-y-3">
                      {upcomingSessions.map(session => (
                        <SessionCard key={session.id} session={session} isUpcoming />
                      ))}
                    </div>
                  </div>
                )}
                {pastSessions.length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Past Sessions</h2>
                    <div className="space-y-3">
                      {pastSessions.map(session => (
                        <SessionCard key={session.id} session={session} isUpcoming={false} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Assignments Tab ── */}
          <TabsContent value="assignments">
            {assignments.length === 0 ? (
              <Card className="text-center py-16">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No assignments yet</p>
                <p className="text-gray-400 text-sm mt-1">Assignments will appear here once published by your instructor.</p>
              </Card>
            ) : (
              <div className="space-y-6">
                {overdueAssignments.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">Overdue</h2>
                    <div className="space-y-3">
                      {overdueAssignments.map(a => (
                        <AssignmentCard key={a.id} assignment={a} overdue />
                      ))}
                    </div>
                  </div>
                )}
                {pendingAssignments.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3">Pending</h2>
                    <div className="space-y-3">
                      {pendingAssignments.map(a => (
                        <AssignmentCard key={a.id} assignment={a} />
                      ))}
                    </div>
                  </div>
                )}
                {noDeadlineAssignments.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">No Deadline</h2>
                    <div className="space-y-3">
                      {noDeadlineAssignments.map(a => (
                        <AssignmentCard key={a.id} assignment={a} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SessionCard({ session, isUpcoming }: { session: any; isUpcoming: boolean }) {
  const hasMeetingLink = !!session.meetingUrl;
  const hasRecording = !!session.recordingUrl;

  return (
    <Card className={`border ${isUpcoming ? "border-teal-200 bg-teal-50/30" : "border-gray-200 bg-white opacity-80"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isUpcoming ? "bg-teal-100" : "bg-gray-100"}`}>
            <Video className={`w-5 h-5 ${isUpcoming ? "text-teal-600" : "text-gray-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{session.title}</h3>
              {isUpcoming ? (
                <Badge className="bg-teal-500 text-white text-xs flex-shrink-0">Upcoming</Badge>
              ) : hasRecording ? (
                <Badge variant="outline" className="text-xs flex-shrink-0 text-gray-500">Recorded</Badge>
              ) : (
                <Badge variant="outline" className="text-xs flex-shrink-0 text-gray-400">Completed</Badge>
              )}
            </div>
            {session.description && (
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{session.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {fmtDate(session.sessionDate)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {fmtTime(session.sessionDate)} · {fmtDuration(session.durationMinutes)}
              </span>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {isUpcoming && hasMeetingLink && (
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 h-8 text-xs gap-1.5" asChild>
                  <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Join Live Session
                  </a>
                </Button>
              )}
              {hasRecording && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50" asChild>
                  <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                    <PlayCircle className="w-3.5 h-3.5" />
                    Watch Recording
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AssignmentCard({ assignment, overdue }: { assignment: any; overdue?: boolean }) {
  const dueSoon = !overdue && isDueSoon(assignment.dueDate);

  return (
    <Card className={`border ${overdue ? "border-red-200 bg-red-50/20" : dueSoon ? "border-amber-200 bg-amber-50/20" : "border-gray-200 bg-white"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${overdue ? "bg-red-100" : dueSoon ? "bg-amber-100" : "bg-gray-100"}`}>
            <FileText className={`w-5 h-5 ${overdue ? "text-red-500" : dueSoon ? "text-amber-600" : "text-gray-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{assignment.title}</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {overdue && <Badge className="bg-red-500 text-white text-xs">Overdue</Badge>}
                {dueSoon && !overdue && <Badge className="bg-amber-500 text-white text-xs">Due Soon</Badge>}
                {assignment.maxPoints > 0 && (
                  <Badge variant="outline" className="text-xs text-gray-500">{assignment.maxPoints} pts</Badge>
                )}
              </div>
            </div>
            {assignment.description && (
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{assignment.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              {assignment.dueDate ? (
                <span className={`flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : dueSoon ? "text-amber-600 font-medium" : ""}`}>
                  <Calendar className="w-3.5 h-3.5" />
                  Due {fmtDate(assignment.dueDate)}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  No deadline
                </span>
              )}
              <span className="flex items-center gap-1">
                {submissionIcon[assignment.submissionType as keyof typeof submissionIcon] ?? <CheckCircle className="w-3.5 h-3.5" />}
                {submissionLabel[assignment.submissionType as keyof typeof submissionLabel] ?? "Submission required"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
