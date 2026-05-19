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

export default function LessonQuizBlockEditor({ data, onChange, handleFileUpload, lessonId }: Props) {
  const [activeTab, setActiveTab] = useState<"ai" | "manual">("manual");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingQ, setEditingQ] = useState<QuizQuestion | null>(null);
  const [aiCount, setAiCount] = useState(5);
  const [aiPreview, setAiPreview] = useState<QuizQuestion[] | null>(null);
  const imgRef = useRef<HTMLInputElement | null>(null);

  const generateMutation = trpc.lmsGroup.generateQuizFromLesson.useMutation({
    onSuccess: (res) => {
      setAiPreview(res.questions);
      toast.success(`Generated ${res.questions.length} questions — review and apply below.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const set = (key: keyof LessonQuizData, value: any) => onChange({ ...data, [key]: value });

  const saveQuestion = () => {
    if (!editingQ) return;
    const qs = [...(data.questions ?? [])];
    if (editingIndex === null) {
      qs.push(editingQ);
    } else {
      qs[editingIndex] = editingQ;
    }
    set("questions", qs);
    setEditingIndex(null);
    setEditingQ(null);
  };

  const deleteQuestion = (i: number) => {
    const qs = [...(data.questions ?? [])];
    qs.splice(i, 1);
    set("questions", qs);
  };

  const applyAiPreview = () => {
    if (!aiPreview) return;
    set("questions", [...(data.questions ?? []), ...aiPreview]);
    setAiPreview(null);
    toast.success("Questions added to quiz.");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload || !editingQ) return;
    const url = await handleFileUpload(file, "imageUrl", "quiz_question");
    if (url) setEditingQ({ ...editingQ, imageUrl: url });
  };

  return (
    <div className="space-y-4">
      {/* Settings row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-600">Quiz Title</Label>
          <Input
            value={data.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Knowledge Check"
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600">Passing Score (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={data.passingScore ?? 70}
            onChange={(e) => set("passingScore", Number(e.target.value))}
            className="h-8 text-sm mt-1"
          />
        </div>
      </div>
      <div className="flex gap-4">
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ai" | "manual")}>
        <TabsList className="h-8">
          <TabsTrigger value="manual" className="text-xs h-7">Manual Entry</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs h-7">AI Generate</TabsTrigger>
        </TabsList>

        {/* ── AI Generate ── */}
        <TabsContent value="ai" className="mt-3 space-y-3">
          {!lessonId && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">Save the lesson first to enable AI generation.</p>
          )}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 whitespace-nowrap">Questions to generate:</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value))}
              className="h-8 text-sm w-20"
            />
            <Button
              size="sm"
              className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs"
              disabled={!lessonId || generateMutation.isPending}
              onClick={() => generateMutation.mutate({ lessonId: lessonId!, count: aiCount })}
            >
              {generateMutation.isPending ? "Generating…" : "Generate from Lesson"}
            </Button>
          </div>
          {aiPreview && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Preview ({aiPreview.length} questions):</p>
              {aiPreview.map((q, i) => (
                <div key={i} className="p-2 bg-teal-50 rounded text-xs">
                  <p className="font-medium mb-1">{i + 1}. {q.question}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {q.options.map((opt, j) => (
                      <span key={j} className={`px-1.5 py-0.5 rounded ${j === q.correctAnswer ? "bg-teal-200 text-teal-800 font-medium" : "bg-white border border-gray-200 text-gray-500"}`}>
                        {["A","B","C","D"][j]}. {opt}
                      </span>
                    ))}
                  </div>
                  {q.explanation && <p className="mt-1 text-gray-500 italic">{q.explanation}</p>}
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={applyAiPreview}>
                  Add All to Quiz
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAiPreview(null)}>
                  Discard
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Manual Entry ── */}
        <TabsContent value="manual" className="mt-3 space-y-3">
          {/* Question list */}
          {(data.questions ?? []).length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No questions yet. Add one below.</p>
          )}
          {(data.questions ?? []).map((q, i) => (
            <div key={i} className="p-2 bg-gray-50 rounded border border-gray-200 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-700 flex-1">{i + 1}. {q.question}</p>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-teal-600"
                    onClick={() => { setEditingIndex(i); setEditingQ({ ...q, options: [...q.options] }); }}
                  >Edit</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-red-500"
                    onClick={() => deleteQuestion(i)}
                  >Del</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {q.options.map((opt, j) => (
                  <span key={j} className={`px-1.5 py-0.5 rounded ${j === q.correctAnswer ? "bg-teal-100 text-teal-700 font-medium" : "bg-white border border-gray-200 text-gray-500"}`}>
                    {["A","B","C","D"][j]}. {opt}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Add / Edit form */}
          {editingQ !== null ? (
            <div className="p-3 bg-white border border-teal-200 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-gray-700">{editingIndex === null ? "New Question" : `Edit Question ${editingIndex + 1}`}</p>
              <div>
                <Label className="text-xs text-gray-600">Question</Label>
                <Textarea
                  value={editingQ.question}
                  onChange={(e) => setEditingQ({ ...editingQ, question: e.target.value })}
                  placeholder="Enter question text…"
                  className="text-sm mt-1 min-h-[60px]"
                />
              </div>
              {editingQ.options.map((opt, j) => (
                <div key={j} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingQ({ ...editingQ, correctAnswer: j })}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${j === editingQ.correctAnswer ? "border-teal-500 bg-teal-500 text-white" : "border-gray-300 text-gray-400 hover:border-teal-400"}`}
                    title="Mark as correct"
                  >
                    {["A","B","C","D"][j]}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const opts = [...editingQ.options];
                      opts[j] = e.target.value;
                      setEditingQ({ ...editingQ, options: opts });
                    }}
                    placeholder={`Option ${["A","B","C","D"][j]}`}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              ))}
              <div>
                <Label className="text-xs text-gray-600">Explanation (optional)</Label>
                <Textarea
                  value={editingQ.explanation ?? ""}
                  onChange={(e) => setEditingQ({ ...editingQ, explanation: e.target.value })}
                  placeholder="Explain why the correct answer is correct…"
                  className="text-sm mt-1 min-h-[50px]"
                />
              </div>
              {handleFileUpload && (
                <div>
                  <Label className="text-xs text-gray-600">Question Image (optional)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {editingQ.imageUrl && (
                      <img src={editingQ.imageUrl} alt="" className="h-12 w-auto rounded border border-gray-200 object-cover" />
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => imgRef.current?.click()}
                    >
                      {editingQ.imageUrl ? "Change Image" : "Upload Image"}
                    </Button>
                    {editingQ.imageUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500"
                        onClick={() => setEditingQ({ ...editingQ, imageUrl: undefined })}
                      >Remove</Button>
                    )}
                    <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={saveQuestion}>
                  {editingIndex === null ? "Add Question" : "Save Changes"}
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditingIndex(null); setEditingQ(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-teal-300 text-teal-700 hover:bg-teal-50"
              onClick={() => { setEditingIndex(null); setEditingQ({ ...EMPTY_QUESTION, options: ["", "", "", ""] }); }}
            >
              + Add Question
            </Button>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2 pt-1">
        <Badge variant="secondary" className="text-xs">
          {(data.questions ?? []).length} question{(data.questions ?? []).length !== 1 ? "s" : ""}
        </Badge>
        {(data.passingScore ?? 70) > 0 && (
          <Badge variant="outline" className="text-xs text-teal-700 border-teal-300">
            Pass: {data.passingScore ?? 70}%
          </Badge>
        )}
      </div>
    </div>
  );
}
