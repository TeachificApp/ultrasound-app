import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  imageUrl?: string;
}

export interface LessonQuizData {
  title?: string;
  questions: QuizQuestion[];
  showExplanations?: boolean;
  passingScore?: number;
  shuffleQuestions?: boolean;
  requirePassToComplete?: boolean;
}

interface Props {
  data: LessonQuizData;
  onChange: (data: LessonQuizData) => void;
  handleFileUpload?: (file: File, targetField: string, context: string) => Promise<string | null>;
  lessonId?: number;
}

const EMPTY_QUESTION: QuizQuestion = {
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
};

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
  const [q, setQ] = useState<QuizQuestion>({ ...question, options: [...question.options] });
  const imgRef = useRef<HTMLInputElement | null>(null);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload) return;
    const url = await handleFileUpload(file, "imageUrl", "quiz_question");
    if (url) setQ(prev => ({ ...prev, imageUrl: url }));
  };

  return (
    <div className="p-3 bg-white border border-teal-200 rounded-lg space-y-2 mt-2">
      <p className="text-xs font-semibold text-gray-700">
        {isNew ? "New Question" : `Edit Question ${(index ?? 0) + 1}`}
      </p>
      <div>
        <Label className="text-xs text-gray-600">Question</Label>
        <Textarea
          value={q.question}
          onChange={(e) => setQ(prev => ({ ...prev, question: e.target.value }))}
          placeholder="Enter question text…"
          className="text-sm mt-1 min-h-[60px]"
        />
      </div>
      {q.options.map((opt, j) => (
        <div key={j} className="flex items-center gap-2">
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
      ))}
      <div>
        <Label className="text-xs text-gray-600">Explanation (optional)</Label>
        <Textarea
          value={q.explanation ?? ""}
          onChange={(e) => setQ(prev => ({ ...prev, explanation: e.target.value }))}
          placeholder="Explain why the correct answer is correct…"
          className="text-sm mt-1 min-h-[50px]"
        />
      </div>
      {handleFileUpload && (
        <div>
          <Label className="text-xs text-gray-600">Question Image (optional)</Label>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {q.imageUrl && (
              <img src={q.imageUrl} alt="" className="h-12 w-auto rounded border border-gray-200 object-cover" />
            )}
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => imgRef.current?.click()}>
              {q.imageUrl ? "Change Image" : "Upload Image"}
            </Button>
            {q.imageUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-red-500"
                onClick={() => setQ(prev => ({ ...prev, imageUrl: undefined }))}
              >
                Remove
              </Button>
            )}
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={() => onSave(q)}>
          {isNew ? "Add Question" : "Save Changes"}
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function LessonQuizBlockEditor({ data, onChange, handleFileUpload, lessonId }: Props) {
  const [addTab, setAddTab] = useState<"ai" | "manual">("manual");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [aiCount, setAiCount] = useState(5);
  const [aiStyle, setAiStyle] = useState<"understanding" | "thinking" | "compliance" | "thought_provoking" | "custom">("understanding");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiPreview, setAiPreview] = useState<QuizQuestion[] | null>(null);
  const [editingAiIndex, setEditingAiIndex] = useState<number | null>(null);

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
    if (editingIndex === null) {
      qs.push(q);
    } else {
      qs[editingIndex] = q;
    }
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

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <Label className="text-xs text-gray-600">Quiz Title</Label>
        <Input
          value={data.title ?? ""}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Knowledge Check"
          className="h-8 text-sm mt-1"
        />
      </div>

      {/* Require pass toggle */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div>
          <p className="text-xs font-medium text-gray-700">Require Pass to Complete</p>
          <p className="text-xs text-gray-400 mt-0.5">Student must reach passing score to mark lesson complete</p>
        </div>
        <Switch checked={requirePass} onCheckedChange={(v) => set("requirePassToComplete", v)} />
      </div>

      {/* Passing score — only when required */}
      {requirePass && (
        <div>
          <Label className="text-xs text-gray-600">Passing Score (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={data.passingScore ?? 70}
            onChange={(e) => set("passingScore", Number(e.target.value))}
            className="h-8 text-sm mt-1 w-28"
          />
        </div>
      )}

      {/* Other toggles */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="showExp"
            checked={data.showExplanations ?? true}
            onCheckedChange={(v) => set("showExplanations", v)}
          />
          <Label htmlFor="showExp" className="text-xs text-gray-600">Show Explanations</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="shuffleQ"
            checked={data.shuffleQuestions ?? false}
            onCheckedChange={(v) => set("shuffleQuestions", v)}
          />
          <Label htmlFor="shuffleQ" className="text-xs text-gray-600">Shuffle Questions</Label>
        </div>
      </div>

      {/* ── Existing questions list — always visible ── */}
      {questions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Questions ({questions.length})</p>
          {questions.map((q, i) => (
            <div key={i}>
              <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                <span className="text-gray-400 font-medium shrink-0 mt-0.5">{i + 1}.</span>
                <p className="font-medium text-gray-700 flex-1 min-w-0 break-words">{q.question}</p>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-teal-50 text-teal-600 transition-colors"
                    title="Edit question"
                    onClick={() => {
                      setAddingNew(false);
                      setEditingIndex(editingIndex === i ? null : i);
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-red-50 text-red-400 transition-colors"
                    title="Delete question"
                    onClick={() => deleteQuestion(i)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {editingIndex === i && (
                <QuestionEditor
                  question={q}
                  index={i}
                  isNew={false}
                  handleFileUpload={handleFileUpload}
                  onSave={saveQuestion}
                  onCancel={() => setEditingIndex(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Add new question form ── */}
      {addingNew && editingIndex === null && (
        <QuestionEditor
          question={{ ...EMPTY_QUESTION, options: ["", "", "", ""] }}
          index={null}
          isNew={true}
          handleFileUpload={handleFileUpload}
          onSave={saveQuestion}
          onCancel={() => setAddingNew(false)}
        />
      )}

      {/* ── Add / AI tabs ── */}
      {!addingNew && editingIndex === null && (
        <Tabs value={addTab} onValueChange={(v) => setAddTab(v as "ai" | "manual")}>
          <TabsList className="h-8">
            <TabsTrigger value="manual" className="text-xs h-7">Manual Entry</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs h-7">AI Generate</TabsTrigger>
          </TabsList>

          {/* Manual */}
          <TabsContent value="manual" className="mt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 w-full"
              onClick={() => setAddingNew(true)}
            >
              <Plus size={12} className="mr-1" /> Add Question
            </Button>
          </TabsContent>

          {/* AI Generate */}
          <TabsContent value="ai" className="mt-3 space-y-3">
            {!lessonId && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">Save the lesson first to enable AI generation.</p>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-600 whitespace-nowrap shrink-0">Questions to generate:</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="h-8 text-sm w-20"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Question Style</Label>
                <Select value={aiStyle} onValueChange={(v) => setAiStyle(v as typeof aiStyle)}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="understanding" className="text-xs">Ensuring Understanding — recall &amp; definitions</SelectItem>
                    <SelectItem value="thinking" className="text-xs">Getting Thinking — apply &amp; reason</SelectItem>
                    <SelectItem value="compliance" className="text-xs">Compliance — protocol &amp; safety</SelectItem>
                    <SelectItem value="thought_provoking" className="text-xs">Thought Provoking — critical &amp; nuanced</SelectItem>
                    <SelectItem value="custom" className="text-xs">Custom Prompt…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {aiStyle === "custom" && (
                <div>
                  <Label className="text-xs text-gray-600">Custom Style Instructions</Label>
                  <Textarea
                    value={aiCustomPrompt}
                    onChange={(e) => setAiCustomPrompt(e.target.value)}
                    placeholder="e.g. Focus on image interpretation and scanning technique errors…"
                    className="text-xs mt-1 min-h-[60px]"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{aiCustomPrompt.length}/500</p>
                </div>
              )}
              <Button
                size="sm"
                className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs w-full"
                disabled={!lessonId || generateMutation.isPending}
                onClick={() => generateMutation.mutate({ lessonId: lessonId!, count: aiCount, questionStyle: aiStyle, customPrompt: aiStyle === "custom" ? aiCustomPrompt : undefined })}
              >
                {generateMutation.isPending ? "Generating…" : "Generate from Lesson"}
              </Button>
            </div>

            {/* AI Preview — editable */}
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
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-teal-100 text-teal-700 shrink-0"
                          onClick={() => setEditingAiIndex(editingAiIndex === i ? null : i)}
                          title="Edit this question"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                      {editingAiIndex !== i && (
                        <div className="grid grid-cols-2 gap-1 mt-1">
                          {q.options.map((opt, j) => (
                            <span
                              key={j}
                              className={`px-1.5 py-0.5 rounded ${
                                j === q.correctAnswer
                                  ? "bg-teal-200 text-teal-800 font-medium"
                                  : "bg-white border border-gray-200 text-gray-500"
                              }`}
                            >
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
                      <QuestionEditor
                        question={q}
                        index={i}
                        isNew={false}
                        handleFileUpload={handleFileUpload}
                        onSave={saveAiEdit}
                        onCancel={() => setEditingAiIndex(null)}
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs"
                    onClick={applyAiPreview}
                  >
                    Add All to Quiz
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => { setAiPreview(null); setEditingAiIndex(null); }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Summary badges */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Badge variant="secondary" className="text-xs">
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </Badge>
        {requirePass ? (
          <Badge variant="outline" className="text-xs text-teal-700 border-teal-300">
            Pass required: {data.passingScore ?? 70}%
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">
            No pass required
          </Badge>
        )}
      </div>
    </div>
  );
}
