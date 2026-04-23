/**
 * LMSAdmin.tsx
 * Platform Admin — LMS Education Library management panel.
 *
 * Tabs:
 *   Courses      — list, create, edit, delete
 *   Enrollments  — view, add, remove
 *   Groups       — group seat management
 *   Instructors  — create, edit instructor profiles
 *   Affiliates   — affiliate codes, commission, payout tracking
 *   Orders       — order history
 *   Analytics    — overview stats
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import RichTextEditor from "@/components/RichTextEditor";
import {
  BookOpen, ChevronRight, Download, Edit2, HelpCircle, Plus, Trash2,
  Users, DollarSign, BarChart2, GripVertical, CheckCircle, AlertCircle,
  Link as LinkIcon, UserCheck, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  public: "bg-green-100 text-green-700",
  hidden: "bg-yellow-100 text-yellow-700",
  private: "bg-blue-100 text-blue-700",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-4 h-4" />,
  quiz: <HelpCircle className="w-4 h-4" />,
  download: <Download className="w-4 h-4" />,
};

// ─── Course List Tab ──────────────────────────────────────────────────────────

function CoursesTab({ onEdit }: { onEdit: (id: number) => void }) {
  
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = trpc.lmsAdmin.listCourses.useQuery({ status: statusFilter as any, page, pageSize: 20 });

  const deleteCourse = trpc.lmsAdmin.deleteCourse.useMutation({
    onSuccess: () => { toast.success("Course deleted"); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
          {data && <span className="text-sm text-gray-500">{data.total} course{data.total !== 1 ? "s" : ""}</span>}
        </div>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Course
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : (
        <div className="space-y-2">
          {(data?.courses ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3 hover:border-teal-300 transition-colors">
              <span className="text-gray-400">{TYPE_ICONS[c.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{c.title}</p>
                <p className="text-xs text-gray-400">{c.brand === "aaus" ? "All About Ultrasound" : "iHeartEcho"} · {c.type} · {c.isFree ? "Free" : `$${(c.price / 100).toFixed(0)}`}</p>
              </div>
              <Badge className={`text-xs ${STATUS_COLORS[c.status]}`}>{c.status}</Badge>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600 hover:bg-teal-50" onClick={() => onEdit(c.id)}>
                <Edit2 className="w-3 h-3 mr-1" /> Edit
              </Button>
              <Link href={`/learn/${c.slug}`} target="_blank">
                <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500 hover:bg-gray-50">
                  <LinkIcon className="w-3 h-3" />
                </Button>
              </Link>
              <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50" onClick={() => {
                if (confirm(`Delete "${c.title}"?`)) deleteCourse.mutate({ id: c.id });
              }}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {data?.courses.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No courses yet. Create your first course.</p>
            </div>
          )}
        </div>
      )}

      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page * 20 >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <CreateCourseDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={id => { setCreateOpen(false); onEdit(id); refetch(); }} />
    </div>
  );
}

// ─── Create Course Dialog ─────────────────────────────────────────────────────

function CreateCourseDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [type, setType] = useState<"course" | "quiz" | "download">("course");
  const [brand, setBrand] = useState<"aaus" | "iheartecho">("aaus");
  const [price, setPrice] = useState("");
  const [isFree, setIsFree] = useState(false);

  const create = trpc.lmsAdmin.createCourse.useMutation({
    onSuccess: (data) => {
      toast.success("Course created!");
      onCreated(data.id);
    },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create New Course</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Course title" className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Subtitle</Label>
            <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Short description" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Type</Label>
              <Select value={type} onValueChange={v => setType(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Brand</Label>
              <Select value={brand} onValueChange={v => setBrand(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aaus">All About Ultrasound</SelectItem>
                  <SelectItem value="iheartecho">iHeartEcho</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isFree} onCheckedChange={setIsFree} id="is-free" />
            <Label htmlFor="is-free" className="text-sm">Free course</Label>
          </div>
          {!isFree && (
            <div>
              <Label className="text-sm">Price (USD)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="pl-7" type="number" min="0" step="0.01" />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate({
              title: title.trim(), subtitle: subtitle.trim() || undefined,
              type, brand, isFree,
              price: isFree ? 0 : Math.round(parseFloat(price || "0") * 100),
            })}
          >
            {create.isPending ? "Creating..." : "Create Course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Course Editor ────────────────────────────────────────────────────────────

function CourseEditor({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  
  const utils = trpc.useUtils();
  const { data: course, isLoading, refetch } = trpc.lmsAdmin.getCourse.useQuery({ id: courseId });
  const [activeTab, setActiveTab] = useState("settings");
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addLessonSection, setAddLessonSection] = useState<number | null>(null);
  const [editLesson, setEditLesson] = useState<any>(null);
  const [quizLesson, setQuizLesson] = useState<any>(null);

  const updateCourse = trpc.lmsAdmin.updateCourse.useMutation({
    onSuccess: () => { toast.success("Saved"); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const deleteSection = trpc.lmsAdmin.deleteSection.useMutation({
    onSuccess: () => refetch(),
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const deleteLesson = trpc.lmsAdmin.deleteLesson.useMutation({
    onSuccess: () => refetch(),
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const updateLandingPage = trpc.lmsAdmin.updateLandingPage.useMutation({
    onSuccess: () => toast.success("Landing page saved"),
    onError: e => toast.error(`Error: ${e.message}`),
  });

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (!course) return <div className="text-gray-500">Course not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack} className="text-gray-500 hover:text-gray-700 h-8">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="font-semibold text-gray-900 text-lg truncate flex-1">{course.title}</h2>
        <Badge className={`text-xs ${STATUS_COLORS[course.status]}`}>{course.status}</Badge>
        <Link href={`/learn/${course.slug}`} target="_blank">
          <Button size="sm" variant="outline" className="h-8 text-xs text-teal-600 border-teal-300">
            <LinkIcon className="w-3 h-3 mr-1" /> Preview
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          <TabsTrigger value="curriculum" className="text-xs">Curriculum</TabsTrigger>
          <TabsTrigger value="landing" className="text-xs">Landing Page</TabsTrigger>
          <TabsTrigger value="instructors" className="text-xs">Instructors</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <CourseSettingsForm course={course} onSave={data => updateCourse.mutate({ id: courseId, ...data })} saving={updateCourse.isPending} />
        </TabsContent>

        {/* Curriculum Tab */}
        <TabsContent value="curriculum" className="mt-4">
          <div className="space-y-4">
            {course.sections.map((section: any) => (
              <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <span className="font-medium text-sm text-gray-800 flex-1">{section.title}</span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600" onClick={() => setAddLessonSection(section.id)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Lesson
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50" onClick={() => {
                    if (confirm(`Delete section "${section.title}" and all its lessons?`)) deleteSection.mutate({ id: section.id });
                  }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="divide-y divide-gray-100">
                  {section.lessons.map((lesson: any) => (
                    <div key={lesson.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                      <GripVertical className="w-4 h-4 text-gray-300" />
                      <span className="text-gray-400">{TYPE_ICONS[lesson.type]}</span>
                      <span className="text-sm text-gray-700 flex-1">{lesson.title}</span>
                      {lesson.isPreview && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300">Preview</Badge>}
                      {lesson.type === "quiz" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-purple-600 hover:bg-purple-50" onClick={() => setQuizLesson(lesson)}>
                          <HelpCircle className="w-3 h-3 mr-1" /> Quiz
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600 hover:bg-teal-50" onClick={() => setEditLesson(lesson)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50" onClick={() => {
                        if (confirm(`Delete lesson "${lesson.title}"?`)) deleteLesson.mutate({ id: lesson.id });
                      }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {section.lessons.length === 0 && (
                    <div className="px-4 py-3 text-xs text-gray-400">No lessons yet. Add a lesson above.</div>
                  )}
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" className="border-dashed border-teal-300 text-teal-600 hover:bg-teal-50" onClick={() => setAddSectionOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Section
            </Button>
          </div>
        </TabsContent>

        {/* Landing Page Tab */}
        <TabsContent value="landing" className="mt-4">
          <LandingPageEditor courseId={courseId} landingPage={course.landingPage} onSave={data => updateLandingPage.mutate({ courseId, ...data })} saving={updateLandingPage.isPending} />
        </TabsContent>

        {/* Instructors Tab */}
        <TabsContent value="instructors" className="mt-4">
          <CourseInstructorsEditor courseId={courseId} courseInstructors={course.courseInstructors} onSaved={() => refetch()} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddSectionDialog open={addSectionOpen} courseId={courseId} onClose={() => setAddSectionOpen(false)} onCreated={() => { setAddSectionOpen(false); refetch(); }} />
      {addLessonSection && (
        <AddLessonDialog sectionId={addLessonSection} onClose={() => setAddLessonSection(null)} onCreated={() => { setAddLessonSection(null); refetch(); }} />
      )}
      {editLesson && (
        <EditLessonDialog lesson={editLesson} onClose={() => setEditLesson(null)} onSaved={() => { setEditLesson(null); refetch(); }} />
      )}
      {quizLesson && (
        <QuizBuilderDialog lesson={quizLesson} onClose={() => setQuizLesson(null)} />
      )}
    </div>
  );
}

// ─── Course Settings Form ─────────────────────────────────────────────────────

function CourseSettingsForm({ course, onSave, saving }: { course: any; onSave: (data: any) => void; saving: boolean }) {
  const [title, setTitle] = useState(course.title);
  const [subtitle, setSubtitle] = useState(course.subtitle ?? "");
  const [description, setDescription] = useState(course.description ?? "");
  const [status, setStatus] = useState(course.status);
  const [brand, setBrand] = useState(course.brand);
  const [price, setPrice] = useState(String((course.price / 100).toFixed(2)));
  const [isFree, setIsFree] = useState(course.isFree);
  const [hasCertificate, setHasCertificate] = useState(course.hasCertificate);
  const [coverImageUrl, setCoverImageUrl] = useState(course.coverImageUrl ?? "");

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Title *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-sm">Subtitle</Label>
          <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-sm">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
              <SelectItem value="private">Private (invite only)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Brand</Label>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aaus">All About Ultrasound™</SelectItem>
              <SelectItem value="iheartecho">iHeartEcho</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-sm">Cover Image URL</Label>
        <Input value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)} placeholder="https://..." className="mt-1" />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={isFree} onCheckedChange={setIsFree} id="free-switch" />
          <Label htmlFor="free-switch" className="text-sm">Free course</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={hasCertificate} onCheckedChange={setHasCertificate} id="cert-switch" />
          <Label htmlFor="cert-switch" className="text-sm">Certificate of completion</Label>
        </div>
      </div>

      {!isFree && (
        <div className="w-40">
          <Label className="text-sm">Price (USD)</Label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <Input value={price} onChange={e => setPrice(e.target.value)} className="pl-7" type="number" min="0" step="0.01" />
          </div>
        </div>
      )}

      <div>
        <Label className="text-sm">Description (rich text)</Label>
        <div className="mt-1">
          <RichTextEditor value={description} onChange={setDescription} />
        </div>
      </div>

      <Button
        className="bg-teal-600 hover:bg-teal-700 text-white"
        disabled={saving}
        onClick={() => onSave({
          title: title.trim(), subtitle: subtitle.trim() || undefined,
          description: description || undefined, status, brand,
          isFree, hasCertificate,
          price: isFree ? 0 : Math.round(parseFloat(price || "0") * 100),
          coverImageUrl: coverImageUrl.trim() || undefined,
        })}
      >
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}

// ─── Landing Page Editor ──────────────────────────────────────────────────────

function LandingPageEditor({ courseId, landingPage, onSave, saving }: { courseId: number; landingPage: any; onSave: (data: any) => void; saving: boolean }) {
  const [heroTitle, setHeroTitle] = useState(landingPage?.heroTitle ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(landingPage?.heroSubtitle ?? "");
  const [ctaText, setCtaText] = useState(landingPage?.ctaText ?? "Enroll Now");
  const [whatYouLearn, setWhatYouLearn] = useState(landingPage?.whatYouLearn ?? "");
  const [requirements, setRequirements] = useState(landingPage?.requirements ?? "");
  const [bodyContent, setBodyContent] = useState(landingPage?.bodyContent ?? "");

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Hero Title</Label>
          <Input value={heroTitle} onChange={e => setHeroTitle(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-sm">CTA Button Text</Label>
          <Input value={ctaText} onChange={e => setCtaText(e.target.value)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-sm">Hero Subtitle</Label>
        <Input value={heroSubtitle} onChange={e => setHeroSubtitle(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label className="text-sm">What You'll Learn (rich text)</Label>
        <div className="mt-1"><RichTextEditor value={whatYouLearn} onChange={setWhatYouLearn} /></div>
      </div>
      <div>
        <Label className="text-sm">Course Description / Body Content (rich text)</Label>
        <div className="mt-1"><RichTextEditor value={bodyContent} onChange={setBodyContent} /></div>
      </div>
      <div>
        <Label className="text-sm">Requirements (rich text)</Label>
        <div className="mt-1"><RichTextEditor value={requirements} onChange={setRequirements} /></div>
      </div>
      <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={saving} onClick={() => onSave({ heroTitle, heroSubtitle, ctaText, whatYouLearn, bodyContent, requirements })}>
        {saving ? "Saving..." : "Save Landing Page"}
      </Button>
    </div>
  );
}

// ─── Course Instructors Editor ────────────────────────────────────────────────

function CourseInstructorsEditor({ courseId, courseInstructors, onSaved }: { courseId: number; courseInstructors: any[]; onSaved: () => void }) {
  
  const { data: allInstructors } = trpc.lmsAdmin.listInstructors.useQuery();
  const [assignments, setAssignments] = useState<Array<{ instructorId: number; revenueSharePct: number; isPrimary: boolean }>>(
    courseInstructors.map(ci => ({ instructorId: ci.instructorId, revenueSharePct: ci.revenueSharePct, isPrimary: ci.isPrimary }))
  );

  const setCourseInstructors = trpc.lmsAdmin.setCourseInstructors.useMutation({
    onSuccess: () => { toast.success("Instructors saved"); onSaved(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const addAssignment = () => {
    const available = (allInstructors ?? []).find((i: any) => !assignments.find(a => a.instructorId === i.id));
    if (available) setAssignments(a => [...a, { instructorId: available.id, revenueSharePct: 0, isPrimary: assignments.length === 0 }]);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="space-y-3">
        {assignments.map((a, idx) => {
          const ins = (allInstructors ?? []).find((i: any) => i.id === a.instructorId);
          return (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
              <Select value={String(a.instructorId)} onValueChange={v => setAssignments(prev => prev.map((x, i) => i === idx ? { ...x, instructorId: parseInt(v) } : x))}>
                <SelectTrigger className="w-48 h-8 text-sm"><SelectValue placeholder="Select instructor" /></SelectTrigger>
                <SelectContent>
                  {(allInstructors ?? []).map((i: any) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Input type="number" min="0" max="100" value={a.revenueSharePct} onChange={e => setAssignments(prev => prev.map((x, i) => i === idx ? { ...x, revenueSharePct: parseInt(e.target.value) || 0 } : x))} className="w-16 h-8 text-sm text-center" />
                <span className="text-xs text-gray-500">% rev share</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={a.isPrimary} onCheckedChange={v => setAssignments(prev => prev.map((x, i) => ({ ...x, isPrimary: i === idx ? v : false })))} id={`primary-${idx}`} />
                <Label htmlFor={`primary-${idx}`} className="text-xs">Primary</Label>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-red-400 ml-auto" onClick={() => setAssignments(prev => prev.filter((_, i) => i !== idx))}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3">
        <Button size="sm" variant="outline" className="border-dashed border-teal-300 text-teal-600 hover:bg-teal-50" onClick={addAssignment} disabled={!allInstructors?.length}>
          <Plus className="w-4 h-4 mr-1" /> Add Instructor
        </Button>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" disabled={setCourseInstructors.isPending} onClick={() => setCourseInstructors.mutate({ courseId, instructors: assignments })}>
          {setCourseInstructors.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Add Section Dialog ───────────────────────────────────────────────────────

function AddSectionDialog({ open, courseId, onClose, onCreated }: { open: boolean; courseId: number; onClose: () => void; onCreated: () => void }) {
  
  const [title, setTitle] = useState("");
  const create = trpc.lmsAdmin.createSection.useMutation({
    onSuccess: () => { toast.success("Section added"); setTitle(""); onCreated(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Section title" className="mt-2" />
        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!title.trim() || create.isPending} onClick={() => create.mutate({ courseId, title: title.trim() })}>
            {create.isPending ? "Adding..." : "Add Section"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Lesson Dialog ────────────────────────────────────────────────────────

function AddLessonDialog({ sectionId, onClose, onCreated }: { sectionId: number; onClose: () => void; onCreated: () => void }) {
  
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"video" | "text" | "quiz" | "download">("text");
  const [isPreview, setIsPreview] = useState(false);
  const [content, setContent] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  const create = trpc.lmsAdmin.createLesson.useMutation({
    onSuccess: () => { toast.success("Lesson added"); onCreated(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Lesson</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-sm">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lesson title" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Type</Label>
              <Select value={type} onValueChange={v => setType(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Duration (min)</Label>
              <Input value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} type="number" min="0" className="mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isPreview} onCheckedChange={setIsPreview} id="preview-switch" />
            <Label htmlFor="preview-switch" className="text-sm">Free preview (visible without enrollment)</Label>
          </div>
          {type !== "quiz" && (
            <div>
              <Label className="text-sm">{type === "video" ? "Video URL" : type === "download" ? "Download URL" : "Content (rich text)"}</Label>
              {type === "text" ? (
                <div className="mt-1"><RichTextEditor value={content} onChange={setContent} /></div>
              ) : (
                <Input value={content} onChange={e => setContent(e.target.value)} placeholder="https://..." className="mt-1" />
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate({
              sectionId, title: title.trim(), type, isPreview,
              content: content || undefined,
              durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
            })}
          >
            {create.isPending ? "Adding..." : "Add Lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Lesson Dialog ───────────────────────────────────────────────────────

function EditLessonDialog({ lesson, onClose, onSaved }: { lesson: any; onClose: () => void; onSaved: () => void }) {
  
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content ?? "");
  const [isPreview, setIsPreview] = useState(lesson.isPreview);
  const [durationMinutes, setDurationMinutes] = useState(String(lesson.durationMinutes ?? ""));

  const update = trpc.lmsAdmin.updateLesson.useMutation({
    onSuccess: () => { toast.success("Lesson saved"); onSaved(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Lesson</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-sm">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isPreview} onCheckedChange={setIsPreview} id="edit-preview" />
            <Label htmlFor="edit-preview" className="text-sm">Free preview</Label>
          </div>
          <div>
            <Label className="text-sm">Duration (min)</Label>
            <Input value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} type="number" min="0" className="mt-1 w-24" />
          </div>
          {lesson.type !== "quiz" && (
            <div>
              <Label className="text-sm">{lesson.type === "video" ? "Video URL" : lesson.type === "download" ? "Download URL" : "Content (rich text)"}</Label>
              {lesson.type === "text" ? (
                <div className="mt-1"><RichTextEditor value={content} onChange={setContent} /></div>
              ) : (
                <Input value={content} onChange={e => setContent(e.target.value)} placeholder="https://..." className="mt-1" />
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={update.isPending}
            onClick={() => update.mutate({
              id: lesson.id, title: title.trim(), isPreview,
              content: content || undefined,
              durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
            })}
          >
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quiz Builder Dialog ──────────────────────────────────────────────────────

function QuizBuilderDialog({ lesson, onClose }: { lesson: any; onClose: () => void }) {
  
  const { data: quiz, refetch } = trpc.lmsAdmin.getQuiz.useQuery({ lessonId: lesson.id });
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQ, setNewQ] = useState({ question: "", type: "mcq" as "mcq" | "truefalse", options: ["", "", "", ""], correctAnswer: "", explanation: "" });

  const updateQuiz = trpc.lmsAdmin.updateQuiz.useMutation({ onSuccess: () => { toast.success("Quiz settings saved"); refetch(); } });
  const addQuestion = trpc.lmsAdmin.addQuestion.useMutation({
    onSuccess: () => { toast.success("Question added"); setAddingQuestion(false); setNewQ({ question: "", type: "mcq", options: ["", "", "", ""], correctAnswer: "", explanation: "" }); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });
  const deleteQuestion = trpc.lmsAdmin.deleteQuestion.useMutation({ onSuccess: () => refetch() });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Quiz Builder — {lesson.title}</DialogTitle></DialogHeader>

        {quiz && (
          <div className="space-y-5">
            {/* Quiz settings */}
            <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Passing score:</Label>
                <Input type="number" min="0" max="100" defaultValue={quiz.passingScore} className="w-16 h-7 text-sm text-center"
                  onBlur={e => updateQuiz.mutate({ lessonId: lesson.id, passingScore: parseInt(e.target.value) })} />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch defaultChecked={quiz.allowRetakes} onCheckedChange={v => updateQuiz.mutate({ lessonId: lesson.id, allowRetakes: v })} id="retakes" />
                <Label htmlFor="retakes" className="text-sm">Allow retakes</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch defaultChecked={quiz.showCorrectAnswers} onCheckedChange={v => updateQuiz.mutate({ lessonId: lesson.id, showCorrectAnswers: v })} id="show-answers" />
                <Label htmlFor="show-answers" className="text-sm">Show correct answers</Label>
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-3">
              {(quiz.questions ?? []).map((q: any, qi: number) => {
                const options = q.options ? JSON.parse(q.options) : [];
                return (
                  <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800">{qi + 1}. {q.question}</p>
                      <Button size="sm" variant="ghost" className="h-6 text-red-400 flex-shrink-0" onClick={() => deleteQuestion.mutate({ id: q.id })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {options.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {options.map((opt: string) => (
                          <li key={opt} className={`text-xs px-2 py-1 rounded ${opt === q.correctAnswer ? "bg-green-50 text-green-700 font-medium" : "text-gray-500"}`}>
                            {opt === q.correctAnswer ? "✓ " : "○ "}{opt}
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.explanation && <p className="text-xs text-gray-400 mt-1 italic">{q.explanation}</p>}
                  </div>
                );
              })}
            </div>

            {/* Add question */}
            {addingQuestion ? (
              <div className="border border-teal-200 rounded-lg p-4 space-y-3 bg-teal-50">
                <div>
                  <Label className="text-sm">Question *</Label>
                  <Input value={newQ.question} onChange={e => setNewQ(q => ({ ...q, question: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Type</Label>
                  <Select value={newQ.type} onValueChange={v => setNewQ(q => ({ ...q, type: v as any }))}>
                    <SelectTrigger className="mt-1 w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple Choice</SelectItem>
                      <SelectItem value="truefalse">True / False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newQ.type === "mcq" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Options</Label>
                    {newQ.options.map((opt, oi) => (
                      <Input key={oi} value={opt} onChange={e => setNewQ(q => { const o = [...q.options]; o[oi] = e.target.value; return { ...q, options: o }; })} placeholder={`Option ${oi + 1}`} className="h-8 text-sm" />
                    ))}
                  </div>
                )}
                <div>
                  <Label className="text-sm">Correct Answer *</Label>
                  {newQ.type === "truefalse" ? (
                    <Select value={newQ.correctAnswer} onValueChange={v => setNewQ(q => ({ ...q, correctAnswer: v }))}>
                      <SelectTrigger className="mt-1 w-32 h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="True">True</SelectItem>
                        <SelectItem value="False">False</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={newQ.correctAnswer} onChange={e => setNewQ(q => ({ ...q, correctAnswer: e.target.value }))} placeholder="Must match one of the options exactly" className="mt-1" />
                  )}
                </div>
                <div>
                  <Label className="text-sm">Explanation (optional)</Label>
                  <Input value={newQ.explanation} onChange={e => setNewQ(q => ({ ...q, explanation: e.target.value }))} className="mt-1" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAddingQuestion(false)}>Cancel</Button>
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!newQ.question.trim() || !newQ.correctAnswer.trim() || addQuestion.isPending}
                    onClick={() => addQuestion.mutate({
                      quizId: quiz.id, question: newQ.question.trim(), type: newQ.type,
                      options: newQ.type === "mcq" ? newQ.options.filter(o => o.trim()) : undefined,
                      correctAnswer: newQ.correctAnswer.trim(), explanation: newQ.explanation.trim() || undefined,
                      position: (quiz.questions?.length ?? 0),
                    })}>
                    {addQuestion.isPending ? "Adding..." : "Add Question"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="border-dashed border-teal-300 text-teal-600 hover:bg-teal-50" onClick={() => setAddingQuestion(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Question
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Enrollments Tab ──────────────────────────────────────────────────────────

function EnrollmentsTab() {
  
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = trpc.lmsAdmin.listEnrollments.useQuery({ page, pageSize: 20 });
  const removeEnrollment = trpc.lmsAdmin.removeEnrollment.useMutation({
    onSuccess: () => { toast.success("Enrollment removed"); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{data?.total ?? 0} enrollments</span>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">User</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Course</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Progress</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Enrolled</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.enrollments ?? []).map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{e.user?.displayName ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400">{e.user?.email}</p>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{e.course?.title ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5">
                        <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${e.progressPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{e.progressPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(e.enrolledAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <Button size="sm" variant="ghost" className="h-6 text-red-400 hover:bg-red-50" onClick={() => {
                      if (confirm("Remove this enrollment?")) removeEnrollment.mutate({ id: e.id });
                    }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.enrollments ?? []).length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No enrollments yet</div>
          )}
        </div>
      )}
      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page * 20 >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ─── Groups Tab ───────────────────────────────────────────────────────────────

function GroupsTab() {
  
  const { data: groups, isLoading, refetch } = trpc.lmsAdmin.listGroups.useQuery({});
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [newEmail, setNewEmail] = useState<Record<number, string>>({});

  const assignSeat = trpc.lmsAdmin.assignSeat.useMutation({
    onSuccess: (data, vars) => {
      toast.success(`Seat assigned — invite token: ${data.token}`);
      setNewEmail(e => ({ ...e, [vars.groupId]: "" }));
      refetch();
    },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const revokeSeat = trpc.lmsAdmin.revokeSeat.useMutation({
    onSuccess: () => { toast.success("Seat revoked"); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Group
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="space-y-3">
          {(groups ?? []).map((g: any) => (
            <div key={g.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)}>
                <Users className="w-4 h-4 text-teal-500" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{g.name}</p>
                  <p className="text-xs text-gray-400">{g.course?.title} · {g.usedSeats}/{g.seats} seats used</p>
                </div>
                <div className="w-24 bg-gray-200 rounded-full h-1.5">
                  <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${g.seats > 0 ? (g.usedSeats / g.seats) * 100 : 0}%` }} />
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedGroup === g.id ? "rotate-90" : ""}`} />
              </div>

              {expandedGroup === g.id && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  <div className="space-y-2">
                    {(g.seatList ?? []).map((seat: any) => (
                      <div key={seat.id} className="flex items-center gap-3 text-sm">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${seat.acceptedAt ? "bg-green-400" : "bg-yellow-400"}`} />
                        <span className="flex-1 text-gray-700">{seat.email}</span>
                        <span className="text-xs text-gray-400">{seat.acceptedAt ? "Accepted" : "Pending"}</span>
                        <Button size="sm" variant="ghost" className="h-6 text-red-400 hover:bg-red-50" onClick={() => revokeSeat.mutate({ seatId: seat.id })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {g.usedSeats < g.seats && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="email@example.com"
                        value={newEmail[g.id] ?? ""}
                        onChange={e => setNewEmail(em => ({ ...em, [g.id]: e.target.value }))}
                        className="h-8 text-sm flex-1"
                        type="email"
                      />
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8" disabled={assignSeat.isPending}
                        onClick={() => assignSeat.mutate({ groupId: g.id, email: newEmail[g.id] ?? "" })}>
                        Assign
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {(groups ?? []).length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No groups yet</div>
          )}
        </div>
      )}

      <CreateGroupDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); refetch(); }} />
    </div>
  );
}

function CreateGroupDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  
  const { data: courses } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", page: 1, pageSize: 100 });
  const [courseId, setCourseId] = useState("");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("5");

  const create = trpc.lmsAdmin.createGroup.useMutation({
    onSuccess: () => { toast.success("Group created"); onCreated(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-sm">Course *</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {(courses?.courses ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Group Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hospital ABC — Batch 1" className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Number of Seats</Label>
            <Input value={seats} onChange={e => setSeats(e.target.value)} type="number" min="1" className="mt-1 w-24" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!courseId || !name.trim() || create.isPending}
            onClick={() => create.mutate({ courseId: parseInt(courseId), name: name.trim(), seats: parseInt(seats) || 1 })}
          >
            {create.isPending ? "Creating..." : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Instructors Tab ──────────────────────────────────────────────────────────

function InstructorsTab() {
  
  const { data: instructors, isLoading, refetch } = trpc.lmsAdmin.listInstructors.useQuery();
  const [editInstructor, setEditInstructor] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const updateInstructor = trpc.lmsAdmin.updateInstructor.useMutation({
    onSuccess: () => { toast.success("Instructor saved"); setEditInstructor(null); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const createInstructor = trpc.lmsAdmin.createInstructor.useMutation({
    onSuccess: () => { toast.success("Instructor created"); setCreateOpen(false); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Instructor
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(instructors ?? []).map((ins: any) => (
            <div key={ins.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4">
              {ins.avatarUrl ? (
                <img src={ins.avatarUrl} alt={ins.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center text-xl font-bold text-teal-700 flex-shrink-0">{ins.name[0]}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{ins.name}</p>
                {ins.title && <p className="text-xs text-teal-600">{ins.title}</p>}
                {ins.website && <a href={ins.website} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:underline truncate block">{ins.website}</a>}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={`text-xs ${ins.isActive ? "text-green-600 border-green-300" : "text-gray-400"}`}>{ins.isActive ? "Active" : "Inactive"}</Badge>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-teal-600 hover:bg-teal-50" onClick={() => setEditInstructor(ins)}>
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {(instructors ?? []).length === 0 && (
            <div className="col-span-2 text-center py-10 text-gray-400 text-sm">No instructors yet</div>
          )}
        </div>
      )}

      {/* Create/Edit dialogs */}
      {createOpen && <InstructorFormDialog title="New Instructor" onClose={() => setCreateOpen(false)} onSave={data => createInstructor.mutate(data)} saving={createInstructor.isPending} />}
      {editInstructor && <InstructorFormDialog title="Edit Instructor" instructor={editInstructor} onClose={() => setEditInstructor(null)} onSave={data => updateInstructor.mutate({ id: editInstructor.id, ...data })} saving={updateInstructor.isPending} />}
    </div>
  );
}

function InstructorFormDialog({ title, instructor, onClose, onSave, saving }: { title: string; instructor?: any; onClose: () => void; onSave: (data: any) => void; saving: boolean }) {
  const [name, setName] = useState(instructor?.name ?? "");
  const [instrTitle, setInstrTitle] = useState(instructor?.title ?? "");
  const [bio, setBio] = useState(instructor?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(instructor?.avatarUrl ?? "");
  const [website, setWebsite] = useState(instructor?.website ?? "");
  const [isActive, setIsActive] = useState(instructor?.isActive ?? true);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Title / Credentials</Label>
              <Input value={instrTitle} onChange={e => setInstrTitle(e.target.value)} placeholder="RDCS, FASE" className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-sm">Avatar URL</Label>
            <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Website</Label>
            <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Bio (rich text)</Label>
            <div className="mt-1"><RichTextEditor value={bio} onChange={setBio} /></div>
          </div>
          {instructor && (
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="active-switch" />
              <Label htmlFor="active-switch" className="text-sm">Active</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!name.trim() || saving}
            onClick={() => onSave({ name: name.trim(), title: instrTitle.trim() || undefined, bio: bio || undefined, avatarUrl: avatarUrl.trim() || undefined, website: website.trim() || undefined, isActive })}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Affiliates Tab ───────────────────────────────────────────────────────────

function AffiliatesTab() {
  
  const { data: affiliates, isLoading, refetch } = trpc.lmsAdmin.listAffiliates.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [commission, setCommission] = useState("10");

  const create = trpc.lmsAdmin.createAffiliate.useMutation({
    onSuccess: (data) => { toast.success(`Affiliate created — code: ${data.code}`); setCreateOpen(false); setName(""); setEmail(""); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const update = trpc.lmsAdmin.updateAffiliate.useMutation({
    onSuccess: () => { toast.success("Saved"); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Affiliate
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Code</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Commission</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Earned</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Paid</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(affiliates ?? []).map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{a.name}</p>
                    {a.email && <p className="text-xs text-gray-400">{a.email}</p>}
                  </td>
                  <td className="px-4 py-2.5"><code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{a.code}</code></td>
                  <td className="px-4 py-2.5 text-gray-700">{a.commissionPct}%</td>
                  <td className="px-4 py-2.5 text-green-700 font-medium">${(a.totalEarned / 100).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-gray-500">${(a.totalPaid / 100).toFixed(2)}</td>
                  <td className="px-4 py-2.5 flex gap-1">
                    <Badge variant="outline" className={`text-xs ${a.isActive ? "text-green-600 border-green-300" : "text-gray-400"}`}>{a.isActive ? "Active" : "Inactive"}</Badge>
                    {a.totalEarned > a.totalPaid && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-teal-600 hover:bg-teal-50" onClick={() => update.mutate({ id: a.id, markPaid: true })}>
                        Mark Paid
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-500" onClick={() => update.mutate({ id: a.id, isActive: !a.isActive })}>
                      {a.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(affiliates ?? []).length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No affiliates yet</div>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={() => setCreateOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Affiliate</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm">Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} type="email" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Commission %</Label>
              <Input value={commission} onChange={e => setCommission(e.target.value)} type="number" min="0" max="100" className="mt-1 w-24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate({ name: name.trim(), email: email.trim() || undefined, commissionPct: parseInt(commission) || 10 })}>
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { data, isLoading } = trpc.lmsAdmin.getAnalytics.useQuery();
  const { data: orders, isLoading: ordersLoading } = trpc.lmsAdmin.getOrders.useQuery({ page: 1, pageSize: 10 });

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Courses", value: data.totalCourses, icon: <BookOpen className="w-5 h-5 text-teal-500" /> },
            { label: "Enrollments", value: data.totalEnrollments, icon: <Users className="w-5 h-5 text-blue-500" /> },
            { label: "Completions", value: data.completions, icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
            { label: "Revenue", value: `$${(data.totalRevenue / 100).toFixed(0)}`, icon: <DollarSign className="w-5 h-5 text-yellow-500" /> },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              {stat.icon}
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top courses */}
      {data?.topCourses && data.topCourses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Top Courses by Enrollment</h3>
          <div className="space-y-3">
            {data.topCourses.map((c: any) => (
              <div key={c.courseId} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 flex-1 truncate">{c.course?.title ?? "Unknown"}</span>
                <span className="text-sm font-medium text-teal-700">{c.enrollments} enrolled</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Recent Orders</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">User</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Course</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Amount</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ordersLoading ? (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-xs">Loading...</td></tr>
            ) : (orders?.orders ?? []).map((o: any) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-700">{o.user?.displayName ?? o.user?.email ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-700 truncate max-w-[160px]">{o.course?.title ?? "—"}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">${(o.amount / 100).toFixed(2)}</td>
                <td className="px-4 py-2.5">
                  <Badge className={`text-xs ${o.status === "paid" ? "bg-green-100 text-green-700" : o.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{o.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(orders?.orders ?? []).length === 0 && !ordersLoading && (
          <div className="text-center py-8 text-gray-400 text-sm">No orders yet</div>
        )}
      </div>
    </div>
  );
}

// ─── Main LMSAdmin Component ──────────────────────────────────────────────────

export default function LMSAdmin() {
  const [activeTab, setActiveTab] = useState("courses");
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-teal-600" />
        <h1 className="text-xl font-bold text-gray-900">Education Library — Admin</h1>
        <Link href="/education-library">
          <Button size="sm" variant="outline" className="ml-auto h-8 text-xs text-teal-600 border-teal-300">
            <LinkIcon className="w-3 h-3 mr-1" /> View Public Library
          </Button>
        </Link>
      </div>

      {editingCourseId ? (
        <CourseEditor courseId={editingCourseId} onBack={() => setEditingCourseId(null)} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100">
            <TabsTrigger value="courses" className="text-xs">Courses</TabsTrigger>
            <TabsTrigger value="enrollments" className="text-xs">Enrollments</TabsTrigger>
            <TabsTrigger value="groups" className="text-xs">Groups</TabsTrigger>
            <TabsTrigger value="instructors" className="text-xs">Instructors</TabsTrigger>
            <TabsTrigger value="affiliates" className="text-xs">Affiliates</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="courses" className="mt-4"><CoursesTab onEdit={setEditingCourseId} /></TabsContent>
          <TabsContent value="enrollments" className="mt-4"><EnrollmentsTab /></TabsContent>
          <TabsContent value="groups" className="mt-4"><GroupsTab /></TabsContent>
          <TabsContent value="instructors" className="mt-4"><InstructorsTab /></TabsContent>
          <TabsContent value="affiliates" className="mt-4"><AffiliatesTab /></TabsContent>
          <TabsContent value="analytics" className="mt-4"><AnalyticsTab /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
