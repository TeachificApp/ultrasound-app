import React, { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, Cloud, Gamepad2, Image, Link2, Loader2, MousePointer2, Play, Plus, Puzzle, QrCode, Sparkles, Trash2, Type, Upload, Video } from "lucide-react";

type InteractionType = "multiple_choice" | "true_false" | "word_cloud" | "hotspot" | "puzzle";

type SlideForm = {
  interactionType: InteractionType;
  slideTitle: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  mediaUrl: string;
  mediaType: "" | "image" | "video" | "gif";
  timeLimitSeconds: number;
  points: number;
  wordLimit: number;
  hotspotX: number;
  hotspotY: number;
  hotspotWidth: number;
  hotspotHeight: number;
  puzzleItems: string;
};

const interactionMeta: Record<InteractionType, { title: string; detail: string; icon: React.ReactNode }> = {
  multiple_choice: { title: "Multiple choice", detail: "Score a selected answer", icon: <Gamepad2 className="w-4 h-4" /> },
  true_false: { title: "True or false", detail: "Fast binary response", icon: <Type className="w-4 h-4" /> },
  word_cloud: { title: "Word cloud", detail: "Collect group free-word responses", icon: <Cloud className="w-4 h-4" /> },
  hotspot: { title: "Hotspot", detail: "Point and click on media", icon: <MousePointer2 className="w-4 h-4" /> },
  puzzle: { title: "Puzzle", detail: "Arrange terms in the right order", icon: <Puzzle className="w-4 h-4" /> },
};

const emptySlide = (): SlideForm => ({
  interactionType: "multiple_choice",
  slideTitle: "",
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
  mediaUrl: "",
  mediaType: "",
  timeLimitSeconds: 20,
  points: 100,
  wordLimit: 3,
  hotspotX: 40,
  hotspotY: 40,
  hotspotWidth: 20,
  hotspotHeight: 20,
  puzzleItems: "",
});

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TeachGames() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const mediaRef = useRef<HTMLInputElement>(null);
  const kahootRef = useRef<HTMLInputElement>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [newSlideOpen, setNewSlideOpen] = useState(false);
  const [gameTitle, setGameTitle] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [slide, setSlide] = useState<SlideForm>(emptySlide());
  const [editingSlideId, setEditingSlideId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: teachContext, isLoading: contextLoading } = trpc.teach.getMyContext.useQuery(undefined, { enabled: !!user });
  const { data: allGames = [], isLoading: gamesLoading } = trpc.sonoQuiz.listQuizzes.useQuery(undefined, { enabled: !!teachContext?.canAccessTeach });
  const { data: gameDetail, isLoading: detailLoading } = trpc.sonoQuiz.getQuiz.useQuery(
    { quizId: selectedGameId! },
    { enabled: !!selectedGameId },
  );
  const games = useMemo(() => allGames.filter((game: any) => game.isTeachGame), [allGames]);

  const createGame = trpc.sonoQuiz.createQuiz.useMutation({
    onSuccess: ({ quizId }) => {
      utils.sonoQuiz.listQuizzes.invalidate();
      setSelectedGameId(quizId);
      setNewGameOpen(false);
      setGameTitle("");
      setGameDescription("");
      toast.success("Teach game created");
    },
    onError: (error) => toast.error(error.message),
  });
  const saveSlide = trpc.sonoQuiz.upsertQuestion.useMutation({
    onSuccess: () => {
      if (selectedGameId) utils.sonoQuiz.getQuiz.invalidate({ quizId: selectedGameId });
      utils.sonoQuiz.listQuizzes.invalidate();
      setNewSlideOpen(false);
      setEditingSlideId(null);
      setSlide(emptySlide());
      toast.success("Game slide saved");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteSlide = trpc.sonoQuiz.deleteQuestion.useMutation({
    onSuccess: () => {
      if (selectedGameId) utils.sonoQuiz.getQuiz.invalidate({ quizId: selectedGameId });
      utils.sonoQuiz.listQuizzes.invalidate();
      toast.success("Slide deleted");
    },
    onError: (error) => toast.error(error.message),
  });
  const reorderSlides = trpc.sonoQuiz.reorderQuestions.useMutation({
    onSuccess: () => {
      if (selectedGameId) utils.sonoQuiz.getQuiz.invalidate({ quizId: selectedGameId });
      toast.success("Slide order updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const launchGame = trpc.sonoQuiz.createSession.useMutation({
    onSuccess: ({ sessionId }) => {
      window.open(`/teach/games/host/${sessionId}`, "_blank", "noopener,noreferrer");
      toast.success("Live session opened. Share the QR code or Game PIN with your group.");
    },
    onError: (error) => toast.error(error.message),
  });
  const uploadMedia = trpc.sonoQuiz.uploadTeachGameMedia.useMutation({
    onSuccess: ({ url, mediaType }) => {
      setSlide((current) => ({ ...current, mediaUrl: url, mediaType }));
      toast.success("Slide media uploaded");
    },
    onError: (error) => toast.error(error.message),
  });
  const importKahoot = trpc.sonoQuiz.importKahootSpreadsheet.useMutation({
    onSuccess: ({ quizId, questionCount, warnings }) => {
      utils.sonoQuiz.listQuizzes.invalidate();
      setSelectedGameId(quizId);
      toast.success(`Imported ${questionCount} Kahoot quiz slides${warnings.length ? ` with ${warnings.length} review note(s)` : ""}.`);
      setImporting(false);
    },
    onError: (error) => { setImporting(false); toast.error(error.message); },
  });

  if (loading || contextLoading) return <div className="min-h-screen grid place-items-center bg-slate-50"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>;
  if (!user) { window.location.href = getLoginUrl("/teach/games"); return null; }
  if (!teachContext?.canAccessTeach) return <div className="min-h-screen grid place-items-center p-6 bg-slate-50"><Card className="max-w-md"><CardHeader><CardTitle>TEACH access required</CardTitle><CardDescription>Live games are available to LMS instructors and EducatorAssist™ educators.</CardDescription></CardHeader></Card></div>;

  const openNewSlide = () => { setSlide(emptySlide()); setEditingSlideId(null); setNewSlideOpen(true); };
  const openEditSlide = (question: any) => {
    let config: any = {};
    try { config = question.interactionConfig ? JSON.parse(question.interactionConfig) : {}; } catch { /* retain safe defaults */ }
    let options: string[] = [];
    try { options = JSON.parse(question.options); } catch { /* retain safe defaults */ }
    setSlide({
      ...emptySlide(),
      interactionType: question.interactionType ?? "multiple_choice",
      slideTitle: question.slideTitle ?? "",
      question: question.question,
      options: [...options, "", "", "", ""].slice(0, 4),
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? "",
      mediaUrl: question.mediaUrl ?? "",
      mediaType: question.mediaType ?? "",
      timeLimitSeconds: question.timeLimitSeconds ?? 20,
      points: question.points ?? 100,
      wordLimit: config.wordLimit ?? 3,
      hotspotX: config.targetRegions?.[0]?.x ?? 40,
      hotspotY: config.targetRegions?.[0]?.y ?? 40,
      hotspotWidth: config.targetRegions?.[0]?.width ?? 20,
      hotspotHeight: config.targetRegions?.[0]?.height ?? 20,
      puzzleItems: Array.isArray(config.correctOrder) ? config.correctOrder.join(", ") : "",
    });
    setEditingSlideId(question.id);
    setNewSlideOpen(true);
  };
  const saveCurrentSlide = () => {
    if (!selectedGameId || !slide.question.trim()) return toast.error("Add a question or prompt before saving.");
    const config = slide.interactionType === "word_cloud"
      ? { wordLimit: slide.wordLimit, moderate: true }
      : slide.interactionType === "hotspot"
        ? { targetRegions: [{ x: slide.hotspotX, y: slide.hotspotY, width: slide.hotspotWidth, height: slide.hotspotHeight, label: "Correct area" }] }
        : slide.interactionType === "puzzle"
          ? { correctOrder: slide.puzzleItems.split(",").map((item) => item.trim()).filter(Boolean) }
          : undefined;
    saveSlide.mutate({
      questionId: editingSlideId ?? undefined,
      quizId: selectedGameId,
      interactionType: slide.interactionType,
      interactionConfig: config,
      slideTitle: slide.slideTitle || undefined,
      question: slide.question,
      options: slide.interactionType === "true_false" ? ["True", "False"] : slide.options.filter(Boolean),
      correctAnswer: ["multiple_choice", "true_false"].includes(slide.interactionType) ? slide.correctAnswer : -1,
      explanation: slide.explanation || undefined,
      mediaUrl: slide.mediaUrl || undefined,
      mediaType: slide.mediaType || undefined,
      timeLimitSeconds: slide.timeLimitSeconds,
      points: ["multiple_choice", "true_false"].includes(slide.interactionType) ? slide.points : 0,
      sortOrder: editingSlideId ? (gameDetail?.questions.findIndex((question: any) => question.id === editingSlideId) ?? 0) : (gameDetail?.questions.length ?? 0),
    });
  };
  const handleMediaUpload = async (file: File) => {
    if (!selectedGameId) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return toast.error("Use JPG, PNG, WebP, or GIF media.");
    uploadMedia.mutate({ quizId: selectedGameId, fileName: file.name, mimeType: file.type as any, fileData: await toBase64(file) });
  };
  const handleKahootImport = async (file: File) => {
    if (!/\.xlsx$/i.test(file.name)) return toast.error("Choose a Kahoot-style .xlsx quiz spreadsheet.");
    setImporting(true);
    importKahoot.mutate({ title: file.name.replace(/\.xlsx$/i, ""), fileName: file.name, fileData: await toBase64(file), ownerContext: "lms_instructor" });
  };
  const moveSlide = (index: number, direction: -1 | 1) => {
    if (!selectedGameId || !gameDetail?.questions) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= gameDetail.questions.length) return;
    const order = [...gameDetail.questions];
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    reorderSlides.mutate({ quizId: selectedGameId, order: order.map((question: any, sortOrder: number) => ({ questionId: question.id, sortOrder })) });
  };

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white"><div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap gap-3 items-center justify-between"><div className="flex items-center gap-3"><Link href="/teach"><Button variant="ghost" size="icon" aria-label="Back to Teach"><ArrowLeft className="w-4 h-4" /></Button></Link><div><h1 className="text-xl font-bold flex items-center gap-2"><Gamepad2 className="text-teal-600" /> Teach Live Games</h1><p className="text-sm text-slate-500">Teacher-led interactive sessions with QR code and Game PIN joining</p></div></div><div className="flex gap-2"><input ref={kahootRef} className="hidden" type="file" accept=".xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleKahootImport(file); event.currentTarget.value = ""; }} /><Button variant="outline" onClick={() => kahootRef.current?.click()} disabled={importing}><Upload className="w-4 h-4 mr-1" /> {importing ? "Importing…" : "Import Kahoot .xlsx"}</Button><Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setNewGameOpen(true)}><Plus className="w-4 h-4 mr-1" /> New live game</Button></div></div></header>
    <main className="max-w-7xl mx-auto px-4 py-6">
      {!selectedGameId ? <section>{gamesLoading ? <div className="py-20 text-center"><Loader2 className="mx-auto animate-spin text-teal-600" /></div> : games.length === 0 ? <Card className="border-dashed"><CardContent className="py-16 text-center"><Sparkles className="w-10 h-10 text-aqua-500 mx-auto mb-3" /><h2 className="font-semibold">Create your first live teaching game</h2><p className="text-sm text-slate-500 mt-1">Mix quiz, word cloud, hotspot, and puzzle slides—or import an authorised Kahoot spreadsheet.</p></CardContent></Card> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{games.map((game: any) => <Card key={game.id} className="overflow-hidden"><div className="h-2 bg-teal-600" /><CardHeader><div className="flex gap-2 justify-between"><Badge variant="outline" className="border-teal-200 text-teal-700">Live game</Badge><Badge variant="outline">{game.status}</Badge></div><CardTitle className="mt-3">{game.title}</CardTitle><CardDescription>{game.questionCount} slide{game.questionCount === 1 ? "" : "s"} · {game.timeLimitSeconds}s default</CardDescription></CardHeader><CardContent className="flex gap-2"><Button className="flex-1" variant="outline" onClick={() => setSelectedGameId(game.id)}>Edit slides</Button><Button className="bg-teal-600 hover:bg-teal-700" disabled={!game.questionCount} onClick={() => launchGame.mutate({ quizId: game.id, allowAnonymous: true, showLeaderboard: true })}><Play className="w-4 h-4" /></Button></CardContent></Card>)}</div>}</section> : <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><div><Button variant="ghost" className="px-0" onClick={() => setSelectedGameId(null)}><ArrowLeft className="w-4 h-4 mr-1" /> All games</Button><h2 className="text-2xl font-bold">{gameDetail?.quiz.title ?? "Loading game…"}</h2><p className="text-sm text-slate-500">Arrange and mix slide interactions. Launch when your group is ready.</p></div><div className="flex gap-2"><Button variant="outline" onClick={openNewSlide}><Plus className="w-4 h-4 mr-1" /> Add slide</Button><Button className="bg-teal-600 hover:bg-teal-700" disabled={!gameDetail?.questions.length || launchGame.isPending} onClick={() => launchGame.mutate({ quizId: selectedGameId, allowAnonymous: true, showLeaderboard: true })}><QrCode className="w-4 h-4 mr-1" /> Launch live session</Button></div></div>
        {detailLoading ? <Loader2 className="mx-auto animate-spin text-teal-600" /> : <div className="space-y-3">{gameDetail?.questions.map((question: any, index: number) => { const meta = interactionMeta[question.interactionType as InteractionType] ?? interactionMeta.multiple_choice; return <Card key={question.id}><CardContent className="p-4 flex gap-4 items-start"><div className="w-9 h-9 shrink-0 rounded-full bg-teal-50 text-teal-700 grid place-items-center font-semibold">{index + 1}</div><div className="flex-1 min-w-0"><div className="flex flex-wrap gap-2 items-center"><Badge className="bg-teal-50 text-teal-700 hover:bg-teal-50">{meta.title}</Badge>{question.mediaType && <Badge variant="outline">{question.mediaType}</Badge>}</div><p className="font-medium mt-2">{question.question}</p><p className="text-sm text-slate-500 mt-1">{meta.detail}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Move slide up" disabled={index === 0 || reorderSlides.isPending} onClick={() => moveSlide(index, -1)}><ArrowUp className="w-4 h-4" /></Button><Button variant="ghost" size="icon" aria-label="Move slide down" disabled={index === gameDetail.questions.length - 1 || reorderSlides.isPending} onClick={() => moveSlide(index, 1)}><ArrowDown className="w-4 h-4" /></Button><Button variant="outline" size="sm" onClick={() => openEditSlide(question)}>Edit</Button><Button variant="ghost" size="icon" className="text-red-600" onClick={() => { if (confirm("Delete this slide?")) deleteSlide.mutate({ quizId: selectedGameId, questionId: question.id }); }}><Trash2 className="w-4 h-4" /></Button></div></CardContent></Card>; })}{!gameDetail?.questions.length && <Card className="border-dashed"><CardContent className="py-12 text-center text-slate-500">Add a slide to begin building the live teaching experience.</CardContent></Card>}</div>}
      </section>}</main>
    <Dialog open={newGameOpen} onOpenChange={setNewGameOpen}><DialogContent><DialogHeader><DialogTitle>New Teach live game</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Game title</Label><Input value={gameTitle} onChange={(event) => setGameTitle(event.target.value)} placeholder="e.g., Fetal Echo Warm-Up" className="mt-1" /></div><div><Label>Description</Label><Textarea value={gameDescription} onChange={(event) => setGameDescription(event.target.value)} placeholder="Optional teacher notes" className="mt-1" /></div></div><DialogFooter><Button variant="outline" onClick={() => setNewGameOpen(false)}>Cancel</Button><Button className="bg-teal-600 hover:bg-teal-700" disabled={!gameTitle.trim() || createGame.isPending} onClick={() => createGame.mutate({ title: gameTitle.trim(), description: gameDescription || undefined, isTeachGame: true, ownerContext: "lms_instructor", importSource: "manual" })}>Create game</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={newSlideOpen} onOpenChange={setNewSlideOpen}><DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingSlideId ? "Edit game slide" : "Add game slide"}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Interaction</Label><Select value={slide.interactionType} onValueChange={(value: InteractionType) => setSlide((current) => ({ ...current, interactionType: value }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(interactionMeta) as InteractionType[]).map((type) => <SelectItem key={type} value={type}>{interactionMeta[type].title}</SelectItem>)}</SelectContent></Select></div><div><Label>Slide title</Label><Input value={slide.slideTitle} onChange={(event) => setSlide((current) => ({ ...current, slideTitle: event.target.value }))} placeholder="Optional presenter heading" className="mt-1" /></div><div><Label>Question or prompt</Label><Textarea value={slide.question} onChange={(event) => setSlide((current) => ({ ...current, question: event.target.value }))} className="mt-1" /></div>{["multiple_choice", "true_false"].includes(slide.interactionType) && <div className="space-y-2"><Label>Answer options</Label>{(slide.interactionType === "true_false" ? ["True", "False"] : slide.options).map((option, index) => <div key={index} className="flex gap-2 items-center"><input type="radio" checked={slide.correctAnswer === index} onChange={() => setSlide((current) => ({ ...current, correctAnswer: index }))} aria-label={`Correct option ${index + 1}`} /><Input value={option} disabled={slide.interactionType === "true_false"} onChange={(event) => setSlide((current) => ({ ...current, options: current.options.map((value, optionIndex) => optionIndex === index ? event.target.value : value) }))} /></div>)}</div>}{slide.interactionType === "word_cloud" && <div><Label>Maximum words per response</Label><Input type="number" min={1} max={10} value={slide.wordLimit} onChange={(event) => setSlide((current) => ({ ...current, wordLimit: Number(event.target.value) }))} className="mt-1" /></div>}{slide.interactionType === "hotspot" && <div className="grid grid-cols-2 gap-3"><p className="col-span-2 text-sm text-slate-500">Set the correct target as percentages of the image width and height.</p>{(["hotspotX", "hotspotY", "hotspotWidth", "hotspotHeight"] as const).map((field) => <div key={field}><Label>{field.replace("hotspot", "").replace(/([A-Z])/g, " $1") || "X"} (%)</Label><Input type="number" min={0} max={100} value={slide[field]} onChange={(event) => setSlide((current) => ({ ...current, [field]: Number(event.target.value) }))} className="mt-1" /></div>)}</div>}{slide.interactionType === "puzzle" && <div><Label>Correct puzzle order</Label><Textarea value={slide.puzzleItems} onChange={(event) => setSlide((current) => ({ ...current, puzzleItems: event.target.value }))} placeholder="Comma-separated steps or terms" className="mt-1" /></div>}<div className="grid sm:grid-cols-2 gap-3"><div><Label>Time limit (seconds)</Label><Input type="number" min={5} max={120} value={slide.timeLimitSeconds} onChange={(event) => setSlide((current) => ({ ...current, timeLimitSeconds: Number(event.target.value) }))} className="mt-1" /></div><div><Label>Points</Label><Input type="number" min={0} max={1000} value={slide.points} disabled={!(["multiple_choice", "true_false"].includes(slide.interactionType))} onChange={(event) => setSlide((current) => ({ ...current, points: Number(event.target.value) }))} className="mt-1" /></div></div><div className="border rounded-lg p-3 space-y-3"><div className="flex items-center justify-between"><Label>Slide media</Label><input ref={mediaRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleMediaUpload(file); event.currentTarget.value = ""; }} /><Button type="button" variant="outline" size="sm" disabled={uploadMedia.isPending} onClick={() => mediaRef.current?.click()}><Upload className="w-4 h-4 mr-1" /> Upload image</Button></div><div className="flex gap-2"><Input value={slide.mediaUrl} onChange={(event) => setSlide((current) => ({ ...current, mediaUrl: event.target.value }))} placeholder="Image, video, or GIF URL" /><Select value={slide.mediaType || "none"} onValueChange={(value) => setSlide((current) => ({ ...current, mediaType: value === "none" ? "" : value as any }))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No media</SelectItem><SelectItem value="image">Image</SelectItem><SelectItem value="video">Video URL</SelectItem><SelectItem value="gif">GIF URL</SelectItem></SelectContent></Select></div>{slide.mediaUrl && <p className="text-xs text-slate-500 flex gap-1 items-center"><Link2 className="w-3 h-3" /> GIPHY search will appear here after a GIPHY key is connected. Direct GIF URLs already work.</p>}</div><div><Label>Reveal explanation</Label><Textarea value={slide.explanation} onChange={(event) => setSlide((current) => ({ ...current, explanation: event.target.value }))} placeholder="Optional explanation after the response reveal" className="mt-1" /></div></div><DialogFooter><Button variant="outline" onClick={() => setNewSlideOpen(false)}>Cancel</Button><Button className="bg-teal-600 hover:bg-teal-700" disabled={saveSlide.isPending} onClick={saveCurrentSlide}>Save slide</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
