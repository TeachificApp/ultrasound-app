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
  BookOpen, ChevronLeft, ChevronRight, Clock, Copy, Download, Edit2, HelpCircle, Plus, Trash2,
  Users, DollarSign, BarChart2, GripVertical, CheckCircle, AlertCircle,
  Link as LinkIcon, UserCheck, ArrowLeft, Upload, ImageIcon,
  Sparkles, Loader2, Eye, FolderOpen, Monitor, Video, FileText, CheckSquare, Settings2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import LessonEffectEditor from "@/components/LessonEffectEditor";
import DigitalDownloadsAdmin from "./DigitalDownloadsAdmin";
import OrderBumpsAdmin from "./OrderBumpsAdmin";
import LessonBlockEditor from "@/components/LessonBlockEditor";
import { Block } from "@/pages/admin/LandingPageBuilder";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  public: "bg-green-100 text-green-700",
  hidden: "bg-yellow-100 text-yellow-700",
  private: "bg-blue-100 text-blue-700",
  archived: "bg-red-100 text-red-600",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-4 h-4" />,
  quiz: <HelpCircle className="w-4 h-4" />,
  download: <Download className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  text: <FileText className="w-4 h-4" />,
  embed: <Monitor className="w-4 h-4" />,
  video_text: <Video className="w-4 h-4" />,
};

const LESSON_TYPE_LABELS: Record<string, string> = {
  text: "Rich Text",
  video: "Video",
  video_text: "Video + Text",
  embed: "Multimedia Embed",
  quiz: "Quiz",
  download: "Download / File",
};

// ─── Course / Quiz / Download List Tab ──────────────────────────────────────

function CoursesTab({ onEdit, typeFilter = "course" }: { onEdit: (id: number) => void; typeFilter?: "course" | "quiz" | "download" }) {
  
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const typeLabel = typeFilter === "quiz" ? "Quiz" : typeFilter === "download" ? "Download" : "Course";
  const typeLabelPlural = typeFilter === "quiz" ? "quizzes" : typeFilter === "download" ? "downloads" : "courses";

  const { data, isLoading, refetch } = trpc.lmsAdmin.listCourses.useQuery({ status: statusFilter as any, type: typeFilter, page, pageSize: 20 });

  const deleteCourse = trpc.lmsAdmin.deleteCourse.useMutation({
    onSuccess: () => { toast.success("Course deleted"); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });
  const duplicateCourse = trpc.lmsAdmin.duplicateCourse.useMutation({
    onSuccess: (data) => { toast.success(`Duplicated as "${data.title}"`); refetch(); },
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
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          {data && <span className="text-sm text-gray-500">{data.total} {data.total !== 1 ? typeLabelPlural : typeLabel.toLowerCase()}</span>}
        </div>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New {typeLabel}
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
              <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-500 hover:bg-blue-50" title="Duplicate" onClick={() => duplicateCourse.mutate({ id: c.id })} disabled={duplicateCourse.isPending}>
                <Copy className="w-3 h-3" />
              </Button>
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
              <p>No {typeLabelPlural} yet. Create your first {typeLabel.toLowerCase()}.</p>
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

      <CreateCourseDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={id => { setCreateOpen(false); onEdit(id); refetch(); }} defaultType={typeFilter} />
    </div>
  );
}

// ─── Create Course Dialog ─────────────────────────────────────────────────────

function CreateCourseDialog({ open, onClose, onCreated, defaultType = "course" }: { open: boolean; onClose: () => void; onCreated: (id: number) => void; defaultType?: "course" | "quiz" | "download" }) {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [type, setType] = useState<"course" | "quiz" | "download">(defaultType);
  const [brand, setBrand] = useState<"aaus" | "iheartecho">("aaus");
  const [pricingType, setPricingType] = useState<"free"|"one_time"|"subscription"|"payment_plan">("one_time");
  const [price, setPrice] = useState("");
  const [subscriptionInterval, setSubscriptionInterval] = useState<"monthly"|"quarterly"|"annual">("monthly");
  const [downPayment, setDownPayment] = useState("");
  const [installmentCount, setInstallmentCount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState("30");

  // AI Generate state
  const [aiTopics, setAiTopics] = useState("");
  const [aiAudience, setAiAudience] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState<"beginner"|"intermediate"|"advanced">("intermediate");
  const [aiDuration, setAiDuration] = useState("");
  const [aiPreview, setAiPreview] = useState<any>(null);
  const [aiStep, setAiStep] = useState<"input"|"preview">("input");

  const create = trpc.lmsAdmin.createCourse.useMutation({
    onSuccess: (data) => { toast.success("Course created!"); onCreated(data.id); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const aiGenerate = trpc.lmsAdmin.aiGenerateCourse.useMutation({
    onSuccess: (data) => { setAiPreview(data.generated); setAiStep("preview"); },
    onError: e => toast.error(`AI generation failed: ${e.message}`),
  });

  const aiCommit = trpc.lmsAdmin.aiCommitCourse.useMutation({
    onSuccess: () => toast.success("Content applied!"),
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const handleAiCreate = async () => {
    // Step 1: create the course shell
    const courseTitle = aiPreview?.title || `New ${type === "quiz" ? "Quiz" : type === "download" ? "Download" : "Course"}`;
    create.mutate({
      title: courseTitle,
      subtitle: aiPreview?.subtitle || undefined,
      type,
      brand,
      pricingType: "free",
      isFree: true,
      price: 0,
    }, {
      onSuccess: async (data) => {
        // Step 2: commit AI content (only for course and quiz — downloads don't have curriculum)
        if (type !== "download") {
          await aiCommit.mutateAsync({ courseId: data.id, productType: type === "quiz" ? "quiz" : "course", generated: aiPreview });
        }
        toast.success(`${type === "quiz" ? "Quiz" : type === "download" ? "Download" : "Course"} created${type !== "download" ? " with AI content" : ""}!`);
        onCreated(data.id);
      },
    });
  };

  const productLabel = type === "quiz" ? "Quiz" : type === "download" ? "Download" : "Course";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New {productLabel}</DialogTitle>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")} className={mode === "manual" ? "bg-teal-600 hover:bg-teal-700 text-white" : ""}>
              Manual
            </Button>
            <Button size="sm" variant={mode === "ai" ? "default" : "outline"} onClick={() => setMode("ai")} className={mode === "ai" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}>
              <Sparkles className="w-4 h-4 mr-1" /> AI Generate
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {mode === "manual" ? (
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
              <div>
                <Label className="text-sm">Pricing Type</Label>
                <Select value={pricingType} onValueChange={v => setPricingType(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="one_time">One-Time Purchase</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="payment_plan">Payment Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pricingType === "one_time" && (
                <div>
                  <Label className="text-sm">Price (USD)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="pl-7" type="number" min="0" step="0.01" />
                  </div>
                </div>
              )}
              {pricingType === "subscription" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Price per Period (USD)</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="pl-7" type="number" min="0" step="0.01" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Billing Interval</Label>
                    <Select value={subscriptionInterval} onValueChange={v => setSubscriptionInterval(v as any)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {pricingType === "payment_plan" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Down Payment (USD)</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <Input value={downPayment} onChange={e => setDownPayment(e.target.value)} placeholder="0.00" className="pl-7" type="number" min="0" step="0.01" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Total Price (USD)</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="pl-7" type="number" min="0" step="0.01" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-sm"># Installments</Label>
                      <Input value={installmentCount} onChange={e => setInstallmentCount(e.target.value)} placeholder="3" className="mt-1" type="number" min="1" />
                    </div>
                    <div>
                      <Label className="text-sm">Amount Each (USD)</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <Input value={installmentAmount} onChange={e => setInstallmentAmount(e.target.value)} placeholder="0.00" className="pl-7" type="number" min="0" step="0.01" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Every (days)</Label>
                      <Input value={installmentIntervalDays} onChange={e => setInstallmentIntervalDays(e.target.value)} placeholder="30" className="mt-1" type="number" min="1" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // AI Generate mode
            <div className="py-2">
              {aiStep === "input" ? (
                <div className="space-y-4">
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                    <p className="text-sm text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      AI will generate a complete {type === "quiz" ? "quiz with questions" : "course curriculum with sections and lessons"} plus a full landing page based on your topics.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Product Type</Label>
                      <Select value={type === "download" ? "course" : type} onValueChange={v => setType(v as any)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="course">Course</SelectItem>
                          <SelectItem value="quiz">Quiz</SelectItem>
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
                  <div>
                    <Label className="text-sm">Topics / Subject Matter *</Label>
                    <textarea
                      value={aiTopics}
                      onChange={e => setAiTopics(e.target.value)}
                      placeholder={type === "quiz" ? "e.g. Mitral valve anatomy, regurgitation grading, Doppler assessment, PISA method" : "e.g. Left ventricular systolic function assessment, EF calculation methods, wall motion abnormalities, clinical interpretation"}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[100px] resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Be specific — include clinical concepts, procedures, or anatomy you want covered.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Target Audience (optional)</Label>
                      <Input value={aiAudience} onChange={e => setAiAudience(e.target.value)} placeholder="e.g. Sonography students" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Difficulty</Label>
                      <Select value={aiDifficulty} onValueChange={v => setAiDifficulty(v as any)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {type !== "quiz" && (
                    <div>
                      <Label className="text-sm">Estimated Duration (minutes, optional)</Label>
                      <Input value={aiDuration} onChange={e => setAiDuration(e.target.value)} placeholder="e.g. 120" className="mt-1" type="number" min="5" />
                    </div>
                  )}
                </div>
              ) : (
                // Preview step
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2"><Eye className="w-4 h-4" /> Preview Generated Content</h3>
                    <Button size="sm" variant="outline" onClick={() => setAiStep("input")}>← Back to Edit</Button>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3 text-sm max-h-[50vh] overflow-y-auto">
                    <div>
                      <span className="font-semibold text-teal-700 dark:text-teal-400">Title:</span>
                      <Input value={aiPreview?.title ?? ""} onChange={e => setAiPreview((p: any) => ({ ...p, title: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <span className="font-semibold text-teal-700 dark:text-teal-400">Subtitle:</span>
                      <Input value={aiPreview?.subtitle ?? ""} onChange={e => setAiPreview((p: any) => ({ ...p, subtitle: e.target.value }))} className="mt-1" />
                    </div>
                    {type !== "quiz" && Array.isArray(aiPreview?.sections) && (
                      <div>
                        <span className="font-semibold text-teal-700 dark:text-teal-400">Curriculum ({aiPreview.sections.length} sections):</span>
                        <div className="mt-2 space-y-2">
                          {aiPreview.sections.map((sec: any, si: number) => (
                            <div key={si} className="border rounded p-2">
                              <div className="font-medium text-xs text-gray-700 dark:text-gray-300">{si + 1}. {sec.title}</div>
                              <div className="mt-1 pl-3 space-y-1">
                                {sec.lessons?.map((les: any, li: number) => (
                                  <div key={li} className="text-xs text-gray-500 flex items-center gap-1">
                                    <span className="text-gray-400">{li + 1}.</span> {les.title}
                                    <span className="ml-auto text-gray-400">{les.type} {les.durationMinutes ? `· ${les.durationMinutes}m` : ""}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {type === "quiz" && Array.isArray(aiPreview?.questions) && (
                      <div>
                        <span className="font-semibold text-teal-700 dark:text-teal-400">Questions ({aiPreview.questions.length}):</span>
                        <div className="mt-2 space-y-2">
                          {aiPreview.questions.slice(0, 5).map((q: any, qi: number) => (
                            <div key={qi} className="border rounded p-2 text-xs">
                              <div className="font-medium">{qi + 1}. {q.question}</div>
                              <div className="mt-1 text-gray-500">{q.options?.join(" · ")}</div>
                              <div className="text-teal-600 mt-1">✓ {q.correctAnswer}</div>
                            </div>
                          ))}
                          {aiPreview.questions.length > 5 && <div className="text-xs text-gray-400">+ {aiPreview.questions.length - 5} more questions…</div>}
                        </div>
                      </div>
                    )}
                    {aiPreview?.landingPage && (
                      <div>
                        <span className="font-semibold text-teal-700 dark:text-teal-400">Landing Page:</span>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <div><strong>Hero:</strong> {aiPreview.landingPage.heroTitle}</div>
                          <div><strong>Subtitle:</strong> {aiPreview.landingPage.heroSubtitle}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">You can edit all content after creation in the course editor. Click "Create with AI Content" to proceed.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {mode === "manual" ? (
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={!title.trim() || create.isPending}
              onClick={() => create.mutate({
                title: title.trim(), subtitle: subtitle.trim() || undefined,
                type, brand, pricingType,
                isFree: pricingType === "free",
                price: pricingType === "free" ? 0 : Math.round(parseFloat(price || "0") * 100),
                subscriptionInterval: pricingType === "subscription" ? subscriptionInterval : undefined,
                downPayment: pricingType === "payment_plan" ? Math.round(parseFloat(downPayment || "0") * 100) : undefined,
                installmentCount: pricingType === "payment_plan" ? parseInt(installmentCount || "0") : undefined,
                installmentAmount: pricingType === "payment_plan" ? Math.round(parseFloat(installmentAmount || "0") * 100) : undefined,
                installmentIntervalDays: pricingType === "payment_plan" ? parseInt(installmentIntervalDays || "30") : undefined,
              })}
            >
              {create.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creating...</> : `Create ${productLabel}`}
            </Button>
          ) : aiStep === "input" ? (
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!aiTopics.trim() || aiGenerate.isPending}
              onClick={() => aiGenerate.mutate({
                topics: aiTopics.trim(),
                productType: type === "quiz" ? "quiz" : "course",
                targetAudience: aiAudience.trim() || undefined,
                difficultyLevel: aiDifficulty,
                estimatedDurationMinutes: aiDuration ? parseInt(aiDuration) : undefined,
              })}
            >
              {aiGenerate.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-1" /> Generate Preview</>}
            </Button>
          ) : (
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={create.isPending || aiCommit.isPending}
              onClick={handleAiCreate}
            >
              {(create.isPending || aiCommit.isPending) ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creating...</> : <><Sparkles className="w-4 h-4 mr-1" /> Create with AI Content</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lesson Row ──────────────────────────────────────────────────────────────

function LessonRow({ lesson, onEdit, onQuiz, onDelete }: {
  lesson: any;
  onEdit: (lesson: any) => void;
  onQuiz: (lesson: any) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
      <GripVertical className="w-4 h-4 text-gray-300" />
      <span className="text-gray-400">{TYPE_ICONS[lesson.type] ?? <FileText className="w-4 h-4" />}</span>
      <span className="text-sm text-gray-700 flex-1">{lesson.title}</span>
      <span className="text-xs text-gray-400">{LESSON_TYPE_LABELS[lesson.type] ?? lesson.type}</span>
      {lesson.isPreview && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300">Preview</Badge>}
      {lesson.requireVideoCompletion === 1 && <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Video req.</Badge>}
      {lesson.requireManualComplete === 1 && <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Manual</Badge>}
      {lesson.type === "quiz" && (
        <Button size="sm" variant="ghost" className="h-7 text-xs text-purple-600 hover:bg-purple-50" onClick={() => onQuiz(lesson)}>
          <HelpCircle className="w-3 h-3 mr-1" /> Quiz
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600 hover:bg-teal-50" onClick={() => onEdit(lesson)}>
        <Edit2 className="w-3 h-3" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50" onClick={() => onDelete(lesson.id)}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ─── Course Editor ────────────────────────────────────────────────────────────

function CourseEditor({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  const [, navigate] = useLocation();
  
  const utils = trpc.useUtils();
  const { data: course, isLoading, refetch } = trpc.lmsAdmin.getCourse.useQuery({ id: courseId });
  const [activeTab, setActiveTab] = useState("settings");
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addLessonSection, setAddLessonSection] = useState<number | null>(null);
  const [addLessonAtCourseLevel, setAddLessonAtCourseLevel] = useState(false);
  const [editLesson, setEditLesson] = useState<any>(null);
  const [quizLesson, setQuizLesson] = useState<any>(null);
  const [importMediaSection, setImportMediaSection] = useState<number | null>(null);
  const [editSectionDrip, setEditSectionDrip] = useState<{ id: number; title: string; dripDays: number } | null>(null);

  const updateSection = trpc.lmsAdmin.updateSection.useMutation({
    onSuccess: () => { toast.success("Section updated"); setEditSectionDrip(null); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

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
        <Badge className="text-xs bg-gray-100 text-gray-600 border border-gray-200 capitalize">{course.type}</Badge>
        <Badge className={`text-xs ${STATUS_COLORS[course.status]}`}>{course.status}</Badge>
        <Button
          size="sm" variant="outline"
          className="h-8 text-xs text-teal-600 border-teal-300"
          onClick={() => navigate(`/course/${course.slug}/player`)}
        >
          <Eye className="w-3 h-3 mr-1" /> Preview Course
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-8 text-xs text-gray-500 hover:text-teal-600"
          onClick={() => navigate(`/admin/lms/${courseId}/landing-builder`)}
        >
          <LinkIcon className="w-3 h-3 mr-1" /> Edit Landing Page
        </Button>
        <a href={`/learn/${course.slug}?preview=admin`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400 hover:text-gray-600">
            <Eye className="w-3 h-3 mr-1" /> Preview Landing Page
          </Button>
        </a>
        <a href={`/learn/${course.slug}/player?preview=student`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="h-8 text-xs text-purple-600 border-purple-300 hover:bg-purple-50">
            <Users className="w-3 h-3 mr-1" /> Preview as Student
          </Button>
        </a>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          <TabsTrigger value="curriculum" className="text-xs">
            {course.type === "quiz" ? "Questions" : course.type === "download" ? "Files" : "Curriculum"}
          </TabsTrigger>
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
            {/* Top-level lessons (no section) */}
            {(course.topLevelLessons ?? []).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 border-b border-teal-200">
                  <span className="font-medium text-sm text-teal-800 flex-1">Course-Level Lessons</span>
                  <span className="text-xs text-teal-600">Not inside any section</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {(course.topLevelLessons ?? []).map((lesson: any) => (
                    <LessonRow key={lesson.id} lesson={lesson} onEdit={setEditLesson} onQuiz={setQuizLesson} onDelete={id => { if (confirm(`Delete lesson "${lesson.title}"?`)) deleteLesson.mutate({ id }); }} />
                  ))}
                </div>
              </div>
            )}

            {course.sections.map((section: any) => (
              <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <span className="font-medium text-sm text-gray-800 flex-1">{section.title}</span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600" onClick={() => setAddLessonSection(section.id)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Lesson
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500 hover:bg-gray-100" title="Drip schedule" onClick={() => setEditSectionDrip({ id: section.id, title: section.title, dripDays: section.dripDays ?? 0 })}>
                    <Clock className="w-3 h-3 mr-1" />{(section.dripDays ?? 0) > 0 ? `+${section.dripDays}d` : "Drip"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50" onClick={() => {
                    if (confirm(`Delete section "${section.title}" and all its lessons?`)) deleteSection.mutate({ id: section.id });
                  }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="divide-y divide-gray-100">
                  {section.lessons.map((lesson: any) => (
                    <LessonRow key={lesson.id} lesson={lesson} onEdit={setEditLesson} onQuiz={setQuizLesson} onDelete={id => { if (confirm(`Delete lesson "${lesson.title}"?`)) deleteLesson.mutate({ id }); }} />
                  ))}
                  {section.lessons.length === 0 && (
                    <div className="px-4 py-3 text-xs text-gray-400">No lessons yet. Add a lesson above.</div>
                  )}
                </div>
              </div>
            ))}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="border-dashed border-teal-300 text-teal-600 hover:bg-teal-50" onClick={() => setAddLessonAtCourseLevel(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Lesson (No Section)
              </Button>
              <Button size="sm" variant="outline" className="border-dashed border-gray-300 text-gray-600 hover:bg-gray-50" onClick={() => setAddSectionOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Section
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Landing Page Tab */}
        <TabsContent value="landing" className="mt-4">
          <LandingPageEditor courseId={courseId} landingPage={course.landingPage} courseType={course.type} onSave={data => updateLandingPage.mutate({ courseId, ...data })} saving={updateLandingPage.isPending} />
        </TabsContent>

        {/* Instructors Tab */}
        <TabsContent value="instructors" className="mt-4">
          <CourseInstructorsEditor courseId={courseId} courseInstructors={course.courseInstructors} onSaved={() => refetch()} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddSectionDialog open={addSectionOpen} courseId={courseId} onClose={() => setAddSectionOpen(false)} onCreated={() => { setAddSectionOpen(false); refetch(); }} />
      {addLessonSection && (
        <AddLessonDialog courseId={courseId} sectionId={addLessonSection} onClose={() => setAddLessonSection(null)} onCreated={() => { setAddLessonSection(null); refetch(); }} />
      )}
      {addLessonAtCourseLevel && (
        <AddLessonDialog courseId={courseId} sectionId={undefined} onClose={() => setAddLessonAtCourseLevel(false)} onCreated={() => { setAddLessonAtCourseLevel(false); refetch(); }} />
      )}
      {importMediaSection && (
        <ImportMediaAsLessonDialog sectionId={importMediaSection} courseId={courseId} onClose={() => setImportMediaSection(null)} onCreated={() => { setImportMediaSection(null); refetch(); }} />
      )}
      {editLesson && (
        <LessonEditorPage lesson={editLesson} onClose={() => setEditLesson(null)} onSaved={() => { refetch(); }} onSavedAndClose={() => { setEditLesson(null); refetch(); }} />
      )}
      {quizLesson && (
        <QuizBuilderDialog lesson={quizLesson} onClose={() => setQuizLesson(null)} />
      )}
    </div>
  );
}

// ─── Course Settings Form ─────────────────────────────────────────────────────

function CourseSettingsForm({ course, onSave, saving }: { course: any; onSave: (data: any) => void; saving: boolean }) {
   const [uploadingCover, setUploadingCover] = useState(false);
  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) { toast.error("Image must be under 10 MB"); return; }
    e.target.value = "";
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-course-image", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Upload failed"); }
      const { url } = await res.json();
      setCoverImageUrl(url);
      toast.success("Cover image uploaded");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingCover(false);
    }
  };

  const [title, setTitle] = useState(course.title);
  const [subtitle, setSubtitle] = useState(course.subtitle ?? "");
  const [description, setDescription] = useState(course.description ?? "");
  const [status, setStatus] = useState(course.status);
  const [brand, setBrand] = useState(course.brand);
  const [pricingType, setPricingType] = useState<"free"|"one_time"|"subscription"|"payment_plan"|"trial_then_subscription">(course.pricingType ?? (course.isFree ? "free" : "one_time"));
  const [price, setPrice] = useState(String((course.price / 100).toFixed(2)));
  const [subscriptionInterval, setSubscriptionInterval] = useState<"monthly"|"quarterly"|"annual">(course.subscriptionInterval ?? "monthly");
  const [trialDays, setTrialDays] = useState(String(course.trialDays ?? ""));
  const [accessDurationDays, setAccessDurationDays] = useState(String(course.accessDurationDays ?? ""));
  const [downPayment, setDownPayment] = useState(String(((course.downPayment ?? 0) / 100).toFixed(2)));
  const [installmentCount, setInstallmentCount] = useState(String(course.installmentCount ?? ""));
  const [installmentAmount, setInstallmentAmount] = useState(String(((course.installmentAmount ?? 0) / 100).toFixed(2)));
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState(String(course.installmentIntervalDays ?? 30));
  const [hasCertificate, setHasCertificate] = useState(course.hasCertificate);
  const [isFeatured, setIsFeatured] = useState(course.isFeatured ?? false);
  const [coverImageUrl, setCoverImageUrl] = useState(course.coverImageUrl ?? "");
  const [slug, setSlug] = useState(course.slug ?? "");
  const [metaTitle, setMetaTitle] = useState(course.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(course.metaDescription ?? "");
  const updateCourseSettings = trpc.lmsAdmin.updateCourseSettings.useMutation({
    onSuccess: () => toast.success("URL & SEO settings saved"),
    onError: (e) => toast.error(e.message),
  });

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
              <SelectItem value="archived">Archived</SelectItem>
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

      {/* Cover Image */}
      <div>
        <Label className="text-sm">Course Card Photo</Label>
        <div className="mt-2 flex items-start gap-4">
          {/* Preview */}
          <div className="w-32 h-20 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
            {coverImageUrl ? (
              <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400 text-center px-2">No image</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            {/* Upload button */}
            <label className="cursor-pointer">
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCoverFileChange} disabled={uploadingCover} />
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                uploadingCover
                  ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                  : "border-teal-300 text-teal-600 bg-white hover:bg-teal-50 cursor-pointer"
              }`}>
                <Upload className="w-3 h-3" />
                {uploadingCover ? "Uploading..." : "Upload Photo"}
              </span>
            </label>
            {/* URL fallback */}
            <Input value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)} placeholder="Or paste image URL..." className="text-xs h-8" />
            <p className="text-xs text-gray-400">Recommended: 800×500 px, JPG or PNG, max 8 MB. Displayed as the card thumbnail in the Education Library.</p>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Pricing Type</Label>
            <Select value={pricingType} onValueChange={v => setPricingType(v as any)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="one_time">One-Time Purchase</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="trial_then_subscription">Free Trial → Subscription</SelectItem>
                <SelectItem value="payment_plan">Payment Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Content Access Duration</Label>
            <Select
              value={accessDurationDays === "" ? "lifetime" : accessDurationDays}
              onValueChange={v => setAccessDurationDays(v === "lifetime" ? "" : v)}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lifetime">Full Lifetime Access</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="60">60 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
                <SelectItem value="180">180 Days (6 months)</SelectItem>
                <SelectItem value="365">365 Days (1 year)</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
            {accessDurationDays !== "" && !(["30","60","90","180","365"].includes(accessDurationDays)) && (
              <Input
                value={accessDurationDays}
                onChange={e => setAccessDurationDays(e.target.value)}
                placeholder="Days (e.g. 120)"
                className="mt-1 h-8 text-sm"
                type="number" min="1"
              />
            )}
          </div>
        </div>
        {pricingType === "one_time" && (
          <div className="w-40">
            <Label className="text-sm">Price (USD)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <Input value={price} onChange={e => setPrice(e.target.value)} className="pl-7" type="number" min="0" step="0.01" />
            </div>
          </div>
        )}
        {pricingType === "subscription" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Price per Period (USD)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <Input value={price} onChange={e => setPrice(e.target.value)} className="pl-7" type="number" min="0" step="0.01" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Billing Interval</Label>
              <Select value={subscriptionInterval} onValueChange={v => setSubscriptionInterval(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {pricingType === "trial_then_subscription" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Price After Trial (USD / period)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <Input value={price} onChange={e => setPrice(e.target.value)} className="pl-7" type="number" min="0" step="0.01" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Billing Interval</Label>
              <Select value={subscriptionInterval} onValueChange={v => setSubscriptionInterval(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Free Trial Length (days)</Label>
              <Input value={trialDays} onChange={e => setTrialDays(e.target.value)} placeholder="e.g. 7" className="mt-1" type="number" min="1" />
              <p className="text-xs text-gray-400 mt-1">Student gets free access for this many days, then is charged.</p>
            </div>
          </div>
        )}
        {pricingType === "payment_plan" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Down Payment (USD)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <Input value={downPayment} onChange={e => setDownPayment(e.target.value)} className="pl-7" type="number" min="0" step="0.01" />
                </div>
              </div>
              <div>
                <Label className="text-sm">Total Price (USD)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <Input value={price} onChange={e => setPrice(e.target.value)} className="pl-7" type="number" min="0" step="0.01" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm"># Installments</Label>
                <Input value={installmentCount} onChange={e => setInstallmentCount(e.target.value)} placeholder="3" className="mt-1" type="number" min="1" />
              </div>
              <div>
                <Label className="text-sm">Amount Each (USD)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <Input value={installmentAmount} onChange={e => setInstallmentAmount(e.target.value)} className="pl-7" type="number" min="0" step="0.01" />
                </div>
              </div>
              <div>
                <Label className="text-sm">Every (days)</Label>
                <Input value={installmentIntervalDays} onChange={e => setInstallmentIntervalDays(e.target.value)} placeholder="30" className="mt-1" type="number" min="1" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={hasCertificate} onCheckedChange={setHasCertificate} id="cert-switch" />
        <Label htmlFor="cert-switch" className="text-sm">Certificate of completion</Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={isFeatured} onCheckedChange={setIsFeatured} id="featured-switch" />
        <Label htmlFor="featured-switch" className="text-sm">Featured on LMS Home Page</Label>
      </div>

      <div>
        <Label className="text-sm">Description (rich text)</Label>
        <div className="mt-1">
          <RichTextEditor value={description} onChange={setDescription} />
        </div>
      </div>

      {/* URL & SEO Section */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><LinkIcon className="w-4 h-4 text-teal-600" /> URL &amp; SEO Settings</h3>
        <div>
          <Label className="text-sm">URL Slug</Label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-400 whitespace-nowrap">/learn/</span>
            <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))} placeholder="course-url-slug" className="flex-1" />
          </div>
          <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, and hyphens only. Changing this will break existing links.</p>
        </div>
        <div>
          <Label className="text-sm">Meta Title (SEO)</Label>
          <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder="Leave blank to use course title" className="mt-1" maxLength={255} />
        </div>
        <div>
          <Label className="text-sm">Meta Description (SEO)</Label>
          <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} placeholder="Brief description for search engines (150–160 characters)" className="mt-1 w-full text-sm border border-gray-200 rounded-md p-2 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-teal-500" maxLength={500} />
        </div>
        <Button size="sm" variant="outline" className="border-teal-300 text-teal-600 hover:bg-teal-50"
          disabled={updateCourseSettings.isPending}
          onClick={() => updateCourseSettings.mutate({ courseId: course.id, slug: slug.trim() || course.slug, metaTitle: metaTitle.trim() || undefined, metaDescription: metaDescription.trim() || undefined, status, hasCertificate, isFeatured })}
        >
          {updateCourseSettings.isPending ? "Saving..." : "Save URL & SEO"}
        </Button>
      </div>

      <Button
        className="bg-teal-600 hover:bg-teal-700 text-white"
        disabled={saving}
        onClick={() => onSave({
          title: title.trim(), subtitle: subtitle.trim() || undefined,
          description: description || undefined, status, brand,
          pricingType,
          isFree: pricingType === "free",
          hasCertificate,
          isFeatured,
          price: pricingType === "free" ? 0 : Math.round(parseFloat(price || "0") * 100),
          subscriptionInterval: pricingType === "subscription" ? subscriptionInterval : null,
          downPayment: pricingType === "payment_plan" ? Math.round(parseFloat(downPayment || "0") * 100) : null,
          installmentCount: pricingType === "payment_plan" ? parseInt(installmentCount || "0") : null,
          installmentAmount: pricingType === "payment_plan" ? Math.round(parseFloat(installmentAmount || "0") * 100) : null,
          installmentIntervalDays: pricingType === "payment_plan" ? parseInt(installmentIntervalDays || "30") : null,
          trialDays: pricingType === "trial_then_subscription" ? (trialDays ? parseInt(trialDays) : null) : null,
          accessDurationDays: accessDurationDays ? parseInt(accessDurationDays) : null,
          coverImageUrl: coverImageUrl.trim() || undefined,
        })}
      >
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}

// ─── Landing Page Editor ──────────────────────────────────────────────────────

function LandingPageEditor({ courseId, landingPage, courseType, onSave, saving }: { courseId: number; landingPage: any; courseType?: string; onSave: (data: any) => void; saving: boolean }) {
  const [heroTitle, setHeroTitle] = useState(landingPage?.heroTitle ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(landingPage?.heroSubtitle ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(landingPage?.heroImageUrl ?? "");
  const [ctaText, setCtaText] = useState(landingPage?.ctaText ?? "Enroll Now");
  const [whatYouLearn, setWhatYouLearn] = useState(landingPage?.whatYouLearn ?? "");
  const [requirements, setRequirements] = useState(landingPage?.requirements ?? "");
  const [bodyContent, setBodyContent] = useState(landingPage?.bodyContent ?? "");
   const [uploadingHero, setUploadingHero] = useState(false);
  const handleHeroFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) { toast.error("Image must be under 10 MB"); return; }
    e.target.value = "";
    setUploadingHero(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-course-image", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Upload failed"); }
      const { url } = await res.json();
      setHeroImageUrl(url);
      toast.success("Hero image uploaded");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingHero(false);
    }
  };

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
        <Label className="text-sm">
          {courseType === "download" ? "What's Included" : courseType === "quiz" ? "What You'll Practice" : "What You'll Learn"}
        </Label>
        <div className="mt-1"><RichTextEditor value={whatYouLearn} onChange={setWhatYouLearn} /></div>
      </div>
      <div>
        <Label className="text-sm">
          {courseType === "download" ? "About This Download" : courseType === "quiz" ? "About This Quiz" : "Course Description / Body Content"}
        </Label>
        <div className="mt-1"><RichTextEditor value={bodyContent} onChange={setBodyContent} /></div>
      </div>
      <div>
        <Label className="text-sm">
          {courseType === "download" ? "Who This Is For" : courseType === "quiz" ? "Prerequisites" : "Requirements"}
        </Label>
        <div className="mt-1"><RichTextEditor value={requirements} onChange={setRequirements} /></div>
      </div>
      {/* Hero Image */}
      <div>
        <Label className="text-sm">Hero Banner Image</Label>
        <p className="text-xs text-gray-400 mt-0.5">Displayed at the top of the public landing page. Recommended: 1600×600 px. Stored in the Media Library.</p>
        <div className="mt-2 flex items-start gap-4">
          <div className="w-48 h-20 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
            {heroImageUrl ? (
              <img src={heroImageUrl} alt="Hero" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400 text-center px-2">No banner</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleHeroFileChange} disabled={uploadingHero} />
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                uploadingHero
                  ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                  : "border-teal-300 text-teal-600 bg-white hover:bg-teal-50 cursor-pointer"
              }`}>
                <Upload className="w-3 h-3" />
                {uploadingHero ? "Uploading..." : "Upload Banner"}
              </span>
            </label>
            <Input value={heroImageUrl} onChange={e => setHeroImageUrl(e.target.value)} placeholder="Or paste image URL..." className="text-xs h-8" />
          </div>
        </div>
      </div>

      <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={saving} onClick={() => onSave({ heroTitle, heroSubtitle, heroImageUrl, ctaText, whatYouLearn, bodyContent, requirements })}>
        {saving ? "Saving..." : "Save Landing Page"}
      </Button>
    </div>
  );
}

// ─── Course Instructors Editor ────────────────────────────────────────────────

function CourseInstructorsEditor({ courseId, courseInstructors, onSaved }: { courseId: number; courseInstructors: any[]; onSaved: () => void }) {
  
  const { data: allInstructors, refetch: refetchInstructors } = trpc.lmsAdmin.listInstructors.useQuery();
  const [assignments, setAssignments] = useState<Array<{ instructorId: number; revenueSharePct: number; isPrimary: boolean }>>(
    courseInstructors.map(ci => ({ instructorId: ci.instructorId, revenueSharePct: ci.revenueSharePct, isPrimary: ci.isPrimary }))
  );
  const [createOpen, setCreateOpen] = useState(false);

  const setCourseInstructors = trpc.lmsAdmin.setCourseInstructors.useMutation({
    onSuccess: () => { toast.success("Instructors saved"); onSaved(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const createInstructor = trpc.lmsAdmin.createInstructor.useMutation({
    onSuccess: (data) => {
      toast.success("Instructor profile created");
      setCreateOpen(false);
      refetchInstructors();
      // Auto-assign the newly created instructor
      setAssignments(a => [...a, { instructorId: data.id, revenueSharePct: 0, isPrimary: a.length === 0 }]);
    },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const addAssignment = () => {
    const available = (allInstructors ?? []).find((i: any) => !assignments.find(a => a.instructorId === i.id));
    if (available) {
      setAssignments(a => [...a, { instructorId: available.id, revenueSharePct: 0, isPrimary: assignments.length === 0 }]);
    } else {
      // No existing instructors available — open create dialog
      setCreateOpen(true);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {/* Existing assignments */}
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

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button size="sm" variant="outline" className="border-dashed border-teal-300 text-teal-600 hover:bg-teal-50" onClick={addAssignment}>
          <Plus className="w-4 h-4 mr-1" /> {(allInstructors ?? []).length > 0 ? "Add Instructor" : "Create & Add Instructor"}
        </Button>
        {(allInstructors ?? []).length > 0 && (
          <Button size="sm" variant="outline" className="border-dashed border-purple-300 text-purple-600 hover:bg-purple-50" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create New Profile
          </Button>
        )}
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" disabled={setCourseInstructors.isPending} onClick={() => setCourseInstructors.mutate({ courseId, instructors: assignments })}>
          {setCourseInstructors.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Hint about global profiles */}
      <p className="text-xs text-gray-400">
        Instructor profiles are saved globally and can be reused across all courses. Manage all profiles from the <span className="font-medium text-teal-600">Instructors</span> tab in the main Education Library view.
      </p>

      {/* Create Instructor Dialog */}
      {createOpen && <InstructorFormDialog title="New Instructor Profile" onClose={() => setCreateOpen(false)} onSave={data => createInstructor.mutate(data)} saving={createInstructor.isPending} />}
    </div>
  );
}

// ─── Import Media As Lesson Dialog ──────────────────────────────────────────

function ImportMediaAsLessonDialog({ sectionId, courseId, onClose, onCreated }: { sectionId: number; courseId: number; onClose: () => void; onCreated: () => void }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "document" | "scorm" | "html">("all");
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const { data: assets, isLoading } = trpc.mediaRepo.listAssets.useQuery({
    page: 1, pageSize: 30,
    search: search || undefined,
    mediaType: typeFilter === "all" ? undefined : typeFilter,
  });

  const importLesson = trpc.lmsAdmin.importMediaAssetAsLesson.useMutation({
    onSuccess: () => { toast.success("Lesson imported from Media Library!"); onCreated(); },
    onError: e => toast.error(`Import failed: ${e.message}`),
  });

  const lessonTypeForAsset = (asset: any) => {
    if (asset.mediaType === "video") return "video";
    if (asset.mediaType === "scorm") return "scorm";
    if (asset.mediaType === "html") return "html";
    return "download";
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-blue-600" /> Import from Media Library</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="scorm">SCORM</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : assets?.assets?.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No assets found. Upload files to the Media Library first.</div>
          ) : (
            assets?.assets?.map((asset: any) => (
              <div
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedAsset?.id === asset.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {asset.mediaType === "video" ? "🎬" : asset.mediaType === "scorm" ? "📦" : asset.mediaType === "html" ? "🌐" : "📄"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{asset.title}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">{asset.mediaType}</Badge>
                    {asset.folder && <span>{asset.folder.name}</span>}
                  </div>
                </div>
                {selectedAsset?.id === asset.id && <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />}
              </div>
            ))
          )}
        </div>
        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!selectedAsset || importLesson.isPending}
            onClick={() => importLesson.mutate({
              courseId,
              sectionId,
              mediaAssetId: selectedAsset.id,
              title: selectedAsset.title,
            })}
          >
            {importLesson.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importing...</> : <><FolderOpen className="w-4 h-4 mr-1" /> Import as Lesson</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// ─── Media Repository Picker Dialog ──────────────────────────────────────────

function MediaPickerDialog({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (asset: { id: number; title: string; s3Url: string; mediaType: string }) => void }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mediaType, setMediaType] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = trpc.mediaRepo.listAssets.useQuery(
    { search: debouncedSearch || undefined, mediaType: mediaType !== "all" ? mediaType as any : undefined, page, pageSize: 20 },
    { enabled: open }
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Pick from Media Repository</DialogTitle></DialogHeader>
        <div className="flex gap-2 mb-3">
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search assets..." className="flex-1 h-8 text-sm" />
          <Select value={mediaType} onValueChange={v => { setMediaType(v); setPage(1); }}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="document">Document</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)
          ) : (
            (data?.assets ?? []).map((a: any) => (
              <button key={a.id} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors text-left"
                onClick={() => { onSelect({ id: a.id, title: a.title, s3Url: a.s3Url, mediaType: a.mediaType }); onClose(); }}>
                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">{a.mediaType}</span>
                <span className="text-sm text-gray-800 flex-1 truncate">{a.title}</span>
                {a.folder && <span className="text-xs text-gray-400 truncate max-w-[120px]">{a.folder}</span>}
              </button>
            ))
          )}
          {!isLoading && data?.assets?.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">No assets found.</p>
          )}
        </div>
        {(data?.total ?? 0) > 20 && (
          <div className="flex justify-center gap-2 pt-3 border-t border-gray-100">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page * 20 >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddLessonDialog({ courseId, sectionId, onClose, onCreated }: {
  courseId: number;
  sectionId?: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  type LessonType = "text" | "video" | "video_text" | "embed" | "quiz" | "download";
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LessonType>("text");
  const [isPreview, setIsPreview] = useState(false);
  const [content, setContent] = useState("");
  const [videoContent, setVideoContent] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [requireVideoCompletion, setRequireVideoCompletion] = useState(false);
  const [requireManualComplete, setRequireManualComplete] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ id: number; title: string; s3Url: string; mediaType: string } | null>(null);

  const create = trpc.lmsAdmin.createLesson.useMutation({
    onSuccess: () => { toast.success("Lesson added"); onCreated(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const handleSelectAsset = (asset: { id: number; title: string; s3Url: string; mediaType: string }) => {
    setSelectedAsset(asset);
    setContent(asset.s3Url);
    if (!title.trim()) setTitle(asset.title);
  };

  const handleCreate = () => {
    create.mutate({
      courseId,
      sectionId,
      title: title.trim(),
      type,
      isPreview,
      content: (type === "text" || type === "video" || type === "download") ? (content || undefined) : undefined,
      videoContent: type === "video_text" ? (videoContent || undefined) : undefined,
      embedUrl: type === "embed" ? (embedUrl || undefined) : undefined,
      mediaAssetId: selectedAsset?.id ?? undefined,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
      requireVideoCompletion,
      requireManualComplete,
    });
  };

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Lesson{!sectionId ? " (Course Level)" : ""}</DialogTitle>
          {!sectionId && <p className="text-xs text-teal-600 mt-1">This lesson will appear at the top level, not inside any section.</p>}
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lesson title" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Lesson Type</Label>
              <Select value={type} onValueChange={v => { setType(v as LessonType); setSelectedAsset(null); setContent(""); setVideoContent(""); setEmbedUrl(""); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Rich Text</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="video_text">Video + Text</SelectItem>
                  <SelectItem value="embed">Multimedia Embed (iframe)</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="download">Download / File</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Duration (min)</Label>
              <Input value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} type="number" min="0" className="mt-1" />
            </div>
          </div>

          {/* Content fields by type */}
          {type === "text" && (
            <div>
              <Label className="text-sm">Content</Label>
              <div className="mt-1"><RichTextEditor value={content} onChange={setContent} /></div>
            </div>
          )}
          {(type === "video" || type === "download") && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm">{type === "video" ? "Video URL" : "Download URL"}</Label>
                <Button size="sm" variant="outline" className="h-6 text-xs text-teal-600 border-teal-300 hover:bg-teal-50" onClick={() => setMediaPickerOpen(true)}>
                  Pick from Media Repository
                </Button>
              </div>
              {selectedAsset && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-700">
                  <span className="font-mono bg-teal-100 px-1 rounded uppercase">{selectedAsset.mediaType}</span>
                  <span className="flex-1 truncate">{selectedAsset.title}</span>
                  <button className="text-teal-400 hover:text-teal-600" onClick={() => { setSelectedAsset(null); setContent(""); }}>×</button>
                </div>
              )}
              <Input value={content} onChange={e => setContent(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
          )}
          {type === "video_text" && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm">Video URL</Label>
                  <Button size="sm" variant="outline" className="h-6 text-xs text-teal-600 border-teal-300 hover:bg-teal-50" onClick={() => setMediaPickerOpen(true)}>
                    Pick from Media Repository
                  </Button>
                </div>
                {selectedAsset && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-700">
                    <span className="font-mono bg-teal-100 px-1 rounded uppercase">{selectedAsset.mediaType}</span>
                    <span className="flex-1 truncate">{selectedAsset.title}</span>
                    <button className="text-teal-400 hover:text-teal-600" onClick={() => { setSelectedAsset(null); setContent(""); }}>×</button>
                  </div>
                )}
                <Input value={content} onChange={e => setContent(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Text Content (below video)</Label>
                <div className="mt-1"><RichTextEditor value={videoContent} onChange={setVideoContent} /></div>
              </div>
            </div>
          )}
          {type === "embed" && (
            <div>
              <Label className="text-sm">Embed URL (iframe src)</Label>
              <Input value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} placeholder="https://..." className="mt-1" />
              <p className="text-xs text-gray-400 mt-1">Paste the full URL to embed (e.g., YouTube, Vimeo, SCORM, H5P, etc.)</p>
            </div>
          )}
          {type === "quiz" && (
            <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
              A quiz will be automatically created. Use the Quiz Builder to add questions after saving.
            </div>
          )}

          {/* Preview toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={isPreview} onCheckedChange={setIsPreview} id="add-preview-switch" />
            <Label htmlFor="add-preview-switch" className="text-sm">Free preview (requires login)</Label>
          </div>

          {/* Completion toggles */}
          {(type === "video" || type === "video_text") && (
            <div className="flex items-center gap-2">
              <Switch checked={requireVideoCompletion} onCheckedChange={setRequireVideoCompletion} id="add-req-video" />
              <Label htmlFor="add-req-video" className="text-sm">Require video completion before marking complete</Label>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={requireManualComplete} onCheckedChange={setRequireManualComplete} id="add-req-manual" />
            <Label htmlFor="add-req-manual" className="text-sm">Show "Mark Complete" button (manual completion)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!title.trim() || create.isPending}
            onClick={handleCreate}
          >
            {create.isPending ? "Adding..." : "Add Lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <MediaPickerDialog open={mediaPickerOpen} onClose={() => setMediaPickerOpen(false)} onSelect={handleSelectAsset} />
    </>
  );
}

// ─── Full-Screen Lesson Editor Page ─────────────────────────────────────────

function LessonEditorPage({ lesson, onClose, onSaved, onSavedAndClose }: { lesson: any; onClose: () => void; onSaved: () => void; onSavedAndClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<"settings" | "content" | "quiz">("settings");
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content ?? "");
  const [videoContent, setVideoContent] = useState(lesson.videoContent ?? "");
  const [embedUrl, setEmbedUrl] = useState(lesson.embedUrl ?? "");
  const [isPreview, setIsPreview] = useState(!!lesson.isPreview);
  const [durationMinutes, setDurationMinutes] = useState(String(lesson.durationMinutes ?? ""));
  const [requireVideoCompletion, setRequireVideoCompletion] = useState(lesson.requireVideoCompletion === 1);
  const [requireManualComplete, setRequireManualComplete] = useState(lesson.requireManualComplete === 1);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ id: number; title: string; s3Url: string; mediaType: string } | null>(null);

  const update = trpc.lmsAdmin.updateLesson.useMutation({
    onSuccess: () => { toast.success("Lesson saved"); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const handleSave = (andClose = false) => {
    update.mutate({
      id: lesson.id,
      title: title.trim(),
      isPreview,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
      requireVideoCompletion,
      requireManualComplete,
      content: (lesson.type === "text" || lesson.type === "video" || lesson.type === "download" || lesson.type === "video_text") ? (content || null) : undefined,
      videoContent: lesson.type === "video_text" ? (videoContent || null) : undefined,
      embedUrl: lesson.type === "embed" ? (embedUrl || null) : undefined,
      mediaAssetId: selectedAsset?.id ?? undefined,
    }, {
      onSuccess: () => { if (andClose && onSavedAndClose) { onSavedAndClose(); } else { onSaved(); } },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 mr-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="text-teal-700 font-bold text-sm uppercase tracking-wide">Edit Lesson</span>
          <span className="ml-3 text-gray-500 text-xs">{LESSON_TYPE_LABELS[lesson.type] ?? lesson.type}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "settings" ? "bg-teal-600 text-white" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab("content")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "content" ? "bg-teal-600 text-white" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Content Blocks
          </button>
          {lesson.type === "quiz" && (
            <button
              onClick={() => setActiveTab("quiz")}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "quiz" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <HelpCircle className="w-3 h-3" /> Quiz Builder
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <>
      {activeTab === "settings" && (
      <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Duration (min)</Label>
              <Input value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} type="number" min="0" className="mt-1" />
            </div>
          </div>

          {/* Content fields by type */}
          {lesson.type === "text" && (
            <div>
              <Label className="text-sm">Content</Label>
              <div className="mt-1"><RichTextEditor value={content} onChange={setContent} /></div>
            </div>
          )}
          {(lesson.type === "video" || lesson.type === "download") && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm">{lesson.type === "video" ? "Video URL" : "Download URL"}</Label>
                <Button size="sm" variant="outline" className="h-6 text-xs text-teal-600 border-teal-300 hover:bg-teal-50" onClick={() => setMediaPickerOpen(true)}>
                  Pick from Media Repository
                </Button>
              </div>
              {selectedAsset && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-700">
                  <span className="font-mono bg-teal-100 px-1 rounded uppercase">{selectedAsset.mediaType}</span>
                  <span className="flex-1 truncate">{selectedAsset.title}</span>
                  <button className="text-teal-400 hover:text-teal-600" onClick={() => { setSelectedAsset(null); setContent(lesson.content ?? ""); }}>×</button>
                </div>
              )}
              <Input value={content} onChange={e => setContent(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
          )}
          {lesson.type === "video_text" && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm">Video URL</Label>
                  <Button size="sm" variant="outline" className="h-6 text-xs text-teal-600 border-teal-300 hover:bg-teal-50" onClick={() => setMediaPickerOpen(true)}>
                    Pick from Media Repository
                  </Button>
                </div>
                {selectedAsset && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-700">
                    <span className="font-mono bg-teal-100 px-1 rounded uppercase">{selectedAsset.mediaType}</span>
                    <span className="flex-1 truncate">{selectedAsset.title}</span>
                    <button className="text-teal-400 hover:text-teal-600" onClick={() => { setSelectedAsset(null); setContent(lesson.content ?? ""); }}>×</button>
                  </div>
                )}
                <Input value={content} onChange={e => setContent(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Text Content (below video)</Label>
                <div className="mt-1"><RichTextEditor value={videoContent} onChange={setVideoContent} /></div>
              </div>
            </div>
          )}
          {lesson.type === "embed" && (
            <div>
              <Label className="text-sm">Embed URL (iframe src)</Label>
              <Input value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} placeholder="https://..." className="mt-1" />
              <p className="text-xs text-gray-400 mt-1">Paste the full URL to embed (YouTube, Vimeo, SCORM, H5P, etc.)</p>
            </div>
          )}
          {lesson.type === "quiz" && (
            <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
              Use the Quiz Builder button to manage questions for this quiz lesson.
            </div>
          )}

          {/* Preview toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={isPreview} onCheckedChange={setIsPreview} id="edit-preview" />
            <Label htmlFor="edit-preview" className="text-sm">Free preview (requires login)</Label>
          </div>

          {/* Completion toggles */}
          {(lesson.type === "video" || lesson.type === "video_text") && (
            <div className="flex items-center gap-2">
              <Switch checked={requireVideoCompletion} onCheckedChange={setRequireVideoCompletion} id="edit-req-video" />
              <Label htmlFor="edit-req-video" className="text-sm">Require video completion before marking complete</Label>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={requireManualComplete} onCheckedChange={setRequireManualComplete} id="edit-req-manual" />
            <Label htmlFor="edit-req-manual" className="text-sm">Show "Mark Complete" button (manual completion)</Label>
          </div>

          {/* Effects section */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-teal-700 mb-3 flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Lesson Effect</p>
            <LessonEffectEditor
              lessonId={lesson.id}
              initialData={{
                effectEnabled: lesson.effectEnabled,
                effectTrigger: lesson.effectTrigger,
                effectBannerText: lesson.effectBannerText,
                effectBannerBgColor: lesson.effectBannerBgColor,
                effectBannerTextColor: lesson.effectBannerTextColor,
                effectSound: lesson.effectSound,
                effectSoundUrl: lesson.effectSoundUrl,
                effectConfetti: lesson.effectConfetti,
                effectConfettiColors: lesson.effectConfettiColors,
              }}
              onSaved={onSaved}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="outline"
            className="border-teal-300 text-teal-700 hover:bg-teal-50"
            disabled={update.isPending}
            onClick={() => handleSave(false)}
          >
            {update.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={update.isPending}
            onClick={() => handleSave(true)}
          >
            {update.isPending ? "Saving..." : "Save & Close"}
          </Button>
        </div>
      </div>
      </div>
      )}

      {/* Content Blocks Tab */}
      {activeTab === "content" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <LessonBlockEditor
            lessonId={lesson.id}
            courseSlug={""}
            initialBlocks={lesson.contentBlocks ? (typeof lesson.contentBlocks === "string" ? JSON.parse(lesson.contentBlocks) : lesson.contentBlocks) as Block[] : []}
            initialObjectives={lesson.learningObjectives ? (typeof lesson.learningObjectives === "string" ? JSON.parse(lesson.learningObjectives) : lesson.learningObjectives) as string[] : []}
            onClose={() => setActiveTab("settings")}
            onSaved={() => { onSaved(); }}
            onSavedAndClose={() => { if (onSavedAndClose) onSavedAndClose(); else onSaved(); }}
          />
        </div>
      )}

      {/* Quiz Builder Tab (quiz-type lessons only) */}
      {activeTab === "quiz" && lesson.type === "quiz" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-6">
            <QuizBuilderInline lesson={lesson} courseId={lesson.courseId} />
          </div>
        </div>
      )}
      </>
      <MediaPickerDialog open={mediaPickerOpen} onClose={() => setMediaPickerOpen(false)} onSelect={asset => { setSelectedAsset(asset); setContent(asset.s3Url); }} />
    </div>
  );
}

// ─── Quiz Builder Inline (embedded in LessonEditorPage Quiz tab) ─────────────

function QuizBuilderInline({ lesson, courseId }: { lesson: any; courseId?: number }) {
  const { data: quiz, refetch } = trpc.lmsAdmin.getQuiz.useQuery({ lessonId: lesson.id });
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQ, setNewQ] = useState({ question: "", type: "mcq" as "mcq" | "truefalse", options: ["", "", "", ""], correctAnswer: "", explanation: "" });

  // AI Generate state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiTopic, setAITopic] = useState("");
  const [aiCount, setAICount] = useState(10);
  const [aiDifficulty, setAIDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [aiQType, setAIQType] = useState<"mcq" | "truefalse" | "mixed">("mcq");
  const [aiPreview, setAIPreview] = useState<Array<{ question: string; type: string; options: string[]; correctAnswer: string; explanation: string; selected: boolean }> | null>(null);

  const updateQuiz = trpc.lmsAdmin.updateQuiz.useMutation({ onSuccess: () => { toast.success("Quiz settings saved"); refetch(); } });
  const addQuestion = trpc.lmsAdmin.addQuestion.useMutation({
    onSuccess: () => { toast.success("Question added"); setAddingQuestion(false); setNewQ({ question: "", type: "mcq", options: ["", "", "", ""], correctAnswer: "", explanation: "" }); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });
  const deleteQuestion = trpc.lmsAdmin.deleteQuestion.useMutation({ onSuccess: () => refetch() });
  const aiGenerate = trpc.lmsAdmin.aiGenerateQuizQuestions.useMutation({
    onSuccess: (data) => { setAIPreview(data.questions.map(q => ({ ...q, selected: true }))); },
    onError: e => toast.error(`AI error: ${e.message}`),
  });
  const bulkInsert = trpc.lmsAdmin.bulkInsertQuizQuestions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.inserted} question${data.inserted === 1 ? "" : "s"} added`);
      setShowAIPanel(false);
      setAIPreview(null);
      setAITopic("");
      refetch();
    },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  if (!quiz) return <div className="text-gray-400 text-sm py-8 text-center">Loading quiz...</div>;

  return (
    <div className="space-y-5">
      {/* Quiz settings */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Passing score:</Label>
          <Input type="number" min="0" max="100" defaultValue={quiz.passingScore} className="w-16 h-7 text-sm text-center"
            onBlur={e => updateQuiz.mutate({ lessonId: lesson.id, passingScore: parseInt(e.target.value) })} />
          <span className="text-sm text-gray-500">%</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch defaultChecked={quiz.allowRetakes} onCheckedChange={v => updateQuiz.mutate({ lessonId: lesson.id, allowRetakes: v })} id="inline-retakes" />
          <Label htmlFor="inline-retakes" className="text-sm">Allow retakes</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch defaultChecked={quiz.showCorrectAnswers} onCheckedChange={v => updateQuiz.mutate({ lessonId: lesson.id, showCorrectAnswers: v })} id="inline-show-answers" />
          <Label htmlFor="inline-show-answers" className="text-sm">Show correct answers</Label>
        </div>
        <div className="ml-auto">
          <Button size="sm" variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50 gap-1.5" onClick={() => { setAIPreview(null); setShowAIPanel(p => !p); }}>
            <Sparkles className="w-3.5 h-3.5" /> AI Generate
          </Button>
        </div>
      </div>

      {/* AI Generate Panel */}
      {showAIPanel && (
        <div className="border border-purple-200 rounded-xl p-5 bg-purple-50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Question Generator</h3>
            {courseId && <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">Course context enabled</span>}
          </div>

          {!aiPreview ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Topic *</Label>
                <Input value={aiTopic} onChange={e => setAITopic(e.target.value)} placeholder="e.g. Doppler physics, DVT diagnosis criteria, Normal fetal echo anatomy" className="mt-1" />
                <p className="text-xs text-gray-500 mt-1">{courseId ? "The AI will use this course's content as context to generate relevant questions." : "Be specific — the AI will generate clinically accurate questions tailored to your topic."}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-medium">Number of Questions</Label>
                  <Select value={String(aiCount)} onValueChange={v => setAICount(Number(v))}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20, 25, 30, 40, 50].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Difficulty</Label>
                  <Select value={aiDifficulty} onValueChange={v => setAIDifficulty(v as any)}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Question Type</Label>
                  <Select value={aiQType} onValueChange={v => setAIQType(v as any)}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple Choice</SelectItem>
                      <SelectItem value="truefalse">True / False</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAIPanel(false)}>Cancel</Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                  size="sm"
                  disabled={!aiTopic.trim() || aiGenerate.isPending}
                  onClick={() => aiGenerate.mutate({ quizId: quiz.id, topic: aiTopic.trim(), count: aiCount, difficulty: aiDifficulty, questionType: aiQType, courseId })}
                >
                  {aiGenerate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate {aiCount} Questions</>}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{aiPreview.filter(q => q.selected).length} of {aiPreview.length} questions selected</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAIPreview(p => p!.map(q => ({ ...q, selected: true })))}>Select All</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAIPreview(p => p!.map(q => ({ ...q, selected: false })))}>Deselect All</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7 text-purple-600" onClick={() => setAIPreview(null)}>← Back</Button>
                </div>
              </div>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {aiPreview.map((q, qi) => (
                  <div key={qi} className={`border rounded-lg p-3 cursor-pointer transition-colors ${q.selected ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-white opacity-60"}`}
                    onClick={() => setAIPreview(p => p!.map((item, i) => i === qi ? { ...item, selected: !item.selected } : item))}>
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${q.selected ? "bg-purple-600 border-purple-600 text-white" : "border-gray-300"}`}>{q.selected ? "✓" : ""}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{qi + 1}. {q.question}</p>
                        <div className="mt-1.5 space-y-0.5">
                          {(q.options ?? []).map((opt: string) => (
                            <p key={opt} className={`text-xs px-2 py-0.5 rounded ${opt === q.correctAnswer ? "bg-green-100 text-green-700 font-medium" : "text-gray-500"}`}>{opt === q.correctAnswer ? "✓ " : "○ "}{opt}</p>
                          ))}
                        </div>
                        {q.explanation && <p className="text-xs text-gray-400 mt-1 italic">{q.explanation}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowAIPanel(false); setAIPreview(null); }}>Cancel</Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                  size="sm"
                  disabled={aiPreview.filter(q => q.selected).length === 0 || bulkInsert.isPending}
                  onClick={() => bulkInsert.mutate({
                    quizId: quiz.id,
                    questions: aiPreview.filter(q => q.selected).map(({ selected: _s, ...q }) => ({
                      question: q.question, type: q.type as "mcq" | "truefalse", options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation,
                    })),
                  })}
                >
                  {bulkInsert.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Inserting...</> : <>Add {aiPreview.filter(q => q.selected).length} Questions to Quiz</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Questions list */}
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
  );
}

// ─── Quiz Builder Dialog ──────────────────────────────────────────────────────

function QuizBuilderDialog({ lesson, onClose }: { lesson: any; onClose: () => void }) {
  
  const { data: quiz, refetch } = trpc.lmsAdmin.getQuiz.useQuery({ lessonId: lesson.id });
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQ, setNewQ] = useState({ question: "", type: "mcq" as "mcq" | "truefalse", options: ["", "", "", ""], correctAnswer: "", explanation: "" });

  // AI Generate state
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiTopic, setAITopic] = useState("");
  const [aiCount, setAICount] = useState(10);
  const [aiDifficulty, setAIDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [aiQType, setAIQType] = useState<"mcq" | "truefalse" | "mixed">("mcq");
  const [aiPreview, setAIPreview] = useState<Array<{ question: string; type: string; options: string[]; correctAnswer: string; explanation: string; selected: boolean }> | null>(null);

  const updateQuiz = trpc.lmsAdmin.updateQuiz.useMutation({ onSuccess: () => { toast.success("Quiz settings saved"); refetch(); } });
  const addQuestion = trpc.lmsAdmin.addQuestion.useMutation({
    onSuccess: () => { toast.success("Question added"); setAddingQuestion(false); setNewQ({ question: "", type: "mcq", options: ["", "", "", ""], correctAnswer: "", explanation: "" }); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });
  const deleteQuestion = trpc.lmsAdmin.deleteQuestion.useMutation({ onSuccess: () => refetch() });

  const aiGenerate = trpc.lmsAdmin.aiGenerateQuizQuestions.useMutation({
    onSuccess: (data) => {
      setAIPreview(data.questions.map(q => ({ ...q, selected: true })));
    },
    onError: e => toast.error(`AI error: ${e.message}`),
  });

  const bulkInsert = trpc.lmsAdmin.bulkInsertQuizQuestions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.inserted} question${data.inserted === 1 ? "" : "s"} added`);
      setShowAIDialog(false);
      setAIPreview(null);
      setAITopic("");
      refetch();
    },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Quiz Builder — {lesson.title}</DialogTitle>
            <Button size="sm" variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50 gap-1.5" onClick={() => { setAIPreview(null); setShowAIDialog(true); }}>
              <Sparkles className="w-3.5 h-3.5" /> AI Generate
            </Button>
          </div>
        </DialogHeader>

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

    {/* AI Generate Dialog */}
    {showAIDialog && quiz && (
      <Dialog open={true} onOpenChange={() => { setShowAIDialog(false); setAIPreview(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" /> AI Generate Questions
            </DialogTitle>
          </DialogHeader>

          {!aiPreview ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Topic *</Label>
                <Input
                  value={aiTopic}
                  onChange={e => setAITopic(e.target.value)}
                  placeholder="e.g. Doppler physics in vascular ultrasound, Normal fetal echo anatomy, DVT diagnosis criteria"
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">Be specific — the AI will generate clinically accurate questions tailored to your topic.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-medium">Number of Questions</Label>
                  <Select value={String(aiCount)} onValueChange={v => setAICount(Number(v))}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20, 25, 30, 40, 50].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Difficulty</Label>
                  <Select value={aiDifficulty} onValueChange={v => setAIDifficulty(v as any)}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Question Type</Label>
                  <Select value={aiQType} onValueChange={v => setAIQType(v as any)}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple Choice</SelectItem>
                      <SelectItem value="truefalse">True / False</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAIDialog(false)}>Cancel</Button>
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                  disabled={!aiTopic.trim() || aiGenerate.isPending}
                  onClick={() => aiGenerate.mutate({ quizId: quiz.id, topic: aiTopic.trim(), count: aiCount, difficulty: aiDifficulty, questionType: aiQType })}
                >
                  {aiGenerate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate {aiCount} Questions</>}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{aiPreview.filter(q => q.selected).length} of {aiPreview.length} questions selected</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAIPreview(p => p!.map(q => ({ ...q, selected: true })))}>Select All</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAIPreview(p => p!.map(q => ({ ...q, selected: false })))}>Deselect All</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7 text-teal-600" onClick={() => setAIPreview(null)}>← Back</Button>
                </div>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {aiPreview.map((q, qi) => {
                  const opts = q.options ?? [];
                  return (
                    <div
                      key={qi}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        q.selected ? "border-teal-400 bg-teal-50" : "border-gray-200 bg-white opacity-60"
                      }`}
                      onClick={() => setAIPreview(p => p!.map((item, i) => i === qi ? { ...item, selected: !item.selected } : item))}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${
                          q.selected ? "bg-teal-600 border-teal-600 text-white" : "border-gray-300"
                        }`}>{q.selected ? "✓" : ""}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{qi + 1}. {q.question}</p>
                          <div className="mt-1.5 space-y-0.5">
                            {opts.map((opt: string) => (
                              <p key={opt} className={`text-xs px-2 py-0.5 rounded ${
                                opt === q.correctAnswer ? "bg-green-100 text-green-700 font-medium" : "text-gray-500"
                              }`}>{opt === q.correctAnswer ? "✓ " : "○ "}{opt}</p>
                            ))}
                          </div>
                          {q.explanation && <p className="text-xs text-gray-400 mt-1 italic">{q.explanation}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setShowAIDialog(false); setAIPreview(null); }}>Cancel</Button>
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                  disabled={aiPreview.filter(q => q.selected).length === 0 || bulkInsert.isPending}
                  onClick={() => bulkInsert.mutate({
                    quizId: quiz.id,
                    questions: aiPreview.filter(q => q.selected).map(({ selected: _s, ...q }) => ({
                      question: q.question,
                      type: q.type as "mcq" | "truefalse",
                      options: q.options,
                      correctAnswer: q.correctAnswer,
                      explanation: q.explanation,
                    })),
                  })}
                >
                  {bulkInsert.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Inserting...</> : <>Add {aiPreview.filter(q => q.selected).length} Questions to Quiz</>}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )}
    </>
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
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlTab = urlParams?.get("tab") ?? null;
  const urlEditCourse = urlParams?.get("editCourse") ?? null;
  const urlEditDownload = urlParams?.get("editDownload") ?? null;
  const [activeTab, setActiveTab] = useState(urlTab || (urlEditDownload ? "downloads" : "courses"));
  const [editingCourseId, setEditingCourseId] = useState<number | null>(urlEditCourse ? Number(urlEditCourse) : null);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="mb-1">
        <Link href="/platform-admin" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-3 h-3" /> Platform Admin
        </Link>
      </div>
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
          <TabsList className="bg-gray-100 flex-wrap h-auto gap-0.5">
            <TabsTrigger value="courses" className="text-xs">Courses</TabsTrigger>
            <TabsTrigger value="quizzes" className="text-xs">Quizzes</TabsTrigger>
            <TabsTrigger value="downloads" className="text-xs">Downloads</TabsTrigger>
            <TabsTrigger value="enrollments" className="text-xs">Enrollments</TabsTrigger>
            <TabsTrigger value="groups" className="text-xs">Groups</TabsTrigger>
            <TabsTrigger value="instructors" className="text-xs">Instructors</TabsTrigger>
            <TabsTrigger value="affiliates" className="text-xs">Affiliates</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
            <TabsTrigger value="collections" className="text-xs">Collections</TabsTrigger>
            <TabsTrigger value="orderbumps" className="text-xs">Order Bumps</TabsTrigger>
          </TabsList>
          <TabsContent value="courses" className="mt-4"><CoursesTab onEdit={setEditingCourseId} typeFilter="course" /></TabsContent>
          <TabsContent value="quizzes" className="mt-4"><CoursesTab onEdit={setEditingCourseId} typeFilter="quiz" /></TabsContent>
          <TabsContent value="downloads" className="mt-4"><DigitalDownloadsAdmin initialEditId={urlEditDownload ? Number(urlEditDownload) : undefined} /></TabsContent>
          <TabsContent value="enrollments" className="mt-4"><EnrollmentsTab /></TabsContent>
          <TabsContent value="groups" className="mt-4"><GroupsTab /></TabsContent>
          <TabsContent value="instructors" className="mt-4"><InstructorsTab /></TabsContent>
          <TabsContent value="affiliates" className="mt-4"><AffiliatesTab /></TabsContent>
          <TabsContent value="analytics" className="mt-4"><AnalyticsTab /></TabsContent>
          <TabsContent value="collections" className="mt-4"><CollectionsTab /></TabsContent>
          <TabsContent value="orderbumps" className="mt-4"><OrderBumpsAdmin /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── Collections Tab ──────────────────────────────────────────────────────────
function CollectionsTab() {
  const utils = trpc.useUtils();
  const { data: collections, isLoading } = trpc.lmsAdmin.listCollections.useQuery();
  const { data: allCourses } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", page: 1, pageSize: 200 });

  const [createOpen, setCreateOpen] = useState(false);
  const [editCollection, setEditCollection] = useState<any>(null);

  const createCollection = trpc.lmsAdmin.createCollection.useMutation({
    onSuccess: () => { toast.success("Collection created"); utils.lmsAdmin.listCollections.invalidate(); setCreateOpen(false); },
    onError: e => toast.error(e.message),
  });
  const updateCollection = trpc.lmsAdmin.updateCollection.useMutation({
    onSuccess: () => { toast.success("Collection updated"); utils.lmsAdmin.listCollections.invalidate(); setEditCollection(null); },
    onError: e => toast.error(e.message),
  });
  const deleteCollection = trpc.lmsAdmin.deleteCollection.useMutation({
    onSuccess: () => { toast.success("Collection deleted"); utils.lmsAdmin.listCollections.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const setCourses = trpc.lmsAdmin.setCollectionCourses.useMutation({
    onSuccess: () => { utils.lmsAdmin.listCollections.invalidate(); },
    onError: e => toast.error(e.message),
  });

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Collections</h3>
          <p className="text-xs text-gray-500 mt-0.5">Group courses by custom labels — shown as filter tabs on the Education Library.</p>
        </div>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New Collection
        </Button>
      </div>

      {(!collections || collections.length === 0) && (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No collections yet. Create one to group courses by topic or label.</p>
        </div>
      )}

      <div className="space-y-3">
        {(collections ?? []).map((col: any) => (
          <div key={col.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
            {/* Color swatch */}
            <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
              style={{ backgroundColor: col.color ?? "#189aa1" }}>
              {col.title.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-800 text-sm">{col.title}</span>
                {col.label && <Badge variant="outline" className="text-xs">{col.label}</Badge>}
                {!col.isPublished && <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Draft</Badge>}
              </div>
              {col.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{col.description}</p>}
              <p className="text-xs text-gray-400 mt-1">{col.courseCount} course{col.courseCount !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                onClick={() => setEditCollection(col)}>
                <Edit2 className="w-3 h-3 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50"
                onClick={() => { if (confirm(`Delete collection "${col.title}"?`)) deleteCollection.mutate({ id: col.id }); }}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <CollectionFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        allCourses={allCourses?.courses ?? []}
        onSave={(data, courseIds) => createCollection.mutate({ ...data, isPublished: data.isPublished ?? true } as any)}
        saving={createCollection.isPending}
        title="New Collection"
      />

      {/* Edit Dialog */}
      {editCollection && (
        <CollectionFormDialog
          open={!!editCollection}
          onClose={() => setEditCollection(null)}
          allCourses={allCourses?.courses ?? []}
          initial={editCollection}
          onSave={(data, courseIds) => {
            updateCollection.mutate({ id: editCollection.id, ...data } as any);
            setCourses.mutate({ collectionId: editCollection.id, courseIds });
          }}
          saving={updateCollection.isPending || setCourses.isPending}
          title="Edit Collection"
        />
      )}
    </div>
  );
}

// ─── Collection Form Dialog ────────────────────────────────────────────────────
function CollectionFormDialog({
  open, onClose, allCourses, initial, onSave, saving, title,
}: {
  open: boolean;
  onClose: () => void;
  allCourses: any[];
  initial?: any;
  onSave: (data: any, courseIds: number[]) => void;
  saving: boolean;
  title: string;
}) {
  const [colTitle, setColTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [color, setColor] = useState(initial?.color ?? "#189aa1");
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>(initial?.courseIds ?? []);
  const [search, setSearch] = useState("");

  const filteredCourses = allCourses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCourse = (id: number) => {
    setSelectedCourseIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!colTitle.trim()) return;
    onSave({ title: colTitle.trim(), description: description || undefined, label: label || undefined, color, isPublished }, selectedCourseIds);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs font-medium">Collection Title *</Label>
              <Input value={colTitle} onChange={e => setColTitle(e.target.value)} placeholder="e.g. E-Learning & CME" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Label / Tag</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Featured, New, CME" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Accent Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-10 h-9 rounded border border-gray-200 cursor-pointer p-0.5" />
                <Input value={color} onChange={e => setColor(e.target.value)} className="flex-1 font-mono text-xs" />
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description (optional)" className="mt-1" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              <Label className="text-xs">Published (visible on Education Library)</Label>
            </div>
          </div>

          {/* Course picker */}
          <div>
            <Label className="text-xs font-medium">Courses in this Collection</Label>
            <p className="text-xs text-gray-400 mb-2">Select which courses appear in this collection. Order matches selection order.</p>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses..." className="mb-2 text-sm" />
            <div className="border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-100">
              {filteredCourses.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-400">No courses found</div>
              )}
              {filteredCourses.map((c: any) => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCourseIds.includes(c.id)}
                    onChange={() => toggleCourse(c.id)}
                    className="accent-teal-600"
                  />
                  <span className="text-sm text-gray-700 flex-1 truncate">{c.title}</span>
                  {selectedCourseIds.includes(c.id) && (
                    <span className="text-xs text-teal-600 font-medium">#{selectedCourseIds.indexOf(c.id) + 1}</span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{selectedCourseIds.length} course{selectedCourseIds.length !== 1 ? "s" : ""} selected</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSave} disabled={saving || !colTitle.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save Collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
