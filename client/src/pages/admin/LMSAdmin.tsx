/**
 * LMSAdmin.tsx
 * Platform Admin — LMS LMS Management management panel.
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
import React, { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import RichTextEditor from "@/components/RichTextEditor";
import {
  BookOpen, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Clock, Copy, Download, Edit2, HelpCircle, Pencil, Plus, Trash2,
  Users, DollarSign, BarChart2, GripVertical, CheckCircle, AlertCircle, AlertTriangle,
  Link as LinkIcon, UserCheck, ArrowLeft, Upload, ImageIcon,
  Sparkles, Loader2, Eye, EyeOff, Save, X, FolderOpen, Monitor, Video, FileText, CheckSquare, Settings2,
  User, Lock, ListChecks, Award, PlayCircle, ArrowRight, UserPlus, RefreshCw,
  Package, Layers, Globe, Radio, Tag, LayoutGrid, ShoppingBag, GraduationCap, TrendingUp,
  Layout as LayoutTemplate, Database,
  Hash, Shield, Flag, Pin, Megaphone, Bell, MessageSquare, Star, Zap, XCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import LessonEffectEditor from "@/components/LessonEffectEditor";
import ThinkificImporter from "@/pages/admin/ThinkificImporter";
import { LMSSalesTab } from "@/components/LMSSalesTab";
import DigitalDownloadsAdmin from "./DigitalDownloadsAdmin";
import PhysicalProductsAdmin from "./PhysicalProductsAdmin";
import OrderBumpsAdmin from "./OrderBumpsAdmin";
import CertificateTemplatesAdmin from "./CertificateTemplatesAdmin";
import LessonBlockEditor from "@/components/LessonBlockEditor";
import { Block, BlockType, BlockPreview } from "@/components/BlockPreview";
import { BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock, uid } from "@/pages/admin/LandingPageBuilder";
import { useLearnLink } from "@/hooks/useLearnLink";
/** Convenience alias used in LandingPageEditor */
function useOpenLearnLink() {
  const { openLearnLink } = useLearnLink();
  return openLearnLink;
}

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
  cohort: <Users className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  text: <FileText className="w-4 h-4" />,
  embed: <Monitor className="w-4 h-4" />,
  video_text: <Video className="w-4 h-4" />,
};

const LESSON_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  video: "Video",
  video_text: "Video + Text",
  embed: "Multimedia Embed",
  quiz: "Quiz",
  download: "Download / File",
};

// ─── SSO-aware link button for course list ───────────────────────────────────
/** @param slug - either a bare slug ("my-course") or a full path ("my-course/overview") */
function SsoLearnLinkButton({ slug, label }: { slug: string; label?: string }) {
  const { openLearnLink } = useLearnLink();
  const path = slug.startsWith("/") ? slug : `/courses/${slug}`;
  return (
    <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500 hover:bg-gray-50"
      onClick={() => openLearnLink(path)}
    >
      <LinkIcon className="w-3 h-3" />{label && <span className="ml-1">{label}</span>}
    </Button>
  );
}

// ─── Course / Quiz / Download List Tab ──────────────────────────────────────

function SortableCourseRow({ course, onEdit, onDuplicate, onDelete }: { course: any; onEdit: (id: number) => void; onDuplicate: (id: number) => void; onDelete: (id: number, title: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3 hover:border-teal-300 transition-colors">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none" title="Drag to reorder">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-gray-400">{TYPE_ICONS[course.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{course.title}</p>
        <p className="text-xs text-gray-400">{course.brand === "aaus" ? "All About Ultrasound™" : "iHeartEcho™"} · {course.type} · {course.isFree ? "Free" : `$${Number(course.price).toFixed(2)}`}</p>
      </div>
      <Badge className={`text-xs ${STATUS_COLORS[course.status]}`}>{course.status}</Badge>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600 hover:bg-teal-50" onClick={() => onEdit(course.id)}>
        <Edit2 className="w-3 h-3 mr-1" /> Edit
      </Button>
      <SsoLearnLinkButton slug={course.slug} />
      <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-500 hover:bg-blue-50" title="Duplicate" onClick={() => onDuplicate(course.id)}>
        <Copy className="w-3 h-3" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50" onClick={() => onDelete(course.id, course.title)}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

function CoursesTab({ onEdit, typeFilter = "course" }: { onEdit: (id: number) => void; typeFilter?: "course" | "quiz" | "download" | "cohort" }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [localCourses, setLocalCourses] = useState<any[]>([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  const typeLabel = typeFilter === "quiz" ? "Quiz" : typeFilter === "download" ? "Download" : typeFilter === "cohort" ? "Cohort" : "Course";
  const typeLabelPlural = typeFilter === "quiz" ? "quizzes" : typeFilter === "download" ? "downloads" : typeFilter === "cohort" ? "cohorts" : "courses";

  const { data, isLoading, error, refetch } = trpc.lmsAdmin.listCourses.useQuery({ status: statusFilter as any, type: typeFilter, page, pageSize: 200 });

  // Sync local courses from server data
  const prevDataRef = useRef<any>(null);
  useEffect(() => {
    if (data?.courses && data.courses !== prevDataRef.current) {
      prevDataRef.current = data.courses;
      // Sort by libraryOrder asc, then createdAt desc (mirrors server)
      const sorted = [...data.courses].sort((a: any, b: any) => {
        if (a.libraryOrder !== b.libraryOrder) return (a.libraryOrder ?? 0) - (b.libraryOrder ?? 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setLocalCourses(sorted);
    }
  }, [data?.courses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reorderCourses = trpc.lmsAdmin.reorderCourses.useMutation({
    onSuccess: () => toast.success("Library order saved"),
    onError: e => toast.error(`Failed to save order: ${e.message}`),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localCourses.findIndex((c: any) => c.id === active.id);
    const newIndex = localCourses.findIndex((c: any) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(localCourses, oldIndex, newIndex);
    setLocalCourses(reordered);
    // Persist: assign 1-based positions
    reorderCourses.mutate({
      courses: reordered.map((c: any, i: number) => ({ id: c.id, libraryOrder: i + 1 })),
    });
  };

  const deleteCourse = trpc.lmsAdmin.deleteCourse.useMutation({
    onSuccess: () => { toast.success("Course deleted"); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });
  const duplicateCourse = trpc.lmsAdmin.duplicateCourse.useMutation({
    onSuccess: (d) => { toast.success(`Duplicated as "${d.title}"`); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const activeCourse = activeDragId ? localCourses.find((c: any) => c.id === activeDragId) : null;

  // Paginate locally when not in reorder mode
  const pageSize = 20;
  const displayCourses = reorderMode ? localCourses : localCourses.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!reorderMode && (
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          )}
          {data && <span className="text-sm text-gray-500">{data.total} {data.total !== 1 ? typeLabelPlural : typeLabel.toLowerCase()}</span>}
          {reorderMode && <span className="text-xs text-teal-600 font-medium">Drag rows to set library display order</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={reorderMode ? "default" : "outline"} className={reorderMode ? "h-8 bg-teal-600 hover:bg-teal-700 text-white" : "h-8"} onClick={() => setReorderMode(r => !r)}>
            <GripVertical className="w-3 h-3 mr-1" /> {reorderMode ? "Done Reordering" : "Reorder"}
          </Button>
          {!reorderMode && (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> New {typeLabel}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="font-medium">Failed to load {typeLabelPlural}</p>
          <p className="text-sm text-gray-400 mt-1">{error.message}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : reorderMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveDragId(e.active.id as number)} onDragEnd={handleDragEnd}>
          <SortableContext items={localCourses.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {localCourses.map((c: any) => (
                <SortableCourseRow key={c.id} course={c} onEdit={onEdit}
                  onDuplicate={id => duplicateCourse.mutate({ id })}
                  onDelete={(id, title) => { if (confirm(`Delete "${title}"?`)) deleteCourse.mutate({ id }); }}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeCourse && (
              <div className="flex items-center gap-3 bg-white rounded-lg border-2 border-teal-400 shadow-lg px-4 py-3">
                <GripVertical className="w-4 h-4 text-teal-400" />
                <span className="text-gray-400">{TYPE_ICONS[activeCourse.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{activeCourse.title}</p>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-2">
          {displayCourses.map((c: any) => (
            <SortableCourseRow key={c.id} course={c} onEdit={onEdit}
              onDuplicate={id => duplicateCourse.mutate({ id })}
              onDelete={(id, title) => { if (confirm(`Delete "${title}"?`)) deleteCourse.mutate({ id }); }}
            />
          ))}
          {displayCourses.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No {typeLabelPlural} yet. Create your first {typeLabel.toLowerCase()}.</p>
            </div>
          )}
        </div>
      )}

      {!reorderMode && (data?.total ?? 0) > pageSize && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page * pageSize >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <CreateCourseDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={id => { setCreateOpen(false); onEdit(id); refetch(); }} defaultType={typeFilter} />
    </div>
  );
}

// ─── Create Course Dialog ─────────────────────────────────────────────────────

function CreateCourseDialog({ open, onClose, onCreated, defaultType = "course" }: { open: boolean; onClose: () => void; onCreated: (id: number) => void; defaultType?: "course" | "quiz" | "download" | "cohort" }) {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [type, setType] = useState<"course" | "quiz" | "download" | "cohort">(defaultType);
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
  const [aiModuleCount, setAiModuleCount] = useState(5);
  const [aiLessonsPerModule, setAiLessonsPerModule] = useState(4);
  const [aiStarterContent, setAiStarterContent] = useState("");
  const [aiGenerateQuizzes, setAiGenerateQuizzes] = useState(true);

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

  const productLabel = type === "quiz" ? "Quiz" : type === "download" ? "Download" : type === "cohort" ? "Cohort" : "Course";

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
                      <SelectItem value="cohort">Cohort</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Brand</Label>
                  <Select value={brand} onValueChange={v => setBrand(v as any)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aaus">All About Ultrasound™</SelectItem>
                      <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
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
                          <SelectItem value="aaus">All About Ultrasound™</SelectItem>
                          <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
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
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm">Number of Modules: <span className="font-bold text-teal-600">{aiModuleCount}</span></Label>
                          <input
                            type="range" min={3} max={20} step={1}
                            value={aiModuleCount}
                            onChange={e => setAiModuleCount(Number(e.target.value))}
                            className="mt-2 w-full accent-teal-600"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>3</span><span>20</span></div>
                        </div>
                        <div>
                          <Label className="text-sm">Lessons per Module: <span className="font-bold text-teal-600">{aiLessonsPerModule}</span></Label>
                          <input
                            type="range" min={3} max={10} step={1}
                            value={aiLessonsPerModule}
                            onChange={e => setAiLessonsPerModule(Number(e.target.value))}
                            className="mt-2 w-full accent-teal-600"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>3</span><span>10</span></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md border">
                        <input
                          type="checkbox"
                          id="aiGenerateQuizzes"
                          checked={aiGenerateQuizzes}
                          onChange={e => setAiGenerateQuizzes(e.target.checked)}
                          className="accent-teal-600 w-4 h-4"
                        />
                        <label htmlFor="aiGenerateQuizzes" className="text-sm cursor-pointer">
                          Generate a <strong>5-question quiz</strong> after each lesson
                        </label>
                      </div>
                      <div>
                        <Label className="text-sm">Starter Content / Outline (optional)</Label>
                        <textarea
                          value={aiStarterContent}
                          onChange={e => setAiStarterContent(e.target.value)}
                          placeholder="Paste your existing outline, notes, syllabus, or any content you want the AI to use as the foundation. The AI will follow your structure and terminology."
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[120px] resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">Optional — provide an existing outline, syllabus, or notes to guide the AI.</p>
                      </div>
                      <div>
                        <Label className="text-sm">Estimated Duration (minutes, optional)</Label>
                        <Input value={aiDuration} onChange={e => setAiDuration(e.target.value)} placeholder="e.g. 120" className="mt-1" type="number" min="5" />
                      </div>
                    </>
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
                    {type !== "quiz" && Array.isArray(aiPreview?.sections) && (() => {
                      const totalLessons = aiPreview.sections.reduce((a: number, s: any) => a + (s.lessons?.length ?? 0), 0);
                      const totalQuizzes = aiPreview.sections.reduce((a: number, s: any) =>
                        a + (s.lessons?.filter((l: any) => l.quiz?.questions?.length > 0).length ?? 0), 0);
                      return (
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-teal-700 dark:text-teal-400">Curriculum</span>
                            <span className="text-xs bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full">{aiPreview.sections.length} modules</span>
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{totalLessons} lessons</span>
                            {totalQuizzes > 0 && <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">{totalQuizzes} quizzes</span>}
                          </div>
                          <div className="mt-2 space-y-2">
                            {aiPreview.sections.map((sec: any, si: number) => (
                              <div key={si} className="border rounded p-2">
                                <div className="font-medium text-xs text-gray-700 dark:text-gray-300 mb-1">{si + 1}. {sec.title}</div>
                                <div className="pl-3 space-y-1">
                                  {sec.lessons?.map((les: any, li: number) => (
                                    <div key={li} className="text-xs text-gray-500">
                                      <div className="flex items-center gap-1">
                                        <span className="text-gray-400">{li + 1}.</span>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{les.title}</span>
                                        <span className="ml-auto text-gray-400 shrink-0">{les.durationMinutes ? `${les.durationMinutes}m` : ""}</span>
                                        {les.quiz?.questions?.length > 0 && <span className="text-purple-500 shrink-0">+quiz</span>}
                                      </div>
                                      {les.content && (
                                        <div className="mt-0.5 pl-4 text-gray-400 line-clamp-2" dangerouslySetInnerHTML={{ __html: les.content.replace(/<[^>]+>/g, ' ').slice(0, 120) + '...' }} />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
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
                price: pricingType === "free" ? 0 : parseFloat(price || "0"),
                subscriptionInterval: pricingType === "subscription" ? subscriptionInterval : undefined,
                downPayment: pricingType === "payment_plan" ? parseFloat(downPayment || "0") : undefined,
                installmentCount: pricingType === "payment_plan" ? parseInt(installmentCount || "0") : undefined,
                installmentAmount: pricingType === "payment_plan" ? parseFloat(installmentAmount || "0") : undefined,
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
                moduleCount: aiModuleCount,
                lessonsPerModule: aiLessonsPerModule,
                starterContent: aiStarterContent.trim() || undefined,
                generateQuizzes: aiGenerateQuizzes,
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

function SortableLessonRow({ lesson, onEdit, onQuiz, onDelete, onCopy, onMoveUp, onMoveDown, onToggleStatus }: {
  lesson: any;
  onEdit: (lesson: any) => void;
  onQuiz: (lesson: any) => void;
  onDelete: (id: number) => void;
  onCopy?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleStatus?: (id: number, newStatus: "published" | "draft") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 bg-white">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-gray-100" title="Drag to reorder">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>
      <div className="flex flex-col gap-0">
        <button disabled={!onMoveUp} onClick={onMoveUp} className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-teal-600 disabled:opacity-20 disabled:cursor-not-allowed" title="Move up"><ChevronUp className="w-3 h-3" /></button>
        <button disabled={!onMoveDown} onClick={onMoveDown} className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-teal-600 disabled:opacity-20 disabled:cursor-not-allowed" title="Move down"><ChevronDown className="w-3 h-3" /></button>
      </div>
      <span className="text-gray-400">{TYPE_ICONS[lesson.type] ?? <FileText className="w-4 h-4" />}</span>
      <span className="text-sm text-gray-700 flex-1">{lesson.title}</span>
      <span className="text-xs text-gray-400">{LESSON_TYPE_LABELS[lesson.type] ?? lesson.type}</span>
      {onToggleStatus ? (
        <button
          title={lesson.lessonStatus === "draft" ? "Draft — click to publish" : "Published — click to set as draft"}
          onClick={() => onToggleStatus(lesson.id, lesson.lessonStatus === "draft" ? "published" : "draft")}
          className={`text-xs font-semibold px-2 py-0.5 rounded border transition-colors ${
            lesson.lessonStatus === "draft"
              ? "text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-100"
              : "text-gray-400 border-gray-200 bg-white hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300"
          }`}
        >
          {lesson.lessonStatus === "draft" ? "Draft" : "Published"}
        </button>
      ) : (
        lesson.lessonStatus === "draft" && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">Draft</Badge>
      )}
      {lesson.isPreview && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300">Preview</Badge>}
      {lesson.requireVideoCompletion === 1 && <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Video req.</Badge>}
      {lesson.requireManualComplete === 1 && <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Manual</Badge>}
      {lesson.type === "quiz" && (
        <Button size="sm" variant="ghost" className="h-7 text-xs text-purple-600 hover:bg-purple-50" onClick={() => onQuiz(lesson)}>
          <HelpCircle className="w-3 h-3 mr-1" /> Quiz
        </Button>
      )}
      {onCopy && (
        <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-500 hover:bg-blue-50" title="Copy to another course" onClick={onCopy}>
          <Copy className="w-3 h-3" />
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

// ─── Sortable Section Row ────────────────────────────────────────────────────

function SortableSectionRow({ section, children, onAddLesson, onDrip, onDelete, onCopyModule, onMoveUp, onMoveDown, onRenameSection, onSaveAsTemplate }: {
  section: any;
  children: React.ReactNode;
  onAddLesson: () => void;
  onDrip: () => void;
  onDelete: () => void;
  onCopyModule?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRenameSection?: (newTitle: string) => void;
  onSaveAsTemplate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative',
  };
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const commitRename = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== section.title && onRenameSection) onRenameSection(trimmed);
    setEditingTitle(false);
  };
  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-gray-100" title="Drag to reorder section">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </button>
        <div className="flex flex-col gap-0">
          <button disabled={!onMoveUp} onClick={onMoveUp} className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-teal-600 disabled:opacity-20 disabled:cursor-not-allowed" title="Move up"><ChevronUp className="w-3 h-3" /></button>
          <button disabled={!onMoveDown} onClick={onMoveDown} className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-teal-600 disabled:opacity-20 disabled:cursor-not-allowed" title="Move down"><ChevronDown className="w-3 h-3" /></button>
        </div>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(section.title); } }}
            className="flex-1 font-medium text-sm text-gray-800 bg-white border border-teal-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
            autoFocus
          />
        ) : (
          <span
            className="font-medium text-sm text-gray-800 flex-1 cursor-pointer hover:text-teal-700 group/title flex items-center gap-1"
            title="Click pencil or double-click to rename"
            onDoubleClick={() => { setTitleDraft(section.title); setEditingTitle(true); }}
          >
            <span>{section.title}</span>
            <button
              type="button"
              className="shrink-0 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setTitleDraft(section.title); setEditingTitle(true); }}
              title="Rename section"
            >
              <Pencil className="w-3 h-3 text-gray-300 group-hover/title:text-teal-400 transition-colors hover:text-teal-600" />
            </button>
          </span>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600" onClick={onAddLesson}>
          <Plus className="w-3 h-3 mr-1" /> Add Lesson
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500 hover:bg-gray-100" title="Drip schedule" onClick={onDrip}>
          <Clock className="w-3 h-3 mr-1" />{(section.dripDays ?? 0) > 0 ? `+${section.dripDays}d` : "Drip"}
        </Button>
        {onCopyModule && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-500 hover:bg-blue-50" title="Copy module to another course" onClick={onCopyModule}>
            <Copy className="w-3 h-3 mr-1" /> Copy
          </Button>
        )}
        {onSaveAsTemplate && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-purple-500 hover:bg-purple-50" title="Save section as reusable template" onClick={onSaveAsTemplate}>
            <Save className="w-3 h-3 mr-1" /> Template
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50" onClick={onDelete}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      {children}
    </div>
  );
}

// ─── Course Editor ────────────────────────────────────────────────────────────

function CourseEditor({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  const [, navigate] = useLocation();
  const { openLearnLink } = useLearnLink();
  
  const utils = trpc.useUtils();
  const { data: course, isLoading, refetch } = trpc.lmsAdmin.getCourse.useQuery({ id: courseId });
  const initialTab = (() => { try { return new URLSearchParams(window.location.search).get("tab") ?? "settings"; } catch { return "settings"; } })();
  const [activeTab, setActiveTab] = useState(initialTab);
  // Track which tabs have been visited to lazy-mount heavy editors
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set([initialTab]));
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisitedTabs(prev => { const next = new Set(prev); next.add(tab); return next; });
  };
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addLessonSection, setAddLessonSection] = useState<number | null>(null);
  const [addLessonAtCourseLevel, setAddLessonAtCourseLevel] = useState(false);
  const [editLesson, setEditLesson] = useState<any>(null);
  // No pendingLessonId needed — AddLessonDialog now passes the full lesson object directly
  const [quizLesson, setQuizLesson] = useState<any>(null);
  const [importMediaSection, setImportMediaSection] = useState<number | null>(null);
  const [editSectionDrip, setEditSectionDrip] = useState<{ id: number; title: string; dripDays: number } | null>(null);

  const updateSection = trpc.lmsAdmin.updateSection.useMutation({
    onSuccess: (_data, vars) => { if (vars.dripDays !== undefined) { toast.success("Drip schedule saved"); setEditSectionDrip(null); } refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const updateCourse = trpc.lmsAdmin.updateCourse.useMutation({
    onSuccess: () => { toast.success("Saved"); refetch(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  // Publish dialog state — shown when admin changes status to 'public' and there are draft lessons
  const [publishDialog, setPublishDialog] = useState<{ pendingData: any } | null>(null);
  const bulkSetLessonStatus = trpc.lmsAdmin.bulkSetLessonStatus.useMutation();
  const updateLessonStatus = trpc.lmsAdmin.updateLesson.useMutation({
    onSuccess: () => refetch(),
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const handleSaveCourseSettings = (data: any) => {
    const allLessonsFlat = [
      ...(course?.topLevelLessons ?? []),
      ...(course?.sections ?? []).flatMap((s: any) => s.lessons ?? []),
    ];
    const draftCount = allLessonsFlat.filter((l: any) => l.lessonStatus === "draft").length;
    // If publishing (status → public) and there are draft lessons, show dialog
    if (data.status === "public" && course?.status !== "public" && draftCount > 0) {
      setPublishDialog({ pendingData: data });
    } else {
      updateCourse.mutate({ id: courseId, ...data });
    }
  };

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

  // Local state for optimistic DnD reordering
  const [localSections, setLocalSections] = useState<any[]>([]);
  const [localTopLessons, setLocalTopLessons] = useState<any[]>([]);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [copyLessonTarget, setCopyLessonTarget] = useState<any | null>(null);
  const [copyModuleTarget, setCopyModuleTarget] = useState<any | null>(null);
  const [saveAsTemplateSection, setSaveAsTemplateSection] = useState<any | null>(null);

  useEffect(() => {
    if (course) {
      setLocalSections(course.sections ?? []);
      setLocalTopLessons(course.topLevelLessons ?? []);
    }
  }, [course]);

  const reorderLessons = trpc.lmsAdmin.reorderLessons.useMutation({
    onError: (e) => { toast.error(`Reorder failed: ${e.message}`); refetch(); },
  });

  const reorderSections = trpc.lmsAdmin.reorderSections.useMutation({
    onError: (e) => { toast.error(`Reorder failed: ${e.message}`); refetch(); },
  });

  const moveLesson = trpc.lmsAdmin.moveLesson.useMutation({
    onSuccess: () => { toast.success("Lesson moved"); refetch(); },
    onError: (e) => { toast.error(`Move failed: ${e.message}`); refetch(); },
  });

  const copyLesson = trpc.lmsAdmin.copyLesson.useMutation({
    onSuccess: () => { toast.success("Lesson copied successfully"); refetch(); },
    onError: (e) => toast.error(`Copy failed: ${e.message}`),
  });

  const copyModule = trpc.lmsAdmin.copyModule.useMutation({
    onSuccess: () => { toast.success("Module copied successfully"); refetch(); },
    onError: (e) => toast.error(`Copy failed: ${e.message}`),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: any) => {
    setActiveDragId(event.active.id as number);
  }, []);

  // Unified drag end: handles section reorder, lesson reorder within section, and cross-section move
  const handleUnifiedDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id as number;
    const overId = over.id as number;

    // Check if active is a section
    const activeSectionIdx = localSections.findIndex(s => s.id === activeId);
    if (activeSectionIdx !== -1) {
      // Section reorder
      const overSectionIdx = localSections.findIndex(s => s.id === overId);
      if (overSectionIdx !== -1) {
        setLocalSections(prev => {
          const reordered = arrayMove(prev, activeSectionIdx, overSectionIdx);
          reorderSections.mutate({ sections: reordered.map((s, i) => ({ id: s.id, position: i })) });
          return reordered;
        });
      }
      return;
    }

    // Active is a lesson — find which section it's in
    const findLessonSection = (lessonId: number) => {
      for (const sec of localSections) {
        if (sec.lessons.some((l: any) => l.id === lessonId)) return sec.id as number;
      }
      if (localTopLessons.some(l => l.id === lessonId)) return null;
      return undefined;
    };

    const sourceSectionId = findLessonSection(activeId);
    if (sourceSectionId === undefined) return; // not found

    // Determine target section: over could be a lesson or a section header
    const overIsSection = localSections.some(s => s.id === overId);
    let targetSectionId: number | null;
    if (overIsSection) {
      targetSectionId = overId;
    } else {
      targetSectionId = findLessonSection(overId) ?? null;
    }

    if (sourceSectionId === targetSectionId) {
      // Same section reorder
      if (sourceSectionId === null) {
        setLocalTopLessons(prev => {
          const oldIndex = prev.findIndex(l => l.id === activeId);
          const newIndex = prev.findIndex(l => l.id === overId);
          if (oldIndex === -1 || newIndex === -1) return prev;
          const reordered = arrayMove(prev, oldIndex, newIndex);
          reorderLessons.mutate({ lessons: reordered.map((l, i) => ({ id: l.id, position: i })) });
          return reordered;
        });
      } else {
        setLocalSections(prev => {
          const secIdx = prev.findIndex(s => s.id === sourceSectionId);
          if (secIdx === -1) return prev;
          const lessons = prev[secIdx].lessons;
          const oldIndex = lessons.findIndex((l: any) => l.id === activeId);
          const newIndex = lessons.findIndex((l: any) => l.id === overId);
          if (oldIndex === -1 || newIndex === -1) return prev;
          const reordered = arrayMove(lessons, oldIndex, newIndex);
          reorderLessons.mutate({ lessons: reordered.map((l: any, i: number) => ({ id: l.id, position: i })) });
          const newSections = [...prev];
          newSections[secIdx] = { ...prev[secIdx], lessons: reordered };
          return newSections;
        });
      }
    } else {
      // Cross-section move — optimistic update
      let movedLesson: any;
      setLocalSections(prev => {
        const newSections = prev.map(sec => {
          if (sec.id === sourceSectionId) {
            const lessons = sec.lessons.filter((l: any) => l.id !== activeId);
            movedLesson = sec.lessons.find((l: any) => l.id === activeId);
            return { ...sec, lessons };
          }
          if (sec.id === targetSectionId && movedLesson) {
            return { ...sec, lessons: [...sec.lessons, { ...movedLesson, sectionId: targetSectionId }] };
          }
          return sec;
        });
        return newSections;
      });
      if (sourceSectionId === null) {
        setLocalTopLessons(prev => {
          movedLesson = prev.find(l => l.id === activeId);
          return prev.filter(l => l.id !== activeId);
        });
      }
      moveLesson.mutate({ lessonId: activeId, targetSectionId, courseId });
    }
  }, [localSections, localTopLessons, reorderLessons, reorderSections, moveLesson, courseId]);

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
          onClick={() => openLearnLink(`/courses/${course.slug}/player`)}
        >
          <Eye className="w-3 h-3 mr-1" /> Preview Course
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
          onClick={() => openLearnLink(`/courses/${course.slug}/player?preview=student`)}
        >
          <Users className="w-3 h-3 mr-1" /> Preview as Student
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          {course.type === "cohort" && (
            <TabsTrigger value="cohort" className="text-xs">Cohort</TabsTrigger>
          )}
          <TabsTrigger value="curriculum" className="text-xs">
            {course.type === "quiz" ? "Questions" : course.type === "download" ? "Files" : "Curriculum"}
          </TabsTrigger>
          <TabsTrigger value="landing" className="text-xs">Landing Page</TabsTrigger>
          <TabsTrigger value="overview" className="text-xs">Course Overview</TabsTrigger>
          <TabsTrigger value="instructors" className="text-xs">Instructors</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">Students</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs">Sales</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <CourseSettingsForm course={course} onSave={handleSaveCourseSettings} saving={updateCourse.isPending} />
        </TabsContent>

        {/* Curriculum Tab */}
        <TabsContent value="curriculum" className="mt-4">
          <div className="space-y-4">
            {/* Quick-add buttons at the top */}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="border-dashed border-teal-300 text-teal-600 hover:bg-teal-50" onClick={() => setAddLessonAtCourseLevel(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Lesson (No Section)
              </Button>
              <Button size="sm" variant="outline" className="border-dashed border-gray-300 text-gray-600 hover:bg-gray-50" onClick={() => setAddSectionOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Section
              </Button>
            </div>
            {/* Single unified DndContext for all drag operations */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleUnifiedDragEnd}
            >
              {/* Top-level lessons (no section) */}
              {localTopLessons.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 border-b border-teal-200">
                    <span className="font-medium text-sm text-teal-800 flex-1">Course-Level Lessons</span>
                    <span className="text-xs text-teal-600">Not inside any section</span>
                  </div>
                  <SortableContext items={localTopLessons.map((l: any) => l.id)} strategy={verticalListSortingStrategy}>
                    <div className="divide-y divide-gray-100">
                      {localTopLessons.map((lesson: any, li: number) => (
                        <SortableLessonRow
                          key={lesson.id} lesson={lesson}
                          onEdit={setEditLesson} onQuiz={setQuizLesson}
                          onCopy={() => setCopyLessonTarget(lesson)}
                          onDelete={id => { if (confirm(`Delete lesson "${lesson.title}"?`)) deleteLesson.mutate({ id }); }}
                          onToggleStatus={(id, newStatus) => updateLessonStatus.mutate({ id, lessonStatus: newStatus })}
                          onMoveUp={li > 0 ? () => setLocalTopLessons(prev => { const r = arrayMove(prev, li, li - 1); reorderLessons.mutate({ lessons: r.map((l: any, i: number) => ({ id: l.id, position: i })) }); return r; }) : undefined}
                          onMoveDown={li < localTopLessons.length - 1 ? () => setLocalTopLessons(prev => { const r = arrayMove(prev, li, li + 1); reorderLessons.mutate({ lessons: r.map((l: any, i: number) => ({ id: l.id, position: i })) }); return r; }) : undefined}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              )}

              {/* Sections */}
              <SortableContext items={localSections.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {localSections.map((section: any, si: number) => (
                    <SortableSectionRow
                      key={section.id}
                      section={section}
                      onAddLesson={() => setAddLessonSection(section.id)}
                      onDrip={() => setEditSectionDrip({ id: section.id, title: section.title, dripDays: section.dripDays ?? 0 })}
                      onCopyModule={() => setCopyModuleTarget(section)}
                      onSaveAsTemplate={() => setSaveAsTemplateSection(section)}
                      onDelete={() => { if (confirm(`Delete section "${section.title}" and all its lessons?`)) deleteSection.mutate({ id: section.id }); }}
                      onMoveUp={si > 0 ? () => setLocalSections(prev => { const r = arrayMove(prev, si, si - 1); reorderSections.mutate({ sections: r.map((s: any, i: number) => ({ id: s.id, position: i })) }); return r; }) : undefined}
                      onMoveDown={si < localSections.length - 1 ? () => setLocalSections(prev => { const r = arrayMove(prev, si, si + 1); reorderSections.mutate({ sections: r.map((s: any, i: number) => ({ id: s.id, position: i })) }); return r; }) : undefined}
                      onRenameSection={(newTitle) => {
                        // Optimistic update — update title immediately in local state
                        setLocalSections(prev => prev.map(s => s.id === section.id ? { ...s, title: newTitle } : s));
                        updateSection.mutate({ id: section.id, title: newTitle });
                      }}
                    >
                      <SortableContext items={section.lessons.map((l: any) => l.id)} strategy={verticalListSortingStrategy}>
                        <div className="divide-y divide-gray-100">
                          {section.lessons.map((lesson: any, li: number) => (
                            <SortableLessonRow
                              key={lesson.id} lesson={lesson}
                              onEdit={setEditLesson} onQuiz={setQuizLesson}
                              onCopy={() => setCopyLessonTarget(lesson)}
                              onDelete={id => { if (confirm(`Delete lesson "${lesson.title}"?`)) deleteLesson.mutate({ id }); }}
                              onToggleStatus={(id, newStatus) => updateLessonStatus.mutate({ id, lessonStatus: newStatus })}
                              onMoveUp={li > 0 ? () => setLocalSections(prev => { const secs = [...prev]; const lessons = arrayMove(secs[si].lessons, li, li - 1); secs[si] = { ...secs[si], lessons }; reorderLessons.mutate({ lessons: lessons.map((l: any, i: number) => ({ id: l.id, position: i })) }); return secs; }) : undefined}
                              onMoveDown={li < section.lessons.length - 1 ? () => setLocalSections(prev => { const secs = [...prev]; const lessons = arrayMove(secs[si].lessons, li, li + 1); secs[si] = { ...secs[si], lessons }; reorderLessons.mutate({ lessons: lessons.map((l: any, i: number) => ({ id: l.id, position: i })) }); return secs; }) : undefined}
                            />
                          ))}
                          {section.lessons.length === 0 && (
                            <div className="px-4 py-3 text-xs text-gray-400 italic">No lessons yet — drag a lesson here or click Add Lesson.</div>
                          )}
                        </div>
                      </SortableContext>
                    </SortableSectionRow>
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeDragId ? (
                  <div className="bg-white border border-teal-300 rounded-lg px-4 py-2 shadow-xl text-sm text-teal-700 font-medium opacity-90 cursor-grabbing">
                    Moving...
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

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

        {/* Landing Page Tab — lazy-mounted on first visit to avoid parsing the large builder on load */}
        <TabsContent value="landing" className="mt-4">
          <LandingPageEditor courseId={courseId} courseType={course.type} />
        </TabsContent>

        {/* Course Overview Tab — lazy-mounted on first visit */}
        <TabsContent value="overview" className="mt-4">
          {visitedTabs.has("overview") ? (
            <CourseOverviewEditor
              courseId={courseId}
              courseSlug={course.slug}
              courseTitle={course.title}
              courseThumbnail={course.thumbnailUrl ?? null}
              sections={course.sections ?? []}
              topLevelLessons={course.topLevelLessons ?? []}
              initialBlocks={course.courseOverviewBlocks ? (typeof course.courseOverviewBlocks === "string" ? JSON.parse(course.courseOverviewBlocks) : course.courseOverviewBlocks) : []}
              initialTopBlocks={course.courseOverviewTopBlocks ? (typeof course.courseOverviewTopBlocks === "string" ? JSON.parse(course.courseOverviewTopBlocks) : course.courseOverviewTopBlocks) : []}
              initialBottomBlocks={course.courseOverviewBottomBlocks ? (typeof course.courseOverviewBottomBlocks === "string" ? JSON.parse(course.courseOverviewBottomBlocks) : course.courseOverviewBottomBlocks) : []}
              hideProgress={course.hideProgress ?? false}
              onSaved={() => refetch()}
            />
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading Overview editor…</div>
          )}
        </TabsContent>

        {/* Instructors Tab */}
        <TabsContent value="instructors" className="mt-4">
          <CourseInstructorsEditor courseId={courseId} courseInstructors={course.courseInstructors} onSaved={() => refetch()} />
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="users" className="mt-4">
          <CourseUsersTab courseId={courseId} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4">
          <CourseAnalyticsTab courseId={courseId} />
        </TabsContent>
        <TabsContent value="sales" className="mt-4">
          <LMSSalesTab courseId={courseId} />
        </TabsContent>
        {/* Cohort Tab — only visible for cohort type */}
        <TabsContent value="cohort" className="mt-4">
          <CohortTab courseId={courseId} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddSectionDialog open={addSectionOpen} courseId={courseId} onClose={() => setAddSectionOpen(false)} onCreated={(newSection) => {
        setAddSectionOpen(false);
        // Optimistic append — immediately show the new section without waiting for refetch
        setLocalSections(prev => [...prev, { ...newSection, position: prev.length, lessons: [], isPreview: false, dripDays: 0 }]);
        refetch();
      }} />
      {editSectionDrip && (
        <SectionDripDialog
          section={editSectionDrip}
          onClose={() => setEditSectionDrip(null)}
          onSave={(dripDays) => updateSection.mutate({ id: editSectionDrip.id, dripDays })}
        />
      )}
      {addLessonSection && (
        <AddLessonDialog courseId={courseId} sectionId={addLessonSection} onClose={() => setAddLessonSection(null)} onCreated={(lesson) => { setAddLessonSection(null); refetch(); setEditLesson(lesson); }} />
      )}
      {addLessonAtCourseLevel && (
        <AddLessonDialog courseId={courseId} sectionId={undefined} onClose={() => setAddLessonAtCourseLevel(false)} onCreated={(lesson) => { setAddLessonAtCourseLevel(false); refetch(); setEditLesson(lesson); }} />
      )}
      {importMediaSection && (
        <ImportMediaAsLessonDialog sectionId={importMediaSection} courseId={courseId} onClose={() => setImportMediaSection(null)} onCreated={() => { setImportMediaSection(null); refetch(); }} />
      )}
      {editLesson && (() => {
        // Build a flat ordered list of all lessons in the course for prev/next navigation
        const flatLessons: any[] = [
          ...localTopLessons,
          ...localSections.flatMap((s: any) => s.lessons ?? []),
        ];
        const currentIdx = flatLessons.findIndex((l: any) => l.id === editLesson.id);
        const prevLessonNav = currentIdx > 0 ? flatLessons[currentIdx - 1] : null;
        const nextLessonNav = currentIdx >= 0 && currentIdx < flatLessons.length - 1 ? flatLessons[currentIdx + 1] : null;
        return (
          <LessonEditorPage
            lesson={editLesson}
            onClose={() => setEditLesson(null)}
            onSaved={() => { refetch(); }}
            onSavedAndClose={() => { setEditLesson(null); refetch(); }}
            prevLesson={prevLessonNav}
            nextLesson={nextLessonNav}
            onNavigateLesson={(l: any) => { refetch(); setEditLesson(l); }}
          />
        );
      })()}
      {quizLesson && (
        <QuizBuilderDialog lesson={quizLesson} onClose={() => setQuizLesson(null)} />
      )}
      {copyLessonTarget && (
        <CopyLessonDialog
          lesson={copyLessonTarget}
          currentCourseId={courseId}
          onClose={() => setCopyLessonTarget(null)}
          onCopy={(targetCourseId, targetSectionId) => {
            copyLesson.mutate({ lessonId: copyLessonTarget.id, targetCourseId, targetSectionId });
            setCopyLessonTarget(null);
          }}
        />
      )}
      {copyModuleTarget && (
        <CopyModuleDialog
          section={copyModuleTarget}
          currentCourseId={courseId}
          onClose={() => setCopyModuleTarget(null)}
          onCopy={(targetCourseId) => {
            copyModule.mutate({ sectionId: copyModuleTarget.id, targetCourseId });
            setCopyModuleTarget(null);
          }}
        />
      )}
      {saveAsTemplateSection && (
        <SaveSectionTemplateDialog
          section={saveAsTemplateSection}
          onClose={() => setSaveAsTemplateSection(null)}
        />
      )}

      {/* Publish Dialog — shown when publishing a course that has draft lessons */}
      {publishDialog && (() => {
        const allLessonsFlat = [
          ...(course?.topLevelLessons ?? []),
          ...(course?.sections ?? []).flatMap((s: any) => s.lessons ?? []),
        ];
        const draftCount = allLessonsFlat.filter((l: any) => l.lessonStatus === "draft").length;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Publish Course</h2>
              <p className="text-sm text-gray-600">
                This course has <strong>{draftCount} draft {draftCount === 1 ? "lesson" : "lessons"}</strong> that won’t be visible to enrolled learners. How would you like to proceed?
              </p>
              <div className="space-y-3">
                <button
                  className="w-full text-left border border-teal-300 rounded-lg px-4 py-3 hover:bg-teal-50 transition-colors group"
                  onClick={async () => {
                    await bulkSetLessonStatus.mutateAsync({ courseId, lessonStatus: "published", onlyDrafts: true });
                    updateCourse.mutate({ id: courseId, ...publishDialog.pendingData });
                    setPublishDialog(null);
                  }}
                >
                  <p className="text-sm font-semibold text-teal-700 group-hover:text-teal-800">Publish all lessons</p>
                  <p className="text-xs text-gray-500 mt-0.5">All {draftCount} draft {draftCount === 1 ? "lesson" : "lessons"} will be published and visible to enrolled learners.</p>
                </button>
                <button
                  className="w-full text-left border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors group"
                  onClick={() => {
                    updateCourse.mutate({ id: courseId, ...publishDialog.pendingData });
                    setPublishDialog(null);
                  }}
                >
                  <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Keep draft lessons hidden</p>
                  <p className="text-xs text-gray-500 mt-0.5">The course will be published, but the {draftCount} draft {draftCount === 1 ? "lesson" : "lessons"} will remain hidden from learners.</p>
                </button>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  className="text-sm text-gray-400 hover:text-gray-600 underline"
                  onClick={() => setPublishDialog(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Course Settings Form ─────────────────────────────────────────────────────

function CertTemplateSelector({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const { data: templates = [] } = trpc.lmsAdmin.listCertificateTemplates.useQuery();
  return (
    <Select
      value={value ? String(value) : "_default"}
      onValueChange={v => onChange(v === "_default" ? null : Number(v))}
    >
      <SelectTrigger className="h-8 text-xs mt-1">
        <SelectValue placeholder="Default template" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_default">Default template</SelectItem>
        {templates.map((t: any) => (
          <SelectItem key={t.id} value={String(t.id)}>
            {t.name}{t.isDefault ? " ★" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
  const [courseType, setCourseType] = useState<"course" | "quiz" | "download" | "cohort">(course.type ?? "course");
  const [enrollmentCloseDate, setEnrollmentCloseDate] = useState<string>(
    course.enrollmentCloseDate ? new Date(course.enrollmentCloseDate).toISOString().split("T")[0] : ""
  );
  const [pricingType, setPricingType] = useState<"free"|"one_time"|"subscription"|"payment_plan"|"trial_then_subscription">(course.pricingType ?? (course.isFree ? "free" : "one_time"));
  const [price, setPrice] = useState(String(Number(course.price).toFixed(2)));
  const [subscriptionInterval, setSubscriptionInterval] = useState<"monthly"|"quarterly"|"annual">(course.subscriptionInterval ?? "monthly");
  const [trialDays, setTrialDays] = useState(String(course.trialDays ?? ""));
  const [accessDurationDays, setAccessDurationDays] = useState(String(course.accessDurationDays ?? ""));
  const [downPayment, setDownPayment] = useState(String(Number(course.downPayment ?? 0).toFixed(2)));
  const [installmentCount, setInstallmentCount] = useState(String(course.installmentCount ?? ""));
  const [installmentAmount, setInstallmentAmount] = useState(String(Number(course.installmentAmount ?? 0).toFixed(2)));
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState(String(course.installmentIntervalDays ?? 30));
  const [hasCertificate, setHasCertificate] = useState(course.hasCertificate);
  const [certificateTemplateId, setCertificateTemplateId] = useState<number | null>((course as any).certificateTemplateId ?? null);
  const [isFeatured, setIsFeatured] = useState(course.isFeatured ?? false);
  const [isDrip, setIsDrip] = useState(course.isDrip ?? false);
  const [hideProgress, setHideProgress] = useState(course.hideProgress ?? false);
  const [showInstructor, setShowInstructor] = useState(course.showInstructor ?? false);
  const [showInLibrary, setShowInLibrary] = useState(course.showInLibrary ?? true);
  const [sendEnrollmentEmail, setSendEnrollmentEmail] = useState(course.sendEnrollmentEmail ?? true);
  const [defaultMarkComplete, setDefaultMarkComplete] = useState<boolean>(course.defaultMarkComplete !== 0);
  const [playerTheme, setPlayerTheme] = useState<"light" | "dark">(course.playerTheme ?? "light");
  // Custom labels — parse from JSON string stored in DB
  const initLabels = (() => { try { return course.customLabels ? JSON.parse(course.customLabels) : {}; } catch { return {}; } })();
  const [labelLesson, setLabelLesson] = useState<string>(initLabels.lesson ?? "");
  const [labelSection, setLabelSection] = useState<string>(initLabels.section ?? "");
  const [labelMarkComplete, setLabelMarkComplete] = useState<string>(initLabels.markComplete ?? "");
  const [labelNextLesson, setLabelNextLesson] = useState<string>(initLabels.nextLesson ?? "");
  const [labelPrevLesson, setLabelPrevLesson] = useState<string>(initLabels.prevLesson ?? "");
  const [labelSubmitQuiz, setLabelSubmitQuiz] = useState<string>(initLabels.submitQuiz ?? "");
  const [labelCourseModules, setLabelCourseModules] = useState<string>(initLabels.courseModules ?? "");
  const [labelCompleted, setLabelCompleted] = useState<string>(initLabels.completed ?? "");
  const buildCustomLabels = () => {
    const obj: Record<string, string> = {};
    if (labelLesson.trim()) obj.lesson = labelLesson.trim();
    if (labelSection.trim()) obj.section = labelSection.trim();
    if (labelMarkComplete.trim()) obj.markComplete = labelMarkComplete.trim();
    if (labelNextLesson.trim()) obj.nextLesson = labelNextLesson.trim();
    if (labelPrevLesson.trim()) obj.prevLesson = labelPrevLesson.trim();
    if (labelSubmitQuiz.trim()) obj.submitQuiz = labelSubmitQuiz.trim();
    if (labelCourseModules.trim()) obj.courseModules = labelCourseModules.trim();
    if (labelCompleted.trim()) obj.completed = labelCompleted.trim();
    return Object.keys(obj).length > 0 ? JSON.stringify(obj) : null;
  };
  const [coverImageUrl, setCoverImageUrl] = useState(course.coverImageUrl ?? "");
  const [slug, setSlug] = useState(course.slug ?? "");
  const [metaTitle, setMetaTitle] = useState(course.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(course.metaDescription ?? "");
  // Color scheme
  const [primaryColor, setPrimaryColor] = useState(course.primaryColor ?? "#0d9488");
  const [accentColor, setAccentColor] = useState(course.accentColor ?? "#0f766e");
  const [gradientStart, setGradientStart] = useState(course.gradientFrom ?? "");
  const [gradientEnd, setGradientEnd] = useState(course.gradientTo ?? "");
  const [gradientDirection, setGradientDirection] = useState(course.gradientDirection ?? "to right");
  const [useGradient, setUseGradient] = useState(!!(course.gradientFrom && course.gradientTo));
  const updateCourseSettings = trpc.lmsGroup.updateCourseSettings.useMutation({
    onSuccess: () => toast.success("URL & SEO settings saved"),
    onError: (e) => toast.error(e.message),
  });

  // Thinkific resync
  const { data: syncInfo } = trpc.lmsAdmin.getThinkificSyncInfo.useQuery({ courseId: course.id });
  const [resyncContent, setResyncContent] = useState(true);
  const [resyncEnrollments, setResyncEnrollments] = useState(true);
  const [resyncLandingPage, setResyncLandingPage] = useState(true);
  const [resyncResult, setResyncResult] = useState<{ lessonsUpdated: number; enrollmentsUpdated: number; landingPageUpdated: boolean; log: string[] } | null>(null);
  const [showResyncLog, setShowResyncLog] = useState(false);
  const resyncCourse = trpc.thinkificImport.resyncCourse.useMutation({
    onSuccess: (result) => {
      setResyncResult(result);
      toast.success(`Re-sync complete — ${result.lessonsUpdated} lessons, ${result.enrollmentsUpdated} enrollments updated`);
      if (result.log?.some(l => l.startsWith('Updated cover image'))) {
        setCoverImageUrl(result.log.find(l => l.startsWith('Updated cover image'))?.replace('Updated cover image: ', '') ?? coverImageUrl);
      }
    },
    onError: (e) => toast.error(`Re-sync failed: ${e.message}`),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {/* Top Save Button */}
      <div className="flex justify-end pb-2 border-b border-gray-100">
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white"
          disabled={saving}
          onClick={() => onSave({
            title: title.trim(), subtitle: subtitle.trim() || undefined,
            description: description || undefined, status, brand, type: courseType,
            enrollmentCloseDate: courseType === "cohort" ? (enrollmentCloseDate || null) : null,
            pricingType,
            isFree: pricingType === "free",
            hasCertificate,
            isFeatured,
            isDrip,
            hideProgress,
            showInstructor,
            showInLibrary,
            price: pricingType === "free" ? 0 : parseFloat(price || "0"),
            subscriptionInterval: pricingType === "subscription" ? subscriptionInterval : null,
            downPayment: pricingType === "payment_plan" ? parseFloat(downPayment || "0") : null,
            installmentCount: pricingType === "payment_plan" ? parseInt(installmentCount || "0") : null,
            installmentAmount: pricingType === "payment_plan" ? parseFloat(installmentAmount || "0") : null,
            installmentIntervalDays: pricingType === "payment_plan" ? parseInt(installmentIntervalDays || "30") : null,
            trialDays: pricingType === "trial_then_subscription" ? (trialDays ? parseInt(trialDays) : null) : null,
            accessDurationDays: accessDurationDays ? parseInt(accessDurationDays) : null,
            coverImageUrl: coverImageUrl.trim() || undefined,
            primaryColor: primaryColor || null,
            accentColor: accentColor || null,
            gradientFrom: useGradient ? (gradientStart || null) : null,
            gradientTo: useGradient ? (gradientEnd || null) : null,
            gradientDirection: gradientDirection || null,
            sendEnrollmentEmail,
            defaultMarkComplete,
            playerTheme,
            customLabels: buildCustomLabels(),
          })}
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
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
              <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Content Type</Label>
          <Select value={courseType} onValueChange={v => setCourseType(v as "course" | "quiz" | "download" | "cohort")}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="course">Course — appears in Courses section</SelectItem>
              <SelectItem value="quiz">Quiz — appears in Quizzes section</SelectItem>
              <SelectItem value="download">Download — appears in Downloads section</SelectItem>
              <SelectItem value="cohort">Cohort — live/coaching program with sessions &amp; assignments</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400 mt-1">Changing this moves the content to a different section of the Education Library.</p>
        </div>
        {courseType === "cohort" && (
          <div>
            <Label className="text-sm">Enrollment Close Date</Label>
            <Input
              type="date"
              value={enrollmentCloseDate}
              onChange={e => setEnrollmentCloseDate(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank to keep enrollment open indefinitely. After this date, new students cannot enroll.</p>
          </div>
        )}
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
          {pricingType !== "subscription" && pricingType !== "trial_then_subscription" && (
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
          )}
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

        {/* Additional Pricing Options */}
        <CoursePricingOptionsEditor courseId={course.id} />
      </div>

            <div className="flex items-center gap-2">
        <Switch checked={hasCertificate} onCheckedChange={setHasCertificate} id="cert-switch" />
        <Label htmlFor="cert-switch" className="text-sm">Certificate of completion</Label>
      </div>
      {hasCertificate && (
        <div className="ml-6 mt-1">
          <Label className="text-xs text-muted-foreground">Certificate Template</Label>
          <CertTemplateSelector value={certificateTemplateId} onChange={setCertificateTemplateId} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Switch checked={isFeatured} onCheckedChange={setIsFeatured} id="featured-switch" />
        <Label htmlFor="featured-switch" className="text-sm">Featured on LMS Home Page</Label>
      </div>
      <div className="flex items-start gap-2">
        <Switch checked={showInLibrary} onCheckedChange={setShowInLibrary} id="show-in-library-switch" className="mt-0.5" />
        <div>
          <Label htmlFor="show-in-library-switch" className="text-sm">Show in Education Library</Label>
          <p className="text-xs text-gray-400 mt-0.5">When enabled, this item will appear in the public Education Library. Disable to hide it from the library while keeping it accessible by direct URL.</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Switch checked={isDrip} onCheckedChange={setIsDrip} id="drip-switch" className="mt-0.5" />
        <div>
          <Label htmlFor="drip-switch" className="text-sm">Enable drip content</Label>
          <p className="text-xs text-gray-400 mt-0.5">When enabled, sections and lessons can be scheduled to unlock a set number of days after enrollment. Configure per-section timing using the Drip button on each section.</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Switch checked={hideProgress} onCheckedChange={setHideProgress} id="hide-progress-switch" className="mt-0.5" />
        <div>
          <Label htmlFor="hide-progress-switch" className="text-sm">Hide course progress</Label>
          <p className="text-xs text-gray-400 mt-0.5">When enabled, the progress bar and completion percentage will not be shown to students in the course player or overview page.</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Switch checked={showInstructor} onCheckedChange={setShowInstructor} id="show-instructor-switch" className="mt-0.5" />
        <div>
          <Label htmlFor="show-instructor-switch" className="text-sm">Show instructor profile in lesson sidebar</Label>
          <p className="text-xs text-gray-400 mt-0.5">When enabled, the instructor bio and avatar will appear in the Lesson Info panel of the course player. Individual lessons can override this setting.</p>
        </div>
      </div>

      <div>
        <Label className="text-sm">Description (rich text)</Label>
        <div className="mt-1">
          <RichTextEditor value={description} onChange={setDescription} />
        </div>
      </div>

      {/* Color Scheme Section */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">🎨 Course Color Scheme</h3>
        <p className="text-xs text-gray-500">These colors are applied to the course player sidebar, course overview curriculum, and landing page curriculum block.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Primary Color</Label>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-9 rounded border border-gray-300 cursor-pointer p-0.5" />
              <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} placeholder="#0d9488" className="flex-1 font-mono text-xs" maxLength={20} />
            </div>
          </div>
          <div>
            <Label className="text-sm">Accent Color</Label>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-10 h-9 rounded border border-gray-300 cursor-pointer p-0.5" />
              <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} placeholder="#0f766e" className="flex-1 font-mono text-xs" maxLength={20} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={useGradient} onCheckedChange={setUseGradient} id="use-gradient-switch" />
          <Label htmlFor="use-gradient-switch" className="text-sm">Use gradient header</Label>
        </div>
        {useGradient && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Gradient Start</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={gradientStart || "#0d9488"} onChange={e => setGradientStart(e.target.value)} className="w-10 h-9 rounded border border-gray-300 cursor-pointer p-0.5" />
                  <Input value={gradientStart} onChange={e => setGradientStart(e.target.value)} placeholder="#0d9488" className="flex-1 font-mono text-xs" maxLength={20} />
                </div>
              </div>
              <div>
                <Label className="text-sm">Gradient End</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={gradientEnd || "#0f766e"} onChange={e => setGradientEnd(e.target.value)} className="w-10 h-9 rounded border border-gray-300 cursor-pointer p-0.5" />
                  <Input value={gradientEnd} onChange={e => setGradientEnd(e.target.value)} placeholder="#0f766e" className="flex-1 font-mono text-xs" maxLength={20} />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-sm">Gradient Direction</Label>
              <select value={gradientDirection} onChange={e => setGradientDirection(e.target.value)} className="mt-1 w-full text-sm border border-gray-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="to right">Left → Right</option>
                <option value="to left">Right → Left</option>
                <option value="to bottom">Top → Bottom</option>
                <option value="to top">Bottom → Top</option>
                <option value="to bottom right">Top-Left → Bottom-Right</option>
                <option value="to bottom left">Top-Right → Bottom-Left</option>
              </select>
            </div>
            <div className="rounded-lg overflow-hidden h-12 border border-gray-200" style={{ background: `linear-gradient(${gradientDirection}, ${gradientStart || primaryColor}, ${gradientEnd || accentColor})` }}>
              <div className="h-full flex items-center justify-center text-white text-xs font-medium opacity-80">Preview</div>
            </div>
          </div>
        )}
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
          onClick={() => updateCourseSettings.mutate({ courseId: course.id, slug: slug.trim() || course.slug, metaTitle: metaTitle.trim() || undefined, metaDescription: metaDescription.trim() || undefined, status, hasCertificate, certificateTemplateId, isFeatured })}
        >
          {updateCourseSettings.isPending ? "Saving..." : "Save URL & SEO"}
        </Button>
      </div>

      {/* Enrollment Email Toggle */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span className="text-base">📧</span> Enrollment Notifications
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Send enrollment welcome email</p>
            <p className="text-xs text-gray-400 mt-0.5">Send a welcome email to students when they enroll in this course. Platform-level setting must also be enabled.</p>
          </div>
          <Switch checked={sendEnrollmentEmail} onCheckedChange={setSendEnrollmentEmail} />
        </div>
      </div>
      {/* Player Experience */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span className="text-base">🎨</span> Player Experience
        </h3>
        {/* Mark Lessons Complete */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Show “Mark Complete” button</p>
            <p className="text-xs text-gray-400 mt-0.5">Show the Mark Complete button on all lessons by default. Can be overridden per lesson.</p>
          </div>
          <Switch checked={defaultMarkComplete} onCheckedChange={setDefaultMarkComplete} />
        </div>
        {/* Player Theme */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Player Theme</p>
            <p className="text-xs text-gray-400 mt-0.5">Choose the color theme for the course player interface.</p>
          </div>
          <div className="flex gap-1 border rounded-lg p-1 bg-white">
            {(["light", "dark"] as const).map(t => (
              <button key={t} onClick={() => setPlayerTheme(t)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors capitalize ${
                  playerTheme === t ? "bg-teal-600 text-white shadow" : "text-gray-500 hover:text-gray-700"
                }`}>
                {t === "light" ? "☀️ Light" : "🌙 Dark"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Custom Labels */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="text-base">🏷️</span> Custom Text Labels
          </h3>
          <p className="text-xs text-gray-400 mt-1">Override default terminology shown to students in the course player and curriculum. Leave blank to use the default.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600">"Lesson" label</Label>
            <Input value={labelLesson} onChange={e => setLabelLesson(e.target.value)} placeholder="Lesson" className="mt-1 text-sm h-8" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">"Module" / Section label</Label>
            <Input value={labelSection} onChange={e => setLabelSection(e.target.value)} placeholder="Module" className="mt-1 text-sm h-8" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">"Course Modules" sidebar header</Label>
            <Input value={labelCourseModules} onChange={e => setLabelCourseModules(e.target.value)} placeholder="Course Modules" className="mt-1 text-sm h-8" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">"Mark Complete" button</Label>
            <Input value={labelMarkComplete} onChange={e => setLabelMarkComplete(e.target.value)} placeholder="Mark Complete" className="mt-1 text-sm h-8" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">"Completed" badge</Label>
            <Input value={labelCompleted} onChange={e => setLabelCompleted(e.target.value)} placeholder="Completed" className="mt-1 text-sm h-8" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">"Next Lesson" button</Label>
            <Input value={labelNextLesson} onChange={e => setLabelNextLesson(e.target.value)} placeholder="Next Lesson" className="mt-1 text-sm h-8" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">"Prev" button</Label>
            <Input value={labelPrevLesson} onChange={e => setLabelPrevLesson(e.target.value)} placeholder="Prev" className="mt-1 text-sm h-8" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">"Submit Quiz" button</Label>
            <Input value={labelSubmitQuiz} onChange={e => setLabelSubmitQuiz(e.target.value)} placeholder="Submit Quiz" className="mt-1 text-sm h-8" />
          </div>
        </div>
      </div>
      {/* Thinkific Re-sync Section — only shown for Thinkific-imported courses */}
      {syncInfo && (
        <div className="border border-blue-200 rounded-lg p-4 space-y-3 bg-blue-50">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="text-sm font-semibold text-blue-800">Thinkific Re-sync</h3>
              <p className="text-xs text-blue-500">Source: <span className="font-medium">{syncInfo.thinkificCourseName}</span>{syncInfo.lastSyncedAt && ` · Last synced ${new Date(syncInfo.lastSyncedAt).toLocaleString()}`}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Lesson content &amp; cover image</p>
                <p className="text-xs text-blue-500">Re-fetches all lesson content blocks and updates the course card image</p>
              </div>
              <Switch checked={resyncContent} onCheckedChange={setResyncContent} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Enrollments &amp; progress</p>
                <p className="text-xs text-blue-500">Syncs student enrollments and completion percentages</p>
              </div>
              <Switch checked={resyncEnrollments} onCheckedChange={setResyncEnrollments} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Landing page</p>
                <p className="text-xs text-blue-500">Re-scrapes the Thinkific sales page to refresh landing page blocks</p>
              </div>
              <Switch checked={resyncLandingPage} onCheckedChange={setResyncLandingPage} />
            </div>
          </div>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white h-8"
            disabled={resyncCourse.isPending || (!resyncContent && !resyncEnrollments && !resyncLandingPage)}
            onClick={() => resyncCourse.mutate({ lmsCourseId: course.id, resyncContent, resyncEnrollments, resyncLandingPage })}
          >
            {resyncCourse.isPending ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Re-syncing...</>
            ) : (
              <><RefreshCw className="w-3 h-3 mr-1" /> Re-sync from Thinkific</>
            )}
          </Button>
          {resyncResult && (
            <div className="mt-2 rounded-md bg-white border border-blue-200 p-3 text-xs space-y-1">
              <p className="font-medium text-blue-800">Re-sync complete</p>
              <p className="text-blue-600">{resyncResult.lessonsUpdated} lesson{resyncResult.lessonsUpdated !== 1 ? 's' : ''} updated · {resyncResult.enrollmentsUpdated} enrollment{resyncResult.enrollmentsUpdated !== 1 ? 's' : ''} synced{resyncResult.landingPageUpdated ? ' · Landing page refreshed' : ''}</p>
              <button className="text-blue-400 underline text-xs" onClick={() => setShowResyncLog(v => !v)}>{showResyncLog ? 'Hide' : 'Show'} sync log</button>
              {showResyncLog && (
                <pre className="mt-1 text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">{resyncResult.log.join('\n')}</pre>
              )}
            </div>
          )}
        </div>
      )}

      <Button
        className="bg-teal-600 hover:bg-teal-700 text-white"
        disabled={saving}
        onClick={() => onSave({
          title: title.trim(), subtitle: subtitle.trim() || undefined,
          description: description || undefined, status, brand,
          pricingType,
          isFree: pricingType === "free",
          hasCertificate,
          certificateTemplateId,
          isFeatured,
          isDrip,
          hideProgress,
          showInstructor,
          showInLibrary,
          price: pricingType === "free" ? 0 : parseFloat(price || "0"),
          subscriptionInterval: pricingType === "subscription" ? subscriptionInterval : null,
          downPayment: pricingType === "payment_plan" ? parseFloat(downPayment || "0") : null,
          installmentCount: pricingType === "payment_plan" ? parseInt(installmentCount || "0") : null,
          installmentAmount: pricingType === "payment_plan" ? parseFloat(installmentAmount || "0") : null,
          installmentIntervalDays: pricingType === "payment_plan" ? parseInt(installmentIntervalDays || "30") : null,
          trialDays: pricingType === "trial_then_subscription" ? (trialDays ? parseInt(trialDays) : null) : null,
          accessDurationDays: accessDurationDays ? parseInt(accessDurationDays) : null,
          coverImageUrl: coverImageUrl.trim() || undefined,
          primaryColor: primaryColor || null,
          accentColor: accentColor || null,
                    gradientFrom: useGradient ? (gradientStart || null) : null,
          gradientTo: useGradient ? (gradientEnd || null) : null,
          gradientDirection: gradientDirection || null,
          sendEnrollmentEmail,
          customLabels: buildCustomLabels(),
        })}
      >
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}

// ─── Free Preview Link Panel ──────────────────────────────────────────────────
function FreePreviewLinkPanel({ courseId }: { courseId: number }) {
  const { data, isLoading } = trpc.lmsAdmin.getCourseFreePreviewLessons.useQuery({ courseId });
  const [copied, setCopied] = useState(false);
  if (isLoading) return null;
  if (!data || data.lessons.length === 0) return null;
  const previewUrl = `https://learn.allaboutultrasound.com/courses/${data.courseSlug}/player?preview=1`;
  const handleCopy = () => {
    navigator.clipboard.writeText(previewUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PlayCircle className="w-4 h-4 text-green-700" />
        <h3 className="text-sm font-semibold text-green-800">Free Preview Registration Link</h3>
        <span className="ml-auto text-xs text-green-600 font-medium">{data.lessons.length} preview lesson{data.lessons.length !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-xs text-green-700">Share this link so students can register and access the free preview lessons without purchasing the full course.</p>
      <div className="space-y-1">
        {data.lessons.map((l: any) => (
          <div key={l.id} className="flex items-center gap-2 text-xs text-green-800">
            <Eye className="w-3 h-3 text-green-500 shrink-0" />
            <span className="truncate">{l.title}</span>
            {l.previewMode === 'preview_hide_after_purchase' && <span className="shrink-0 text-green-500 italic">(hides after purchase)</span>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input readOnly value={previewUrl} className="flex-1 text-xs bg-white border border-green-300 rounded-md px-3 py-1.5 text-green-900 font-mono truncate focus:outline-none" onClick={e => (e.target as HTMLInputElement).select()} />
        <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-100 shrink-0 h-8" onClick={handleCopy}>
          {copied ? <><CheckCircle className="w-3 h-3 mr-1" /> Copied!</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Landing Page Editor ──────────────────────────────────────────────────────

function LandingPageEditor({ courseId, courseType }: { courseId: number; courseType?: string }) {
  const [, setLocation] = useLocation();
  const navigate = setLocation;
  const openLearnLink = useOpenLearnLink();
  const { data: course } = trpc.lmsAdmin.getCourse.useQuery({ courseId });
  const aiGenerateLandingPage = trpc.lmsAdmin.aiGenerateLandingPage.useMutation({
    onSuccess: () => {
      toast.success("Landing page generated! Opening builder...");
      setTimeout(() => navigate(`/admin/lms/${courseId}/landing-builder?t=${Date.now()}`), 600);
    },
    onError: e => toast.error(`AI error: ${e.message}`),
  });

  const typeLabel = courseType === "download" ? "download" : courseType === "quiz" ? "quiz" : "course";

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
        <LayoutTemplate className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-teal-800">Landing Page Builder</p>
          <p className="text-xs text-teal-600 mt-0.5">
            Use the full builder to design your {typeLabel} landing page with blocks, images, pricing sections, and more.
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => navigate(`/admin/lms/${courseId}/landing-builder`)}
          className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:bg-teal-50 transition-colors text-left"
        >
          <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <LayoutTemplate className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Open Full Builder</p>
            <p className="text-xs text-gray-500">Edit blocks, layout, pricing, CTAs</p>
          </div>
        </button>
        <button
          onClick={() => openLearnLink(`/courses/${course?.slug}?preview=admin`)}
          className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
        >
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Eye className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Preview Landing Page</p>
            <p className="text-xs text-gray-500">See how it looks to visitors</p>
          </div>
        </button>
      </div>

      {/* AI Generate */}
      <div className="bg-white border border-purple-200 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">AI Generate Landing Page</p>
            <p className="text-xs text-gray-500 mt-0.5">
              The AI will read your {typeLabel} title, description, sections, and lesson content to generate a complete block-based landing page — hero, curriculum, pricing, testimonials, and more.
            </p>
          </div>
        </div>
        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2 w-full"
          disabled={aiGenerateLandingPage.isPending}
          onClick={() => aiGenerateLandingPage.mutate({ courseId })}
        >
          {aiGenerateLandingPage.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating landing page...</>
            : <><Sparkles className="w-4 h-4" /> Generate Landing Page with AI</>}
        </Button>
        {aiGenerateLandingPage.isPending && (
          <p className="text-xs text-purple-500 text-center mt-2">This may take 15–30 seconds while the AI builds your page...</p>
        )}
      </div>
    </div>
  );
}

// ─── Course Overview Editor ─────────────────────────────────────────────────

function CourseOverviewEditor({
  courseId,
  courseSlug,
  courseTitle,
  courseThumbnail,
  sections,
  topLevelLessons,
  initialBlocks,
  initialTopBlocks,
  initialBottomBlocks,
  hideProgress,
  onSaved,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}: {
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  courseThumbnail: string | null;
  sections: any[];
  topLevelLessons: any[];
  initialBlocks: Block[];
  initialTopBlocks: Block[];
  initialBottomBlocks: Block[];
  hideProgress: boolean;
  onSaved: () => void;
}) {
  // Three block zones: main (between progress bar and curriculum), top (above progress bar), bottom (below curriculum)
  const [activeZone, setActiveZone] = useState<"main" | "top" | "bottom">("main");
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [topBlocks, setTopBlocks] = useState<Block[]>(initialTopBlocks);
  const [bottomBlocks, setBottomBlocks] = useState<Block[]>(initialBottomBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATALOG_CATEGORIES[0]);
  const [pickerTab, setPickerTab] = useState<"catalog" | "templates">("catalog");
  const [tplSearch, setTplSearch] = useState("");
  const { data: blockTemplates, isLoading: tplLoading } = trpc.blockTemplates.list.useQuery(
    { search: tplSearch || undefined },
    { enabled: addMenuOpen && pickerTab === "templates" }
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Helpers to get/set the active zone's blocks
  const activeBlocks = activeZone === "main" ? blocks : activeZone === "top" ? topBlocks : bottomBlocks;
  const setActiveBlocks = (fn: (prev: Block[]) => Block[]) => {
    if (activeZone === "main") setBlocks(fn);
    else if (activeZone === "top") setTopBlocks(fn);
    else setBottomBlocks(fn);
  };

  const updateCourse = trpc.lmsAdmin.updateCourse.useMutation();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCourse.mutateAsync({
        id: courseId,
        courseOverviewBlocks: JSON.stringify(blocks),
        courseOverviewTopBlocks: JSON.stringify(topBlocks),
        courseOverviewBottomBlocks: JSON.stringify(bottomBlocks),
      });
      toast.success("Course Overview saved!");
      onSaved();
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: BlockType, initialData?: Record<string, any>) => {
    const catalog = BLOCK_CATALOG.find(c => c.type === type);
    if (!catalog) return;
    const newBlock: Block = { id: uid(), type, data: { ...catalog.defaultData, ...(initialData ?? {}) } };
    setActiveBlocks(bs => [...bs, newBlock]);
    setSelectedBlockId(newBlock.id);
    setAddMenuOpen(false);
  };

  const updateBlock = (id: string, data: Record<string, any>) => {
    setActiveBlocks(bs => bs.map(b => b.id === id ? { ...b, data: { ...b.data, ...data } } : b));
  };

  const deleteBlock = (id: string) => {
    setActiveBlocks(bs => bs.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const duplicateBlock = (id: string) => {
    const idx = activeBlocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const copy: Block = { ...activeBlocks[idx], id: uid() };
    setActiveBlocks(bs => [...bs.slice(0, idx + 1), copy, ...bs.slice(idx + 1)]);
    setSelectedBlockId(copy.id);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setActiveBlocks(bs => {
      const idx = bs.findIndex(b => b.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= bs.length) return bs;
      return arrayMove(bs, idx, newIdx);
    });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setActiveBlocks(bs => {
        const oldIdx = bs.findIndex(b => b.id === active.id);
        const newIdx = bs.findIndex(b => b.id === over.id);
        return arrayMove(bs, oldIdx, newIdx);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZone]);

  const selectedBlock = activeBlocks.find(b => b.id === selectedBlockId) ?? null;

  const ZONE_LABELS: Record<"main" | "top" | "bottom", { label: string; desc: string; color: string }> = {
    top: { label: "Top Zone", desc: "Above progress bar", color: "#7c3aed" },
    main: { label: "Main Zone", desc: "Between progress bar and curriculum", color: "#0d9488" },
    bottom: { label: "Bottom Zone", desc: "Below curriculum outline", color: "#0891b2" },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-teal-700 font-bold text-sm">Course Overview Page Builder</span>
          <span className="text-gray-400 text-xs">Shown to enrolled students at /learn/{courseSlug}/overview</span>
        </div>
        <div className="flex items-center gap-2">
          <SsoLearnLinkButton slug={`${courseSlug}/overview`} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPreviewMode(p => !p)}
            className={cn("text-xs h-7", previewMode ? "border-teal-500 text-teal-700 bg-teal-50" : "text-gray-500 hover:text-teal-700")}
          >
            {previewMode ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
            {previewMode ? "Edit" : "Preview"}
          </Button>
          {!previewMode && (
            <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white text-xs h-7" onClick={() => setAddMenuOpen(true)}>
              <Plus className="w-3 h-3 mr-1" /> Add Block
            </Button>
          )}
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-7 font-semibold" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Zone Selector Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {(["top", "main", "bottom"] as const).map(zone => {
          const z = ZONE_LABELS[zone];
          const count = zone === "top" ? topBlocks.length : zone === "main" ? blocks.length : bottomBlocks.length;
          return (
            <button
              key={zone}
              onClick={() => { setActiveZone(zone); setSelectedBlockId(null); }}
              className={cn(
                "flex-1 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2",
                activeZone === zone
                  ? "border-current text-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              )}
              style={activeZone === zone ? { background: z.color, borderColor: z.color } : {}}
            >
              {z.label}
              <span className={cn("ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]", activeZone === zone ? "bg-white/20" : "bg-gray-200 text-gray-600")}>
                {count}
              </span>
              <span className={cn("block text-[10px] font-normal mt-0.5", activeZone === zone ? "text-white/80" : "text-gray-400")}>{z.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="flex overflow-hidden" style={{ minHeight: 600 }}>
        {/* Canvas — full WYSIWYG page preview */}
        <div className="flex-1 overflow-y-auto bg-gray-100">
          {/* ── Read-only page chrome: Header ── */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4 opacity-70 pointer-events-none select-none">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Course Overview</p>
                <h1 className="font-bold text-gray-900 text-base leading-tight truncate">{courseTitle}</h1>
              </div>
            </div>
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-600 text-white text-xs font-medium">
                Start <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
            {/* ── Top Zone (above progress bar) ── */}
            <div className={cn("rounded-xl border-2 overflow-hidden bg-white", activeZone === "top" ? "border-purple-400" : "border-dashed border-purple-200")}>
              <div className="px-4 py-2 flex items-center justify-between" style={{ background: activeZone === "top" ? "#7c3aed" : "#f5f3ff" }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: activeZone === "top" ? "#fff" : "#7c3aed" }}>🔝 Top Zone — Above Progress Bar</span>
                {activeZone !== "top" && <button onClick={() => { setActiveZone("top"); setSelectedBlockId(null); }} className="text-[10px] text-purple-500 hover:text-purple-700 font-medium">Edit this zone</button>}
              </div>
              {topBlocks.length === 0 && activeZone !== "top" ? (
                <div className="text-center text-gray-400 py-4 text-xs italic">No blocks in Top Zone</div>
              ) : activeZone === "top" ? (
                previewMode ? (
                  <div>
                    {topBlocks.map(block => <div key={block.id}><BlockPreview block={block} /></div>)}
                    {topBlocks.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">No content blocks yet.</div>}
                  </div>
                ) : (
                  <div className="p-3">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={topBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        {topBlocks.map((block, idx) => (
                          <SortableBlock key={block.id} block={block} isSelected={block.id === selectedBlockId}
                            onSelect={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
                            onDelete={() => deleteBlock(block.id)} onDuplicate={() => duplicateBlock(block.id)}
                            onMoveUp={idx > 0 ? () => moveBlock(block.id, -1) : undefined}
                            onMoveDown={idx < topBlocks.length - 1 ? () => moveBlock(block.id, 1) : undefined}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <button onClick={() => setAddMenuOpen(true)} className="w-full border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-xl py-3 text-purple-500 hover:text-purple-700 text-sm flex items-center justify-center gap-2 transition-colors mt-2">
                      <Plus className="w-4 h-4" /> Add Block to Top Zone
                    </button>
                  </div>
                )
              ) : (
                <div>
                  {topBlocks.map(block => <div key={block.id}><BlockPreview block={block} /></div>)}
                </div>
              )}
            </div>

            {/* ── Read-only: Progress bar — only shown when hideProgress is false AND at least one lesson has requireManualComplete ── */}
            {(() => {
              const allLessonsFlat = [...(topLevelLessons ?? []), ...(sections ?? []).flatMap((s: any) => s.lessons ?? [])];
              const hasAnyManualComplete = allLessonsFlat.some((l: any) => l.requireManualComplete === 1 || l.requireManualComplete === true);
              if (hideProgress || !hasAnyManualComplete) return null;
              return (
            <div className="bg-white rounded-xl border border-gray-200 p-5 opacity-60 pointer-events-none select-none">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Your Progress</span>
                <span className="text-sm font-bold text-teal-700">0%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: "0%" }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">0 of {[...(topLevelLessons ?? []), ...(sections ?? []).flatMap((s: any) => s.lessons ?? [])].length} lessons completed</p>
            </div>
              );
            })()}

            {/* ── Main Zone (between progress bar and curriculum) ── */}
            <div className={cn("rounded-xl border-2 overflow-hidden bg-white", activeZone === "main" ? "border-teal-400" : "border-dashed border-teal-200")}>
              <div className="px-4 py-2 bg-teal-50 border-b border-teal-200 flex items-center justify-between" style={{ background: activeZone === "main" ? "#0d9488" : undefined }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: activeZone === "main" ? "#fff" : "#0d9488" }}>✏️ Main Zone — Between Progress Bar and Curriculum</span>
                {activeZone !== "main" && <button onClick={() => { setActiveZone("main"); setSelectedBlockId(null); }} className="text-[10px] text-teal-500 hover:text-teal-700 font-medium">Edit this zone</button>}
              </div>
              {blocks.length === 0 && activeZone !== "main" ? (
                <div className="text-center text-gray-400 py-4 text-xs italic">No blocks in Main Zone</div>
              ) : activeZone === "main" ? (
                previewMode ? (
                  <div>
                    {blocks.map(block => <div key={block.id}><BlockPreview block={block} /></div>)}
                    {blocks.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">No content blocks yet.</div>}
                  </div>
                ) : (
                  <div className="p-3">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        {blocks.map((block, idx) => (
                          <SortableBlock key={block.id} block={block} isSelected={block.id === selectedBlockId}
                            onSelect={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
                            onDelete={() => deleteBlock(block.id)} onDuplicate={() => duplicateBlock(block.id)}
                            onMoveUp={idx > 0 ? () => moveBlock(block.id, -1) : undefined}
                            onMoveDown={idx < blocks.length - 1 ? () => moveBlock(block.id, 1) : undefined}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <button onClick={() => setAddMenuOpen(true)} className="w-full border-2 border-dashed border-teal-200 hover:border-teal-400 rounded-xl py-3 text-teal-500 hover:text-teal-700 text-sm flex items-center justify-center gap-2 transition-colors mt-2">
                      <Plus className="w-4 h-4" /> Add Block to Main Zone
                    </button>
                  </div>
                )
              ) : (
                <div>
                  {blocks.map(block => <div key={block.id}><BlockPreview block={block} /></div>)}
                </div>
              )}
            </div>

            {/* ── Read-only: Curriculum outline ── */}
            <div className="opacity-60 pointer-events-none select-none">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-teal-600" /> Course Curriculum
              </h2>
              {(topLevelLessons ?? []).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3 shadow-sm">
                  {(topLevelLessons ?? []).map((lesson: any) => (
                    <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0">
                      <PlayCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-700">{lesson.title}</span>
                      {lesson.durationMinutes && <span className="text-[10px] text-gray-400 ml-auto">{lesson.durationMinutes}m</span>}
                    </div>
                  ))}
                </div>
              )}
              {(sections ?? []).map((section: any) => (
                <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3 shadow-sm">
                  <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <BookOpen className="w-4 h-4 text-teal-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{section.title}</p>
                      <p className="text-[10px] text-gray-500">{(section.lessons ?? []).length} lessons</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                  <div>
                    {(section.lessons ?? []).slice(0, 3).map((lesson: any) => (
                      <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0">
                        <PlayCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-700">{lesson.title}</span>
                        {lesson.durationMinutes && <span className="text-[10px] text-gray-400 ml-auto">{lesson.durationMinutes}m</span>}
                      </div>
                    ))}
                    {(section.lessons ?? []).length > 3 && (
                      <div className="px-4 py-2 text-xs text-gray-400 italic">+{(section.lessons ?? []).length - 3} more lessons…</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Bottom Zone (below curriculum) ── */}
            <div className={cn("rounded-xl border-2 overflow-hidden bg-white", activeZone === "bottom" ? "border-blue-400" : "border-dashed border-blue-200")}>
              <div className="px-4 py-2 flex items-center justify-between" style={{ background: activeZone === "bottom" ? "#0891b2" : "#eff6ff" }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: activeZone === "bottom" ? "#fff" : "#0891b2" }}>🔚 Bottom Zone — Below Curriculum</span>
                {activeZone !== "bottom" && <button onClick={() => { setActiveZone("bottom"); setSelectedBlockId(null); }} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">Edit this zone</button>}
              </div>
              {bottomBlocks.length === 0 && activeZone !== "bottom" ? (
                <div className="text-center text-gray-400 py-4 text-xs italic">No blocks in Bottom Zone</div>
              ) : activeZone === "bottom" ? (
                previewMode ? (
                  <div>
                    {bottomBlocks.map(block => <div key={block.id}><BlockPreview block={block} /></div>)}
                    {bottomBlocks.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">No content blocks yet.</div>}
                  </div>
                ) : (
                  <div className="p-3">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={bottomBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        {bottomBlocks.map((block, idx) => (
                          <SortableBlock key={block.id} block={block} isSelected={block.id === selectedBlockId}
                            onSelect={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
                            onDelete={() => deleteBlock(block.id)} onDuplicate={() => duplicateBlock(block.id)}
                            onMoveUp={idx > 0 ? () => moveBlock(block.id, -1) : undefined}
                            onMoveDown={idx < bottomBlocks.length - 1 ? () => moveBlock(block.id, 1) : undefined}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <button onClick={() => setAddMenuOpen(true)} className="w-full border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl py-3 text-blue-500 hover:text-blue-700 text-sm flex items-center justify-center gap-2 transition-colors mt-2">
                      <Plus className="w-4 h-4" /> Add Block to Bottom Zone
                    </button>
                  </div>
                )
              ) : (
                <div>
                  {bottomBlocks.map(block => <div key={block.id}><BlockPreview block={block} /></div>)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Block settings */}
        {!previewMode && selectedBlock && (
          <div className="w-72 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <span className="text-gray-700 text-xs font-bold uppercase tracking-wide">Block Settings</span>
              <button onClick={() => setSelectedBlockId(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3">
              <BlockSettings block={selectedBlock} onChange={data => updateBlock(selectedBlock.id, data)} courseId={courseId} />
            </div>
          </div>
        )}
      </div>

      {/* Block Picker Modal */}
      <Dialog open={addMenuOpen} onOpenChange={open => { setAddMenuOpen(open); if (!open) { setTplSearch(""); setPickerTab("catalog"); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-teal-700 flex items-center gap-2"><Plus className="w-5 h-5" /> Add Content Block</DialogTitle>
          </DialogHeader>
          {/* Top-level tabs */}
          <div className="flex gap-1 border-b border-gray-200 shrink-0 overflow-x-auto pb-px">
            <button onClick={() => setPickerTab("catalog")} className={cn("px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors", pickerTab === "catalog" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>Block Catalog</button>
            <button onClick={() => setPickerTab("templates")} className={cn("px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors", pickerTab === "templates" ? "text-teal-700 border-b-2 border-teal-500" : "text-gray-500 hover:text-gray-700")}>Saved Templates</button>
          </div>
          {pickerTab === "catalog" && (
            <>
              <div className="flex gap-1 border-b border-gray-100 shrink-0 overflow-x-auto bg-gray-50">
                {CATALOG_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                      activeCategory === cat ? "text-teal-700 border-b-2 border-teal-500 bg-white" : "text-gray-500 hover:text-gray-700"
                    )}
                  >{cat}</button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 p-3">
                  {BLOCK_CATALOG.filter(b => b.category === activeCategory).map(item => (
                    <button
                      key={item.type}
                      onClick={() => { addBlock(item.type); setAddMenuOpen(false); }}
                      className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-left transition-colors group"
                    >
                      <span className="text-lg shrink-0">{item.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-800 group-hover:text-teal-700">{item.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{(item as any).description ?? item.label}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {pickerTab === "templates" && (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={tplSearch} onChange={e => setTplSearch(e.target.value)} placeholder="Search saved templates…" className="w-full pl-8 pr-3 h-8 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400" />
              </div>
              {tplLoading ? (
                <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
              ) : !blockTemplates?.length ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                  <Layers className="w-8 h-8 opacity-30" />
                  <p className="text-xs">No saved block templates yet. Save blocks as templates from the lesson editor.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blockTemplates.map((tpl: any) => {
                    let blockData: Record<string, any> = {};
                    try { blockData = typeof tpl.blockData === "string" ? JSON.parse(tpl.blockData) : (tpl.blockData ?? {}); } catch { /* ignore */ }
                    const catalogEntry = BLOCK_CATALOG.find(c => c.type === tpl.blockType);
                    return (
                      <div key={tpl.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50 group transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {catalogEntry && <span className="shrink-0 text-teal-500" style={{ fontSize: 14 }}>{catalogEntry.icon}</span>}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">{tpl.name}</p>
                            {tpl.description && <p className="text-xs text-gray-400 truncate">{tpl.description}</p>}
                          </div>
                        </div>
                        <button onClick={() => { addBlock(tpl.blockType, blockData); setAddMenuOpen(false); }}
                          className="shrink-0 px-2.5 py-1 text-xs bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">Add</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
        Instructor profiles are saved globally and can be reused across all courses. Manage all profiles from the <span className="font-medium text-teal-600">Instructors</span> tab in the main LMS admin view.
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

// ─── Section Drip Dialog ─────────────────────────────────────────────────────
function SectionDripDialog({ section, onClose, onSave }: { section: any; onClose: () => void; onSave: (dripDays: number | null) => void }) {
  const [dripDays, setDripDays] = useState<string>(section.dripDays ? String(section.dripDays) : "");
  const [saving, setSaving] = useState(false);
  const handleSave = () => {
    setSaving(true);
    const val = dripDays.trim() ? parseInt(dripDays) : null;
    onSave(val);
    toast.success(val ? `Drip set: unlocks ${val} day${val === 1 ? "" : "s"} after enrollment` : "Drip removed — section available immediately");
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4 text-teal-600" /> Drip Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600">Set how many days after enrollment this section becomes available. Leave blank to make it available immediately.</p>
          <div>
            <Label className="text-sm">Section: <span className="font-semibold text-gray-800">{section.title}</span></Label>
          </div>
          <div>
            <Label className="text-sm">Unlock after (days)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min="0"
                value={dripDays}
                onChange={e => setDripDays(e.target.value)}
                placeholder="e.g. 7"
                className="w-32"
              />
              <span className="text-sm text-gray-500">days after enrollment</span>
            </div>
            {dripDays && parseInt(dripDays) > 0 && (
              <p className="text-xs text-teal-600 mt-1">Students enrolled today will unlock this on day {dripDays}.</p>
            )}
          </div>
          {section.dripDays > 0 && (
            <button
              className="text-xs text-red-500 hover:text-red-700 underline"
              onClick={() => { setDripDays(""); }}
            >
              Remove drip (unlock immediately)
            </button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={saving} onClick={handleSave}>
            Save Drip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// ─── Save Section Template Dialog ───────────────────────────────────────────────
function SaveSectionTemplateDialog({ section, onClose }: { section: { id: number; title: string }; onClose: () => void }) {
  const [name, setName] = useState(section.title);
  const [description, setDescription] = useState("");
  const save = trpc.lmsAdmin.saveSectionTemplate.useMutation({
    onSuccess: () => { toast.success("Section saved as template"); onClose(); },
    onError: e => toast.error(`Error: ${e.message}`),
  });
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Save as Template</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-500 mb-3">Save “{section.title}” as a reusable section template. All lessons will be included.</p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Template Name <span className="text-red-400">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Module" autoFocus />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Description <span className="text-gray-400">(optional)</span></Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this template" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate({ sectionId: section.id, name: name.trim(), description: description.trim() || undefined })}>
            {save.isPending ? "Saving…" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Section Dialog ───────────────────────────────────────────────────────
function AddSectionDialog({ open, courseId, onClose, onCreated }: { open: boolean; courseId: number; onClose: () => void; onCreated: (section: { id: number; title: string }) => void }) {
  const [mode, setMode] = useState<"blank" | "template" | "course">("blank");
  const [title, setTitle] = useState("");
  // Template mode
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateTitle, setTemplateTitle] = useState("");
  // Course copy mode
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [copyTitle, setCopyTitle] = useState("");

  const { data: templates, isLoading: templatesLoading } = trpc.lmsAdmin.listSectionTemplates.useQuery(undefined, { enabled: open && mode === "template" });
  const { data: coursesWithSections, isLoading: coursesLoading } = trpc.lmsAdmin.listCoursesWithSections.useQuery(undefined, { enabled: open && mode === "course" });

  const selectedCourse = coursesWithSections?.find(c => c.id === selectedCourseId);
  const selectedSection = selectedCourse?.sections.find(s => s.id === selectedSectionId);

  const create = trpc.lmsAdmin.createSection.useMutation({
    onSuccess: (data) => { toast.success("Section added"); const t = title.trim(); setTitle(""); onCreated({ id: data.id, title: t }); },
    onError: e => toast.error(`Error: ${e.message}`),
  });
  const importTemplate = trpc.lmsAdmin.importSectionTemplate.useMutation({
    onSuccess: (data) => { toast.success(`Section "${data.title}" imported with ${data.lessonCount} lesson(s)`); setTemplateTitle(""); setSelectedTemplateId(null); onCreated({ id: data.sectionId, title: data.title }); },
    onError: e => toast.error(`Error: ${e.message}`),
  });
  const copySection = trpc.lmsAdmin.copySectionFromCourse.useMutation({
    onSuccess: (data) => { toast.success(`Section "${data.title}" copied with ${data.lessonCount} lesson(s)`); setCopyTitle(""); setSelectedSectionId(null); setSelectedCourseId(null); onCreated({ id: data.sectionId, title: data.title }); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const isPending = create.isPending || importTemplate.isPending || copySection.isPending;

  function handleSubmit() {
    if (mode === "blank") {
      if (!title.trim()) return;
      create.mutate({ courseId, title: title.trim() });
    } else if (mode === "template") {
      if (!selectedTemplateId) return;
      importTemplate.mutate({ courseId, templateId: selectedTemplateId, sectionTitle: templateTitle.trim() || undefined });
    } else {
      if (!selectedSectionId) return;
      copySection.mutate({ targetCourseId: courseId, sourceSectionId: selectedSectionId, sectionTitle: copyTitle.trim() || undefined });
    }
  }

  const canSubmit = mode === "blank" ? !!title.trim() : mode === "template" ? !!selectedTemplateId : !!selectedSectionId;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>

        {/* Mode selector */}
        <div className="flex gap-1 border rounded-lg p-1 bg-gray-50 mb-4">
          {(["blank", "template", "course"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                mode === m ? "bg-white shadow text-teal-700 border border-gray-200" : "text-gray-500 hover:text-gray-700"
              }`}>
              {m === "blank" ? "Blank Section" : m === "template" ? "From Template" : "Copy from Course"}
            </button>
          ))}
        </div>

        {/* Blank */}
        {mode === "blank" && (
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Section Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Module 1: Introduction" autoFocus />
          </div>
        )}

        {/* From Template */}
        {mode === "template" && (
          <div className="space-y-3">
            {templatesLoading ? <p className="text-sm text-gray-400">Loading templates…</p> : !templates?.length ? (
              <p className="text-sm text-gray-500 py-4 text-center">No saved templates yet. Save a section as a template from the course builder.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {templates.map(t => (
                  <button key={t.id} onClick={() => { setSelectedTemplateId(t.id); setTemplateTitle(t.sectionTitle); }}
                    className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                      selectedTemplateId === t.id ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}>
                    <div className="font-medium text-gray-800">{t.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.sectionTitle} · {t.lessonCount} lesson{t.lessonCount !== 1 ? "s" : ""}</div>
                    {t.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</div>}
                  </button>
                ))}
              </div>
            )}
            {selectedTemplateId && (
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Section Title <span className="text-gray-400">(optional override)</span></Label>
                <Input value={templateTitle} onChange={e => setTemplateTitle(e.target.value)} placeholder="Leave blank to use template default" className="h-8 text-sm" />
              </div>
            )}
          </div>
        )}

        {/* Copy from Course */}
        {mode === "course" && (
          <div className="space-y-3">
            {coursesLoading ? <p className="text-sm text-gray-400">Loading courses…</p> : (
              <>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Source Course</Label>
                  <Select value={selectedCourseId?.toString() ?? ""} onValueChange={v => { setSelectedCourseId(Number(v)); setSelectedSectionId(null); setCopyTitle(""); }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a course…" /></SelectTrigger>
                    <SelectContent>
                      {coursesWithSections?.filter(c => c.id !== courseId).map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCourse && (
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Section to Copy</Label>
                    {!selectedCourse.sections.length ? (
                      <p className="text-xs text-gray-400">This course has no sections.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {selectedCourse.sections.map(s => (
                          <button key={s.id} onClick={() => { setSelectedSectionId(s.id); setCopyTitle(s.title); }}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                              selectedSectionId === s.id ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}>
                            {s.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {selectedSection && (
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Section Title in This Course <span className="text-gray-400">(optional override)</span></Label>
                    <Input value={copyTitle} onChange={e => setCopyTitle(e.target.value)} placeholder={selectedSection.title} className="h-8 text-sm" />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!canSubmit || isPending} onClick={handleSubmit}>
            {isPending ? "Adding…" : "Add Section"}
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
  onCreated: (lesson: any) => void;
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
  // null = inherit from course default, true = always show, false = always hide
  const [requireManualComplete, setRequireManualComplete] = useState<boolean | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ id: number; title: string; s3Url: string; mediaType: string } | null>(null);

  const create = trpc.lmsAdmin.createLesson.useMutation({
    onSuccess: (data) => {
      toast.success("Lesson added");
      onCreated({
        id: data.id, title, type, content, videoContent, embedUrl,
        isPreview, durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
        requireVideoCompletion: requireVideoCompletion ? 1 : 0,
        requireManualComplete: requireManualComplete === null ? null : (requireManualComplete ? 1 : 0),
        contentBlocks: null, mediaAssetId: selectedAsset?.id ?? null,
      });
    },
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
      requireManualComplete: requireManualComplete ?? false,
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

          <div>
            <Label className="text-sm">Duration (min)</Label>
            <Input value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} type="number" min="0" className="mt-1" />
          </div>

          {/* Preview toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={isPreview} onCheckedChange={setIsPreview} id="add-preview-switch" />
            <Label htmlFor="add-preview-switch" className="text-sm">Free preview (requires login)</Label>
          </div>


          {/* Mark Complete override — 3-state: inherit / show / hide */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">"Mark Complete" button</p>
            <div className="flex gap-1 border rounded-lg p-1 bg-gray-50 w-fit">
              {([null, true, false] as const).map(v => (
                <button key={String(v)} onClick={() => setRequireManualComplete(v)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    requireManualComplete === v ? "bg-white shadow text-teal-700 border border-gray-200" : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {v === null ? "Inherit from course" : v ? "Always show" : "Always hide"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">"Inherit from course" uses the course-level default setting.</p>
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

function CopyLessonDialog({
  lesson, currentCourseId, onClose, onCopy,
}: {
  lesson: any;
  currentCourseId: number;
  onClose: () => void;
  onCopy: (targetCourseId: number, targetSectionId: number | null) => void;
}) {
  const { data: coursesResp1 } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", type: "all", page: 1, pageSize: 500 });
  // Filter to only courses and quizzes (exclude downloads), sorted: current course first
  const courses1 = (coursesResp1?.courses ?? []).filter((c: any) => c.type === "course" || c.type === "quiz").sort((a: any, b: any) => (a.id === currentCourseId ? -1 : b.id === currentCourseId ? 1 : 0));
  const [selectedCourseId, setSelectedCourseId] = useState<number>(currentCourseId);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const { data: targetCourse } = trpc.lmsAdmin.getCourse.useQuery({ id: selectedCourseId }, { enabled: !!selectedCourseId });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Lesson to Another Course</DialogTitle>
          <DialogDescription>Choose the destination course and section for “{lesson.title}”.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Destination Course</label>
            <Select value={String(selectedCourseId)} onValueChange={v => { setSelectedCourseId(Number(v)); setSelectedSectionId(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {(courses1).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.type === "quiz" ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"}`}>{c.type === "quiz" ? "Quiz" : "Course"}</span>
                      <span>{c.title}</span>
                      {c.status !== "public" && <span className="text-xs text-gray-400">({c.status})</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Destination Section <span className="text-gray-400 font-normal">(optional)</span></label>
            <Select value={selectedSectionId === null ? "__top__" : String(selectedSectionId)} onValueChange={v => setSelectedSectionId(v === "__top__" ? null : Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Course level (no section)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__top__">Course level (no section)</SelectItem>
                {(targetCourse?.sections ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => onCopy(selectedCourseId, selectedSectionId)}>
            <Copy className="w-4 h-4 mr-2" /> Copy Lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyModuleDialog({
  section, currentCourseId, onClose, onCopy,
}: {
  section: any;
  currentCourseId: number;
  onClose: () => void;
  onCopy: (targetCourseId: number) => void;
}) {
  const { data: coursesResp2 } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", type: "all", page: 1, pageSize: 500 });
  // Filter to only courses and quizzes (exclude downloads), sorted: current course first
  const courses2 = (coursesResp2?.courses ?? []).filter((c: any) => c.type === "course" || c.type === "quiz").sort((a: any, b: any) => (a.id === currentCourseId ? -1 : b.id === currentCourseId ? 1 : 0));
  const [selectedCourseId, setSelectedCourseId] = useState<number>(currentCourseId);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Module to Another Course</DialogTitle>
          <DialogDescription>
            Copy “{section.title}” and all its {section.lessons?.length ?? 0} lesson(s) to another course.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Destination Course</label>
            <Select value={String(selectedCourseId)} onValueChange={v => setSelectedCourseId(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {(courses2).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.type === "quiz" ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"}`}>{c.type === "quiz" ? "Quiz" : "Course"}</span>
                      <span>{c.title}</span>
                      {c.status !== "public" && <span className="text-xs text-gray-400">({c.status})</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => onCopy(selectedCourseId)}>
            <Copy className="w-4 h-4 mr-2" /> Copy Module
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LessonEditorPage({ lesson: lessonShallow, onClose, onSaved, onSavedAndClose, prevLesson, nextLesson, onNavigateLesson }: { lesson: any; onClose: () => void; onSaved: () => void; onSavedAndClose?: () => void; prevLesson?: any; nextLesson?: any; onNavigateLesson?: (lesson: any) => void }) {
  const blockEditorRef = React.useRef<import('@/components/LessonBlockEditor').LessonBlockEditorHandle>(null);
  // Fetch the FULL lesson record (including contentBlocks, content, videoContent).
  // The course list view intentionally strips heavy columns for performance, so we
  // must re-fetch the full row here before the editor can render existing blocks.
  const { data: fullLesson, isLoading: lessonLoading } = trpc.lmsAdmin.getLessonAdmin.useQuery(
    { lessonId: lessonShallow.id },
    { enabled: !!lessonShallow.id, staleTime: 0 }
  );
  // Use the full lesson once loaded; fall back to the shallow object while loading
  const lesson = fullLesson ?? lessonShallow;

  const [activeTab, setActiveTab] = useState<"settings" | "content">("settings");
  const [headerSaving, setHeaderSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const handleCloseWithConfirm = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  };

  const handleHeaderSave = async (andClose = false) => {
    setHeaderSaving(true);
    try {
      if (activeTab === "content" && blockEditorRef.current) {
        // Save lesson blocks from the content tab
        await blockEditorRef.current.save(andClose);
      } else {
        // Save lesson settings from the settings tab
        handleSave(andClose);
      }
      setIsDirty(false);
    } finally {
      setHeaderSaving(false);
    }
  };
  const [title, setTitle] = useState(lesson.title);
  const [lessonType, setLessonType] = useState<"video" | "text" | "quiz" | "download" | "embed" | "video_text">(lesson.type ?? "text");
  const [content, setContent] = useState(lesson.content ?? "");
  const [videoContent, setVideoContent] = useState(lesson.videoContent ?? "");
  const [embedUrl, setEmbedUrl] = useState(lesson.embedUrl ?? "");
  const [previewMode, setPreviewMode] = useState<"none" | "preview" | "preview_hide_after_purchase">(
    (lesson as any).previewMode ?? (lesson.isPreview ? "preview" : "none")
  );
  const [durationMinutes, setDurationMinutes] = useState(String(lesson.durationMinutes ?? ""));
    const [requireVideoCompletion, setRequireVideoCompletion] = useState(lesson.requireVideoCompletion === 1);
  // null = inherit from course default, true = always show, false = always hide
  const [requireManualComplete, setRequireManualComplete] = useState<boolean | null>(
    lesson.requireManualComplete === null || lesson.requireManualComplete === undefined ? null : lesson.requireManualComplete === 1
  );
  const [dripDays, setDripDays] = useState(String(lesson.dripDays ?? ""));
  const [showInstructor, setShowInstructor] = useState<"inherit" | "show" | "hide">(lesson.showInstructor ?? "inherit");
  const [isPrerequisite, setIsPrerequisite] = useState<boolean>(!!lesson.isPrerequisite);
  const [commentsEnabled, setCommentsEnabled] = useState<boolean>(!!(lesson as any).commentsEnabled);
  const [meetingLink, setMeetingLink] = useState<string>((lesson as any).meetingLink ?? "");
  const [liveStartAt, setLiveStartAt] = useState<string>((lesson as any).liveStartAt ? new Date((lesson as any).liveStartAt).toISOString().slice(0, 16) : "");
  const [liveEndAt, setLiveEndAt] = useState<string>((lesson as any).liveEndAt ? new Date((lesson as any).liveEndAt).toISOString().slice(0, 16) : "");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ id: number; title: string; s3Url: string; mediaType: string } | null>(null);
  const [lessonStatus, setLessonStatus] = useState<"published" | "draft">((lesson as any).lessonStatus ?? "published");

  // Reset all lesson state when navigating to a different lesson
  useEffect(() => {
    setTitle(lessonShallow.title ?? "");
    setLessonType(lessonShallow.type ?? "text");
    setContent(lessonShallow.content ?? "");
    setVideoContent(lessonShallow.videoContent ?? "");
    setEmbedUrl(lessonShallow.embedUrl ?? "");
    setPreviewMode((lessonShallow as any).previewMode ?? (lessonShallow.isPreview ? "preview" : "none"));
    setDurationMinutes(String(lessonShallow.durationMinutes ?? ""));
    setRequireVideoCompletion(lessonShallow.requireVideoCompletion === 1);
    setRequireManualComplete(
      lessonShallow.requireManualComplete === null || lessonShallow.requireManualComplete === undefined ? null : lessonShallow.requireManualComplete === 1
    );
    setDripDays(String(lessonShallow.dripDays ?? ""));
    setShowInstructor(lessonShallow.showInstructor ?? "inherit");
    setIsPrerequisite(!!lessonShallow.isPrerequisite);
    setCommentsEnabled(!!(lessonShallow as any).commentsEnabled);
    setMeetingLink((lessonShallow as any).meetingLink ?? "");
    setLiveStartAt((lessonShallow as any).liveStartAt ? new Date((lessonShallow as any).liveStartAt).toISOString().slice(0, 16) : "");
    setLiveEndAt((lessonShallow as any).liveEndAt ? new Date((lessonShallow as any).liveEndAt).toISOString().slice(0, 16) : "");
    setLessonStatus((lessonShallow as any).lessonStatus ?? "published");
  }, [lessonShallow.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state when full lesson data arrives (content/videoContent/embedUrl may be empty until then)
  useEffect(() => {
    if (fullLesson) {
      setLessonType(fullLesson.type ?? "text");
      setContent(fullLesson.content ?? "");
      setVideoContent(fullLesson.videoContent ?? "");
      setEmbedUrl(fullLesson.embedUrl ?? "");
    }
  }, [fullLesson]);

  // Fetch all lessons in this course for the prerequisite selector
  const { data: courseLessonsData } = trpc.lmsAdmin.getLessonsWithBlocks.useQuery(
    { courseId: lesson.courseId },
    { enabled: !!lesson.courseId }
  );
  // Also fetch all lessons (including those without blocks) — reuse getCourse
  const { data: courseData } = trpc.lmsAdmin.getCourse.useQuery(
    { id: lesson.courseId },
    { enabled: !!lesson.courseId }
  );
  const allCourseLessons = [
    ...(courseData?.topLevelLessons ?? []),
    ...(courseData?.sections ?? []).flatMap((s: any) => s.lessons ?? []),
  ].filter((l: any) => l.id !== lesson.id); // exclude self

  const update = trpc.lmsAdmin.updateLesson.useMutation({
    onSuccess: () => { toast.success("Lesson saved"); },
    onError: e => toast.error(`Error: ${e.message}`),
  });

  const handleSave = (andClose = false) => {
    update.mutate({
      id: lesson.id,
      title: title.trim(),
      type: lessonType,
      previewMode,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
      // Auto-enable requireVideoCompletion when lesson is a prerequisite gate (video lessons only)
      requireVideoCompletion: (isPrerequisite && (lessonType === "video" || lessonType === "video_text")) ? true : requireVideoCompletion,
      requireManualComplete,
      dripDays: dripDays.trim() ? parseInt(dripDays) : null,
      showInstructor,
      isPrerequisite,
      commentsEnabled,
      meetingLink: meetingLink.trim() || null,
      liveStartAt: liveStartAt ? new Date(liveStartAt).getTime() : null,
      liveEndAt: liveEndAt ? new Date(liveEndAt).getTime() : null,
      lessonStatus,
      content: (lessonType === "text" || lessonType === "video" || lessonType === "download" || lessonType === "video_text") ? (content || null) : undefined,
      videoContent: lessonType === "video_text" ? (videoContent || null) : undefined,
      embedUrl: lessonType === "embed" ? (embedUrl || null) : undefined,
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-teal-700 font-bold text-sm uppercase tracking-wide shrink-0">Edit Lesson</span>
            <span className="text-gray-300 text-sm shrink-0">·</span>
            <span className="text-gray-800 font-semibold text-sm truncate min-w-[15ch] max-w-[40vw]" title={lesson.title}>{lesson.title}</span>
          </div>
        </div>
        {/* Save / Close actions — always visible in header */}
        <div className="flex items-center gap-1.5 shrink-0 mr-2">
          <Button
            size="sm"
            variant="outline"
            className="border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 h-7 text-xs"
            onClick={handleCloseWithConfirm}
            title="Close without saving"
          >
            <X className="w-3 h-3 mr-1" /> Close
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-teal-300 text-teal-700 hover:bg-teal-50 h-7 text-xs font-semibold"
            disabled={headerSaving || update.isPending}
            onClick={() => handleHeaderSave(false)}
          >
            <Save className="w-3 h-3 mr-1" />
            {(headerSaving || update.isPending) ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white h-7 text-xs font-semibold"
            disabled={headerSaving || update.isPending}
            onClick={() => handleHeaderSave(true)}
          >
            {(headerSaving || update.isPending) ? "Saving..." : "Save & Close"}
          </Button>
        </div>
        {/* Tab switcher — always rendered with fixed width so prev/next never shift */}
        <div className="flex gap-1 shrink-0">
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
            Lesson Editor
          </button>

        </div>
        {/* Prev / Next lesson navigation — always at far right, never shifts */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => prevLesson && onNavigateLesson?.(prevLesson)}
            disabled={!prevLesson}
            title={prevLesson ? `← ${prevLesson.title}` : "No previous lesson"}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-teal-700 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline max-w-[110px] truncate">{prevLesson ? prevLesson.title : "Prev"}</span>
          </button>
          <button
            onClick={() => nextLesson && onNavigateLesson?.(nextLesson)}
            disabled={!nextLesson}
            title={nextLesson ? `${nextLesson.title} →` : "No next lesson"}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-teal-700 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <span className="hidden md:inline max-w-[110px] truncate">{nextLesson ? nextLesson.title : "Next"}</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </button>
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
            <Input value={title} onChange={e => { setTitle(e.target.value); setIsDirty(true); }} className="mt-1" />
          </div>

          {/* Lesson Status — Published / Draft */}
          <div className="flex items-center justify-between border rounded-lg px-4 py-3 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-700">Lesson Status</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {lessonStatus === "published"
                  ? "Visible to enrolled learners."
                  : "Hidden from learners — only admins can see this lesson."}
              </p>
            </div>
            <div className="flex gap-1 ml-4 shrink-0">
              <button
                onClick={() => { setLessonStatus("published"); setIsDirty(true); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                  lessonStatus === "published"
                    ? "bg-teal-600 text-white border-teal-600"
                    : "border-gray-200 text-gray-500 hover:border-teal-300 hover:text-teal-600"
                }`}
              >
                Published
              </button>
              <button
                onClick={() => { setLessonStatus("draft"); setIsDirty(true); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                  lessonStatus === "draft"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600"
                }`}
              >
                Draft
              </button>
            </div>
          </div>

          <div>
            <Label className="text-sm">Duration (min)</Label>
            <Input value={durationMinutes} onChange={e => { setDurationMinutes(e.target.value); setIsDirty(true); }} type="number" min="0" className="mt-1" />
          </div>

          {/* Preview mode selector */}
          <div className="border border-teal-100 rounded-lg p-4 space-y-3 bg-teal-50/30">
            <Label className="text-sm font-semibold text-teal-800">Free Preview Setting</Label>
            <Select value={previewMode} onValueChange={(v) => setPreviewMode(v as typeof previewMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not a preview — enrolled users only</SelectItem>
                <SelectItem value="preview">Free preview — always visible to non-enrolled users</SelectItem>
                <SelectItem value="preview_hide_after_purchase">Free preview → hide after purchase</SelectItem>
              </SelectContent>
            </Select>
            {previewMode === "none" && (
              <p className="text-xs text-gray-500">This lesson is only accessible to enrolled students.</p>
            )}
            {previewMode === "preview" && (
              <p className="text-xs text-teal-700">Non-enrolled users can view this lesson as a free sample. Preview access supersedes drip and prerequisite rules.</p>
            )}
            {previewMode === "preview_hide_after_purchase" && (
              <p className="text-xs text-amber-700">Shown as a free teaser to non-enrolled users. Once a student purchases the course, this lesson is hidden — useful for "before you buy" teasers that shouldn't clutter the course after purchase.</p>
            )}
          </div>


                    {/* Mark Complete override — 3-state: inherit / show / hide */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">"Mark Complete" button</p>
            <div className="flex gap-1 border rounded-lg p-1 bg-gray-50 w-fit">
              {([null, true, false] as const).map(v => (
                <button key={String(v)} onClick={() => setRequireManualComplete(v)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    requireManualComplete === v ? "bg-white shadow text-teal-700 border border-gray-200" : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {v === null ? "Inherit from course" : v ? "Always show" : "Always hide"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">"Inherit from course" uses the course-level default setting.</p>
          </div>

          {/* Comments toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={commentsEnabled} onCheckedChange={setCommentsEnabled} id="edit-comments-enabled" />
            <Label htmlFor="edit-comments-enabled" className="text-sm">Enable student discussion / comments on this lesson</Label>
          </div>
          {/* Live meeting link */}
          <div className="border border-teal-100 rounded-lg p-4 space-y-2 bg-teal-50/40">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Video className="w-4 h-4 text-teal-600" /> Live Meeting Link (Zoom / Teams)</p>
            <p className="text-xs text-gray-500">Paste a Zoom or Teams meeting URL here. A "Join Live" button will appear next to this lesson on the enrolled course overview page only.</p>
            <Input
              type="url"
              value={meetingLink}
              onChange={e => setMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/... or https://teams.microsoft.com/..."
              className="text-sm"
            />
            {meetingLink && (
              <p className="text-xs text-teal-700 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Join Live button will be shown on the course overview
              </p>
            )}
            {/* Scheduled start/end times for time-gated Join Live button */}
            {meetingLink && (
              <div className="space-y-2 pt-2 border-t border-teal-100">
                <p className="text-xs font-medium text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Schedule (optional — controls when Join Live button is visible)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Session Start</Label>
                    <Input
                      type="datetime-local"
                      value={liveStartAt}
                      onChange={e => setLiveStartAt(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Session End (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={liveEndAt}
                      onChange={e => setLiveEndAt(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Button appears 15 min before start. If no end time is set, it hides 3 hours after start. Leave both blank to always show the button.</p>
              </div>
            )}
          </div>

          {/* Drip scheduling */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Clock className="w-4 h-4 text-teal-600" /> Drip Schedule</p>
            <p className="text-xs text-gray-500">Optionally lock this lesson until a set number of days after enrollment. Leave blank to inherit section drip or be available immediately.</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={dripDays}
                onChange={e => setDripDays(e.target.value)}
                placeholder="e.g. 3"
                className="w-28"
              />
              <span className="text-sm text-gray-500">days after enrollment</span>
              {dripDays && parseInt(dripDays) > 0 && (
                <button className="text-xs text-red-500 hover:text-red-700 underline ml-2" onClick={() => setDripDays("")}>Clear</button>
              )}
            </div>
            {dripDays && parseInt(dripDays) > 0 && (
              <p className="text-xs text-teal-600">Students enrolled today will unlock this lesson on day {dripDays}.</p>
            )}
          </div>
          {/* Instructor display override */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <User className="w-4 h-4 text-teal-600" /> Instructor Panel
            </p>
            <p className="text-xs text-gray-500">Override the course-level instructor panel setting for this specific lesson.</p>
            <Select value={showInstructor} onValueChange={(v: any) => setShowInstructor(v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Inherit from course</SelectItem>
                <SelectItem value="show">Always show</SelectItem>
                <SelectItem value="hide">Always hide</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prerequisite gate */}
          <div className="border border-orange-200 rounded-lg p-4 space-y-3 bg-orange-50">
            <p className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-orange-500" /> Prerequisite Gate
            </p>
            <div className="flex items-center gap-2">
              <Switch
                checked={isPrerequisite}
                onCheckedChange={v => {
                  setIsPrerequisite(v);
                  // Auto-enable requireVideoCompletion for video lessons when marked as prerequisite
                  void v;
                }}
                id="edit-is-prerequisite"
              />
              <Label htmlFor="edit-is-prerequisite" className="text-sm font-medium text-orange-900">Mark this lesson as a prerequisite</Label>
            </div>
            {isPrerequisite ? (
              <div className="text-xs text-orange-700 bg-orange-100 rounded-md px-3 py-2 space-y-1">
                <p className="font-semibold">🔒 Prerequisite gate active</p>
                <p>All lessons that appear <strong>after</strong> this one in the course will be locked until this lesson is completed.</p>
                {!requireManualComplete && (
                  <p className="text-orange-600">If no Mark Complete button is shown, the gate will be satisfied when the student <strong>opens</strong> this lesson.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">When enabled, all subsequent lessons in the course are locked until this lesson is completed (or opened, if no Mark Complete button).</p>
            )}
          </div>

          {/* Effects section */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-teal-700 mb-3 flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Lesson Effect</p>
            <LessonEffectEditor
              key={`effect-${lesson.id}`}
              lessonId={lesson.id}
              initialData={{
                effectEnabled: lesson.effectEnabled,
                effectTrigger: lesson.effectTrigger,
                effectBannerText: lesson.effectBannerText,
                effectBannerBgColor: lesson.effectBannerBgColor,
                effectBannerTextColor: lesson.effectBannerTextColor,
                effectBannerDuration: lesson.effectBannerDuration ?? 5,
                effectSound: lesson.effectSound,
                effectSoundUrl: lesson.effectSoundUrl,
                effectConfetti: lesson.effectConfetti,
                effectConfettiColors: lesson.effectConfettiColors,
                effectConfettiMode: (lesson as any).effectConfettiMode ?? "fall",
              }}
              onSaved={onSaved}
            />
          </div>
        </div>

      </div>
      </div>
      )}

      {/* Lesson Editor Tab */}
      {activeTab === "content" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Sub-toolbar: canvas actions */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white h-7 text-xs font-semibold"
              onClick={() => blockEditorRef.current?.openAddBlock()}
            >
              <Plus className="w-3 h-3 mr-1" /> Add Block
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-teal-300 text-teal-700 hover:bg-teal-50 h-7 text-xs font-semibold"
              onClick={() => blockEditorRef.current?.openSaveLessonTemplate()}
            >
              <LayoutTemplate className="w-3 h-3 mr-1" /> Save as Template
            </Button>
          </div>
          {!fullLesson ? (
            <div className="flex items-center justify-center flex-1 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading lesson content...</span>
            </div>
          ) : (
            <LessonBlockEditor
              ref={blockEditorRef}
              key={`blocks-${lesson.id}`}
              lessonId={lesson.id}
              courseId={lesson.courseId}
              courseSlug={courseData?.slug ?? ""}
              lessonTitle={lesson.title}
              initialBlocks={fullLesson.contentBlocks ? (typeof fullLesson.contentBlocks === "string" ? JSON.parse(fullLesson.contentBlocks) : fullLesson.contentBlocks) as Block[] : []}
              onClose={() => setActiveTab("settings")}
              onSaved={() => { onSaved(); setIsDirty(false); }}
              onSavedAndClose={() => { setIsDirty(false); if (onSavedAndClose) onSavedAndClose(); else onSaved(); }}
              prevLesson={prevLesson}
              nextLesson={nextLesson}
              onNavigateLesson={onNavigateLesson}
              embedded
            />
          )}
        </div>
      )}


      </>
      <MediaPickerDialog open={mediaPickerOpen} onClose={() => setMediaPickerOpen(false)} onSelect={asset => { setSelectedAsset(asset); setContent(asset.s3Url); }} />

      {/* Discard changes confirmation dialog */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Discard unsaved changes?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">You have unsaved changes to this lesson. If you close now, your changes will be lost.</p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowDiscardDialog(false)}>Keep Editing</Button>
            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => { setShowDiscardDialog(false); setIsDirty(false); onClose(); }}>Discard &amp; Close</Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { setShowDiscardDialog(false); handleHeaderSave(true); }}>Save &amp; Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Quiz Builder Inline (embedded in LessonEditorPage Quiz tab) ─────────────

function QuizBuilderInline({ lesson, courseId }: { lesson: any; courseId?: number }) {
  const { data: quiz, isLoading: quizLoading, refetch } = trpc.lmsAdmin.getQuiz.useQuery({ lessonId: lesson.id });
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQ, setNewQ] = useState({ question: "", type: "mcq" as "mcq" | "truefalse", options: ["", "", "", ""], correctAnswer: "", explanation: "" });

  // AI Generate state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiTopic, setAITopic] = useState("");
  const [aiCount, setAICount] = useState(10);
  const [aiDifficulty, setAIDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [aiQType, setAIQType] = useState<"mcq" | "truefalse" | "mixed">("mcq");
  const [aiPreview, setAIPreview] = useState<Array<{ question: string; type: string; options: string[]; correctAnswer: string; explanation: string; selected: boolean }> | null>(null);
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);
  const [useFromLessons, setUseFromLessons] = useState(false);

  // Fetch course lessons for the lesson selector
  const { data: courseLessonList } = trpc.lmsAdmin.listCourseLessons.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId && showAIPanel }
  );

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

  if (quizLoading) return <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading quiz...</div>;
  if (!quiz) return <div className="text-gray-400 text-sm py-8 text-center">No quiz found. Please try refreshing.</div>;

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
        <div className="flex items-center gap-2">
          <Switch defaultChecked={!!(quiz as any).requirePassingToProgress} onCheckedChange={v => updateQuiz.mutate({ lessonId: lesson.id, requirePassingToProgress: v })} id="inline-require-passing" />
          <Label htmlFor="inline-require-passing" className="text-sm">Require passing to progress</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch defaultChecked={!!(quiz as any).randomizeQuestions} onCheckedChange={v => updateQuiz.mutate({ lessonId: lesson.id, randomizeQuestions: v })} id="inline-rand-q" />
          <Label htmlFor="inline-rand-q" className="text-sm">Randomize questions</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch defaultChecked={!!(quiz as any).randomizeAnswers} onCheckedChange={v => updateQuiz.mutate({ lessonId: lesson.id, randomizeAnswers: v })} id="inline-rand-a" />
          <Label htmlFor="inline-rand-a" className="text-sm">Randomize answers</Label>
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
                <Label className="text-sm font-medium">Topic {!(useFromLessons && selectedLessonIds.length > 0) && <span className="text-red-500">*</span>}</Label>
                <Input value={aiTopic} onChange={e => setAITopic(e.target.value)} placeholder="e.g. Doppler physics, DVT diagnosis criteria, Normal fetal echo anatomy" className="mt-1" />
                <p className="text-xs text-gray-500 mt-1">{useFromLessons && selectedLessonIds.length > 0 ? "Optional when lessons are selected — the AI will use lesson content as context." : "Be specific — the AI will generate clinically accurate questions tailored to your topic."}</p>
              </div>
              {courseId && courseLessonList && courseLessonList.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Switch id="use-lessons" checked={useFromLessons} onCheckedChange={v => { setUseFromLessons(v); if (!v) setSelectedLessonIds([]); }} />
                    <Label htmlFor="use-lessons" className="text-sm font-medium cursor-pointer">Generate from specific lesson content</Label>
                  </div>
                  {useFromLessons && (
                    <div className="border border-purple-200 rounded-lg p-3 bg-white space-y-1 max-h-48 overflow-y-auto">
                      <div className="flex gap-2 mb-2">
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedLessonIds(courseLessonList.map(l => l.id))}>Select All</Button>
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedLessonIds([])}>Clear</Button>
                        <span className="text-xs text-gray-500 ml-auto self-center">{selectedLessonIds.length} selected</span>
                      </div>
                      {courseLessonList.map(l => (
                        <label key={l.id} className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 rounded px-1 py-0.5">
                          <input type="checkbox" className="rounded" checked={selectedLessonIds.includes(l.id)} onChange={e => setSelectedLessonIds(prev => e.target.checked ? [...prev, l.id] : prev.filter(id => id !== l.id))} />
                          <span className="text-sm text-gray-700 truncate">{l.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                  disabled={(!aiTopic.trim() && !(useFromLessons && selectedLessonIds.length > 0)) || aiGenerate.isPending}
                  onClick={() => aiGenerate.mutate({ quizId: quiz.id, topic: aiTopic.trim() || "based on selected lesson content", count: aiCount, difficulty: aiDifficulty, questionType: aiQType, courseId, lessonIds: useFromLessons && selectedLessonIds.length > 0 ? selectedLessonIds : undefined })}
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
  const courseId: number | undefined = lesson.courseId ?? undefined;
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
  const [useFromLessons, setUseFromLessons] = useState(false);
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);

  // Fetch course lessons for lesson selector
  const { data: courseLessonList } = trpc.lmsAdmin.listCourseLessons.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId && showAIDialog }
  );

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
      setUseFromLessons(false);
      setSelectedLessonIds([]);
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
      <Dialog open={true} onOpenChange={() => { setShowAIDialog(false); setAIPreview(null); setUseFromLessons(false); setSelectedLessonIds([]); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" /> AI Generate Questions
            </DialogTitle>
          </DialogHeader>

          {!aiPreview ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Topic {!(useFromLessons && selectedLessonIds.length > 0) && <span className="text-red-500">*</span>}</Label>
                <Input
                  value={aiTopic}
                  onChange={e => setAITopic(e.target.value)}
                  placeholder="e.g. Doppler physics in vascular ultrasound, Normal fetal echo anatomy, DVT diagnosis criteria"
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">{useFromLessons && selectedLessonIds.length > 0 ? "Optional when lessons are selected — AI will use lesson content as context." : "Be specific — the AI will generate clinically accurate questions tailored to your topic."}</p>
              </div>

              {courseId && courseLessonList && courseLessonList.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Switch id="dlg-use-lessons" checked={useFromLessons} onCheckedChange={v => { setUseFromLessons(v); if (!v) setSelectedLessonIds([]); }} />
                    <Label htmlFor="dlg-use-lessons" className="text-sm font-medium cursor-pointer">Generate from specific lesson content</Label>
                  </div>
                  {useFromLessons && (
                    <div className="border border-purple-200 rounded-lg p-3 bg-white space-y-1 max-h-48 overflow-y-auto">
                      <div className="flex gap-2 mb-2">
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedLessonIds(courseLessonList.map(l => l.id))}>Select All</Button>
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedLessonIds([])}>Clear</Button>
                        <span className="text-xs text-gray-500 ml-auto self-center">{selectedLessonIds.length} selected</span>
                      </div>
                      {courseLessonList.map(l => (
                        <label key={l.id} className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 rounded px-1 py-0.5">
                          <input type="checkbox" className="rounded" checked={selectedLessonIds.includes(l.id)} onChange={e => setSelectedLessonIds(prev => e.target.checked ? [...prev, l.id] : prev.filter(id => id !== l.id))} />
                          <span className="text-sm text-gray-700 truncate">{l.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                  disabled={(!aiTopic.trim() && !(useFromLessons && selectedLessonIds.length > 0)) || aiGenerate.isPending}
                  onClick={() => aiGenerate.mutate({ quizId: quiz.id, topic: aiTopic.trim() || "based on selected lesson content", count: aiCount, difficulty: aiDifficulty, questionType: aiQType, courseId, lessonIds: useFromLessons && selectedLessonIds.length > 0 ? selectedLessonIds : undefined })}
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
                <td className="px-4 py-2.5 font-medium text-gray-900">${Number(o.amount).toFixed(2)}</td>
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

// ─── LMS Nav Config ───────────────────────────────────────────────────────────

const LMS_NAV_GROUPS = [
  {
    label: "Content",
    color: "teal",
    items: [
      { value: "courses",     label: "Courses",     icon: BookOpen },
      { value: "quizzes",     label: "Quizzes",     icon: HelpCircle },
      { value: "cohorts",     label: "Cohorts",     icon: Users },
      { value: "downloads",   label: "Downloads",   icon: Download },
      { value: "products",    label: "Products",    icon: ShoppingBag },
      { value: "webinars",    label: "Webinars",    icon: Radio },
      { value: "bundles",     label: "Bundles",     icon: Layers },
      { value: "memberships", label: "Memberships", icon: Award },
      { value: "communities", label: "Communities", icon: Globe },
    ],
  },
  {
    label: "Sales",
    color: "teal",
    items: [
      { value: "orderbumps",  label: "Order Bumps", icon: Tag },
      { value: "collections", label: "Collections", icon: LayoutGrid },
    ],
  },
  {
    label: "People",
    color: "teal",
    items: [
      { value: "members_hub", label: "Members Hub ↗", icon: Users, href: "/admin/members" },
      { value: "groups",      label: "Groups",      icon: Users },
      { value: "instructors", label: "Instructors", icon: GraduationCap },
      { value: "certificates",label: "Certificates",icon: CheckCircle },
      { value: "enrollments", label: "Enrollments", icon: UserCheck },
    ],
  },
  {
    label: "Insights",
    color: "teal",
    items: [
      { value: "analytics",   label: "Analytics",   icon: TrendingUp },
      { value: "affiliates",  label: "Affiliates",  icon: DollarSign },
    ],
  },
  {
    label: "Tools",
    color: "gray",
    items: [
      { value: "question_bank", label: "Question Bank", icon: Database },
      { value: "thinkific",   label: "Import",      icon: Upload }, // Upload already imported
      { value: "trash",       label: "Trash",       icon: Trash2, danger: true },
    ],
  },
] as const;

const GROUP_COLORS: Record<string, { bg: string; text: string; activeBg: string; activeText: string; dot: string }> = {
  teal:   { bg: "bg-teal-50",   text: "text-teal-700",   activeBg: "bg-teal-600",   activeText: "text-white", dot: "bg-teal-400" },
  purple: { bg: "bg-teal-50",   text: "text-teal-700",   activeBg: "bg-teal-600",   activeText: "text-white", dot: "bg-teal-400" },
  blue:   { bg: "bg-teal-50",   text: "text-teal-700",   activeBg: "bg-teal-600",   activeText: "text-white", dot: "bg-teal-400" },
  orange: { bg: "bg-teal-50",   text: "text-teal-700",   activeBg: "bg-teal-600",   activeText: "text-white", dot: "bg-teal-400" },
  gray:   { bg: "bg-gray-50",   text: "text-gray-600",   activeBg: "bg-gray-700",   activeText: "text-white", dot: "bg-gray-400" },
};

// ─── Main LMSAdmin Component ──────────────────────────────────────────────────

export default function LMSAdmin() {
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlTab = urlParams?.get("tab") ?? null;
  const urlEditCourse = urlParams?.get("editCourse") ?? null;
  const urlEditDownload = urlParams?.get("editDownload") ?? null;
  const urlEditProduct = urlParams?.get("editProduct") ?? null;
  const [activeTab, setActiveTab] = useState(urlTab || (urlEditDownload ? "downloads" : urlEditProduct ? "products" : "courses"));
  const [editingCourseId, setEditingCourseId] = useState<number | null>(urlEditCourse ? Number(urlEditCourse) : null);

  // Flatten all tabs to find active group color
  const allItems = LMS_NAV_GROUPS.flatMap(g => g.items.map(i => ({ ...i, groupColor: g.color })));
  const activeItem = allItems.find(i => i.value === activeTab);
  const activeGroupColor = activeItem?.groupColor ?? "teal";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-2">
            <Link href="/platform-admin" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeft className="w-3 h-3" /> Platform Admin
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">LMS Management</h1>
                <p className="text-xs text-gray-400">Education Library · Courses · Products · Enrollments</p>
              </div>
            </div>
            <Link href="/education-library">
              <Button size="sm" variant="outline" className="h-8 text-xs text-teal-600 border-teal-200 hover:bg-teal-50">
                <LinkIcon className="w-3 h-3 mr-1.5" /> View Education Library
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5">
        {editingCourseId ? (
          <CourseEditor courseId={editingCourseId} onBack={() => setEditingCourseId(null)} />
        ) : (
          <div className="flex gap-5">
            {/* Sidebar Nav */}
            <aside className="w-52 flex-shrink-0">
              <nav className="space-y-4">
                {LMS_NAV_GROUPS.map((group) => {
                  const colors = GROUP_COLORS[group.color];
                  return (
                    <div key={group.label}>
                      <div className="flex items-center gap-1.5 px-2 mb-1.5">
                        <div className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{group.label}</span>
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.value;
                          const isDanger = (item as any).danger;
                          return (
                            <button
                              key={item.value}
                              onClick={() => { if ((item as any).href) { window.location.href = (item as any).href; return; } setActiveTab(item.value); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              className={cn(
                                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                isActive
                                  ? isDanger
                                    ? "bg-red-600 text-white shadow-sm"
                                    : cn(colors.activeBg, colors.activeText, "shadow-sm")
                                  : isDanger
                                    ? "text-red-500 hover:bg-red-50"
                                    : "text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm"
                              )}
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
              {activeTab === "courses"     && <CoursesTab onEdit={setEditingCourseId} typeFilter="course" />}
              {activeTab === "quizzes"     && <CoursesTab onEdit={setEditingCourseId} typeFilter="quiz" />}
              {activeTab === "cohorts"     && <CoursesTab onEdit={setEditingCourseId} typeFilter="cohort" />}
              {activeTab === "downloads"   && <DigitalDownloadsAdmin initialEditId={urlEditDownload ? Number(urlEditDownload) : undefined} />}
              {activeTab === "products"    && <PhysicalProductsAdmin initialEditId={urlEditProduct ? Number(urlEditProduct) : undefined} />}
              {activeTab === "webinars"    && <LMSComingSoonTab icon={Radio} title="Webinars" description="Host and manage live webinar sessions with registration, reminders, and replay access." color="teal" />}
              {activeTab === "bundles"     && <LMSComingSoonTab icon={Layers} title="Bundles" description="Package courses, downloads, products, and quizzes together and sell them as a single bundle at a special price." color="teal" />}
              {activeTab === "memberships" && <LMSComingSoonTab icon={Award} title="Memberships" description="Create membership tiers that unlock course access, community features, and exclusive content on a recurring basis." color="teal" />}
              {activeTab === "communities" && <CommunitiesTab />}
              {activeTab === "orderbumps"  && <OrderBumpsAdmin />}
              {activeTab === "collections" && <CollectionsTab />}
              {activeTab === "groups"      && <GroupsTab />}
              {activeTab === "instructors" && <InstructorsTab />}
              {activeTab === "certificates"&& <CertificateTemplatesAdmin />}
              {activeTab === "enrollments" && <EnrollmentsWithPreviewsTab />}
              {activeTab === "analytics"   && <AnalyticsTab />}
              {activeTab === "affiliates"  && <AffiliatesTab />}
              {activeTab === "question_bank" && <QuestionBankAdmin />}
              {activeTab === "thinkific"   && <ThinkificImporter />}
              {activeTab === "trash"       && <TrashTab />}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Communities Tab helpers (top-level to satisfy React rules of hooks) ─────

function CommunityFormInline({
  community, onClose, onCreate, onUpdate, isCreating, isUpdating,
}: {
  community?: any; onClose: () => void;
  onCreate: (data: any) => void; onUpdate: (data: any) => void;
  isCreating: boolean; isUpdating: boolean;
}) {
  const [form, setForm] = useState({
    title: community?.title ?? "",
    slug: community?.slug ?? "",
    description: community?.description ?? "",
    privacy: community?.privacy ?? "public",
    accessType: community?.accessType ?? "free",
    brand: community?.brand ?? "all_about_ultrasound",
    accentColor: community?.accentColor ?? "#189aa1",
    status: community?.status ?? "published",
  });
  function handleSubmit() {
    if (!form.title.trim() || !form.slug.trim()) { toast("Title and slug are required"); return; }
    if (community) onUpdate({ id: community.id, ...form });
    else onCreate(form);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-1 block">Title *</Label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Community title" />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-1 block">Slug *</Label>
          <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="url-slug" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium text-gray-600 mb-1 block">Description</Label>
        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this community about?" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-1 block">Privacy</Label>
          <Select value={form.privacy} onValueChange={v => setForm(f => ({ ...f, privacy: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-1 block">Access</Label>
          <Select value={form.accessType} onValueChange={v => setForm(f => ({ ...f, accessType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-1 block">Brand</Label>
          <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all_about_ultrasound">All About Ultrasound™</SelectItem>
              <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-1 block">Status</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-1 block">Accent Color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="w-9 h-9 rounded cursor-pointer border" />
            <Input value={form.accentColor} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="w-28" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={isCreating || isUpdating}>
          {community ? "Save Changes" : "Create Community"}
        </Button>
      </div>
    </div>
  );
}

function ChannelFormInline({
  communityId, onClose, onAdd, isAdding,
}: {
  communityId: number; onClose: () => void;
  onAdd: (data: any) => void; isAdding: boolean;
}) {
  const [form, setForm] = useState({ name: "", description: "", type: "discussion" as string });
  function handleSubmit() {
    if (!form.name.trim()) { toast("Channel name is required"); return; }
    onAdd({ communityId, name: form.name, description: form.description || undefined, type: form.type });
  }
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium text-gray-600 mb-1 block">Channel Name *</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="general" />
      </div>
      <div>
        <Label className="text-xs font-medium text-gray-600 mb-1 block">Description</Label>
        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this channel for?" />
      </div>
      <div>
        <Label className="text-xs font-medium text-gray-600 mb-1 block">Type</Label>
        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="discussion">Discussion</SelectItem>
            <SelectItem value="announcements">Announcements</SelectItem>
            <SelectItem value="resources">Resources</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={isAdding}>
          Add Channel
        </Button>
      </div>
    </div>
  );
}

// ─── Communities Tab ────────────────────────────────────────────────────────

function CommunitiesTab() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const utils = trpc.useUtils();

  // Community list
  const { data: communities, isLoading: commLoading } = trpc.community.admin.listAllCommunities.useQuery(undefined, { enabled: isAdmin });
  const [activeCommunityId, setActiveCommunityId] = useState<number | null>(null);

  // Tabs within the communities panel
  const [activeSubTab, setActiveSubTab] = useState<"communities" | "channels" | "moderation" | "announcements" | "badges">("communities");

  // Community form state
  const [showCommunityForm, setShowCommunityForm] = useState(false);
  const [editCommunity, setEditCommunity] = useState<any>(null);

  // Channel form state
  const [showChannelForm, setShowChannelForm] = useState(false);

  // Announcement form state
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");

  // Badge award state
  const [awardUserId, setAwardUserId] = useState("");

  // Reports
  const { data: reports } = trpc.community.admin.listReports.useQuery(
    { status: "pending" },
    { enabled: isAdmin }
  );

    // Channels for the active community
  const { data: channelList, isLoading: channelsLoading } = trpc.community.admin.listChannels.useQuery(
    { communityId: activeCommunityId! },
    { enabled: isAdmin && activeCommunityId !== null }
  );
  // Mutations
  const createCommunity = trpc.community.admin.createCommunity.useMutation({
    onSuccess: () => { toast.success("Community created!"); utils.community.admin.listAllCommunities.invalidate(); setShowCommunityForm(false); },
    onError: e => toast.error(e.message),
  });
  const updateCommunity = trpc.community.admin.updateCommunity.useMutation({
    onSuccess: () => { toast.success("Community updated!"); utils.community.admin.listAllCommunities.invalidate(); setShowCommunityForm(false); setEditCommunity(null); },
    onError: e => toast.error(e.message),
  });
  const addChannel = trpc.community.admin.addChannel.useMutation({
    onSuccess: () => { toast.success("Channel added!"); utils.community.admin.listChannels.invalidate(); setShowChannelForm(false); },
    onError: e => toast.error(e.message),
  });
  const deleteChannel = trpc.community.admin.deleteChannel.useMutation({
    onSuccess: () => { toast.success("Channel deleted"); utils.community.admin.listChannels.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const resolveReport = trpc.community.admin.resolveReport.useMutation({
    onSuccess: () => { toast.success("Report resolved"); utils.community.admin.listReports.invalidate(); },
    onError: e => toast.error(e.message),
  });
    const postAnnouncement = trpc.community.admin.postAnnouncement.useMutation({
    onSuccess: () => { toast.success("Announcement posted!"); setAnnouncementTitle(""); setAnnouncementBody(""); },
    onError: e => toast.error(e.message),
  });
  // Badges
  const { data: badges } = trpc.community.admin.listBadges.useQuery(undefined, { enabled: isAdmin });
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [badgeName, setBadgeName] = useState("");
  const [badgeSlug, setBadgeSlug] = useState("");
  const [badgeEmoji, setBadgeEmoji] = useState("🏅");
  const [badgeXP, setBadgeXP] = useState(0);
  const [badgeDesc, setBadgeDesc] = useState("");
  const createBadge = trpc.community.admin.createBadge.useMutation({
    onSuccess: () => { toast.success("Badge created!"); utils.community.admin.listBadges.invalidate(); setShowBadgeForm(false); setBadgeName(""); setBadgeSlug(""); setBadgeEmoji("🏅"); setBadgeXP(0); setBadgeDesc(""); },
    onError: e => toast.error(e.message),
  });
  // Auto-select first community
  useEffect(() => {
    if (communities?.length && !activeCommunityId) setActiveCommunityId(communities[0].id);
  }, [communities]);

    if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Shield className="w-8 h-8 mr-2" /> Admin access required
      </div>
    );
  }

  const pendingReports = reports?.filter((r: any) => r.status === "pending") ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Community Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage communities, channels, moderation, and announcements</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { setEditCommunity(null); setShowCommunityForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Community
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: "communities", label: "Communities", icon: Users },
          { key: "channels", label: "Channels", icon: Hash },
          { key: "moderation", label: "Moderation", icon: Flag, badge: pendingReports.length },
          { key: "announcements", label: "Announcements", icon: Megaphone },
          { key: "badges", label: "Badges", icon: Award },
        ] as const).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setActiveSubTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeSubTab === key
                ? "border-teal-500 text-teal-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge != null && badge > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Communities sub-tab */}
      {activeSubTab === "communities" && (
        <div className="space-y-3">
          {showCommunityForm && (
            <div className="border border-teal-200 rounded-xl bg-teal-50/40 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">{editCommunity ? "Edit Community" : "Create Community"}</h3>
              <CommunityFormInline
                community={editCommunity}
                onClose={() => { setShowCommunityForm(false); setEditCommunity(null); }}
                onCreate={data => createCommunity.mutate(data as any)}
                onUpdate={data => updateCommunity.mutate(data as any)}
                isCreating={createCommunity.isPending}
                isUpdating={updateCommunity.isPending}
              />
            </div>
          )}
          {commLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : !communities?.length ? (
            <div className="text-center py-16 text-gray-400">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No communities yet</p>
              <p className="text-sm mt-1">Create your first community to get started.</p>
            </div>
          ) : (
            communities.map((c: any) => (
              <div key={c.id} className={cn(
                "flex items-center gap-4 bg-white rounded-xl border px-4 py-3 transition-all",
                activeCommunityId === c.id ? "ring-2 ring-teal-400 border-teal-200" : "border-gray-200 hover:border-teal-200"
              )}>
                <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: c.accentColor || "#189aa1" }}>
                  {c.title.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{c.title}</span>
                    <Badge variant="outline" className="text-xs capitalize">{c.status}</Badge>
                    <Badge variant="secondary" className="text-xs capitalize">{c.privacy}</Badge>
                    <Badge variant="secondary" className="text-xs capitalize">{c.accessType}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-0.5">{c.description || "No description"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">/{c.slug} · {(c.memberCount ?? 0).toLocaleString()} members</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setActiveCommunityId(c.id); setActiveSubTab("channels"); }}>
                    <Hash className="w-3.5 h-3.5 mr-1" /> Channels
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditCommunity(c); setShowCommunityForm(true); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Channels sub-tab */}
      {activeSubTab === "channels" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Select value={activeCommunityId?.toString() ?? ""} onValueChange={v => setActiveCommunityId(parseInt(v))}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select community" /></SelectTrigger>
              <SelectContent>
                {communities?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!activeCommunityId}
              onClick={() => setShowChannelForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Channel
            </Button>
          </div>
          {showChannelForm && activeCommunityId && (
            <div className="border border-teal-200 rounded-xl bg-teal-50/40 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Add Channel</h3>
              <ChannelFormInline
                communityId={activeCommunityId}
                onClose={() => setShowChannelForm(false)}
                onAdd={data => addChannel.mutate(data as any)}
                isAdding={addChannel.isPending}
              />
            </div>
          )}
          {!activeCommunityId ? (
            <div className="text-center py-12 text-gray-400">Select a community to manage its channels.</div>
          ) : channelsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : !channelList?.length ? (
            <div className="text-center py-12 text-gray-400">
              <Hash className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No channels yet. Add one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {channelList.map((ch: any) => (
                <div key={ch.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
                  <Hash className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{ch.name}</span>
                      {ch.isDefault && <Badge className="text-xs bg-teal-100 text-teal-700 border-teal-200">Default</Badge>}
                      <Badge variant="secondary" className="text-xs capitalize">{ch.type?.replace("_", " ")}</Badge>
                    </div>
                    {ch.description && <p className="text-sm text-gray-500">{ch.description}</p>}
                  </div>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700"
                    onClick={() => { if (confirm(`Delete #${ch.name}?`)) deleteChannel.mutate({ channelId: ch.id }); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Moderation sub-tab */}
      {activeSubTab === "moderation" && (
        <div className="space-y-3">
          {pendingReports.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No pending reports</p>
              <p className="text-sm mt-1">Community is clean!</p>
            </div>
          ) : (
            pendingReports.map((r: any) => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="destructive" className="text-xs">Pending</Badge>
                      <span className="text-xs text-gray-500 capitalize">{r.targetType} report</span>
                    </div>
                    <p className="text-sm text-gray-700"><strong>Reason:</strong> {r.reason}</p>
                    {r.details && <p className="text-sm text-gray-500 mt-1">{r.details}</p>}
                    <p className="text-xs text-gray-400 mt-1">Reported by user #{r.reporterId} · Target ID: {r.targetId}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => resolveReport.mutate({ reportId: r.id, status: "dismissed" })}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Dismiss
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => resolveReport.mutate({ reportId: r.id, status: "reviewed" })}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Mark Reviewed
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Announcements sub-tab */}
      {activeSubTab === "announcements" && (
        <div className="space-y-4">
          <div className="border border-teal-200 rounded-xl bg-teal-50/40 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-teal-600" /> Post Announcement
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-1 block">Community</Label>
                <Select value={activeCommunityId?.toString() ?? ""} onValueChange={v => setActiveCommunityId(parseInt(v))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select community" /></SelectTrigger>
                  <SelectContent>
                    {communities?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-1 block">Title *</Label>
                <Input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} placeholder="Announcement title" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-1 block">Body *</Label>
                <RichTextEditor
                  value={announcementBody}
                  onChange={setAnnouncementBody}
                  placeholder="Write your announcement here..."
                  minHeight={120}
                />
              </div>
              <div className="flex justify-end">
                <Button className="bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={!activeCommunityId || !announcementTitle.trim() || !announcementBody.trim() || postAnnouncement.isPending}
                  onClick={() => postAnnouncement.mutate({ communityId: activeCommunityId!, title: announcementTitle, body: announcementBody })}>
                  <Megaphone className="w-4 h-4 mr-2" /> Post Announcement
                </Button>
              </div>
            </div>
          </div>
                    <p className="text-xs text-gray-400">Announcements are pinned posts in the Announcements channel and notify all community members.</p>
        </div>
      )}
      {/* Badges sub-tab */}
      {activeSubTab === "badges" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Award className="w-4 h-4 text-teal-600" /> Badge Management</h3>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" size="sm" onClick={() => setShowBadgeForm(v => !v)}>
              <Plus className="w-4 h-4 mr-1" /> New Badge
            </Button>
          </div>
          {showBadgeForm && (
            <div className="border border-teal-200 rounded-xl bg-teal-50/40 p-5 space-y-3">
              <h4 className="font-medium text-gray-900">Create Badge</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-1 block">Name *</Label>
                  <Input value={badgeName} onChange={e => setBadgeName(e.target.value)} placeholder="e.g. First Post" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-1 block">Slug *</Label>
                  <Input value={badgeSlug} onChange={e => setBadgeSlug(e.target.value)} placeholder="e.g. first_post" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-1 block">Emoji</Label>
                  <Input value={badgeEmoji} onChange={e => setBadgeEmoji(e.target.value)} placeholder="🏅" className="w-20" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-1 block">XP Required</Label>
                  <Input type="number" value={badgeXP} onChange={e => setBadgeXP(parseInt(e.target.value) || 0)} placeholder="0" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-1 block">Description</Label>
                <Input value={badgeDesc} onChange={e => setBadgeDesc(e.target.value)} placeholder="Badge description" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowBadgeForm(false)}>Cancel</Button>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={!badgeName.trim() || !badgeSlug.trim() || createBadge.isPending}
                  onClick={() => createBadge.mutate({ name: badgeName, slug: badgeSlug, iconEmoji: badgeEmoji, xpRequired: badgeXP, description: badgeDesc || undefined })}>
                  Create Badge
                </Button>
              </div>
            </div>
          )}
          {!badges?.length ? (
            <div className="text-center py-12 text-gray-400">
              <Award className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No badges yet. Create one to reward community members.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {badges.map((b: any) => (
                <div key={b.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
                  <div className="text-2xl flex-shrink-0">{b.iconEmoji || "🏅"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{b.name}</div>
                    {b.description && <div className="text-xs text-gray-500 truncate">{b.description}</div>}
                    {b.xpRequired > 0 && <div className="text-xs text-teal-600">{b.xpRequired} XP required</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400">Badges are automatically awarded when members reach the required XP threshold or specific milestones.</p>
        </div>
      )}
    </div>
  );
}
// ─── Coming Soon Placeholder Tab ─────────────────────────────────────────────

function LMSComingSoonTab({ icon: Icon, title, description, color }: { icon: any; title: string; description: string; color: string }) {
  const colorMap: Record<string, { bg: string; iconBg: string; iconText: string; badge: string }> = {
    teal:   { bg: "bg-teal-50",   iconBg: "bg-teal-100",   iconText: "text-teal-600",   badge: "bg-teal-100 text-teal-700" },
    purple: { bg: "bg-purple-50", iconBg: "bg-purple-100", iconText: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
    blue:   { bg: "bg-blue-50",   iconBg: "bg-blue-100",   iconText: "text-blue-600",   badge: "bg-blue-100 text-blue-700" },
    orange: { bg: "bg-orange-50", iconBg: "bg-orange-100", iconText: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
  };
  const c = colorMap[color] ?? colorMap.teal;
  return (
    <div className={cn("rounded-2xl border border-gray-200 p-12 text-center", c.bg)}>
      <div className={cn("w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center", c.iconBg)}>
        <Icon className={cn("w-8 h-8", c.iconText)} />
      </div>
      <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold mb-3", c.badge)}>
        <Sparkles className="w-3 h-3" /> Coming Soon
      </span>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto">{description}</p>
    </div>
  );
}

// ─── Enrollments + Free Previews Combined Tab ─────────────────────────────────

function EnrollmentsWithPreviewsTab() {
  const [subTab, setSubTab] = useState<"enrollments" | "free-previews">("enrollments");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setSubTab("enrollments")}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
            subTab === "enrollments" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <UserCheck className="w-3.5 h-3.5 inline mr-1.5" />Enrollments
        </button>
        <button
          onClick={() => setSubTab("free-previews")}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
            subTab === "free-previews" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Eye className="w-3.5 h-3.5 inline mr-1.5" />Free Previews
        </button>
      </div>
      {subTab === "enrollments"   && <EnrollmentsTab />}
      {subTab === "free-previews" && <FreePreviewEnrollmentsTab />}
    </div>
  );
}

// ─── Trash Tab ───────────────────────────────────────────────────────────────
// ─── Free Preview Enrollments Tab ────────────────────────────────────────────────────────────────────────────────────
function FreePreviewEnrollmentsTab() {
  const [courseFilter, setCourseFilter] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);

  const { data: courses } = trpc.lmsPublic.listCourses.useQuery({ limit: 200 });
  const { data, isLoading } = trpc.lmsAdmin.listFreePreviewEnrollments.useQuery(
    { courseId: courseFilter, search: search || undefined, page, pageSize: 50 },
    { refetchOnWindowFocus: false }
  );
  const exportQuery = trpc.lmsAdmin.exportFreePreviewEnrollmentsCsv.useQuery(
    { courseId: courseFilter, search: search || undefined },
    { enabled: false }
  );

  function handleExport() {
    setExportLoading(true);
    exportQuery.refetch().then((res) => {
      setExportLoading(false);
      if (!res.data?.csv) return;
      const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `free-preview-enrollments-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => setExportLoading(false));
  }

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h2 className="text-base font-bold text-gray-800">Free Preview Enrollments</h2>
        <button
          onClick={handleExport}
          disabled={exportLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {exportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
        <select
          value={courseFilter ?? ""}
          onChange={(e) => { setCourseFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
        >
          <option value="">All Courses</option>
          {((courses as any)?.courses ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
      ) : (
        <>
          <div className="text-xs text-gray-500 mb-2">{data?.total ?? 0} enrollment{data?.total !== 1 ? "s" : ""} found</div>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Course</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Enrolled</th>
                  <th className="px-4 py-3 text-left">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data?.items ?? []).map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.firstName} {row.lastName ?? ""}</td>
                    <td className="px-4 py-3 text-gray-600">{row.email}</td>
                    <td className="px-4 py-3 text-gray-600">{row.courseTitle ?? `Course #${row.courseId}`}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{row.source ?? "course_landing"}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{row.accessExpiresAt ? new Date(row.accessExpiresAt).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No enrollments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40">Previous</button>
              <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  course: "Course",
  quiz: "Quiz",
  download: "Download",
  product: "Product",
  bundle: "Bundle",
};
const ITEM_TYPE_COLORS: Record<string, string> = {
  course: "bg-teal-100 text-teal-700",
  quiz: "bg-purple-100 text-purple-700",
  download: "bg-blue-100 text-blue-700",
  product: "bg-orange-100 text-orange-700",
  bundle: "bg-pink-100 text-pink-700",
};

function TrashTab() {
  const [typeFilter, setTypeFilter] = useState<"all" | "course" | "quiz" | "download" | "product" | "bundle">("all");
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);

  const { data, isLoading, refetch } = trpc.lmsAdmin.listArchive.useQuery(
    typeFilter === "all" ? {} : { itemType: typeFilter },
    { refetchOnWindowFocus: false }
  );

  const purgeItem = trpc.lmsAdmin.purgeArchiveItem.useMutation({
    onSuccess: () => { toast.success("Item permanently deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const purgeExpired = trpc.lmsAdmin.purgeExpiredArchive.useMutation({
    onSuccess: (r) => { toast.success(`Purged ${r.purged} expired item(s)`); refetch(); setConfirmPurgeAll(false); },
    onError: (e) => toast.error(e.message),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Trash2 className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-gray-800">Trash</h2>
          <span className="text-xs text-gray-400">(items are permanently purged 30 days after deletion)</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="course">Courses</SelectItem>
              <SelectItem value="quiz">Quizzes</SelectItem>
              <SelectItem value="download">Downloads</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="bundle">Bundles</SelectItem>
            </SelectContent>
          </Select>
          {confirmPurgeAll ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-600">Purge all expired now?</span>
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => purgeExpired.mutate()} disabled={purgeExpired.isPending}>Yes, purge</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmPurgeAll(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-200" onClick={() => setConfirmPurgeAll(true)}>
              <Trash2 className="w-3 h-3 mr-1" /> Purge Expired
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Trash is empty</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Title</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Deleted</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Purge After</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800 max-w-xs truncate">{item.title}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ITEM_TYPE_COLORS[item.itemType] ?? "bg-gray-100 text-gray-600"}`}>
                      {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{new Date(item.deletedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(item.purgeAt) < new Date() ? (
                      <span className="text-red-500 font-medium">Overdue</span>
                    ) : (
                      new Date(item.purgeAt).toLocaleDateString()
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => purgeItem.mutate({ id: item.id })}
                      disabled={purgeItem.isPending}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete Now
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Collections Tab ──────────────────────────────────────────────────────────
// ─── Sortable Collection Row ──────────────────────────────────────────────────
function SortableCollectionRow({ col, onEdit, onDelete }: { col: any; onEdit: (c: any) => void; onDelete: (c: any) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
      <button {...attributes} {...listeners} className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 p-0.5">
        <GripVertical className="w-4 h-4" />
      </button>
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
        <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600 hover:bg-teal-50" onClick={() => onEdit(col)}>
          <Edit2 className="w-3 h-3 mr-1" /> Edit
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-50" onClick={() => onDelete(col)}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function CollectionsTab() {
  const utils = trpc.useUtils();
  const { data: collections, isLoading } = trpc.lmsAdmin.listCollections.useQuery();
  const { data: allCourses } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", page: 1, pageSize: 200 });

  const [createOpen, setCreateOpen] = useState(false);
  const [editCollection, setEditCollection] = useState<any>(null);
  const [localOrder, setLocalOrder] = useState<any[]>([]);

  // Sync local order when server data loads
  const prevCollectionsRef = useRef<any[]>([]);
  if (collections && collections !== prevCollectionsRef.current) {
    prevCollectionsRef.current = collections as any[];
    setLocalOrder(collections as any[]);
  }

  const collectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [pendingCourseIds, setPendingCourseIds] = useState<number[]>([]);
  const createCollection = trpc.lmsAdmin.createCollection.useMutation({
    onSuccess: (newCol) => {
      if (pendingCourseIds.length > 0) {
        setCourses.mutate({ collectionId: newCol.id, courseIds: pendingCourseIds }, {
          onSettled: () => { toast.success("Collection created"); utils.lmsAdmin.listCollections.invalidate(); setCreateOpen(false); setPendingCourseIds([]); },
        });
      } else {
        toast.success("Collection created"); utils.lmsAdmin.listCollections.invalidate(); setCreateOpen(false);
      }
    },
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
  const reorderCollections = trpc.lmsAdmin.reorderCollections.useMutation({
    onError: e => toast.error(e.message),
  });

  const handleCollectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder(prev => {
      const oldIndex = prev.findIndex((c: any) => c.id === active.id);
      const newIndex = prev.findIndex((c: any) => c.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      reorderCollections.mutate({ orderedIds: next.map((c: any) => c.id) });
      return next;
    });
  };

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Collections</h3>
          <p className="text-xs text-gray-500 mt-0.5">Group courses by custom labels — shown as filter tabs on the Education Library. Drag to reorder.</p>
        </div>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New Collection
        </Button>
      </div>

      {localOrder.length === 0 && (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No collections yet. Create one to group courses by topic or label.</p>
        </div>
      )}

      <DndContext sensors={collectionSensors} collisionDetection={closestCenter} onDragEnd={handleCollectionDragEnd}>
        <SortableContext items={localOrder.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {localOrder.map((col: any) => (
              <SortableCollectionRow
                key={col.id}
                col={col}
                onEdit={setEditCollection}
                onDelete={(c) => { if (confirm(`Delete collection "${c.title}"?`)) deleteCollection.mutate({ id: c.id }); }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Create Dialog */}
      <CollectionFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        allCourses={allCourses?.courses ?? []}
        onSave={(data, courseIds) => { setPendingCourseIds(courseIds); createCollection.mutate({ ...data, isPublished: data.isPublished ?? true } as any); }}
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
  const [coverImageUrl, setCoverImageUrl] = useState<string>(initial?.coverImageUrl ?? "");
  const [imageUploading, setImageUploading] = useState(false);
  const uploadCollectionImage = trpc.lmsAdmin.uploadCollectionImage.useMutation({
    onSuccess: (data) => { setCoverImageUrl(data.url); setImageUploading(false); },
    onError: (e) => { toast.error(e.message); setImageUploading(false); },
  });
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) { toast.error("Image must be under 8 MB"); return; }
    if (!initial?.id) { toast.error("Save the collection first, then upload a hero image."); return; }
    setImageUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUri = ev.target?.result as string;
      uploadCollectionImage.mutate({ collectionId: initial.id, dataUri, mimeType: file.type as any });
    };
    reader.readAsDataURL(file);
  };

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
    onSave({ title: colTitle.trim(), description: description || undefined, label: label || undefined, color, isPublished, coverImageUrl: coverImageUrl || undefined }, selectedCourseIds);
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
            <div className="col-span-2">
              <Label className="text-xs font-medium">Hero Banner Image</Label>
              <p className="text-xs text-gray-400 mb-2">Displayed as the collection hero background. Recommended: 1400×400px. {!initial?.id && <span className="text-amber-600">Save the collection first to enable image upload.</span>}</p>
              <div className="flex items-start gap-3">
                {coverImageUrl && (
                  <img src={coverImageUrl} alt="Hero preview" className="w-32 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-teal-400 text-sm text-gray-500 hover:text-teal-600 transition-colors ${!initial?.id ? 'opacity-50 pointer-events-none' : ''}`}>
                    {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    {imageUploading ? "Uploading..." : coverImageUrl ? "Replace image" : "Upload hero image"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageFile} disabled={imageUploading || !initial?.id} />
                  </label>
                  {coverImageUrl && (
                    <button onClick={() => setCoverImageUrl("")} className="text-xs text-red-500 hover:text-red-700 mt-1">Remove image</button>
                  )}
                </div>
              </div>
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

// ─── Course Users Tab ─────────────────────────────────────────────────────────

function CourseUsersTab({ courseId }: { courseId: number }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [unenrollTarget, setUnenrollTarget] = useState<{ id: number; name: string } | null>(null);
  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading, refetch } = trpc.lmsAdmin.getCourseUsers.useQuery({
    courseId, page, pageSize: 25, search: debouncedSearch || undefined,
  });
  const removeEnrollment = trpc.lmsAdmin.removeEnrollment.useMutation({
    onSuccess: () => { toast.success("Student unenrolled successfully"); setUnenrollTarget(null); refetch(); },
    onError: e => toast.error(e.message),
  });
  // Thinkific sync
  const { data: syncInfo } = trpc.lmsAdmin.getThinkificSyncInfo.useQuery({ courseId });
  const syncEnrollments = trpc.lmsAdmin.syncThinkificEnrollments.useMutation({
    onSuccess: (result) => {
      toast.success(`Sync complete: ${result.synced} new enrollment${result.synced !== 1 ? "s" : ""} added, ${result.skipped} already existed.`);
      refetch();
    },
    onError: e => toast.error(`Sync failed: ${e.message}`),
  });
  return (
    <div className="space-y-4">
      {/* Thinkific sync banner — only shown for Thinkific-imported courses */}
      {syncInfo && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">Thinkific course: <span className="font-semibold">{syncInfo.thinkificCourseName}</span></p>
              {syncInfo.lastSyncedAt && (
                <p className="text-xs text-blue-500">Last synced: {new Date(syncInfo.lastSyncedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-400 text-blue-700 hover:bg-blue-100 h-8"
            onClick={() => syncEnrollments.mutate({ courseId })}
            disabled={syncEnrollments.isPending}
          >
            {syncEnrollments.isPending ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing...</>
            ) : (
              <><RefreshCw className="w-3 h-3 mr-1" /> Sync from Thinkific</>
            )}
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or email..."
          className="max-w-xs h-8 text-sm"
        />
        <div className="flex items-center gap-2">
          {data && <span className="text-sm text-gray-500">{data.total} student{data.total !== 1 ? "s" : ""}</span>}
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white h-8" onClick={() => setEnrollDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Enroll Student
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Enrolled</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Last Active</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Access</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.enrollments ?? []).map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">{e.user?.displayName || e.user?.name || "Unknown"}</p>
                        {e.enrollmentType === "free_preview" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                            <Eye className="w-2.5 h-2.5" /> Preview
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{e.user?.email ?? "—"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5">
                        <div className="h-1.5 bg-teal-500 rounded-full" style={{ width: `${e.progressPct ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-600">{e.progressPct ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {e.lastActivityAt ? new Date(e.lastActivityAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Badge className={`text-xs ${e.accessType === "group" ? "bg-blue-100 text-blue-700" : e.accessType === "free" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {e.accessType ?? "direct"}
                      </Badge>
                      {e.enrollmentType === "free_preview" && (
                        <Badge className="text-xs bg-amber-100 text-amber-700 border border-amber-200">free preview</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                      title="Unenroll student"
                      onClick={() => setUnenrollTarget({ id: e.id, name: e.user?.displayName || e.user?.name || e.user?.email || "this student" })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {(data?.enrollments ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No students enrolled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(data?.total ?? 0) > 25 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page * 25 >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <EnrollStudentDialog
        open={enrollDialogOpen}
        courseId={courseId}
        onClose={() => setEnrollDialogOpen(false)}
        onEnrolled={() => { setEnrollDialogOpen(false); refetch(); }}
      />

      {/* Unenroll Confirmation Dialog */}
      <Dialog open={!!unenrollTarget} onOpenChange={(v) => { if (!v) setUnenrollTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Unenroll Student?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600">
              Remove <strong>{unenrollTarget?.name}</strong> from this course?
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Their progress data will be preserved but they will lose access to the course.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnenrollTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => unenrollTarget && removeEnrollment.mutate({ id: unenrollTarget.id })}
              disabled={removeEnrollment.isPending}
            >
              {removeEnrollment.isPending ? "Removing..." : "Yes, Unenroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EnrollStudentDialog({ open, courseId, onClose, onEnrolled }: { open: boolean; courseId: number; onClose: () => void; onEnrolled: () => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  // Create & Enroll mode
  const [createMode, setCreateMode] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data: searchResults } = trpc.lmsAdmin.searchUsers.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  const addEnrollment = trpc.lmsAdmin.addEnrollment.useMutation({
    onSuccess: (result) => {
      if (result.alreadyEnrolled) {
        toast.info("Student is already enrolled in this course");
      } else {
        toast.success("Student enrolled successfully!");
        onEnrolled();
      }
    },
    onError: e => toast.error(e.message),
  });

  const createAndEnroll = trpc.lmsAdmin.createAndEnrollUser.useMutation({
    onSuccess: (result) => {
      if (result.alreadyEnrolled) {
        toast.info("This user is already enrolled in this course");
      } else if (result.isNewUser) {
        toast.success("New user created and enrolled successfully!");
      } else {
        toast.success("Existing user enrolled successfully!");
      }
      onEnrolled();
    },
    onError: e => toast.error(e.message),
  });

  const handleEnroll = () => {
    if (!selectedUser) return;
    addEnrollment.mutate({ userId: selectedUser.id, courseId });
  };

  const handleCreateAndEnroll = () => {
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    createAndEnroll.mutate({ courseId, name: newUserName.trim(), email: newUserEmail.trim() });
  };

  const handleClose = () => {
    setQuery("");
    setDebouncedQuery("");
    setSelectedUser(null);
    setCreateMode(false);
    setNewUserName("");
    setNewUserEmail("");
    onClose();
  };

  const showNoResults = debouncedQuery.length >= 2 && searchResults?.length === 0 && !selectedUser;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll a Student</DialogTitle>
          <DialogDescription>
            {createMode
              ? "Enter the new user's details. They can log in later via OAuth."
              : "Search for an existing user to enroll them in this course."}
          </DialogDescription>
        </DialogHeader>

        {!createMode ? (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Search by name or email</Label>
              <Input
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedUser(null); }}
                placeholder="Type at least 2 characters..."
                className="mt-1"
              />
            </div>
            {searchResults && searchResults.length > 0 && !selectedUser && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {searchResults.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setQuery(u.displayName || u.name || u.email); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900">{u.displayName || u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-200 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-teal-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{selectedUser.displayName || selectedUser.name}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email}</p>
                </div>
                <button onClick={() => { setSelectedUser(null); setQuery(""); }} className="text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {showNoResults && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-sm text-amber-700 font-medium">No users found for "{debouncedQuery}"</p>
                <p className="text-xs text-amber-600 mt-1">This user doesn't have an account yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => {
                    setCreateMode(true);
                    // Pre-fill email if the query looks like an email
                    if (debouncedQuery.includes("@")) setNewUserEmail(debouncedQuery);
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Create & Enroll New User
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Full Name <span className="text-red-500">*</span></Label>
              <Input
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Email Address <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={newUserEmail}
                onChange={e => setNewUserEmail(e.target.value)}
                placeholder="e.g. jane@example.com"
                className="mt-1"
              />
            </div>
            <p className="text-xs text-gray-400">
              A new account will be created. The user can sign in later using the same email address via OAuth.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {createMode ? (
            <>
              <Button variant="outline" onClick={() => setCreateMode(false)}>Back to Search</Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={!newUserName.trim() || !newUserEmail.trim() || createAndEnroll.isPending}
                onClick={handleCreateAndEnroll}
              >
                {createAndEnroll.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
                Create & Enroll
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={!selectedUser || addEnrollment.isPending}
                onClick={handleEnroll}
              >
                {addEnrollment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Enroll Student
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Course Analytics Tab ─────────────────────────────────────────────────────

function CourseAnalyticsTab({ courseId }: { courseId: number }) {
  const { data, isLoading } = trpc.lmsAdmin.getCourseAnalytics.useQuery({ courseId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return <div className="text-center py-12 text-gray-400">No analytics data available.</div>;

  const completionRate = data.totalEnrollments > 0
    ? Math.round((data.completedEnrollments / data.totalEnrollments) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Enrollments</p>
          <p className="text-2xl font-bold text-gray-900">{data.totalEnrollments}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Completions</p>
          <p className="text-2xl font-bold text-green-600">{data.completedEnrollments}</p>
          <p className="text-xs text-gray-400 mt-0.5">{completionRate}% completion rate</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Active Students</p>
          <p className="text-2xl font-bold text-blue-600">{data.activeEnrollments}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Revenue</p>
          <p className="text-2xl font-bold text-teal-600">${(data.totalRevenue / 100).toFixed(0)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{data.orders.length} orders</p>
        </div>
      </div>

      {/* Avg Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Average Student Progress</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-200 rounded-full h-3">
            <div className="h-3 bg-teal-500 rounded-full transition-all" style={{ width: `${data.avgProgress}%` }} />
          </div>
          <span className="text-sm font-bold text-teal-700 w-10 text-right">{data.avgProgress}%</span>
        </div>
      </div>

      {/* Monthly Enrollments */}
      {data.monthlyEnrollments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Monthly Enrollments (Last 12 Months)</p>
          <div className="flex items-end gap-1.5 h-24">
            {data.monthlyEnrollments.map((m: any) => {
              const maxCount = Math.max(...data.monthlyEnrollments.map((x: any) => Number(x.count)));
              const pct = maxCount > 0 ? (Number(m.count) / maxCount) * 100 : 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[9px] text-gray-500">{m.count}</span>
                  <div className="w-full bg-teal-500 rounded-t" style={{ height: `${Math.max(pct, 4)}%`, minHeight: "4px" }} />
                  <span className="text-[9px] text-gray-400 truncate w-full text-center">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lesson Completion Rates */}
      {data.lessonStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700">Lesson Completion Rates</p>
            <p className="text-xs text-gray-400 mt-0.5">Number of students who completed each lesson</p>
          </div>
          <div className="divide-y divide-gray-100">
            {data.lessonStats.map((section: any) => (
              <div key={section.id}>
                <div className="px-4 py-2 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{section.title}</p>
                </div>
                {section.lessons.map((lesson: any) => (
                  <div key={lesson.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-xs text-gray-600 flex-1 truncate">{lesson.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-24 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 bg-teal-500 rounded-full"
                          style={{ width: `${lesson.views > 0 ? Math.round((lesson.completions / lesson.views) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">
                        {lesson.completions}/{lesson.views} views
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {data.orders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700">Recent Orders</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Amount</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.orders.slice(0, 20).map((o: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-600">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs font-medium text-gray-900">${Number(o.amount).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <Badge className="text-xs bg-green-100 text-green-700">{o.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Pricing Options Editor ────────────────────────────────────────────────────
// Shown inside CourseSettingsForm — allows admin to add/edit/delete secondary
// pricing options (payment plans, group rates, etc.)

type PricingOption = {
  id: number;
  label: string;
  sublabel: string | null;
  pricingType: "one_time" | "subscription" | "payment_plan" | "free";
  price: number;
  stripePriceId: string | null;
  subscriptionInterval: "monthly" | "quarterly" | "annual" | null;
  downPayment: number | null;
  installmentCount: number | null;
  installmentAmount: number | null;
  installmentIntervalDays: number | null;
  ctaLabel: string | null;
  sortOrder: number;
  isActive: boolean;
};

function PricingOptionForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<PricingOption>;
  onSave: (data: Omit<PricingOption, "id" | "sortOrder">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [sublabel, setSublabel] = useState(initial?.sublabel ?? "");
  const [pricingType, setPricingType] = useState<PricingOption["pricingType"]>(initial?.pricingType ?? "one_time");
  const [price, setPrice] = useState(String(Number(initial?.price ?? 0).toFixed(2)));
  const [stripePriceId, setStripePriceId] = useState(initial?.stripePriceId ?? "");
  const [subscriptionInterval, setSubscriptionInterval] = useState<"monthly" | "quarterly" | "annual">(initial?.subscriptionInterval ?? "monthly");
  const [downPayment, setDownPayment] = useState(String(Number(initial?.downPayment ?? 0).toFixed(2)));
  const [installmentCount, setInstallmentCount] = useState(String(initial?.installmentCount ?? ""));
  const [installmentAmount, setInstallmentAmount] = useState(String(Number(initial?.installmentAmount ?? 0).toFixed(2)));
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState(String(initial?.installmentIntervalDays ?? 30));
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  return (
    <div className="border border-teal-200 rounded-lg p-4 bg-teal-50/30 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium">Label *</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. 3-Month Payment Plan" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium">Sub-label</Label>
          <Input value={sublabel} onChange={e => setSublabel(e.target.value)} placeholder="e.g. 3 × $99/month" className="mt-1 h-8 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium">Pricing Type</Label>
          <Select value={pricingType} onValueChange={v => setPricingType(v as any)}>
            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="one_time">One-Time Purchase</SelectItem>
              <SelectItem value="subscription">Subscription</SelectItem>
              <SelectItem value="payment_plan">Payment Plan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {pricingType !== "free" && pricingType !== "payment_plan" && (
          <div>
            <Label className="text-xs font-medium">Price (USD)</Label>
            <Input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
        )}
        {pricingType === "subscription" && (
          <div>
            <Label className="text-xs font-medium">Billing Interval</Label>
            <Select value={subscriptionInterval} onValueChange={v => setSubscriptionInterval(v as any)}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly (every 3 months)</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {pricingType === "payment_plan" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-medium">Down Payment ($)</Label>
            <Input type="number" step="0.01" min="0" value={downPayment} onChange={e => setDownPayment(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium">Installments</Label>
            <Input type="number" min="0" value={installmentCount} onChange={e => setInstallmentCount(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium">Amount Each ($)</Label>
            <Input type="number" step="0.01" min="0" value={installmentAmount} onChange={e => setInstallmentAmount(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium">Interval (days)</Label>
            <Input type="number" min="1" value={installmentIntervalDays} onChange={e => setInstallmentIntervalDays(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium">CTA Button Label (optional)</Label>
          <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="e.g. Start Payment Plan" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium">Stripe Price ID (optional)</Label>
          <Input value={stripePriceId} onChange={e => setStripePriceId(e.target.value)} placeholder="price_..." className="mt-1 h-8 text-sm font-mono" />
          <p className="text-xs text-gray-400 mt-0.5">If set, this Stripe Price is used directly at checkout.</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label className="text-xs">Active (visible on landing page)</Label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
            disabled={saving || !label.trim()}
            onClick={() => onSave({
              label: label.trim(),
              sublabel: sublabel.trim() || null,
              pricingType,
              price: pricingType === "free" ? 0 : parseFloat(price || "0"),
              stripePriceId: stripePriceId.trim() || null,
              subscriptionInterval: pricingType === "subscription" ? subscriptionInterval : null,
              downPayment: pricingType === "payment_plan" ? parseFloat(downPayment || "0") : null,
              installmentCount: pricingType === "payment_plan" ? parseInt(installmentCount || "0") : null,
              installmentAmount: pricingType === "payment_plan" ? parseFloat(installmentAmount || "0") : null,
              installmentIntervalDays: pricingType === "payment_plan" ? parseInt(installmentIntervalDays || "30") : null,
              ctaLabel: ctaLabel.trim() || null,
              isActive,
            })}
          >
            {saving ? "Saving..." : "Save Option"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CoursePricingOptionsEditor({ courseId }: { courseId: number }) {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: options = [], isLoading } = trpc.lmsGroup.listPricingOptions.useQuery({ courseId });

  const createOption = trpc.lmsGroup.createPricingOption.useMutation({
    onSuccess: () => { toast.success("Pricing option added"); setShowAdd(false); utils.lmsGroup.listPricingOptions.invalidate({ courseId }); },
    onError: e => toast.error(e.message),
  });

  const updateOption = trpc.lmsGroup.updatePricingOption.useMutation({
    onSuccess: () => { toast.success("Pricing option updated"); setEditingId(null); utils.lmsGroup.listPricingOptions.invalidate({ courseId }); },
    onError: e => toast.error(e.message),
  });

  const deleteOption = trpc.lmsGroup.deletePricingOption.useMutation({
    onSuccess: () => { toast.success("Pricing option removed"); utils.lmsGroup.listPricingOptions.invalidate({ courseId }); },
    onError: e => toast.error(e.message),
  });

  const toggleActive = (opt: PricingOption) => {
    updateOption.mutate({ id: opt.id, isActive: !opt.isActive });
  };

  const formatPrice = (opt: PricingOption) => {
    if (opt.pricingType === "free") return "Free";
    if (opt.pricingType === "payment_plan") {
      const dp = Number(opt.downPayment ?? 0).toFixed(2);
      const inst = Number(opt.installmentAmount ?? 0).toFixed(2);
      const n = opt.installmentCount ?? 0;
      return `$${dp} down + ${n}×$${inst}`;
    }
    if (opt.pricingType === "subscription") {
      return `$${Number(opt.price).toFixed(2)}/${opt.subscriptionInterval ?? "month"}`;
    }
    return `$${Number(opt.price).toFixed(2)}`;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-teal-600" /> Secondary Pricing Options
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs border-teal-300 text-teal-600 hover:bg-teal-50" onClick={() => { setShowAdd(true); setEditingId(null); }}>
          <Plus className="w-3 h-3 mr-1" /> Add Option
        </Button>
      </div>
      <p className="text-xs text-gray-400">Add payment plans, group rates, or alternate pricing. The primary course price is always the default CTA. These appear as selectable alternatives on the landing page.</p>

      {isLoading ? (
        <div className="space-y-2">{[0,1].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}</div>
      ) : options.length === 0 && !showAdd ? (
        <p className="text-xs text-gray-400 italic py-2">No secondary pricing options yet.</p>
      ) : (
        <div className="space-y-2">
          {(options as PricingOption[]).map((opt) => (
            <div key={opt.id}>
              {editingId === opt.id ? (
                <PricingOptionForm
                  initial={opt}
                  onSave={(data) => updateOption.mutate({ id: opt.id, label: data.label, sublabel: data.sublabel, pricingType: data.pricingType, price: data.price, stripePriceId: data.stripePriceId, subscriptionInterval: data.subscriptionInterval, downPayment: data.downPayment ?? undefined, installmentCount: data.installmentCount ?? undefined, installmentAmount: data.installmentAmount ?? undefined, installmentIntervalDays: data.installmentIntervalDays ?? undefined, ctaLabel: data.ctaLabel, isActive: data.isActive })}
                  onCancel={() => setEditingId(null)}
                  saving={updateOption.isPending}
                />
              ) : (
                <div className={`flex items-center gap-3 bg-white rounded-lg border px-3 py-2 ${opt.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{opt.label}</p>
                    <p className="text-xs text-gray-400">{formatPrice(opt)}{opt.sublabel ? ` · ${opt.sublabel}` : ""}{opt.ctaLabel ? ` · CTA: "${opt.ctaLabel}"` : ""}</p>
                  </div>
                  <Badge className={`text-xs ${opt.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {opt.isActive ? "Active" : "Hidden"}
                  </Badge>
                  <button onClick={() => toggleActive(opt)} className="text-xs text-gray-400 hover:text-gray-600 p-1" title={opt.isActive ? "Hide" : "Show"}>
                    {opt.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => { setEditingId(opt.id); setShowAdd(false); }} className="text-xs text-teal-500 hover:text-teal-700 p-1">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm("Delete this pricing option?")) deleteOption.mutate({ id: opt.id }); }} className="text-xs text-red-400 hover:text-red-600 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <PricingOptionForm
          onSave={(data) => createOption.mutate({ courseId, label: data.label, sublabel: data.sublabel ?? undefined, pricingType: data.pricingType, price: data.price, stripePriceId: data.stripePriceId ?? undefined, subscriptionInterval: data.subscriptionInterval ?? undefined, downPayment: data.downPayment ?? undefined, installmentCount: data.installmentCount ?? undefined, installmentAmount: data.installmentAmount ?? undefined, installmentIntervalDays: data.installmentIntervalDays ?? undefined, ctaLabel: data.ctaLabel ?? undefined, isActive: data.isActive, sortOrder: (options as PricingOption[]).length })}
          onCancel={() => setShowAdd(false)}
          saving={createOption.isPending}
        />
      )}
    </div>
  );
}

// ─── Question Bank Admin ──────────────────────────────────────────────────────

function QuestionBankAdmin() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<"" | "mcq" | "truefalse">("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [aiTopic, setAITopic] = useState("");
  const [aiCount, setAICount] = useState(10);
  const [aiDifficulty, setAIDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [aiType, setAIType] = useState<"mcq" | "truefalse" | "mixed">("mcq");
  const [aiTagIds, setAITagIds] = useState<number[]>([]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: tagsData } = trpc.questionBank.listTags.useQuery();
  const tags = tagsData ?? [];

  const { data, isLoading, refetch } = trpc.questionBank.listQuestions.useQuery({
    search: debouncedSearch || undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    type: typeFilter || undefined,
    page,
    pageSize: 25,
  });

  const deleteQ = trpc.questionBank.deleteQuestion.useMutation({ onSuccess: () => { refetch(); setSelectedIds(new Set()); } });
  const bulkDelete = trpc.questionBank.bulkDeleteQuestions.useMutation({ onSuccess: () => { refetch(); setSelectedIds(new Set()); } });
  const aiGenerate = trpc.questionBank.aiGenerateToBank.useMutation({ onSuccess: () => { refetch(); setShowAIPanel(false); setAITopic(""); } });
  const createTag = trpc.questionBank.createTag.useMutation({ onSuccess: () => refetch() });
  const deleteTag = trpc.questionBank.deleteTag.useMutation({ onSuccess: () => refetch() });

  const questions = data?.questions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Database className="w-5 h-5 text-teal-600" /> Question Bank</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} question{total !== 1 ? "s" : ""} total</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowTagManager(p => !p)} className="gap-1.5"><Tag className="w-3.5 h-3.5" /> Tags</Button>
          <Button size="sm" variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50 gap-1.5" onClick={() => setShowAIPanel(p => !p)}><Sparkles className="w-3.5 h-3.5" /> AI Generate</Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> Add Question</Button>
        </div>
      </div>

      {/* Tag Manager */}
      {showTagManager && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">Manage Tags</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowTagManager(false)}><X className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>
                {tag.name}
                <button onClick={() => { if (confirm(`Delete tag "${tag.name}"?`)) deleteTag.mutate({ id: tag.id }); }} className="ml-1 hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input id="new-tag-name" placeholder="New tag name..." className="h-8 text-sm flex-1" />
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => {
              const val = (document.getElementById("new-tag-name") as HTMLInputElement)?.value?.trim();
              if (val) createTag.mutate({ name: val });
            }}>Add</Button>
          </div>
        </div>
      )}

      {/* AI Generate Panel */}
      {showAIPanel && (
        <div className="border border-purple-200 rounded-xl p-5 bg-purple-50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-purple-800 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Question Generator</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowAIPanel(false)}><X className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs font-medium text-purple-700 mb-1 block">Topic *</Label>
              <Input value={aiTopic} onChange={e => setAITopic(e.target.value)} placeholder="e.g. Doppler physics, DVT diagnosis, Normal fetal echo anatomy" className="bg-white border-purple-200" />
            </div>
            <div>
              <Label className="text-xs font-medium text-purple-700 mb-1 block">Number of Questions</Label>
              <select value={aiCount} onChange={e => setAICount(Number(e.target.value))} className="w-full h-9 rounded-md border border-purple-200 bg-white px-3 text-sm">
                {[5, 10, 15, 20, 25, 30, 50].map(n => <option key={n} value={n}>{n} questions</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-purple-700 mb-1 block">Difficulty</Label>
              <select value={aiDifficulty} onChange={e => setAIDifficulty(e.target.value as any)} className="w-full h-9 rounded-md border border-purple-200 bg-white px-3 text-sm">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-purple-700 mb-1 block">Question Type</Label>
              <select value={aiType} onChange={e => setAIType(e.target.value as any)} className="w-full h-9 rounded-md border border-purple-200 bg-white px-3 text-sm">
                <option value="mcq">Multiple Choice</option>
                <option value="truefalse">True / False</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-purple-700 mb-1 block">Tags (optional)</Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <button key={tag.id} onClick={() => setAITagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                    className={cn("px-2 py-0.5 rounded-full text-xs font-medium border transition-all", aiTagIds.includes(tag.id) ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200")}
                    style={aiTagIds.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}>
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5" disabled={!aiTopic.trim() || aiGenerate.isPending}
              onClick={() => aiGenerate.mutate({ topic: aiTopic, count: aiCount, difficulty: aiDifficulty, questionType: aiType, tagIds: aiTagIds.length > 0 ? aiTagIds : undefined })}>
              {aiGenerate.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><Sparkles className="w-3.5 h-3.5" /> Generate & Add to Bank</>}
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search questions..." className="h-9 pl-8 text-sm" />
          <Eye className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as any); setPage(1); }} className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
          <option value="">All Types</option>
          <option value="mcq">Multiple Choice</option>
          <option value="truefalse">True / False</option>
        </select>
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <button key={tag.id} onClick={() => { setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]); setPage(1); }}
              className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-all", selectedTagIds.includes(tag.id) ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200")}
              style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}>
              {tag.name}
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 gap-1.5 ml-auto"
            onClick={() => { if (confirm(`Delete ${selectedIds.size} question(s)?`)) bulkDelete.mutate({ ids: [...selectedIds] }); }}>
            <Trash2 className="w-3.5 h-3.5" /> Delete {selectedIds.size} selected
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Database className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">No questions yet</p>
            <p className="text-sm mt-1">Add questions manually or use AI Generate to populate the bank.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8 px-3 py-2.5"><input type="checkbox" checked={selectedIds.size === questions.length && questions.length > 0} onChange={e => setSelectedIds(e.target.checked ? new Set(questions.map(q => q.id)) : new Set())} className="rounded" /></th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">Question</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 w-24">Type</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 w-40">Tags</th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {questions.map(q => (
                <tr key={q.id} className={cn("hover:bg-gray-50 transition-colors", selectedIds.has(q.id) && "bg-teal-50")}>
                  <td className="px-3 py-2.5"><input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => toggleSelect(q.id)} className="rounded" /></td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-gray-800 line-clamp-2">{q.question}</p>
                    {q.explanation && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">Explanation: {q.explanation}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", q.type === "mcq" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                      {q.type === "mcq" ? "MCQ" : "T/F"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(q.tags ?? []).map((tag: any) => (
                        <span key={tag.id} className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingQuestion(q)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { if (confirm("Delete this question?")) deleteQ.mutate({ id: q.id }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      {(showCreate || editingQuestion) && (
        <QuestionBankEditDialog
          question={editingQuestion}
          tags={tags}
          onClose={() => { setShowCreate(false); setEditingQuestion(null); }}
          onSaved={() => { refetch(); setShowCreate(false); setEditingQuestion(null); }}
        />
      )}
    </div>
  );
}

// ─── Question Bank Edit Dialog ────────────────────────────────────────────────

function QuestionBankEditDialog({ question, tags, onClose, onSaved }: {
  question: any | null;
  tags: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!question;
  const [qText, setQText] = useState(question?.question ?? "");
  const [qType, setQType] = useState<"mcq" | "truefalse">(question?.type ?? "mcq");
  const [options, setOptions] = useState<{ text: string; imageUrl?: string; videoUrl?: string }[]>(
    question?.options?.length > 0 ? question.options : [{ text: "" }, { text: "" }, { text: "" }, { text: "" }]
  );
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [qImageUrl, setQImageUrl] = useState(question?.questionImageUrl ?? "");
  const [qVideoUrl, setQVideoUrl] = useState(question?.questionVideoUrl ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(question?.tags?.map((t: any) => t.id) ?? []);

  const create = trpc.questionBank.createQuestion.useMutation({ onSuccess: onSaved });
  const update = trpc.questionBank.updateQuestion.useMutation({ onSuccess: onSaved });

  const handleSave = () => {
    if (!qText.trim()) return;
    const payload = {
      question: qText.trim(),
      type: qType,
      options: qType === "mcq" ? options.filter(o => o.text.trim()) : [{ text: "True" }, { text: "False" }],
      correctAnswer: correctAnswer.trim(),
      explanation: explanation.trim() || undefined,
      questionImageUrl: qImageUrl.trim() || undefined,
      questionVideoUrl: qVideoUrl.trim() || undefined,
      tagIds: selectedTagIds,
    };
    if (isEdit) update.mutate({ id: question.id, ...payload });
    else create.mutate(payload);
  };

  const isPending = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{isEdit ? "Edit Question" : "Add Question"}</h3>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-5 space-y-4">
          {/* Type */}
          <div className="flex gap-2">
            {(["mcq", "truefalse"] as const).map(t => (
              <button key={t} onClick={() => setQType(t)} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium border transition-all", qType === t ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300")}>
                {t === "mcq" ? "Multiple Choice" : "True / False"}
              </button>
            ))}
          </div>

          {/* Question text */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Question *</Label>
            <textarea value={qText} onChange={e => setQText(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Enter the question..." />
          </div>

          {/* Question media */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Question Image URL (optional)</Label>
              <Input value={qImageUrl} onChange={e => setQImageUrl(e.target.value)} placeholder="https://..." className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Question Video URL (optional)</Label>
              <Input value={qVideoUrl} onChange={e => setQVideoUrl(e.target.value)} placeholder="https://..." className="h-8 text-sm" />
            </div>
          </div>

          {/* Options (MCQ) */}
          {qType === "mcq" && (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Answer Options</Label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" checked={correctAnswer === opt.text} onChange={() => setCorrectAnswer(opt.text)} className="accent-teal-600" />
                    <Input value={opt.text} onChange={e => setOptions(prev => prev.map((o, j) => j === i ? { ...o, text: e.target.value } : o))} placeholder={`Option ${i + 1}`} className="h-8 text-sm flex-1" />
                    <Input value={opt.imageUrl ?? ""} onChange={e => setOptions(prev => prev.map((o, j) => j === i ? { ...o, imageUrl: e.target.value } : o))} placeholder="Image URL (opt.)" className="h-8 text-sm w-36" />
                    {options.length > 2 && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}><X className="w-3.5 h-3.5" /></Button>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setOptions(prev => [...prev, { text: "" }])}><Plus className="w-3 h-3" /> Add Option</Button>
              </div>
            </div>
          )}

          {/* True/False correct answer */}
          {qType === "truefalse" && (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Correct Answer</Label>
              <div className="flex gap-3">
                {["True", "False"].map(v => (
                  <button key={v} onClick={() => setCorrectAnswer(v)} className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-all", correctAnswer === v ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300")}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Explanation (optional)</Label>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Explain the correct answer..." />
          </div>

          {/* Tags */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button key={tag.id} onClick={() => setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                  className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-all", selectedTagIds.includes(tag.id) ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200")}
                  style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}>
                  {tag.name}
                </button>
              ))}
              {tags.length === 0 && <span className="text-xs text-gray-400">No tags yet — create some in the Tags panel.</span>}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!qText.trim() || !correctAnswer.trim() || isPending} onClick={handleSave}>
            {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Saving...</> : isEdit ? "Save Changes" : "Add to Bank"}
          </Button>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// CohortTab — Sessions & Assignments manager for cohort-type courses
// ─────────────────────────────────────────────────────────────────────────────

type CohortSession = {
  id: number;
  courseId: number;
  title: string;
  description: string | null;
  sessionDate: Date | string;
  durationMinutes: number;
  meetingUrl: string | null;
  recordingUrl: string | null;
  status: "draft" | "published" | "cancelled";
};

type CohortAssignment = {
  id: number;
  courseId: number;
  title: string;
  description: string | null;
  dueDate: Date | string | null;
  maxPoints: number;
  submissionType: "text" | "file" | "url" | "none";
  status: "draft" | "published";
  position: number;
};

function CohortTab({ courseId }: { courseId: number }) {
  const [activeTab, setActiveTab] = useState<"sessions" | "assignments">("sessions");
  const utils = trpc.useUtils();

  // Sessions
  const { data: sessions = [], isLoading: sessionsLoading } = trpc.lmsAdmin.listCohortSessions.useQuery({ courseId });
  const createSession = trpc.lmsAdmin.createCohortSession.useMutation({
    onSuccess: () => { utils.lmsAdmin.listCohortSessions.invalidate({ courseId }); toast.success("Session created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateSession = trpc.lmsAdmin.updateCohortSession.useMutation({
    onSuccess: () => { utils.lmsAdmin.listCohortSessions.invalidate({ courseId }); toast.success("Session updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSession = trpc.lmsAdmin.deleteCohortSession.useMutation({
    onSuccess: () => { utils.lmsAdmin.listCohortSessions.invalidate({ courseId }); toast.success("Session deleted"); },
    onError: (e) => toast.error(e.message),
  });

  // Assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = trpc.lmsAdmin.listCohortAssignments.useQuery({ courseId });
  const createAssignment = trpc.lmsAdmin.createCohortAssignment.useMutation({
    onSuccess: () => { utils.lmsAdmin.listCohortAssignments.invalidate({ courseId }); toast.success("Assignment created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateAssignment = trpc.lmsAdmin.updateCohortAssignment.useMutation({
    onSuccess: () => { utils.lmsAdmin.listCohortAssignments.invalidate({ courseId }); toast.success("Assignment updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteAssignment = trpc.lmsAdmin.deleteCohortAssignment.useMutation({
    onSuccess: () => { utils.lmsAdmin.listCohortAssignments.invalidate({ courseId }); toast.success("Assignment deleted"); },
    onError: (e) => toast.error(e.message),
  });

  // Session dialog state
  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; session?: CohortSession }>({ open: false });
  const [sessionForm, setSessionForm] = useState({
    title: "", description: "", sessionDate: "", durationMinutes: 60,
    meetingUrl: "", recordingUrl: "", status: "draft" as "draft" | "published" | "cancelled",
  });

  const openSessionDialog = (session?: CohortSession) => {
    if (session) {
      const d = new Date(session.sessionDate);
      const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setSessionForm({
        title: session.title,
        description: session.description ?? "",
        sessionDate: localISO,
        durationMinutes: session.durationMinutes,
        meetingUrl: session.meetingUrl ?? "",
        recordingUrl: session.recordingUrl ?? "",
        status: session.status,
      });
    } else {
      setSessionForm({ title: "", description: "", sessionDate: "", durationMinutes: 60, meetingUrl: "", recordingUrl: "", status: "draft" });
    }
    setSessionDialog({ open: true, session });
  };

  const handleSaveSession = () => {
    if (!sessionForm.title.trim() || !sessionForm.sessionDate) {
      toast.error("Title and date are required"); return;
    }
    const payload = {
      title: sessionForm.title.trim(),
      description: sessionForm.description || undefined,
      sessionDate: new Date(sessionForm.sessionDate).toISOString(),
      durationMinutes: sessionForm.durationMinutes,
      meetingUrl: sessionForm.meetingUrl || undefined,
      recordingUrl: sessionForm.recordingUrl || undefined,
      status: sessionForm.status,
    };
    if (sessionDialog.session) {
      updateSession.mutate({ id: sessionDialog.session.id, ...payload }, { onSuccess: () => setSessionDialog({ open: false }) });
    } else {
      createSession.mutate({ courseId, ...payload }, { onSuccess: () => setSessionDialog({ open: false }) });
    }
  };

  // Assignment dialog state
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; assignment?: CohortAssignment }>({ open: false });
  const [assignForm, setAssignForm] = useState({
    title: "", description: "", dueDate: "", maxPoints: 100,
    submissionType: "none" as "text" | "file" | "url" | "none",
    status: "draft" as "draft" | "published",
  });

  const openAssignDialog = (assignment?: CohortAssignment) => {
    if (assignment) {
      const d = assignment.dueDate ? new Date(assignment.dueDate) : null;
      const localISO = d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
      setAssignForm({
        title: assignment.title,
        description: assignment.description ?? "",
        dueDate: localISO,
        maxPoints: assignment.maxPoints,
        submissionType: assignment.submissionType,
        status: assignment.status,
      });
    } else {
      setAssignForm({ title: "", description: "", dueDate: "", maxPoints: 100, submissionType: "none", status: "draft" });
    }
    setAssignDialog({ open: true, assignment });
  };

  const handleSaveAssignment = () => {
    if (!assignForm.title.trim()) { toast.error("Title is required"); return; }
    const payload = {
      title: assignForm.title.trim(),
      description: assignForm.description || undefined,
      dueDate: assignForm.dueDate ? new Date(assignForm.dueDate).toISOString() : null,
      maxPoints: assignForm.maxPoints,
      submissionType: assignForm.submissionType,
      status: assignForm.status,
    };
    if (assignDialog.assignment) {
      updateAssignment.mutate({ id: assignDialog.assignment.id, ...payload }, { onSuccess: () => setAssignDialog({ open: false }) });
    } else {
      createAssignment.mutate({ courseId, ...payload }, { onSuccess: () => setAssignDialog({ open: false }) });
    }
  };

  const fmtDate = (d: Date | string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      published: "bg-green-100 text-green-700",
      draft: "bg-gray-100 text-gray-600",
      cancelled: "bg-red-100 text-red-600",
    };
    return <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", map[status] ?? "bg-gray-100 text-gray-600")}>{status}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {(["sessions", "assignments"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize",
              activeTab === t ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700")}>
            {t === "sessions" ? "Live Sessions" : "Assignments"}
          </button>
        ))}
      </div>

      {/* Sessions */}
      {activeTab === "sessions" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Manage live sessions, coaching calls, and recorded replays for this cohort.</p>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => openSessionDialog()}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Session
            </Button>
          </div>

          {sessionsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Radio className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No sessions yet — add your first live session above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(sessions as CohortSession[]).map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <Radio className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{s.title}</span>
                      {statusBadge(s.status)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(s.sessionDate)}</span>
                      <span>{s.durationMinutes} min</span>
                      {s.meetingUrl && <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1"><LinkIcon className="w-3 h-3" />Meeting Link</a>}
                      {s.recordingUrl && <a href={s.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1"><PlayCircle className="w-3 h-3" />Recording</a>}
                    </div>
                    {s.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openSessionDialog(s)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => {
                      if (confirm("Delete this session?")) deleteSession.mutate({ id: s.id });
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assignments */}
      {activeTab === "assignments" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Manage assignments, homework, and projects for cohort participants.</p>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => openAssignDialog()}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Assignment
            </Button>
          </div>

          {assignmentsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No assignments yet — add your first assignment above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(assignments as CohortAssignment[]).map(a => (
                <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <ListChecks className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{a.title}</span>
                      {statusBadge(a.status)}
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{a.submissionType !== "none" ? `${a.submissionType} submission` : "No submission"}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      {a.dueDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due: {fmtDate(a.dueDate)}</span>}
                      <span>{a.maxPoints} pts</span>
                    </div>
                    {a.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{a.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openAssignDialog(a)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => {
                      if (confirm("Delete this assignment?")) deleteAssignment.mutate({ id: a.id });
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session Dialog */}
      {sessionDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{sessionDialog.session ? "Edit Session" : "Add Live Session"}</h3>
              <Button size="sm" variant="ghost" onClick={() => setSessionDialog({ open: false })}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Session Title *</Label>
                <Input value={sessionForm.title} onChange={e => setSessionForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Week 1: Introduction to Cardiac Assessment" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">Date & Time *</Label>
                  <Input type="datetime-local" value={sessionForm.sessionDate} onChange={e => setSessionForm(p => ({ ...p, sessionDate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">Duration (minutes)</Label>
                  <Input type="number" min={1} value={sessionForm.durationMinutes} onChange={e => setSessionForm(p => ({ ...p, durationMinutes: parseInt(e.target.value) || 60 }))} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Meeting URL</Label>
                <Input value={sessionForm.meetingUrl} onChange={e => setSessionForm(p => ({ ...p, meetingUrl: e.target.value }))} placeholder="https://zoom.us/j/..." />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Recording URL (after session)</Label>
                <Input value={sessionForm.recordingUrl} onChange={e => setSessionForm(p => ({ ...p, recordingUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Description</Label>
                <textarea value={sessionForm.description} onChange={e => setSessionForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="What will be covered in this session..." />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Status</Label>
                <Select value={sessionForm.status} onValueChange={v => setSessionForm(p => ({ ...p, status: v as "draft" | "published" | "cancelled" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft (hidden from students)</SelectItem>
                    <SelectItem value="published">Published (visible to enrolled students)</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <Button variant="outline" onClick={() => setSessionDialog({ open: false })}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={createSession.isPending || updateSession.isPending}
                onClick={handleSaveSession}>
                {(createSession.isPending || updateSession.isPending) ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Saving...</> : sessionDialog.session ? "Save Changes" : "Create Session"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Dialog */}
      {assignDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{assignDialog.assignment ? "Edit Assignment" : "Add Assignment"}</h3>
              <Button size="sm" variant="ghost" onClick={() => setAssignDialog({ open: false })}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Assignment Title *</Label>
                <Input value={assignForm.title} onChange={e => setAssignForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Case Study: Aortic Stenosis Assessment" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">Due Date</Label>
                  <Input type="datetime-local" value={assignForm.dueDate} onChange={e => setAssignForm(p => ({ ...p, dueDate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">Max Points</Label>
                  <Input type="number" min={0} value={assignForm.maxPoints} onChange={e => setAssignForm(p => ({ ...p, maxPoints: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Submission Type</Label>
                <Select value={assignForm.submissionType} onValueChange={v => setAssignForm(p => ({ ...p, submissionType: v as "text" | "file" | "url" | "none" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No submission required</SelectItem>
                    <SelectItem value="text">Text response</SelectItem>
                    <SelectItem value="file">File upload</SelectItem>
                    <SelectItem value="url">URL / link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Description / Instructions</Label>
                <textarea value={assignForm.description} onChange={e => setAssignForm(p => ({ ...p, description: e.target.value }))} rows={4} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Describe the assignment and what students need to do..." />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Status</Label>
                <Select value={assignForm.status} onValueChange={v => setAssignForm(p => ({ ...p, status: v as "draft" | "published" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft (hidden from students)</SelectItem>
                    <SelectItem value="published">Published (visible to enrolled students)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <Button variant="outline" onClick={() => setAssignDialog({ open: false })}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={createAssignment.isPending || updateAssignment.isPending}
                onClick={handleSaveAssignment}>
                {(createAssignment.isPending || updateAssignment.isPending) ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Saving...</> : assignDialog.assignment ? "Save Changes" : "Create Assignment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
