import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export interface FlashcardItem {
  front: string;
  back: string;
  hint?: string;
  imageUrl?: string;
  backImageUrl?: string;
}

export interface LessonFlashcardData {
  title?: string;
  cards: FlashcardItem[];
  shuffleCards?: boolean;
  showHints?: boolean;
  /** Theme colors for the player buttons */
  gotItColor?: string;
  stillLearningColor?: string;
  gotItTextColor?: string;
  stillLearningTextColor?: string;
}

interface Props {
  data: LessonFlashcardData;
  onChange: (data: LessonFlashcardData) => void;
  handleFileUpload?: (file: File, targetField: string, context: string) => Promise<string | null>;
  lessonId?: number;
  courseId?: number;
}

const EMPTY_CARD: FlashcardItem = { front: "", back: "", hint: "" };

const DEFAULT_GOT_IT_COLOR = "#1ab7b4";
const DEFAULT_STILL_LEARNING_COLOR = "#f0fdfa";
const DEFAULT_GOT_IT_TEXT = "#ffffff";
const DEFAULT_STILL_LEARNING_TEXT = "#189593";

export default function LessonFlashcardBlockEditor({ data, onChange, handleFileUpload, lessonId, courseId }: Props) {
  const [activeTab, setActiveTab] = useState<"ai" | "manual" | "style">("manual");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingCard, setEditingCard] = useState<FlashcardItem | null>(null);
  const [aiCount, setAiCount] = useState(10);
  const [aiStyle, setAiStyle] = useState<"understanding" | "thinking" | "compliance" | "thought_provoking" | "reflection" | "custom">("understanding");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiPreview, setAiPreview] = useState<FlashcardItem[] | null>(null);
  // AI source selection
  const [aiSource, setAiSource] = useState<"lesson" | "course" | "pick" | "topic">("lesson");
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);
  const [aiTopic, setAiTopic] = useState("");
  const frontImgRef = useRef<HTMLInputElement | null>(null);
  const backImgRef = useRef<HTMLInputElement | null>(null);

  // Fetch course lessons for "course" / "pick" modes
  const { data: curriculumData } = trpc.lmsAdmin.getCurriculumById.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId && (aiSource === "pick" || aiSource === "course") }
  );
  const courseLessons: { id: number; title: string }[] = curriculumData?.sections?.flatMap((s: any) => s.lessons ?? []) ?? [];

  const generateMutation = trpc.lmsAdmin.generateFlashcardsFromLesson.useMutation({
    onSuccess: (res) => {
      setAiPreview(res.cards);
      toast.success(`Generated ${res.cards.length} flashcards — review and apply below.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const canGenerate =
    aiSource === "lesson" ? !!lessonId
    : aiSource === "course" ? !!courseId
    : aiSource === "pick" ? selectedLessonIds.length > 0
    : aiTopic.trim().length > 0;

  const handleGenerate = () => {
    const payload: Parameters<typeof generateMutation.mutate>[0] = {
      count: aiCount,
      cardStyle: aiStyle,
      customPrompt: aiStyle === "custom" ? aiCustomPrompt : undefined,
    };
    if (aiSource === "lesson" && lessonId) {
      payload.lessonId = lessonId;
    } else if (aiSource === "course" && courseId) {
      payload.courseId = courseId;
    } else if (aiSource === "pick") {
      payload.lessonIds = selectedLessonIds;
    } else if (aiSource === "topic" && aiTopic.trim()) {
      payload.topic = aiTopic.trim();
    } else {
      toast.error("Please select a source or enter a topic for AI generation.");
      return;
    }
    generateMutation.mutate(payload);
  };

  const set = (key: keyof LessonFlashcardData, value: any) => onChange({ ...data, [key]: value });
  const setMulti = (updates: Partial<LessonFlashcardData>) => onChange({ ...data, ...updates });

  const saveCard = () => {
    if (!editingCard) return;
    const cs = [...(data.cards ?? [])];
    if (editingIndex === null) {
      cs.push(editingCard);
    } else {
      cs[editingIndex] = editingCard;
    }
    set("cards", cs);
    setEditingIndex(null);
    setEditingCard(null);
  };

  const deleteCard = (i: number) => {
    const cs = [...(data.cards ?? [])];
    cs.splice(i, 1);
    set("cards", cs);
  };

  const applyAiPreview = () => {
    if (!aiPreview) return;
    set("cards", [...(data.cards ?? []), ...aiPreview]);
    setAiPreview(null);
    toast.success("Flashcards added to deck.");
  };

  const handleFrontImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload || !editingCard) return;
    const url = await handleFileUpload(file, "imageUrl", "flashcard_front");
    if (url) setEditingCard({ ...editingCard, imageUrl: url });
  };

  const handleBackImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !handleFileUpload || !editingCard) return;
    const url = await handleFileUpload(file, "backImageUrl", "flashcard_back");
    if (url) setEditingCard({ ...editingCard, backImageUrl: url });
  };

  const gotItColor = data.gotItColor ?? DEFAULT_GOT_IT_COLOR;
  const stillLearningColor = data.stillLearningColor ?? DEFAULT_STILL_LEARNING_COLOR;
  const gotItText = data.gotItTextColor ?? DEFAULT_GOT_IT_TEXT;
  const stillLearningText = data.stillLearningTextColor ?? DEFAULT_STILL_LEARNING_TEXT;

  return (
    <div className="space-y-4">
      {/* Settings row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-600">Deck Title</Label>
          <Input
            value={data.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Review Flashcards"
            className="h-8 text-sm mt-1"
          />
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-2">
            <Switch
              id="shuffleCards"
              checked={data.shuffleCards ?? true}
              onCheckedChange={(v) => set("shuffleCards", v)}
            />
            <Label htmlFor="shuffleCards" className="text-xs text-gray-600">Shuffle Cards</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="showHints"
              checked={data.showHints ?? true}
              onCheckedChange={(v) => set("showHints", v)}
            />
            <Label htmlFor="showHints" className="text-xs text-gray-600">Show Hints</Label>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="h-8">
          <TabsTrigger value="manual" className="text-xs h-7">Manual Entry</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs h-7">AI Generate</TabsTrigger>
          <TabsTrigger value="style" className="text-xs h-7">Button Style</TabsTrigger>
        </TabsList>

        {/* ── AI Generate ── */}
        <TabsContent value="ai" className="mt-3 space-y-3">
          {/* Source selector */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-600 font-medium">Generate from:</Label>
            <div className="grid grid-cols-2 gap-1">
              {[
                { value: "lesson", label: "Current Lesson", disabled: !lessonId },
                { value: "course", label: "Entire Course", disabled: !courseId },
                { value: "pick", label: "Pick Lessons", disabled: !courseId },
                { value: "topic", label: "Topic / Custom", disabled: false },
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
            {aiSource === "lesson" && !lessonId && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">Save the lesson first to enable AI generation from this lesson.</p>
            )}
          </div>

          {/* Topic input */}
          {aiSource === "topic" && (
            <div>
              <Label className="text-xs text-gray-600">Topic or custom instructions</Label>
              <Textarea value={aiTopic} onChange={(e) => setAiTopic(e.target.value)}
                placeholder="e.g. Doppler ultrasound physics, normal vs abnormal cardiac anatomy, FAST exam technique…"
                className="text-xs mt-1 min-h-[60px]" maxLength={800} />
              <p className="text-xs text-gray-400 mt-0.5 text-right">{aiTopic.length}/800</p>
            </div>
          )}

          {/* Lesson picker for "pick" mode */}
          {aiSource === "pick" && courseId && (
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Select lessons to generate from:</Label>
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded p-2 space-y-1 bg-white">
                {courseLessons.length === 0 ? (
                  <p className="text-xs text-gray-400">Loading lessons…</p>
                ) : (
                  courseLessons.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <Checkbox id={`fc-lesson-${l.id}`} checked={selectedLessonIds.includes(l.id)}
                        onCheckedChange={(checked) => setSelectedLessonIds(prev =>
                          checked ? [...prev, l.id] : prev.filter(id => id !== l.id)
                        )} />
                      <label htmlFor={`fc-lesson-${l.id}`} className="text-xs text-gray-700 cursor-pointer flex-1 truncate">{l.title}</label>
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-600 whitespace-nowrap shrink-0">Cards to generate:</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="h-8 text-sm w-20"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Card Style</Label>
              <Select value={aiStyle} onValueChange={(v) => setAiStyle(v as typeof aiStyle)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
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
              disabled={!canGenerate || generateMutation.isPending}
              onClick={handleGenerate}
            >
              {generateMutation.isPending ? "Generating…" : "Generate Flashcards"}
            </Button>
          </div>

          {aiPreview && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Preview ({aiPreview.length} cards):</p>
              {aiPreview.map((c, i) => (
                <div key={i} className="p-2 bg-teal-50 rounded text-xs">
                  <p className="font-medium text-gray-700 mb-0.5">Front: {c.front}</p>
                  <p className="text-gray-600">Back: {c.back}</p>
                  {c.hint && <p className="text-gray-400 italic mt-0.5">Hint: {c.hint}</p>}
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={applyAiPreview}>
                  Add All to Deck
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
          {(data.cards ?? []).length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No cards yet. Add one below.</p>
          )}
          {(data.cards ?? []).map((c, i) => (
            <div key={i} className="p-2 bg-gray-50 rounded border border-gray-200 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">Front: {c.front}</p>
                  <p className="text-gray-500 truncate">Back: {c.back}</p>
                  {c.hint && <p className="text-gray-400 italic truncate">Hint: {c.hint}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-teal-600"
                    onClick={() => { setEditingIndex(i); setEditingCard({ ...c }); }}
                  >Edit</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-red-500"
                    onClick={() => deleteCard(i)}
                  >Del</Button>
                </div>
              </div>
            </div>
          ))}

          {/* Add / Edit form */}
          {editingCard !== null ? (
            <div className="p-3 bg-white border border-teal-200 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-gray-700">{editingIndex === null ? "New Card" : `Edit Card ${editingIndex + 1}`}</p>
              <div>
                <Label className="text-xs text-gray-600">Front (Question / Term)</Label>
                <Textarea
                  value={editingCard.front}
                  onChange={(e) => setEditingCard({ ...editingCard, front: e.target.value })}
                  placeholder="What is…?"
                  className="text-sm mt-1 min-h-[60px]"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Back (Answer / Definition)</Label>
                <Textarea
                  value={editingCard.back}
                  onChange={(e) => setEditingCard({ ...editingCard, back: e.target.value })}
                  placeholder="The answer is…"
                  className="text-sm mt-1 min-h-[60px]"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Hint (optional)</Label>
                <Input
                  value={editingCard.hint ?? ""}
                  onChange={(e) => setEditingCard({ ...editingCard, hint: e.target.value })}
                  placeholder="Think about…"
                  className="h-8 text-sm mt-1"
                />
              </div>
              {handleFileUpload && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-600">Front Image</Label>
                    <div className="flex flex-col gap-1 mt-1">
                      {editingCard.imageUrl && (
                        <img src={editingCard.imageUrl} alt="" className="h-12 w-auto rounded border border-gray-200 object-cover" />
                      )}
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => frontImgRef.current?.click()}>
                        {editingCard.imageUrl ? "Change" : "Upload"}
                      </Button>
                      {editingCard.imageUrl && (
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => setEditingCard({ ...editingCard, imageUrl: undefined })}>Remove</Button>
                      )}
                      <input ref={frontImgRef} type="file" accept="image/*" className="hidden" onChange={handleFrontImageUpload} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Back Image</Label>
                    <div className="flex flex-col gap-1 mt-1">
                      {editingCard.backImageUrl && (
                        <img src={editingCard.backImageUrl} alt="" className="h-12 w-auto rounded border border-gray-200 object-cover" />
                      )}
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => backImgRef.current?.click()}>
                        {editingCard.backImageUrl ? "Change" : "Upload"}
                      </Button>
                      {editingCard.backImageUrl && (
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => setEditingCard({ ...editingCard, backImageUrl: undefined })}>Remove</Button>
                      )}
                      <input ref={backImgRef} type="file" accept="image/*" className="hidden" onChange={handleBackImageUpload} />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs" onClick={saveCard}>
                  {editingIndex === null ? "Add Card" : "Save Changes"}
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditingIndex(null); setEditingCard(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs w-full border-dashed border-teal-300 text-teal-600 hover:bg-teal-50"
              onClick={() => setEditingCard({ ...EMPTY_CARD })}
            >
              + Add Card
            </Button>
          )}
        </TabsContent>

        {/* ── Button Style ── */}
        <TabsContent value="style" className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">Customize the "Got It" and "Still Learning" button appearance.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">Got It — Background</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={gotItColor} onChange={(e) => set("gotItColor", e.target.value)} className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
                <Input value={gotItColor} onChange={(e) => set("gotItColor", e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Got It — Text</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={gotItText} onChange={(e) => set("gotItTextColor", e.target.value)} className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
                <Input value={gotItText} onChange={(e) => set("gotItTextColor", e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Still Learning — Background</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={stillLearningColor} onChange={(e) => set("stillLearningColor", e.target.value)} className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
                <Input value={stillLearningColor} onChange={(e) => set("stillLearningColor", e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Still Learning — Text</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={stillLearningText} onChange={(e) => set("stillLearningTextColor", e.target.value)} className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
                <Input value={stillLearningText} onChange={(e) => set("stillLearningTextColor", e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
          </div>
          {/* Preview */}
          <div className="flex gap-2 mt-2">
            <button type="button" style={{ backgroundColor: gotItColor, color: gotItText }} className="flex-1 py-2 rounded text-sm font-semibold transition-all">
              Got It ✓
            </button>
            <button type="button" style={{ backgroundColor: stillLearningColor, color: stillLearningText, borderColor: stillLearningText + "33" }} className="flex-1 py-2 rounded text-sm font-semibold border transition-all">
              Still Learning ↩
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
