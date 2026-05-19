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
}

interface Props {
  data: LessonFlashcardData;
  onChange: (data: LessonFlashcardData) => void;
  handleFileUpload?: (file: File, targetField: string, context: string) => Promise<string | null>;
  lessonId?: number;
}

const EMPTY_CARD: FlashcardItem = { front: "", back: "", hint: "" };

export default function LessonFlashcardBlockEditor({ data, onChange, handleFileUpload, lessonId }: Props) {
  const [activeTab, setActiveTab] = useState<"ai" | "manual">("manual");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingCard, setEditingCard] = useState<FlashcardItem | null>(null);
  const [aiCount, setAiCount] = useState(10);
  const [aiPreview, setAiPreview] = useState<FlashcardItem[] | null>(null);
  const frontImgRef = useRef<HTMLInputElement | null>(null);
  const backImgRef = useRef<HTMLInputElement | null>(null);

  const generateMutation = trpc.lmsGroup.generateFlashcardsFromLesson.useMutation({
    onSuccess: (res) => {
      setAiPreview(res.cards);
      toast.success(`Generated ${res.cards.length} flashcards — review and apply below.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const set = (key: keyof LessonFlashcardData, value: any) => onChange({ ...data, [key]: value });

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
            <Label className="text-xs text-gray-600 whitespace-nowrap">Cards to generate:</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value))}
              className="h-8 text-sm w-20"
            />
            <Button
              size="sm"
              className="h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs"
              disabled={!lessonId || generateMutation.isPending}
              onClick={() => generateMutation.mutate({ lessonId: lessonId!, count: aiCount })}
            >
              {generateMutation.isPending ? "Generating…" : "Generate from Lesson"}
            </Button>
          </div>
          {aiPreview && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Preview ({aiPreview.length} cards):</p>
              {aiPreview.map((c, i) => (
                <div key={i} className="p-2 bg-purple-50 rounded text-xs">
                  <p className="font-medium text-gray-700 mb-0.5">Front: {c.front}</p>
                  <p className="text-gray-600">Back: {c.back}</p>
                  {c.hint && <p className="text-gray-400 italic mt-0.5">Hint: {c.hint}</p>}
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs" onClick={applyAiPreview}>
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
                    className="h-6 px-2 text-xs text-purple-600"
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
            <div className="p-3 bg-white border border-purple-200 rounded-lg space-y-2">
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
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs" onClick={saveCard}>
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
              className="h-8 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={() => { setEditingIndex(null); setEditingCard({ ...EMPTY_CARD }); }}
            >
              + Add Card
            </Button>
          )}
        </TabsContent>
      </Tabs>

      <Badge variant="secondary" className="text-xs">
        {(data.cards ?? []).length} card{(data.cards ?? []).length !== 1 ? "s" : ""}
      </Badge>
    </div>
  );
}
