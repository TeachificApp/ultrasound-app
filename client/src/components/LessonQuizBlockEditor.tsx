import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Database, Search, Video, Image as ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export interface QuizAnswer {
  text: string;
  imageUrl?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answerImages?: (string | undefined)[];
  correctAnswer: number;
  explanation?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface LessonQuizData {
  title?: string;
  questions: QuizQuestion[];
  showExplanations?: boolean;
  passingScore?: number;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  requirePassToComplete?: boolean;
}

interface Props {
  data: LessonQuizData;
  onChange: (data: LessonQuizData) => void;
  handleFileUpload?: (file: File, targetField: string, context: string) => Promise<string | null>;
  lessonId?: number;
  courseId?: number;
}

const EMPTY_QUESTION: QuizQuestion = {
  question: "",
  options: ["", "", "", ""],
  answerImages: [undefined, undefined, undefined, undefined],
  correctAnswer: 0,
  explanation: "",
};

// ─── Question Editor ──────────────────────────────────────────────────────────

function QuestionEditor({
  question,
  index,
  isNew,
  handleFileUpload,
  onSave,
  onCancel,
}: {
  question: QuizQuestion;
  index: number | null;
  isNew: boolean;
  handleFileUpload?: Props["handleFileUpload"];
  onSave: (q: QuizQuestion) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState<QuizQuestion>({
    ...question,
    options: [...question.options],
    answerImages: question.answerImages ? [...question.answerImages] : Array(question.options.length).fill(undefined),
  });
  const imgRef = useRef<HTMLInputElement | null>(null);
  const ansImgRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload) return;
    const url = await handleFileUpload(file, "imageUrl", "quiz_question");
    if (url) setQ(prev => ({ ...prev, imageUrl: url }));
  };

  const handleAnswerImage = async (e: React.ChangeEvent<HTMLInputElement>, j: number) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload) return;
    const url = await handleFileUpload(file, `answerImage_${j}`, "quiz_answer");
    if (url) {
      const imgs = [...(q.answerImages ?? Array(q.options.length).fill(undefined))];
      imgs[j] = url;
      setQ(prev => ({ ...prev, answerImages: imgs }));
    }
  };

  return (
    <div className="p-3 bg-white border border-teal-200 rounded-lg space-y-2 mt-2">
      <p className="text-xs font-semibold text-gray-700">
        {isNew ? "New Question" : `Edit Question ${(index ?? 0) + 1}`}
      </p>

      {/* Question text */}
      <div>
        <Label className="text-xs text-gray-600">Question</Label>
        <Textarea
          value={q.question}
          onChange={(e) => setQ(prev => ({ ...prev, question: e.target.value }))}
          placeholder="Enter question text…"
          className="text-sm mt-1 min-h-[60px]"
        />
      </div>

      {/* Question image */}
      {handleFileUpload && (
        <div>
          <Label className="text-xs text-gray-600">Question Image (optional)</Label>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {q.imageUrl && (
              <img src={q.imageUrl} alt="" className="h-12 w-auto rounded border border-gray-200 object-cover" />
            )}
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => imgRef.current?.click()}>
              <ImageIcon size={11} className="mr-1" /> {q.imageUrl ? "Change" : "Add Image"}
            </Button>
            {q.imageUrl && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-500"
                onClick={() => setQ(prev => ({ ...prev, imageUrl: undefined }))}>Remove</Button>
            )}
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </div>
        </div>
      )}

      {/* Question video URL */}
      <div>
        <Label className="text-xs text-gray-600">Question Video URL (optional)</Label>
        <div className="flex items-center gap-2 mt-1">
          <Video size={12} className="text-gray-400 shrink-0" />
          <Input
            value={q.videoUrl ?? ""}
            onChange={(e) => setQ(prev => ({ ...prev, videoUrl: e.target.value || undefined }))}
            placeholder="https://youtube.com/watch?v=… or direct MP4 URL"
            className="h-8 text-xs flex-1"
          />
          {q.videoUrl && (
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-500 shrink-0"
              onClick={() => setQ(prev => ({ ...prev, videoUrl: undefined }))}>✕</Button>
          )}
        </div>
      </div>

      {/* Answer options */}
      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Answer Options (click circle to mark correct)</Label>
        {q.options.map((opt, j) => (
          <div key={j} className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQ(prev => ({ ...prev, correctAnswer: j }))}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  j === q.correctAnswer
                    ? "border-teal-500 bg-teal-500 text-white"
                    : "border-gray-300 text-gray-400 hover:border-teal-400"
                }`}
                title="Mark as correct"
              >
                {["A", "B", "C", "D"][j]}
              </button>
              <Input
                value={opt}
                onChange={(e) => {
                  const opts = [...q.options];
                  opts[j] = e.target.value;
                  setQ(prev => ({ ...prev, options: opts }));
                }}
                placeholder={`Option ${["A", "B", "C", "D"][j]}`}
                className="h-8 text-sm flex-1"
              />
            </div>
            {/* Per-answer image */}
            {handleFileUpload && (
              <div className="ml-8 flex items-center gap-2 flex-wrap">
                {q.answerImages?.[j] && (
                  <img src={q.answerImages[j]} alt="" className="h-8 w-auto rounded border border-gray-200 object-cover" />
                )}
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-teal-600 flex items-center gap-1"
                  onClick={() => ansImgRefs.current[j]?.click()}
                >
                  <ImageIcon size={10} /> {q.answerImages?.[j] ? "Change image" : "Add image"}
                </button>
                {q.answerImages?.[j] && (
                  <button type="button" className="text-xs text-red-400 hover:text-red-600"
                    onClick={() => {
                      const imgs = [...(q.answerImages ?? Array(q.options.length).fill(undefined))];
                      imgs[j] = undefined;
                      setQ(prev => ({ ...prev, answerImages: imgs }));
                    }}>✕</button>
                )}
                <input
                  ref={el => { ansImgRefs.current[j] = el; }}
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleAnswerImage(e, j)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Explanation */}
      <div>
        <Label className="text-xs text-gray-600">Explanation (optional)</Label>
        <Textarea
          value={q.explanation ?? ""}
          onChange={(e) => setQ(prev => ({ ...prev, explanation: e.target.value }))}
          placeholder="Explain why the correct answer is correct…"
          className="text-sm mt-1 min-h-[50px]"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={() => onSave(q)}>
          {isNew ? "Add Question" : "Save Changes"}
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LessonQuizBlockEditor({ data, onChange, handleFileUpload, lessonId, courseId }: Props) {
  const [addTab, setAddTab] = useState<"ai" | "manual" | "bank">("manual");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [aiCount, setAiCount] = useState(5);
  const [aiStyle, setAiStyle] = useState<"understanding" | "thinking" | "compliance" | "thought_provoking" | "reflection" | "custom">("understanding");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiPreview, setAiPreview] = useState<QuizQuestion[] | null>(null);
  const [editingAiIndex, setEditingAiIndex] = useState<number | null>(null);

  // AI source selection
  const [aiSource, setAiSource] = useState<"lesson" | "course" | "pick">("lesson");
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);

  // Fetch course lessons for "pick" mode
  const { data: courseLessonsData } = trpc.lmsAdmin.listCourseLessons.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId && (aiSource === "pick" || aiSource === "course") }
  );
  const courseLessons = courseLessonsData ?? [];

  const generateMutation = trpc.lmsGroup.generateQuizFromLesson.useMutation({
    onSuccess: (res) => {
      setAiPreview(res.questions);
      toast.success(`Generated ${res.questions.length} questions — review, edit, then apply below.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const set = (key: keyof LessonQuizData, value: any) => onChange({ ...data, [key]: value });
  const requirePass = data.requirePassToComplete ?? true;
  const questions = data.questions ?? [];

  const saveQuestion = (q: QuizQuestion) => {
    const qs = [...questions];
    if (editingIndex === null) { qs.push(q); } else { qs[editingIndex] = q; }
    set("questions", qs);
    setEditingIndex(null);
    setAddingNew(false);
  };

  const deleteQuestion = (i: number) => {
    const qs = [...questions];
    qs.splice(i, 1);
    set("questions", qs);
    if (editingIndex === i) setEditingIndex(null);
  };

  const saveAiEdit = (q: QuizQuestion) => {
    if (editingAiIndex === null || !aiPreview) return;
    const updated = [...aiPreview];
    updated[editingAiIndex] = q;
    setAiPreview(updated);
    setEditingAiIndex(null);
  };

  const applyAiPreview = () => {
    if (!aiPreview) return;
    set("questions", [...questions, ...aiPreview]);
    setAiPreview(null);
    toast.success("Questions added to quiz.");
  };

  const handleGenerate = () => {
    const payload: any = { count: aiCount, questionStyle: aiStyle, customPrompt: aiStyle === "custom" ? aiCustomPrompt : undefined };
    if (aiSource === "lesson" && lessonId) {
      payload.lessonId = lessonId;
    } else if (aiSource === "course" && courseId) {
      payload.courseId = courseId;
    } else if (aiSource === "pick" && selectedLessonIds.length > 0) {
      payload.lessonIds = selectedLessonIds;
    } else {
      toast.error("Please select a source for AI generation.");
      return;
    }
    generateMutation.mutate(payload);
  };

  const canGenerate = aiSource === "lesson" ? !!lessonId
    : aiSource === "course" ? !!courseId
    : selectedLessonIds.length > 0;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <Label className="text-xs text-gray-600">Quiz Title</Label>
        <Input value={data.title ?? ""} onChange={(e) => set("title", e.target.value)}
          placeholder="Knowledge Check" className="h-8 text-sm mt-1" />
      </div>

      {/* Require pass toggle */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div>
          <p className="text-xs font-medium text-gray-700">Require Pass to Complete</p>
          <p className="text-xs text-gray-400 mt-0.5">Student must reach passing score to mark lesson complete</p>
        </div>
        <Switch checked={requirePass} onCheckedChange={(v) => set("requirePassToComplete", v)} />
      </div>

      {/* Passing score */}
      {requirePass && (
        <div>
          <Label className="text-xs text-gray-600">Passing Score (%)</Label>
          <Input type="number" min={0} max={100} value={data.passingScore ?? 70}
            onChange={(e) => set("passingScore", Number(e.target.value))}
            className="h-8 text-sm mt-1 w-28" />
        </div>
      )}

      {/* Toggles */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch id="showExp" checked={data.showExplanations ?? true} onCheckedChange={(v) => set("showExplanations", v)} />
          <Label htmlFor="showExp" className="text-xs text-gray-600">Show Explanations</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="shuffleQ" checked={data.shuffleQuestions ?? false} onCheckedChange={(v) => set("shuffleQuestions", v)} />
          <Label htmlFor="shuffleQ" className="text-xs text-gray-600">Shuffle Questions</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="shuffleA" checked={data.shuffleAnswers ?? false} onCheckedChange={(v) => set("shuffleAnswers", v)} />
          <Label htmlFor="shuffleA" className="text-xs text-gray-600">Shuffle Answers</Label>
        </div>
      </div>

      {/* Existing questions */}
      {questions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Questions ({questions.length})</p>
          {questions.map((q, i) => (
            <div key={i}>
              <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                <span className="text-gray-400 font-medium shrink-0 mt-0.5">{i + 1}.</span>
                {q.imageUrl && <img src={q.imageUrl} alt="" className="h-8 w-auto rounded border border-gray-200 object-cover shrink-0" />}
                <p className="font-medium text-gray-700 flex-1 min-w-0 break-words">{q.question}</p>
                <div className="flex gap-1 shrink-0">
                  <button type="button" className="p-1 rounded hover:bg-teal-50 text-teal-600 transition-colors" title="Edit question"
                    onClick={() => { setAddingNew(false); setEditingIndex(editingIndex === i ? null : i); }}>
                    <Pencil size={12} />
                  </button>
                  <button type="button" className="p-1 rounded hover:bg-red-50 text-red-400 transition-colors" title="Delete question"
                    onClick={() => deleteQuestion(i)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {editingIndex === i && (
                <QuestionEditor question={q} index={i} isNew={false} handleFileUpload={handleFileUpload}
                  onSave={saveQuestion} onCancel={() => setEditingIndex(null)} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* New question form */}
      {addingNew && editingIndex === null && (
        <QuestionEditor question={{ ...EMPTY_QUESTION, options: ["", "", "", ""], answerImages: [undefined, undefined, undefined, undefined] }}
          index={null} isNew={true} handleFileUpload={handleFileUpload}
          onSave={saveQuestion} onCancel={() => setAddingNew(false)} />
      )}

      {/* Add / AI tabs */}
      {!addingNew && editingIndex === null && (
        <Tabs value={addTab} onValueChange={(v) => setAddTab(v as "ai" | "manual" | "bank")}>
          <TabsList className="h-8">
            <TabsTrigger value="manual" className="text-xs h-7">Manual Entry</TabsTrigger>
            <TabsTrigger value="bank" className="text-xs h-7">From Bank</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs h-7">AI Generate</TabsTrigger>
          </TabsList>

          {/* From Bank */}
          <TabsContent value="bank" className="mt-2">
            <QuestionBankPicker onAdd={(bankQ) => {
              const opts = Array.isArray(bankQ.options)
                ? bankQ.options.map((o: any) => (typeof o === "string" ? o : o.text ?? ""))
                : ["True", "False"];
              const correctIdx = opts.findIndex((o: string) => o === bankQ.correctAnswer);
              const q: QuizQuestion = {
                question: bankQ.question,
                options: opts.length > 0 ? opts : ["True", "False"],
                correctAnswer: correctIdx >= 0 ? correctIdx : 0,
                explanation: bankQ.explanation ?? "",
                imageUrl: bankQ.questionImageUrl ?? undefined,
                videoUrl: bankQ.questionVideoUrl ?? undefined,
              };
              set("questions", [...questions, q]);
              toast.success("Question added from bank.");
            }} />
          </TabsContent>

          {/* Manual */}
          <TabsContent value="manual" className="mt-2">
            <Button size="sm" variant="outline" className="h-8 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 w-full"
              onClick={() => setAddingNew(true)}>
              <Plus size={12} className="mr-1" /> Add Question
            </Button>
          </TabsContent>

          {/* AI Generate */}
          <TabsContent value="ai" className="mt-3 space-y-3">
            {/* Source selector */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 font-medium">Generate from:</Label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { value: "lesson", label: "Current Lesson", disabled: !lessonId },
                  { value: "course", label: "Entire Course", disabled: !courseId },
                  { value: "pick", label: "Pick Lessons", disabled: !courseId },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => setAiSource(opt.value as typeof aiSource)}
                    className={`text-xs px-2 py-1.5 rounded border transition-all ${
                      aiSource === opt.value
                        ? "bg-teal-600 text-white border-teal-600"
                        : opt.disabled
                        ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                        : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {!lessonId && !courseId && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">Save the lesson first to enable AI generation.</p>
              )}
            </div>

            {/* Lesson picker for "pick" mode */}
            {aiSource === "pick" && courseId && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Select lessons to generate from:</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded p-2 bg-gray-50">
                  {courseLessons.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Loading lessons…</p>
                  ) : (
                    courseLessons.map((l: any) => (
                      <div key={l.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`lesson-${l.id}`}
                          checked={selectedLessonIds.includes(l.id)}
                          onCheckedChange={(checked) => {
                            setSelectedLessonIds(prev =>
                              checked ? [...prev, l.id] : prev.filter(id => id !== l.id)
                            );
                          }}
                        />
                        <label htmlFor={`lesson-${l.id}`} className="text-xs text-gray-700 cursor-pointer flex-1 truncate">
                          {l.title}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {courseLessons.length > 0 && (
                  <div className="flex gap-2">
                    <button type="button" className="text-xs text-teal-600 hover:text-teal-700"
                      onClick={() => setSelectedLessonIds(courseLessons.map((l: any) => l.id))}>Select all</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => setSelectedLessonIds([])}>Clear</button>
                  </div>
                )}
              </div>
            )}

            {/* Count + style */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-600 whitespace-nowrap shrink-0">Questions to generate:</Label>
                <Input type="number" min={1} max={50} value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="h-8 text-sm w-20" />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Question Style</Label>
                <Select value={aiStyle} onValueChange={(v) => setAiStyle(v as typeof aiStyle)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="understanding" className="text-xs">Ensuring Understanding — recall &amp; definitions</SelectItem>
                    <SelectItem value="thinking" className="text-xs">Getting Thinking — apply &amp; reason</SelectItem>
                    <SelectItem value="compliance" className="text-xs">Compliance — protocol &amp; safety</SelectItem>
                    <SelectItem value="thought_provoking" className="text-xs">Thought Provoking — critical &amp; nuanced</SelectItem>
                    <SelectItem value="reflection" className="text-xs">Reflection — self-assess &amp; connect to practice</SelectItem>
                    <SelectItem value="custom" className="text-xs">Custom Prompt…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {aiStyle === "custom" && (
                <div>
                  <Label className="text-xs text-gray-600">Custom Style Instructions</Label>
                  <Textarea value={aiCustomPrompt} onChange={(e) => setAiCustomPrompt(e.target.value)}
                    placeholder="e.g. Focus on image interpretation and scanning technique errors…"
                    className="text-xs mt-1 min-h-[60px]" maxLength={500} />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{aiCustomPrompt.length}/500</p>
                </div>
              )}
              <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs w-full"
                disabled={!canGenerate || generateMutation.isPending}
                onClick={handleGenerate}>
                {generateMutation.isPending ? "Generating…" : "Generate Questions"}
              </Button>
            </div>

            {/* AI Preview */}
            {aiPreview && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">
                  Preview ({aiPreview.length} questions) — click <Pencil size={10} className="inline" /> to edit before adding:
                </p>
                {aiPreview.map((q, i) => (
                  <div key={i}>
                    <div className="p-2 bg-teal-50 rounded text-xs border border-teal-100">
                      <div className="flex items-start gap-2">
                        <p className="font-medium flex-1 break-words">{i + 1}. {q.question}</p>
                        <button type="button" className="p-1 rounded hover:bg-teal-100 text-teal-700 shrink-0"
                          onClick={() => setEditingAiIndex(editingAiIndex === i ? null : i)} title="Edit">
                          <Pencil size={11} />
                        </button>
                      </div>
                      {editingAiIndex !== i && (
                        <div className="grid grid-cols-2 gap-1 mt-1">
                          {q.options.map((opt, j) => (
                            <span key={j} className={`px-1.5 py-0.5 rounded ${
                              j === q.correctAnswer ? "bg-teal-200 text-teal-800 font-medium" : "bg-white border border-gray-200 text-gray-500"
                            }`}>
                              {["A", "B", "C", "D"][j]}. {opt}
                            </span>
                          ))}
                        </div>
                      )}
                      {q.explanation && editingAiIndex !== i && (
                        <p className="mt-1 text-gray-500 italic">{q.explanation}</p>
                      )}
                    </div>
                    {editingAiIndex === i && (
                      <QuestionEditor question={q} index={i} isNew={false} handleFileUpload={handleFileUpload}
                        onSave={saveAiEdit} onCancel={() => setEditingAiIndex(null)} />
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={applyAiPreview}>
                    Add All to Quiz
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs"
                    onClick={() => { setAiPreview(null); setEditingAiIndex(null); }}>Discard</Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Summary badges */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Badge variant="secondary" className="text-xs">{questions.length} question{questions.length !== 1 ? "s" : ""}</Badge>
        {requirePass ? (
          <Badge variant="outline" className="text-xs text-teal-700 border-teal-300">Pass required: {data.passingScore ?? 70}%</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">No pass required</Badge>
        )}
        {data.shuffleQuestions && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300">Shuffled</Badge>}
        {data.shuffleAnswers && <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Answers shuffled</Badge>}
      </div>
    </div>
  );
}

// ─── Question Bank Picker ─────────────────────────────────────────────────────

function QuestionBankPicker({ onAdd }: { onAdd: (q: any) => void }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: tagsData } = trpc.questionBank.listTags.useQuery();
  const tags = tagsData ?? [];

  const { data, isLoading } = trpc.questionBank.listQuestions.useQuery({
    search: debouncedSearch || undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    page,
    pageSize: 10,
  });

  const questions = data?.questions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search question bank..." className="h-8 text-xs pl-7" />
          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag: any) => (
            <button key={tag.id} onClick={() => { setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]); setPage(1); }}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${selectedTagIds.includes(tag.id) ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`}
              style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}>
              {tag.name}
            </button>
          ))}
        </div>
      )}
      {isLoading ? (
        <p className="text-xs text-gray-400 text-center py-3">Loading...</p>
      ) : questions.length === 0 ? (
        <div className="text-center py-4">
          <Database className="w-6 h-6 mx-auto mb-1 text-gray-300" />
          <p className="text-xs text-gray-400">{total === 0 ? "No questions in bank yet." : "No questions match your search."}</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {questions.map((q: any) => (
            <div key={q.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-100 text-xs hover:border-teal-200 hover:bg-teal-50 transition-colors">
              {q.questionImageUrl && <img src={q.questionImageUrl} alt="" className="h-8 w-auto rounded border border-gray-200 object-cover shrink-0" />}
              <p className="flex-1 text-gray-700 font-medium line-clamp-2">{q.question}</p>
              <button onClick={() => onAdd(q)} className="shrink-0 px-2 py-0.5 bg-teal-600 text-white rounded text-xs hover:bg-teal-700 transition-colors">Add</button>
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-0.5 border border-gray-200 rounded disabled:opacity-40">‹</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-0.5 border border-gray-200 rounded disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
