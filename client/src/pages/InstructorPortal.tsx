/**
 * InstructorPortal.tsx
 * Self-service portal for instructors to:
 *   - View assigned courses and revenue share percentages
 *   - Submit publish requests for courses
 *   - View publish request history
 *   - Configure payout settings (PayPal, ACH, Stripe)
 *   - View payout request history
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  BookOpen, DollarSign, Send, Clock, CheckCircle, XCircle,
  Settings, CreditCard, ChevronRight, AlertCircle, Eye, RefreshCw,
  BarChart2, TrendingUp, Users, Activity, List,
  PlusCircle, Pencil, Trash2, GripVertical, Upload, Video, FileText,
  ChevronDown, ChevronUp, FolderOpen, Loader2, ExternalLink
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  if (status === "pending") return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Pending Review</Badge>;
  if (status === "approved") return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">Approved</Badge>;
  if (status === "rejected") return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">Rejected</Badge>;
  if (status === "public") return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">Published</Badge>;
  if (status === "draft") return <Badge variant="outline" className="text-gray-500 border-gray-300">Draft</Badge>;
  if (status === "private") return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">Private</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Course Management Tab ───────────────────────────────────────────────────

type LessonType = "video" | "text" | "quiz" | "download" | "embed" | "video_text";

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  video: "Video", text: "Text", quiz: "Quiz", download: "Download", embed: "Embed", video_text: "Video + Text",
};

function lessonTypeBadge(type: string) {
  const colors: Record<string, string> = {
    video: "bg-blue-100 text-blue-700",
    text: "bg-gray-100 text-gray-700",
    quiz: "bg-purple-100 text-purple-700",
    download: "bg-green-100 text-green-700",
    embed: "bg-orange-100 text-orange-700",
    video_text: "bg-teal-100 text-teal-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[type] ?? "bg-gray-100 text-gray-600"}`}>{LESSON_TYPE_LABELS[type as LessonType] ?? type}</span>;
}

function CourseManagementTab() {
  const utils = trpc.useUtils();
  const { data: myCourses, isLoading: coursesLoading } = trpc.lms.getMyInstructorCourses.useQuery();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  // Auto-select first course
  useEffect(() => {
    if (myCourses && myCourses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(myCourses[0].courseId ?? null);
    }
  }, [myCourses]);

  const { data: course, isLoading: courseLoading, refetch: refetchCourse } = trpc.lmsEnrollmentAdmin.instructorGetCourse.useQuery(
    { courseId: selectedCourseId! },
    { enabled: !!selectedCourseId }
  );

  // Section mutations
  const createSection = trpc.lmsEnrollmentAdmin.instructorCreateSection.useMutation({
    onSuccess: () => { toast.success("Section created"); refetchCourse(); },
    onError: (e) => toast.error(e.message),
  });
  const updateSection = trpc.lmsEnrollmentAdmin.instructorUpdateSection.useMutation({
    onSuccess: () => { toast.success("Section updated"); refetchCourse(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSection = trpc.lmsEnrollmentAdmin.instructorDeleteSection.useMutation({
    onSuccess: () => { toast.success("Section deleted"); refetchCourse(); },
    onError: (e) => toast.error(e.message),
  });

  // Lesson mutations
  const createLesson = trpc.lmsEnrollmentAdmin.instructorCreateLesson.useMutation({
    onSuccess: () => { toast.success("Lesson created"); refetchCourse(); },
    onError: (e) => toast.error(e.message),
  });
  const updateLesson = trpc.lmsEnrollmentAdmin.instructorUpdateLesson.useMutation({
    onSuccess: () => { toast.success("Lesson updated"); refetchCourse(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteLesson = trpc.lmsEnrollmentAdmin.instructorDeleteLesson.useMutation({
    onSuccess: () => { toast.success("Lesson deleted"); refetchCourse(); },
    onError: (e) => toast.error(e.message),
  });
  const uploadAsset = trpc.lmsEnrollmentAdmin.instructorUploadLessonAsset.useMutation({
    onError: (e) => toast.error(e.message),
  });

  // Dialog state
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; editing?: { id: number; title: string } }>({
    open: false,
  });
  const [sectionTitle, setSectionTitle] = useState("");
  const [lessonDialog, setLessonDialog] = useState<{
    open: boolean;
    sectionId: number | null;
    editing?: { id: number; title: string; type: LessonType; embedUrl?: string | null; videoContent?: string | null; content?: string | null; durationMinutes?: number | null; isPreview?: boolean; lessonStatus?: string };
  }>({ open: false, sectionId: null });
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState<LessonType>("text");
  const [lessonEmbed, setLessonEmbed] = useState("");
  const [lessonVideo, setLessonVideo] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonDuration, setLessonDuration] = useState("");
  const [lessonIsPreview, setLessonIsPreview] = useState(false);
  const [lessonStatus, setLessonStatus] = useState<"draft" | "published">("draft");
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Upload state
  const [uploadDialog, setUploadDialog] = useState<{ open: boolean; lessonId: number | null; lessonTitle: string }>({
    open: false, lessonId: null, lessonTitle: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  function openAddSection() {
    setSectionTitle("");
    setSectionDialog({ open: true });
  }

  function openEditSection(s: { id: number; title: string }) {
    setSectionTitle(s.title);
    setSectionDialog({ open: true, editing: s });
  }

  function openAddLesson(sectionId: number | null) {
    setLessonTitle(""); setLessonType("text"); setLessonEmbed(""); setLessonVideo("");
    setLessonContent(""); setLessonDuration(""); setLessonIsPreview(false); setLessonStatus("draft");
    setLessonDialog({ open: true, sectionId });
  }

  function openEditLesson(l: { id: number; title: string; type: string; embedUrl?: string | null; videoContent?: string | null; content?: string | null; durationMinutes?: number | null; isPreview?: boolean; lessonStatus?: string | null }, sectionId: number | null) {
    setLessonTitle(l.title); setLessonType((l.type as LessonType) ?? "text");
    setLessonEmbed(l.embedUrl ?? ""); setLessonVideo(l.videoContent ?? "");
    setLessonContent(l.content ?? ""); setLessonDuration(l.durationMinutes ? String(l.durationMinutes) : "");
    setLessonIsPreview(l.isPreview ?? false); setLessonStatus((l.lessonStatus as "draft" | "published") ?? "draft");
    setLessonDialog({ open: true, sectionId, editing: { id: l.id, title: l.title, type: (l.type as LessonType), embedUrl: l.embedUrl, videoContent: l.videoContent, content: l.content, durationMinutes: l.durationMinutes, isPreview: l.isPreview, lessonStatus: l.lessonStatus ?? undefined } });
  }

  function handleSaveSection() {
    if (!sectionTitle.trim() || !selectedCourseId) return;
    if (sectionDialog.editing) {
      updateSection.mutate({ id: sectionDialog.editing.id, courseId: selectedCourseId, title: sectionTitle.trim() });
    } else {
      createSection.mutate({ courseId: selectedCourseId, title: sectionTitle.trim() });
    }
    setSectionDialog({ open: false });
  }

  function handleSaveLesson() {
    if (!lessonTitle.trim() || !selectedCourseId) return;
    const payload = {
      courseId: selectedCourseId,
      sectionId: lessonDialog.sectionId,
      title: lessonTitle.trim(),
      type: lessonType,
      embedUrl: lessonEmbed || null,
      videoContent: lessonVideo || null,
      content: lessonContent || null,
      durationMinutes: lessonDuration ? parseInt(lessonDuration) : null,
      isPreview: lessonIsPreview,
    };
    if (lessonDialog.editing) {
      updateLesson.mutate({ ...payload, id: lessonDialog.editing.id, lessonStatus });
    } else {
      createLesson.mutate(payload);
    }
    setLessonDialog({ open: false, sectionId: null });
  }

  async function handleUpload() {
    if (!uploadFile || !uploadDialog.lessonId || !selectedCourseId) return;
    setUploadProgress(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });
      const result = await uploadAsset.mutateAsync({
        courseId: selectedCourseId,
        lessonId: uploadDialog.lessonId,
        fileName: uploadFile.name,
        mimeType: uploadFile.type || "application/octet-stream",
        base64Data: base64,
      });
      setUploadedUrl(result.url);
      toast.success("File uploaded successfully");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadProgress(false);
    }
  }

  function toggleSection(id: number) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (coursesLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  if (!myCourses || myCourses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No courses assigned</p>
        <p className="text-sm mt-1">Contact your administrator to be assigned to a course.</p>
      </div>
    );
  }

  const allSections = course?.sections ?? [];
  const topLevelLessons = course?.topLevelLessons ?? [];

  return (
    <div className="space-y-6">
      {/* Course selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <Label className="text-sm mb-1 block">Course</Label>
          <Select value={selectedCourseId ? String(selectedCourseId) : ""} onValueChange={v => setSelectedCourseId(parseInt(v))}>
            <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Select a course" /></SelectTrigger>
            <SelectContent>
              {myCourses.map(c => <SelectItem key={c.courseId} value={String(c.courseId)}>{c.courseTitle ?? `Course #${c.courseId}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {course && (
          <div className="flex items-center gap-2 sm:mt-5">
            {statusBadge(course.status ?? "draft")}
            {course.slug && (
              <a href={`/learn/course/${course.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Preview
              </a>
            )}
          </div>
        )}
      </div>

      {courseLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : course ? (
        <div className="space-y-4">
          {/* Syllabus header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-600" /> Syllabus
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openAddSection} className="gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> Add Section
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAddLesson(null)} className="gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> Add Lesson
              </Button>
            </div>
          </div>

          {/* Sections */}
          {allSections.length === 0 && topLevelLessons.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sections or lessons yet. Add a section or lesson to get started.</p>
            </div>
          )}

          {allSections.map(section => (
            <Card key={section.id} className="border">
              <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 rounded-t-lg"
                onClick={() => toggleSection(section.id)}
              >
                <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                <span className="flex-1 font-medium text-gray-800">{section.title}</span>
                <span className="text-xs text-muted-foreground mr-2">{section.lessons.length} lesson{section.lessons.length !== 1 ? "s" : ""}</span>
                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={e => { e.stopPropagation(); openEditSection({ id: section.id, title: section.title }); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="w-7 h-7 text-red-500 hover:text-red-600" onClick={e => { e.stopPropagation(); if (confirm(`Delete section "${section.title}" and all its lessons?`)) deleteSection.mutate({ id: section.id, courseId: selectedCourseId! }); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                {expandedSections.has(section.id) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>

              {expandedSections.has(section.id) && (
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="space-y-1.5">
                    {section.lessons.map(lesson => (
                      <div key={lesson.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 group">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        <span className="flex-1 text-sm text-gray-700 truncate">{lesson.title}</span>
                        {lessonTypeBadge(lesson.type)}
                        {lesson.lessonStatus === "published"
                          ? <span className="text-xs text-green-600 font-medium">Published</span>
                          : <span className="text-xs text-gray-400">Draft</span>}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="w-6 h-6" title="Upload file" onClick={() => { setUploadedUrl(null); setUploadFile(null); setUploadDialog({ open: true, lessonId: lesson.id, lessonTitle: lesson.title }); }}>
                            <Upload className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => openEditLesson(lesson, section.id)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="w-6 h-6 text-red-500 hover:text-red-600" onClick={() => { if (confirm(`Delete lesson "${lesson.title}"?`)) deleteLesson.mutate({ id: lesson.id, courseId: selectedCourseId! }); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" className="w-full text-teal-600 hover:text-teal-700 hover:bg-teal-50 mt-1 gap-1" onClick={() => openAddLesson(section.id)}>
                      <PlusCircle className="w-3.5 h-3.5" /> Add Lesson to Section
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          {/* Top-level (unsectioned) lessons */}
          {topLevelLessons.length > 0 && (
            <Card className="border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm text-muted-foreground">Unsectioned Lessons</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                <div className="space-y-1.5">
                  {topLevelLessons.map(lesson => (
                    <div key={lesson.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 group">
                      <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="flex-1 text-sm text-gray-700 truncate">{lesson.title}</span>
                      {lessonTypeBadge(lesson.type)}
                      {lesson.lessonStatus === "published"
                        ? <span className="text-xs text-green-600 font-medium">Published</span>
                        : <span className="text-xs text-gray-400">Draft</span>}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="w-6 h-6" title="Upload file" onClick={() => { setUploadedUrl(null); setUploadFile(null); setUploadDialog({ open: true, lessonId: lesson.id, lessonTitle: lesson.title }); }}>
                          <Upload className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => openEditLesson(lesson, null)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-6 h-6 text-red-500 hover:text-red-600" onClick={() => { if (confirm(`Delete lesson "${lesson.title}"?`)) deleteLesson.mutate({ id: lesson.id, courseId: selectedCourseId! }); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Section dialog */}
      <Dialog open={sectionDialog.open} onOpenChange={o => setSectionDialog({ open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{sectionDialog.editing ? "Edit Section" : "Add Section"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm mb-1 block">Section Title</Label>
              <Input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} placeholder="e.g. Introduction" onKeyDown={e => e.key === "Enter" && handleSaveSection()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog({ open: false })}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSaveSection} disabled={!sectionTitle.trim() || createSection.isPending || updateSection.isPending}>
              {createSection.isPending || updateSection.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (sectionDialog.editing ? "Save" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson dialog */}
      <Dialog open={lessonDialog.open} onOpenChange={o => setLessonDialog({ open: o, sectionId: lessonDialog.sectionId })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lessonDialog.editing ? "Edit Lesson" : "Add Lesson"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm mb-1 block">Lesson Title *</Label>
              <Input value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} placeholder="e.g. Introduction to Doppler" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm mb-1 block">Type</Label>
                <Select value={lessonType} onValueChange={v => setLessonType(v as LessonType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LESSON_TYPE_LABELS) as LessonType[]).map(t => <SelectItem key={t} value={t}>{LESSON_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-1 block">Duration (min)</Label>
                <Input type="number" min="0" value={lessonDuration} onChange={e => setLessonDuration(e.target.value)} placeholder="e.g. 15" />
              </div>
            </div>
            {(lessonType === "video" || lessonType === "video_text") && (
              <div>
                <Label className="text-sm mb-1 block">Video URL / Embed Code</Label>
                <Textarea value={lessonVideo} onChange={e => setLessonVideo(e.target.value)} placeholder="https://vimeo.com/... or embed code" rows={2} />
              </div>
            )}
            {lessonType === "embed" && (
              <div>
                <Label className="text-sm mb-1 block">Embed URL</Label>
                <Input value={lessonEmbed} onChange={e => setLessonEmbed(e.target.value)} placeholder="https://..." />
              </div>
            )}
            {(lessonType === "text" || lessonType === "video_text") && (
              <div>
                <Label className="text-sm mb-1 block">Content (Markdown / HTML)</Label>
                <Textarea value={lessonContent} onChange={e => setLessonContent(e.target.value)} placeholder="Lesson content..." rows={4} />
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={lessonIsPreview} onCheckedChange={setLessonIsPreview} id="preview-toggle" />
                <Label htmlFor="preview-toggle" className="text-sm cursor-pointer">Free Preview</Label>
              </div>
              {lessonDialog.editing && (
                <div className="flex items-center gap-2">
                  <Switch checked={lessonStatus === "published"} onCheckedChange={v => setLessonStatus(v ? "published" : "draft")} id="status-toggle" />
                  <Label htmlFor="status-toggle" className="text-sm cursor-pointer">Published</Label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialog({ open: false, sectionId: null })}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSaveLesson} disabled={!lessonTitle.trim() || createLesson.isPending || updateLesson.isPending}>
              {createLesson.isPending || updateLesson.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (lessonDialog.editing ? "Save" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File upload dialog */}
      <Dialog open={uploadDialog.open} onOpenChange={o => { if (!uploadProgress) setUploadDialog({ open: o, lessonId: null, lessonTitle: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload File — {uploadDialog.lessonTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm mb-1 block">Select File (max 16 MB)</Label>
              <input
                type="file"
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadedUrl(null); }}
                accept="video/*,audio/*,image/*,application/pdf,.zip,.mp4,.mov,.webm,.mp3,.wav"
              />
              {uploadFile && <p className="text-xs text-muted-foreground mt-1">{uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
            </div>
            {uploadedUrl && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-medium text-green-700 mb-1">Uploaded successfully</p>
                <a href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline break-all flex items-center gap-1">
                  <ExternalLink className="w-3 h-3 shrink-0" /> {uploadedUrl}
                </a>
                <p className="text-xs text-muted-foreground mt-1">Copy this URL and paste it into the lesson's video or embed field.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialog({ open: false, lessonId: null, lessonTitle: "" })} disabled={uploadProgress}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleUpload} disabled={!uploadFile || uploadProgress || (uploadFile?.size ?? 0) > 16 * 1024 * 1024}>
              {uploadProgress ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Uploading…</> : <><Upload className="w-4 h-4 mr-1" /> Upload</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── My Courses Tab ───────────────────────────────────────────────────────────

function MyCoursesTab() {
  const utils = trpc.useUtils();
  const { data: courses, isLoading } = trpc.lms.getMyInstructorCourses.useQuery();
  const [publishDialogCourse, setPublishDialogCourse] = useState<{ id: number; title: string } | null>(null);
  const [publishNote, setPublishNote] = useState("");

  const requestPublishMut = trpc.lms.requestCoursePublish.useMutation({
    onSuccess: () => {
      toast.success("Publish request submitted! The admin will review it shortly.");
      setPublishDialogCourse(null);
      setPublishNote("");
      utils.lms.getMyInstructorCourses.invalidate();
      utils.lms.getMyPublishRequests.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No courses assigned yet</p>
        <p className="text-sm mt-1">Contact your administrator to get assigned to a course.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {courses.map((c) => {
          const isPending = c.latestPublishRequest?.status === "pending";
          const canRequestPublish = c.courseStatus !== "public" && !c.canSelfPublish && !isPending;
          const canSelfPublish = c.canSelfPublish && c.courseStatus !== "public";

          return (
            <Card key={c.permId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Thumbnail */}
                  {c.courseThumbnail ? (
                    <img src={c.courseThumbnail} alt="" className="w-full sm:w-20 h-32 sm:h-14 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-full sm:w-20 h-14 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-6 h-6 text-teal-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{c.courseTitle ?? "Untitled Course"}</h3>
                      {statusBadge(c.courseStatus ?? "draft")}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Revenue share: <strong className="text-foreground">{c.revenueSharePct}%</strong>
                      </span>
                      {c.canSelfPublish && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Can self-publish
                        </span>
                      )}
                    </div>
                    {/* Latest publish request status */}
                    {c.latestPublishRequest && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Last request:</span>
                        {statusBadge(c.latestPublishRequest.status)}
                        <span className="text-muted-foreground">{fmtDate(c.latestPublishRequest.requestedAt)}</span>
                        {c.latestPublishRequest.reviewNote && (
                          <span className="text-muted-foreground italic">— "{c.latestPublishRequest.reviewNote}"</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap sm:flex-col gap-2 sm:items-end flex-shrink-0">
                    {c.courseSlug && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/learn/${c.courseSlug}`}>
                          <Eye className="w-3 h-3 mr-1" /> Preview
                        </Link>
                      </Button>
                    )}
                    {canRequestPublish && (
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                        onClick={() => setPublishDialogCourse({ id: c.courseId!, title: c.courseTitle ?? "Course" })}
                      >
                        <Send className="w-3 h-3 mr-1" /> Request Publish
                      </Button>
                    )}
                    {canSelfPublish && (
                      <Button size="sm" variant="outline" className="text-green-600 border-green-300">
                        <CheckCircle className="w-3 h-3 mr-1" /> Publish Now
                      </Button>
                    )}
                    {isPending && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                        <Clock className="w-3 h-3 mr-1" /> Awaiting Review
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Publish Request Dialog */}
      <Dialog open={!!publishDialogCourse} onOpenChange={() => setPublishDialogCourse(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Course Publish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Submitting a publish request for <strong>{publishDialogCourse?.title}</strong>. An admin will review and approve or reject it.
            </p>
            <div className="space-y-2">
              <Label>Note to admin (optional)</Label>
              <Textarea
                placeholder="e.g. All content is finalized and ready for review."
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogCourse(null)}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={requestPublishMut.isPending}
              onClick={() => {
                if (!publishDialogCourse) return;
                requestPublishMut.mutate({ courseId: publishDialogCourse.id, note: publishNote || undefined });
              }}
            >
              {requestPublishMut.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Publish History Tab ──────────────────────────────────────────────────────

function PublishHistoryTab() {
  const { data: requests, isLoading } = trpc.lms.getMyPublishRequests.useQuery();

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No publish requests yet</p>
        <p className="text-sm mt-1">When you submit a publish request for a course, it will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Course</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Submitted</th>
            <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Reviewed</th>
            <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Review Note</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {requests.map((r) => (
            <tr key={r.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium max-w-[200px] truncate">{r.courseTitle ?? "—"}</td>
              <td className="px-4 py-3">{statusBadge(r.status)}</td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{fmtDate(r.requestedAt)}</td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{fmtDate(r.reviewedAt)}</td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell italic text-xs max-w-[200px] truncate">{r.reviewNote ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Analytics Tab ──────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { data: courses, isLoading: coursesLoading } = trpc.lms.getMyInstructorCourses.useQuery();
  const { data: allowedMetrics, isLoading: permsLoading } = trpc.lmsEnrollmentAdmin.getMyAnalyticsPermissions.useQuery();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  // Auto-select first course
  useEffect(() => {
    if (courses && courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].courseId ?? null);
    }
  }, [courses]);

  const { data: analytics, isLoading: analyticsLoading } = trpc.lmsEnrollmentAdmin.getMyInstructorAnalytics.useQuery(
    { courseId: selectedCourseId! },
    { enabled: !!selectedCourseId }
  );

  if (coursesLoading || permsLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  if (!allowedMetrics || allowedMetrics.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No analytics access</p>
        <p className="text-sm mt-1">Contact your administrator to enable analytics for your account.</p>
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No courses assigned</p>
        <p className="text-sm mt-1">You need to be assigned to a course to view analytics.</p>
      </div>
    );
  }

  const allowed = new Set(allowedMetrics);

  return (
    <div className="space-y-6">
      {/* Course selector */}
      {courses.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm shrink-0">Course</Label>
          <Select value={selectedCourseId ? String(selectedCourseId) : ""} onValueChange={v => setSelectedCourseId(parseInt(v))}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Select a course" /></SelectTrigger>
            <SelectContent>
              {courses.map(c => <SelectItem key={c.courseId} value={String(c.courseId)}>{c.courseTitle ?? `Course #${c.courseId}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {analyticsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : analytics ? (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {allowed.has("enrollments") && analytics.totalEnrollments !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium">Total Enrollments</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalEnrollments.toLocaleString()}</p>
                </CardContent>
              </Card>
            )}
            {allowed.has("completion_rate") && analytics.completionRate !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">Completion Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{analytics.completionRate}%</p>
                  {analytics.completedEnrollments !== undefined && (
                    <p className="text-xs text-muted-foreground">{analytics.completedEnrollments} completed</p>
                  )}
                </CardContent>
              </Card>
            )}
            {allowed.has("avg_progress") && analytics.avgProgress !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium">Avg. Progress</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{analytics.avgProgress}%</p>
                </CardContent>
              </Card>
            )}
            {allowed.has("revenue") && analytics.totalRevenue !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-medium">Total Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">${(analytics.totalRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Monthly chart */}
          {allowed.has("monthly_chart") && analytics.monthlyEnrollments && analytics.monthlyEnrollments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-teal-600" /> Monthly Enrollments (12 months)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32">
                  {analytics.monthlyEnrollments.map((m: any, i: number) => {
                    const max = Math.max(...analytics.monthlyEnrollments.map((x: any) => Number(x.count)));
                    const height = max > 0 ? Math.round((Number(m.count) / max) * 100) : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">{Number(m.count)}</span>
                        <div className="w-full bg-teal-500 rounded-t" style={{ height: `${height}%` }} />
                        <span className="text-xs text-muted-foreground rotate-45 origin-left" style={{ fontSize: "9px" }}>{m.month}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lesson stats */}
          {allowed.has("lesson_stats") && analytics.lessonStats && analytics.lessonStats.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><List className="w-4 h-4 text-teal-600" /> Lesson Completion Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.lessonStats.map((section: any) => (
                  <div key={section.id}>
                    <p className="text-xs font-semibold text-gray-600 mb-1">{section.title}</p>
                    <div className="space-y-1">
                      {section.lessons.map((lesson: any) => (
                        <div key={lesson.id} className="flex items-center gap-3 text-xs">
                          <span className="flex-1 text-gray-700 truncate">{lesson.title}</span>
                          <span className="text-muted-foreground shrink-0">{lesson.views} views</span>
                          <span className="text-green-600 shrink-0">{lesson.completions} completed</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

// ─── Payout Settings Tab ──────────────────────────────────────────────────────

function PayoutSettingsTab() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.lmsEnrollmentAdmin.getMyInstructorPayoutConfig.useQuery();
  const { data: payoutHistory, isLoading: histLoading } = trpc.lmsEnrollmentAdmin.getMyPayoutRequests.useQuery();

  const [method, setMethod] = useState<"stripe" | "paypal" | "ach">("paypal");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [achRouting, setAchRouting] = useState("");
  const [achAccount, setAchAccount] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);

  // Pre-fill form from existing config
  if (config && !configLoaded) {
    setConfigLoaded(true);
    setMethod((config.preferredMethod as "stripe" | "paypal" | "ach") ?? "paypal");
    try {
      const details = JSON.parse(config.paymentDetails ?? "{}");
      if (details.paypal_email) setPaypalEmail(details.paypal_email);
      if (details.ach_routing) setAchRouting(details.ach_routing);
      if (details.ach_account) setAchAccount(details.ach_account);
      if (details.stripe_account_id) setStripeAccountId(details.stripe_account_id);
    } catch {}
  }

  const saveMut = trpc.lmsEnrollmentAdmin.saveInstructorPayoutConfig.useMutation({
    onSuccess: () => {
      toast.success("Payout settings saved!");
      utils.lmsEnrollmentAdmin.getMyInstructorPayoutConfig.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const details: Record<string, string> = {};
    if (method === "paypal" && paypalEmail) details.paypal_email = paypalEmail;
    if (method === "ach") { details.ach_routing = achRouting; details.ach_account = achAccount; }
    if (method === "stripe" && stripeAccountId) details.stripe_account_id = stripeAccountId;
    saveMut.mutate({ preferredMethod: method, paymentDetails: details });
  };

  return (
    <div className="space-y-6">
      {/* Payout Config Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-teal-600" />
            Payout Method
          </CardTitle>
          <CardDescription>Configure how you'd like to receive your revenue share payments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Preferred Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as "stripe" | "paypal" | "ach")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="ach">ACH Bank Transfer</SelectItem>
                    <SelectItem value="stripe">Stripe Connect</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {method === "paypal" && (
                <div className="space-y-2">
                  <Label>PayPal Email</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                  />
                </div>
              )}

              {method === "ach" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Routing Number</Label>
                    <Input
                      placeholder="9-digit routing number"
                      value={achRouting}
                      onChange={(e) => setAchRouting(e.target.value)}
                      maxLength={9}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      placeholder="Account number"
                      value={achAccount}
                      onChange={(e) => setAchAccount(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {method === "stripe" && (
                <div className="space-y-2">
                  <Label>Stripe Connect Account ID</Label>
                  <Input
                    placeholder="acct_..."
                    value={stripeAccountId}
                    onChange={(e) => setStripeAccountId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Contact admin to set up your Stripe Connect account.</p>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saveMut.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {saveMut.isPending ? "Saving..." : "Save Payout Settings"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-teal-600" />
            Payout Request History
          </CardTitle>
          <CardDescription>Track the status of your payout requests.</CardDescription>
        </CardHeader>
        <CardContent>
          {histLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !payoutHistory || payoutHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No payout requests yet. Contact your administrator to request a payout.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Amount</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Requested</th>
                    <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payoutHistory.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {p.amountCents ? `$${(p.amountCents / 100).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2">{statusBadge(p.status ?? "pending")}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{fmtDate(p.requestedAt)}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell text-xs italic">{p.reviewNote ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InstructorPortal() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="space-y-3 w-full max-w-lg px-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md text-center p-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">Please sign in to access the Instructor Portal.</p>
          <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white">
            <a href={getLoginUrl("/instructor-portal")}>Sign In</a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-teal-600" />
                Instructor Portal
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Welcome back, <strong>{user.name}</strong>
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/learn">
                <ChevronRight className="w-4 h-4 mr-1" /> Back to Library
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Tabs defaultValue="courses">
          <TabsList className="mb-6 w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="courses" className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>My Courses</span>
            </TabsTrigger>
            <TabsTrigger value="course-management" className="flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Course</span> Management
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="publish-history" className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Publish</span> History
            </TabsTrigger>
            <TabsTrigger value="payout" className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Payouts</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses">
            <MyCoursesTab />
          </TabsContent>

          <TabsContent value="course-management">
            <CourseManagementTab />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="publish-history">
            <PublishHistoryTab />
          </TabsContent>

          <TabsContent value="payout">
            <PayoutSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
