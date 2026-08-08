/**
 * InteractiveQuestionEditorPanel
 * Provides editor UI for the 6 interactive question types:
 * image_comparison, drag_sort, branching, fill_blank, annotation, flashcard
 *
 * Usage:
 *   <InteractiveQuestionEditorPanel
 *     question={q}
 *     onChange={(updates) => updateQuestion.mutate({ id: q.id, ...updates })}
 *     onUploadImage={async (file) => uploadUrl}
 *   />
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Upload, Image as ImageIcon } from "lucide-react";
import { HotspotEditor, MatchingEditor } from "@/components/LessonQuizBlockEditor";
import type { HotspotMarker, MatchingPair } from "@/components/LessonQuizBlockEditor";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface InteractiveQuestionEditorProps {
  question: any;
  onChange: (updates: Record<string, any>) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
}

function safeJson<T>(val: string | null | undefined, fallback: T): T {
  try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
}

// ─── Image Comparison Editor ──────────────────────────────────────────────────
function ImageComparisonEditor({ question, onChange, onUploadImage }: InteractiveQuestionEditorProps) {
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);

  const handleUpload = async (side: "A" | "B", file: File) => {
    if (!onUploadImage) return;
    side === "A" ? setUploadingA(true) : setUploadingB(true);
    const url = await onUploadImage(file);
    side === "A" ? setUploadingA(false) : setUploadingB(false);
    if (url) onChange(side === "A" ? { comparisonImageA: url } : { comparisonImageB: url });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Upload two images for side-by-side comparison. Students drag a slider to compare them.</p>
      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map(side => {
          const url = side === "A" ? question.comparisonImageA : question.comparisonImageB;
          const label = side === "A" ? question.comparisonLabelA : question.comparisonLabelB;
          const uploading = side === "A" ? uploadingA : uploadingB;
          return (
            <div key={side} className="space-y-2">
              <Label className="text-xs font-medium">Image {side}</Label>
              {url ? (
                <div className="relative">
                  <img src={url} alt={`Image ${side}`} className="w-full h-24 object-cover rounded border" />
                  <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6 bg-white/80 hover:bg-white"
                    onClick={() => onChange(side === "A" ? { comparisonImageA: null } : { comparisonImageB: null })}>
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors">
                  {uploading ? <span className="text-xs text-gray-400">Uploading…</span> : <><Upload className="w-4 h-4 text-gray-400 mb-1" /><span className="text-xs text-gray-400">Upload image</span></>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(side, f); e.target.value = ""; }} />
                </label>
              )}
              <Input
                placeholder={`Label for Image ${side} (optional)`}
                value={label ?? ""}
                onChange={e => onChange(side === "A" ? { comparisonLabelA: e.target.value } : { comparisonLabelB: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Drag Sort Editor ─────────────────────────────────────────────────────────
interface DragItem { id: string; text: string; imageUrl?: string }
function DragSortEditor({ question, onChange }: InteractiveQuestionEditorProps) {
  const items: DragItem[] = safeJson(question.dragItems, []);

  const setItems = (next: DragItem[]) => onChange({ dragItems: JSON.stringify(next) });

  const addItem = () => setItems([...items, { id: `item_${Date.now()}`, text: "" }]);
  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id: string, text: string) => setItems(items.map(i => i.id === id ? { ...i, text } : i));
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setItems(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Add items in the correct order. Students will drag them into the right sequence.</p>
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-5 text-right">{idx + 1}.</span>
          <Input
            value={item.text}
            onChange={e => updateItem(item.id, e.target.value)}
            placeholder={`Item ${idx + 1}`}
            className="h-7 text-xs flex-1"
          />
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up">
            <GripVertical className="w-3 h-3 text-gray-400" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => removeItem(item.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" className="text-xs border-dashed border-teal-300 text-teal-600 hover:bg-teal-50" onClick={addItem}>
        <Plus className="w-3 h-3 mr-1" /> Add Item
      </Button>
    </div>
  );
}

// ─── Branching / Clinical Scenario Editor ────────────────────────────────────
interface BranchingChoice { id: string; text: string; outcome: string; isCorrect: boolean }
interface BranchingConfig { scenario: string; choices: BranchingChoice[] }
function BranchingEditor({ question, onChange }: InteractiveQuestionEditorProps) {
  const config: BranchingConfig = safeJson(question.branchingConfig, { scenario: "", choices: [] });

  const setConfig = (next: BranchingConfig) => onChange({ branchingConfig: JSON.stringify(next) });

  const addChoice = () => setConfig({ ...config, choices: [...config.choices, { id: `c_${Date.now()}`, text: "", outcome: "", isCorrect: false }] });
  const removeChoice = (id: string) => setConfig({ ...config, choices: config.choices.filter(c => c.id !== id) });
  const updateChoice = (id: string, field: keyof BranchingChoice, value: any) =>
    setConfig({ ...config, choices: config.choices.map(c => c.id === id ? { ...c, [field]: value } : c) });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Clinical Scenario *</Label>
        <Textarea
          value={config.scenario}
          onChange={e => setConfig({ ...config, scenario: e.target.value })}
          placeholder="Describe the clinical scenario students must navigate…"
          className="mt-1 text-xs min-h-[80px]"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium">Decision Choices</Label>
        {config.choices.map((choice, idx) => (
          <div key={choice.id} className="border border-gray-200 rounded p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
              <Input
                value={choice.text}
                onChange={e => updateChoice(choice.id, "text", e.target.value)}
                placeholder="Choice text"
                className="h-7 text-xs flex-1"
              />
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={choice.isCorrect} onChange={e => updateChoice(choice.id, "isCorrect", e.target.checked)} className="rounded" />
                <span className="text-green-700">Correct</span>
              </label>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => removeChoice(choice.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <Input
              value={choice.outcome}
              onChange={e => updateChoice(choice.id, "outcome", e.target.value)}
              placeholder="Outcome / feedback for this choice"
              className="h-7 text-xs ml-6"
            />
          </div>
        ))}
        <Button size="sm" variant="outline" className="text-xs border-dashed border-teal-300 text-teal-600 hover:bg-teal-50" onClick={addChoice}>
          <Plus className="w-3 h-3 mr-1" /> Add Choice
        </Button>
      </div>
    </div>
  );
}

// ─── Fill in the Blank Editor ─────────────────────────────────────────────────
function FillBlankEditor({ question, onChange }: InteractiveQuestionEditorProps) {
  const template = question.fillBlankTemplate ?? "";
  const answers: string[][] = safeJson(question.fillBlankAnswers, []);

  // Count blanks in template (marked as ___)
  const blankCount = (template.match(/___/g) ?? []).length;

  const updateAnswer = (idx: number, val: string) => {
    const next = [...answers];
    next[idx] = val.split(",").map(s => s.trim()).filter(Boolean);
    onChange({ fillBlankAnswers: JSON.stringify(next) });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Sentence Template *</Label>
        <p className="text-xs text-gray-400 mb-1">Use <code className="bg-gray-100 px-1 rounded">___</code> (three underscores) for each blank.</p>
        <Textarea
          value={template}
          onChange={e => onChange({ fillBlankTemplate: e.target.value })}
          placeholder="e.g. The mitral valve has ___ leaflets and is located between the ___ and ___."
          className="text-xs min-h-[60px]"
        />
      </div>
      {blankCount > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Accepted Answers (comma-separated per blank)</Label>
          {Array.from({ length: blankCount }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12">Blank {i + 1}:</span>
              <Input
                value={(answers[i] ?? []).join(", ")}
                onChange={e => updateAnswer(i, e.target.value)}
                placeholder="answer1, answer2 (case-insensitive)"
                className="h-7 text-xs flex-1"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Annotation Editor ────────────────────────────────────────────────────────
interface AnnotationZone { x: number; y: number; radius: number; label: string }
function AnnotationEditor({ question, onChange, onUploadImage }: InteractiveQuestionEditorProps) {
  const [uploading, setUploading] = useState(false);
  const zones: AnnotationZone[] = safeJson(question.annotationTargetZones, []);
  const imgUrl = question.annotationImageUrl ?? "";

  const handleUpload = async (file: File) => {
    if (!onUploadImage) return;
    setUploading(true);
    const url = await onUploadImage(file);
    setUploading(false);
    if (url) onChange({ annotationImageUrl: url });
  };

  const addZone = () => {
    const next: AnnotationZone[] = [...zones, { x: 50, y: 50, radius: 10, label: "" }];
    onChange({ annotationTargetZones: JSON.stringify(next) });
  };
  const removeZone = (idx: number) => {
    const next = zones.filter((_, i) => i !== idx);
    onChange({ annotationTargetZones: JSON.stringify(next) });
  };
  const updateZone = (idx: number, field: keyof AnnotationZone, value: any) => {
    const next = zones.map((z, i) => i === idx ? { ...z, [field]: value } : z);
    onChange({ annotationTargetZones: JSON.stringify(next) });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Annotation Image *</Label>
        {imgUrl ? (
          <div className="relative mt-1">
            <img src={imgUrl} alt="Annotation" className="w-full max-h-48 object-contain rounded border bg-gray-50" />
            <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6 bg-white/80"
              onClick={() => onChange({ annotationImageUrl: null })}>
              <Trash2 className="w-3 h-3 text-red-500" />
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-teal-400 hover:bg-teal-50 mt-1">
            {uploading ? <span className="text-xs text-gray-400">Uploading…</span> : <><ImageIcon className="w-4 h-4 text-gray-400 mb-1" /><span className="text-xs text-gray-400">Upload image</span></>}
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium">Target Zones (x%, y%, radius%)</Label>
        <p className="text-xs text-gray-400">Define clickable target areas. Coordinates are percentages of image dimensions.</p>
        {zones.map((zone, idx) => (
          <div key={idx} className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
            <Input value={zone.x} onChange={e => updateZone(idx, "x", Number(e.target.value))} type="number" min="0" max="100" className="h-7 text-xs w-16" placeholder="X%" />
            <Input value={zone.y} onChange={e => updateZone(idx, "y", Number(e.target.value))} type="number" min="0" max="100" className="h-7 text-xs w-16" placeholder="Y%" />
            <Input value={zone.radius} onChange={e => updateZone(idx, "radius", Number(e.target.value))} type="number" min="1" max="50" className="h-7 text-xs w-16" placeholder="R%" />
            <Input value={zone.label} onChange={e => updateZone(idx, "label", e.target.value)} className="h-7 text-xs flex-1 min-w-[100px]" placeholder="Zone label" />
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => removeZone(idx)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" className="text-xs border-dashed border-teal-300 text-teal-600 hover:bg-teal-50" onClick={addZone}>
          <Plus className="w-3 h-3 mr-1" /> Add Zone
        </Button>
      </div>
    </div>
  );
}

// ─── Flashcard Editor ─────────────────────────────────────────────────────────
function FlashcardEditor({ question, onChange }: InteractiveQuestionEditorProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Students flip the card to reveal the back. They self-assess whether they knew the answer.</p>
      <div>
        <Label className="text-xs font-medium">Front (Question / Term) *</Label>
        <Textarea
          value={question.flashcardFront ?? ""}
          onChange={e => onChange({ flashcardFront: e.target.value })}
          placeholder="What is shown on the front of the card?"
          className="mt-1 text-xs min-h-[60px]"
        />
      </div>
      <div>
        <Label className="text-xs font-medium">Back (Answer / Definition) *</Label>
        <Textarea
          value={question.flashcardBack ?? ""}
          onChange={e => onChange({ flashcardBack: e.target.value })}
          placeholder="What is revealed when the card is flipped?"
          className="mt-1 text-xs min-h-[60px]"
        />
      </div>
    </div>
  );
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
export function InteractiveQuestionEditorPanel({ question, onChange, onUploadImage }: InteractiveQuestionEditorProps) {
  const type = question?.type;
  if (!type) return null;

  switch (type) {
    case "image_comparison":
      return <ImageComparisonEditor question={question} onChange={onChange} onUploadImage={onUploadImage} />;
    case "drag_sort":
      return <DragSortEditor question={question} onChange={onChange} onUploadImage={onUploadImage} />;
    case "branching":
      return <BranchingEditor question={question} onChange={onChange} onUploadImage={onUploadImage} />;
    case "fill_blank":
      return <FillBlankEditor question={question} onChange={onChange} onUploadImage={onUploadImage} />;
    case "annotation":
      return <AnnotationEditor question={question} onChange={onChange} onUploadImage={onUploadImage} />;
    case "flashcard":
      return <FlashcardEditor question={question} onChange={onChange} onUploadImage={onUploadImage} />;
    case "hotspot":
      return (
        <HotspotEditor
          imageUrl={question.hotspotImageUrl ?? undefined}
          markers={question.hotspotMarkers ? (typeof question.hotspotMarkers === "string" ? JSON.parse(question.hotspotMarkers) : question.hotspotMarkers) : []}
          onImageUpload={(url) => onChange({ hotspotImageUrl: url })}
          onMarkersChange={(markers: HotspotMarker[]) => onChange({ hotspotMarkers: JSON.stringify(markers) })}
          handleFileUpload={onUploadImage ? async (file: File, _field: string, _ctx: string) => onUploadImage(file) : undefined}
        />
      );
    case "matching":
      return (
        <MatchingEditor
          pairs={question.matchingPairs ? (typeof question.matchingPairs === "string" ? JSON.parse(question.matchingPairs) : question.matchingPairs) : []}
          onChange={(pairs: MatchingPair[]) => onChange({ matchingPairs: JSON.stringify(pairs) })}
        />
      );
    default:
      return null;
  }
}

/** Returns true if the question type is an interactive type that needs this panel */
export function isInteractiveType(type: string): boolean {
  return ["image_comparison", "drag_sort", "branching", "fill_blank", "annotation", "flashcard", "hotspot", "matching"].includes(type);
}
