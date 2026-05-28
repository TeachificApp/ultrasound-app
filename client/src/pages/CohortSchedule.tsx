import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Clock, Video, ExternalLink, PlayCircle, FileText,
  Upload, Link2, CheckCircle, AlertCircle, BookOpen, ChevronLeft,
  Film, CheckCircle2
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";

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
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

const submissionIcon: Record<string, React.ReactNode> = {
  text: <FileText className="w-4 h-4" />,
  file: <Upload className="w-4 h-4" />,
  url: <Link2 className="w-4 h-4" />,
  none: <CheckCircle className="w-4 h-4" />,
};

const submissionLabel: Record<string, string> = {
  text: "Text response",
  file: "File upload",
  url: "URL submission",
  none: "No submission required",
};

export default function CohortSchedule() {
  const { courseId } = useParams<{ courseId: string }>();
  const [, navigate] = useLocation();
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

  const { course, sessions, assignments, recordings, mySubmissions } = data as any;
  const upcomingSessions = sessions.filter((s: any) => isUpcoming(s.sessionDate));
  const pastSessions = sessions.filter((s: any) => isPast(s.sessionDate));
  const pendingAssignments = assignments.filter((a: any) => a.dueDate && isUpcoming(a.dueDate));
  const overdueAssignments = assignments.filter((a: any) => a.dueDate && isPast(a.dueDate));
  const noDeadlineAssignments = assignments.filter((a: any) => !a.dueDate);
  const submissionMap: Record<number, any> = {};
  (mySubmissions ?? []).forEach((s: any) => { submissionMap[s.assignmentId] = s; });

  return (
    <div className="min-h-screen bg-gray-50">
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
            {(recordings ?? []).length > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{recordings.length}</p>
                <p className="text-xs text-gray-500">Recordings</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
            <TabsTrigger value="replays" className="flex items-center gap-1.5">
              <Film className="w-4 h-4" />
              Replays
              {(recordings ?? []).length > 0 && (
                <Badge className="ml-1 bg-purple-500 text-white text-xs px-1.5 py-0">{recordings.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

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
                      {upcomingSessions.map((session: any) => (
                        <SessionCard key={session.id} session={session} isUpcoming />
                      ))}
                    </div>
                  </div>
                )}
                {pastSessions.length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Past Sessions</h2>
                    <div className="space-y-3">
                      {pastSessions.map((session: any) => (
                        <SessionCard key={session.id} session={session} isUpcoming={false} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

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
                      {overdueAssignments.map((a: any) => (
                        <AssignmentCard key={a.id} assignment={a} overdue courseId={id} mySubmission={submissionMap[a.id]} onOpen={() => navigate(`/cohort/${id}/assignment/${a.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
                {pendingAssignments.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3">Pending</h2>
                    <div className="space-y-3">
                      {pendingAssignments.map((a: any) => (
                        <AssignmentCard key={a.id} assignment={a} courseId={id} mySubmission={submissionMap[a.id]} onOpen={() => navigate(`/cohort/${id}/assignment/${a.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
                {noDeadlineAssignments.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">No Deadline</h2>
                    <div className="space-y-3">
                      {noDeadlineAssignments.map((a: any) => (
                        <AssignmentCard key={a.id} assignment={a} courseId={id} mySubmission={submissionMap[a.id]} onOpen={() => navigate(`/cohort/${id}/assignment/${a.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="replays">
            {(recordings ?? []).length === 0 ? (
              <Card className="text-center py-16">
                <Film className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No recordings yet</p>
                <p className="text-gray-400 text-sm mt-1">Session recordings will appear here once uploaded by your instructor.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {recordings.map((rec: any) => (
                  <RecordingCard key={rec.id} recording={rec} />
                ))}
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
  const tz = session.timezone ?? "";

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
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {session.recurrenceRule && (
                  <Badge variant="outline" className="text-[10px] text-gray-400">Recurring</Badge>
                )}
                {isUpcoming ? (
                  <Badge className="bg-teal-500 text-white text-xs">Upcoming</Badge>
                ) : hasRecording ? (
                  <Badge variant="outline" className="text-xs text-gray-500">Recorded</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-gray-400">Completed</Badge>
                )}
              </div>
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
                {tz && <span className="text-gray-400 text-xs ml-1">({tz})</span>}
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

function AssignmentCard({ assignment, overdue, courseId, mySubmission, onOpen }: {
  assignment: any;
  overdue?: boolean;
  courseId: number;
  mySubmission?: any;
  onOpen: () => void;
}) {
  const dueSoon = !overdue && isDueSoon(assignment.dueDate);
  const isSubmitted = !!mySubmission;
  const isGraded = mySubmission?.status === "graded";

  return (
    <Card
      className={`border cursor-pointer hover:shadow-md transition-shadow ${overdue && !isSubmitted ? "border-red-200 bg-red-50/20" : dueSoon ? "border-amber-200 bg-amber-50/20" : isGraded ? "border-green-200 bg-green-50/10" : isSubmitted ? "border-blue-200 bg-blue-50/10" : "border-gray-200 bg-white"}`}
      onClick={onOpen}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${overdue && !isSubmitted ? "bg-red-100" : dueSoon ? "bg-amber-100" : isGraded ? "bg-green-100" : isSubmitted ? "bg-blue-100" : "bg-gray-100"}`}>
            {isGraded ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : isSubmitted ? (
              <CheckCircle className="w-5 h-5 text-blue-500" />
            ) : (
              <FileText className={`w-5 h-5 ${overdue && !isSubmitted ? "text-red-500" : dueSoon ? "text-amber-600" : "text-gray-400"}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{assignment.title}</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isGraded && <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Graded</Badge>}
                {isSubmitted && !isGraded && <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Submitted</Badge>}
                {overdue && !isSubmitted && <Badge className="bg-red-500 text-white text-xs">Overdue</Badge>}
                {dueSoon && !overdue && !isSubmitted && <Badge className="bg-amber-500 text-white text-xs">Due Soon</Badge>}
                {(assignment.maxPoints ?? assignment.points) > 0 && (
                  <Badge variant="outline" className="text-xs text-gray-500">{assignment.maxPoints ?? assignment.points} pts</Badge>
                )}
              </div>
            </div>
            {assignment.description && (
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{assignment.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              {assignment.dueDate ? (
                <span className={`flex items-center gap-1 ${overdue && !isSubmitted ? "text-red-500 font-medium" : dueSoon ? "text-amber-600 font-medium" : ""}`}>
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
                {submissionIcon[assignment.submissionType] ?? <CheckCircle className="w-3.5 h-3.5" />}
                {submissionLabel[assignment.submissionType] ?? "Submission required"}
              </span>
            </div>
            {isGraded && mySubmission?.grade != null && (
              <div className="mt-2 text-sm text-green-700 font-medium">
                Grade: {mySubmission.grade}{assignment.points ? ` / ${assignment.points}` : ""}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecordingCard({ recording }: { recording: any }) {
  const hasVideo = !!recording.videoUrl;
  const hasEmbed = !!recording.embedCode;

  return (
    <Card className="border border-gray-200 bg-white">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-100">
            <Film className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{recording.title}</h3>
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs flex-shrink-0">Recording</Badge>
            </div>
            {recording.description && (
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{recording.description}</p>
            )}
            {recording.sessionDate && (
              <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                Session: {fmtDate(recording.sessionDate)}
              </div>
            )}
            {hasEmbed && (
              <div className="mt-3 rounded-lg overflow-hidden border border-gray-200"
                dangerouslySetInnerHTML={{ __html: recording.embedCode }}
              />
            )}
            {hasVideo && !hasEmbed && (
              <div className="mt-3">
                <video
                  src={recording.videoUrl}
                  controls
                  className="w-full rounded-lg border border-gray-200 max-h-[360px]"
                  preload="metadata"
                />
              </div>
            )}
            {!hasEmbed && recording.externalUrl && (
              <Button size="sm" variant="outline" className="mt-3 h-8 text-xs gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50" asChild>
                <a href={recording.externalUrl} target="_blank" rel="noopener noreferrer">
                  <PlayCircle className="w-3.5 h-3.5" />
                  Watch Recording
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
