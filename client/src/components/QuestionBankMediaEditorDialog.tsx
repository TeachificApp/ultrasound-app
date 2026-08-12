import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { reuseMediaRepositoryUrl } from "@/lib/mediaReuse";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Plus, Trash2, Upload, Video } from "lucide-react";

type MediaField = "questionImageUrl" | "questionVideoUrl" | "feedbackImageUrl" | "feedbackVideoUrl";

function parseOptions(value: unknown): { text: string; imageUrl?: string; videoUrl?: string; feedback?: string }[] {
  if (Array.isArray(value)) return value.map((option) => typeof option === "string" ? { text: option } : option);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parseOptions(parsed) : [];
  } catch {
    return [];
  }
}

function parseIndices(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value !== "string") return [];
  try { return parseIndices(JSON.parse(value)); } catch { return []; }
}

async function uploadQuestionMedia(file: File): Promise<{ url: string; mediaType: "image" | "video" }> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/upload-question-media", { method: "POST", body, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || "Media upload failed");
  return data;
}

export function MediaPicker({ label, field, value, onChange }: { label: string; field: MediaField; value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isVideo = field.toLowerCase().includes("video");

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadQuestionMedia(file);
      const expectedType = isVideo ? "video" : "image";
      if (uploaded.mediaType !== expectedType) throw new Error(`Please select a ${expectedType} file for this field.`);
      onChange(uploaded.url);
      toast.success(`${label} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Media upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const useExistingUrl = () => {
    reuseMediaRepositoryUrl(label.toLowerCase(), onChange);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          {isVideo ? <Video className="h-3.5 w-3.5 text-teal-600" /> : <ImageIcon className="h-3.5 w-3.5 text-teal-600" />}
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" className="h-7 text-teal-700 hover:text-teal-800" onClick={useExistingUrl}>Use URL</Button>
          {value && <Button type="button" size="sm" variant="ghost" className="h-7 text-red-600 hover:text-red-700" onClick={() => onChange("")}><Trash2 className="mr-1 h-3.5 w-3.5" />Remove</Button>}
        </div>
      </div>
      {value ? (
        isVideo
          ? <video src={value} controls className="max-h-40 w-full rounded border bg-black" />
          : <img src={value} alt={label} className="max-h-40 w-full rounded border bg-white object-contain" />
      ) : (
        <div className="flex gap-2">
          <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Paste media URL" className="h-8 text-xs bg-white" />
          <Button type="button" size="sm" variant="outline" className="h-8 whitespace-nowrap" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
            Upload
          </Button>
        </div>
      )}
      <input ref={inputRef} type="file" accept={isVideo ? "video/*" : "image/*"} className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
    </div>
  );
}

export function QuestionBankMediaEditorDialog({ question, open, onOpenChange, onSaved }: { question: any | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved?: () => void }) {
  const [draft, setDraft] = useState<any>(null);
  const updateQuestion = trpc.questionBank.updateQuestion.useMutation({
    onSuccess: () => {
      toast.success("Question and media saved");
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!question) { setDraft(null); return; }
    const options = parseOptions(question.options);
    setDraft({
      ...question,
      options: options.length > 0 ? options : [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
      correctAnswer: question.correctAnswer ?? "0",
      correctAnswers: parseIndices(question.correctAnswers),
      questionImageUrl: question.questionImageUrl ?? "",
      questionVideoUrl: question.questionVideoUrl ?? "",
      feedbackImageUrl: question.feedbackImageUrl ?? "",
      feedbackVideoUrl: question.feedbackVideoUrl ?? "",
      explanation: question.explanation ?? "",
    });
  }, [question]);

  if (!draft) return null;
  const supportsChoices = ["mcq", "truefalse", "multiselect"].includes(draft.type);
  const isMultiple = draft.type === "multiselect";

  const save = () => updateQuestion.mutate({
    id: draft.id,
    question: draft.question,
    options: draft.options.filter((option: any) => option.text.trim()),
    correctAnswer: String(draft.correctAnswer ?? ""),
    correctAnswers: isMultiple ? draft.correctAnswers : null,
    explanation: draft.explanation || null,
    questionImageUrl: draft.questionImageUrl || null,
    questionVideoUrl: draft.questionVideoUrl || null,
    feedbackImageUrl: draft.feedbackImageUrl || null,
    feedbackVideoUrl: draft.feedbackVideoUrl || null,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quiz Question</DialogTitle>
          <DialogDescription>Edits apply anywhere this shared Question Bank question is used. Add media for the question itself and separate media displayed with learner feedback.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>Question</Label>
            <Textarea value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} rows={3} className="mt-1" />
          </div>
          {supportsChoices && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Answer Choices</Label><Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, options: [...draft.options, { text: "" }] })}><Plus className="mr-1 h-3.5 w-3.5" />Add Choice</Button></div>
              {draft.options.map((option: any, index: number) => {
                const checked = isMultiple ? draft.correctAnswers.includes(index) : String(draft.correctAnswer) === String(index);
                return <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-2" key={index}>
                  <div className="flex items-center gap-2">
                    <input aria-label={`Correct answer ${index + 1}`} type={isMultiple ? "checkbox" : "radio"} name={`correct-${draft.id}`} checked={checked} onChange={() => setDraft({ ...draft, correctAnswer: String(index), correctAnswers: isMultiple ? (checked ? draft.correctAnswers.filter((item: number) => item !== index) : [...draft.correctAnswers, index]) : draft.correctAnswers })} className="h-4 w-4 accent-teal-600" />
                    <Input value={option.text} onChange={(event) => setDraft({ ...draft, options: draft.options.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, text: event.target.value } : item) })} placeholder={`Choice ${index + 1}`} />
                    <Button type="button" size="icon" variant="ghost" className="text-red-600" disabled={draft.options.length <= 2} onClick={() => setDraft({ ...draft, options: draft.options.filter((_: any, itemIndex: number) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Textarea value={option.feedback ?? ""} onChange={(event) => setDraft({ ...draft, options: draft.options.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, feedback: event.target.value } : item) })} placeholder={`Feedback for choice ${index + 1}`} rows={2} className="mt-2 text-xs" />
                </div>;
              })}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <MediaPicker label="Question Image" field="questionImageUrl" value={draft.questionImageUrl} onChange={(value) => setDraft({ ...draft, questionImageUrl: value })} />
            <MediaPicker label="Question Video" field="questionVideoUrl" value={draft.questionVideoUrl} onChange={(value) => setDraft({ ...draft, questionVideoUrl: value })} />
          </div>
          <div>
            <Label>Feedback Explanation</Label>
            <Textarea value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} rows={3} placeholder="Shown after a learner checks their answer." className="mt-1" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <MediaPicker label="Feedback Image" field="feedbackImageUrl" value={draft.feedbackImageUrl} onChange={(value) => setDraft({ ...draft, feedbackImageUrl: value })} />
            <MediaPicker label="Feedback Video" field="feedbackVideoUrl" value={draft.feedbackVideoUrl} onChange={(value) => setDraft({ ...draft, feedbackVideoUrl: value })} />
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button className="bg-teal-600 hover:bg-teal-700" disabled={!draft.question.trim() || updateQuestion.isPending} onClick={save}>{updateQuestion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Question</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
