import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ArrowRight, BookOpen, CheckCircle, AlertCircle, Loader2, Users, FileText, ChevronDown, ChevronRight, ExternalLink, Search } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoursePreview {
  course: {
    id: number;
    name: string;
    slug: string;
    subtitle?: string | null;
    description?: string | null;
    cardImageUrl?: string | null;
    status: string;
  };
  sections: {
    id: number;
    name: string;
    position: number;
    lessonCount: number;
    lessons: {
      id: number;
      name: string;
      type: string;
      contentableType: string;
      position: number;
      isFreePreview: boolean;
      durationSeconds?: number | null;
    }[];
  }[];
  totalSections: number;
  totalLessons: number;
  totalEnrollments: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ThinkificImporter() {

  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importOptions, setImportOptions] = useState({
    importEnrollments: true,
    scrapeSalesPage: true,
    courseType: "course" as "course" | "quiz" | "download",
  });
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [courseSearch, setCourseSearch] = useState("");
  const [importResult, setImportResult] = useState<{
    success: boolean;
    lmsCourseId: number;
    sectionsImported: number;
    lessonsImported: number;
    enrollmentsPending: number;
    enrolledCount?: number;
    log: string[];
  } | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);

  // Queries
  const { data: courses, isLoading: loadingCourses, error: coursesError } = trpc.thinkificImport.listCourses.useQuery();
  const { data: preview, isLoading: loadingPreview } = trpc.thinkificImport.previewImport.useQuery(
    { thinkificCourseId: selectedCourseId! },
    { enabled: !!selectedCourseId && previewOpen }
  );
  const { data: imports } = trpc.thinkificImport.listImports.useQuery();

  // Mutations
  const runImport = trpc.thinkificImport.runImport.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      setPreviewOpen(false);
      setImportResultOpen(true);
      toast.success(`Import complete! ${data.lessonsImported} lessons imported as draft.`);
    },
    onError: (err) => {
      toast.error(`Import failed: ${err.message}`);
    },
  });

  const utils = trpc.useUtils();
  const activateEnrollments = trpc.thinkificImport.activatePendingEnrollments.useMutation({
    onSuccess: (data) => {
      toast.success(`Enrollments activated: ${data.activated} students enrolled, ${data.skipped} skipped.`);
      utils.thinkificImport.listImports.invalidate();
    },
    onError: (err) => {
      toast.error(`Activation failed: ${err.message}`);
    },
  });

  function toggleSection(id: number) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSelectCourse(courseId: number) {
    setSelectedCourseId(courseId);
    setPreviewOpen(true);
  }

  function handleRunImport() {
    if (!selectedCourseId) return;
    runImport.mutate({
      thinkificCourseId: selectedCourseId,
      importEnrollments: importOptions.importEnrollments,
      scrapeSalesPage: importOptions.scrapeSalesPage,
      courseType: importOptions.courseType,
    });
  }

  function getLessonTypeBadge(type: string) {
    const colors: Record<string, string> = {
      video: "bg-blue-100 text-blue-700",
      text: "bg-gray-100 text-gray-700",
      quiz: "bg-purple-100 text-purple-700",
      download: "bg-green-100 text-green-700",
      embed: "bg-orange-100 text-orange-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Import from Thinkific</h2>
        <p className="text-gray-500 mt-1">
          Select a course from your Thinkific account to import it as a draft into the LMS builder.
          Student enrollments are imported directly and visible in the Students tab. No welcome emails are sent.
        </p>
      </div>

      {/* Past imports */}
      {imports && imports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Past Imports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {imports.map((imp) => (
                <div key={imp.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                  <div className="flex items-center gap-3">
                    {imp.status === "complete" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : imp.status === "failed" ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{imp.thinkificCourseName}</p>
                      <p className="text-xs text-gray-500">
                        {imp.sectionsImported} sections · {imp.lessonsImported} lessons ·{" "}
                        {(imp as any).realEnrollmentCount ?? 0} synced enrollments
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={imp.status === "complete" ? "default" : imp.status === "failed" ? "destructive" : "secondary"}>
                      {imp.status}
                    </Badge>
                    {imp.status === "complete" && imp.lmsCourseId && imp.enrollmentsPending > (imp.enrollmentsActivated ?? 0) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => activateEnrollments.mutate({ lmsCourseId: imp.lmsCourseId! })}
                        disabled={activateEnrollments.isPending}
                      >
                        <Users className="w-3 h-3 mr-1" />
                        Activate Pending Enrollments
                      </Button>
                    )}
                    {imp.lmsCourseId && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/admin/lms?courseId=${imp.lmsCourseId}`}>
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open in LMS
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course list */}
      <Card>
        <CardHeader>
          <CardTitle>Your Thinkific Courses</CardTitle>
          <CardDescription>Click a course to preview and import it</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          {courses && courses.length > 0 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search courses…"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {loadingCourses && (
            <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading courses from Thinkific…</span>
            </div>
          )}
          {coursesError && (
            <div className="flex items-center gap-2 text-red-600 py-4">
              <AlertCircle className="w-4 h-4" />
              <span>Failed to load courses: {coursesError.message}</span>
            </div>
          )}
          {courses && courses.length === 0 && (
            <p className="text-gray-500 text-center py-8">No courses found in your Thinkific account.</p>
          )}
          {courses && courses.length > 0 && (
            <div className="grid gap-3">
              {courses
                .filter((course) =>
                  !courseSearch.trim() ||
                  course.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
                  (course.subtitle ?? "").toLowerCase().includes(courseSearch.toLowerCase())
                )
                .map((course) => {
                const alreadyImported = imports?.some(i => i.thinkificCourseId === course.id && i.status === "complete");
                return (
                  <div
                    key={course.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer group ${
                      alreadyImported
                        ? "border-green-200 bg-green-50/40 hover:border-green-400 hover:bg-green-50"
                        : "hover:border-[#149096] hover:bg-teal-50/30"
                    }`}
                    onClick={() => handleSelectCourse(course.id)}
                  >
                    {/* Cover image */}
                    <div className="w-16 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                      {course.cardImageUrl ? (
                        <img src={course.cardImageUrl} alt={course.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{course.name}</p>
                        {alreadyImported && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Imported
                          </Badge>
                        )}
                      </div>
                      {course.subtitle && (
                        <p className="text-sm text-gray-500 truncate">{course.subtitle}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">{course.status}</Badge>
                        <span className="text-xs text-gray-400">ID: {course.id}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className={`w-4 h-4 transition-colors flex-shrink-0 ${
                      alreadyImported
                        ? "text-green-400 group-hover:text-green-600"
                        : "text-gray-400 group-hover:text-[#149096]"
                    }`} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview + import dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Course Preview</DialogTitle>
            <DialogDescription>
              Review the course structure before importing. The course will be created as a <strong>draft</strong> — students won't have access until you publish it.
            </DialogDescription>
          </DialogHeader>

          {loadingPreview && (
            <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Fetching course structure from Thinkific…</span>
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              {/* Course summary */}
              <div className="flex gap-4 p-4 rounded-lg bg-gray-50 border">
                {preview.course.cardImageUrl && (
                  <img src={preview.course.cardImageUrl} alt={preview.course.name} className="w-20 h-14 object-cover rounded" />
                )}
                <div>
                  <h3 className="font-bold text-gray-900">{preview.course.name}</h3>
                  {preview.course.subtitle && <p className="text-sm text-gray-500">{preview.course.subtitle}</p>}
                  <div className="flex gap-3 mt-2 text-sm text-gray-600">
                    <span><strong>{preview.totalSections}</strong> sections</span>
                    <span><strong>{preview.totalLessons}</strong> lessons</span>
                    <span><strong>{preview.totalEnrollments}</strong> enrolled students</span>
                  </div>
                </div>
              </div>

              {/* Import options */}
              <div className="space-y-3 p-4 rounded-lg border">
                <h4 className="font-semibold text-sm text-gray-700">Import Options</h4>
                {/* Content type selector */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Import as</Label>
                    <p className="text-xs text-gray-500">Thinkific labels everything as a "course" — choose the correct type for your LMS</p>
                  </div>
                  <Select value={importOptions.courseType} onValueChange={(v) => setImportOptions(prev => ({ ...prev, courseType: v as "course" | "quiz" | "download" }))}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">Course</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="download">Download</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Import student enrollments</Label>
                    <p className="text-xs text-gray-500">
                      Enroll {preview.totalEnrollments} students now — no welcome emails sent, visible in Students tab immediately
                    </p>
                  </div>
                  <Switch
                    checked={importOptions.importEnrollments}
                    onCheckedChange={(v) => setImportOptions(prev => ({ ...prev, importEnrollments: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Scrape sales page content</Label>
                    <p className="text-xs text-gray-500">
                      Extract text and images from the Thinkific sales page to pre-fill the landing page builder
                    </p>
                  </div>
                  <Switch
                    checked={importOptions.scrapeSalesPage}
                    onCheckedChange={(v) => setImportOptions(prev => ({ ...prev, scrapeSalesPage: v }))}
                  />
                </div>
              </div>

              {/* Curriculum preview */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-gray-700">Curriculum ({preview.totalSections} sections)</h4>
                {preview.sections.map((section) => (
                  <div key={section.id} className="border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      onClick={() => toggleSection(section.id)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.has(section.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-medium text-sm">{section.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">{section.lessonCount} lessons</span>
                    </button>
                    {expandedSections.has(section.id) && (
                      <div className="divide-y">
                        {section.lessons.map((lesson) => (
                          <div key={lesson.id} className="flex items-center gap-3 px-4 py-2">
                            <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 flex-1 truncate">{lesson.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getLessonTypeBadge(lesson.type)}`}>
                              {lesson.type}
                            </span>
                            {lesson.isFreePreview && (
                              <span className="text-xs text-green-600 font-medium">Free preview</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Import button */}
              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleRunImport}
                  disabled={runImport.isPending}
                  className="bg-[#149096] hover:bg-[#107a7f] text-white"
                >
                  {runImport.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Import as Draft
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import result dialog */}
      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Import Complete
            </DialogTitle>
            <DialogDescription>
              The course has been imported as a draft. No students have access yet.
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-blue-50">
                  <p className="text-2xl font-bold text-blue-700">{importResult.sectionsImported}</p>
                  <p className="text-xs text-blue-600">Sections</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50">
                  <p className="text-2xl font-bold text-green-700">{importResult.lessonsImported}</p>
                  <p className="text-xs text-green-600">Lessons</p>
                </div>
                <div className="p-3 rounded-lg bg-teal-50">
                  <p className="text-2xl font-bold text-teal-700">{importResult.enrolledCount ?? importResult.enrollmentsPending}</p>
                  <p className="text-xs text-teal-600">Students Enrolled</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                Students have been enrolled in this draft course. No welcome emails were sent.
                You can review and edit enrollments in the <strong>Students</strong> tab before publishing.
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setImportResultOpen(false)}>Close</Button>
                <Button
                  className="bg-[#149096] hover:bg-[#107a7f] text-white"
                  asChild
                >
                  <a href={`/admin/lms?courseId=${importResult.lmsCourseId}`}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in LMS Builder
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
