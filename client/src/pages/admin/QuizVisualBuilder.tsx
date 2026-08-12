/**
 * QuizVisualBuilder — iSpring-style visual quiz editor
 * Route: /admin/quiz-creator/:quizId/builder
 */
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useQuizStore } from "@/quiz-creator/store/quizStore";
import { EditorToolbar } from "@/quiz-creator/components/EditorToolbar";
import { GroupedQuestionList } from "@/quiz-creator/components/GroupedQuestionList";
import { QuestionEditor } from "@/quiz-creator/components/QuestionEditor";
import { SlideViewEditor } from "@/quiz-creator/components/SlideViewEditor";
import { QuizPreview } from "@/quiz-creator/components/QuizPreview";
import { QuizSettings } from "@/quiz-creator/components/QuizSettings";
import { CloudQuizBrowser } from "@/quiz-creator/components/CloudQuizBrowser";
import BrandingPanel from "@/quiz-creator/components/BrandingPanel";
import QuizAnalyticsPanel from "@/quiz-creator/components/QuizAnalyticsPanel";
import { Loader2, ArrowLeft, BarChart3, Palette, Eye, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuizFile } from "@/quiz-creator/types/quiz";

export default function QuizVisualBuilder() {
  const params = useParams<{ quizId: string }>();
  const [, navigate] = useLocation();
  const quizId = params.quizId ? parseInt(params.quizId, 10) : null;
  const isNew = !quizId || isNaN(quizId);

  const { quiz, loadQuiz, newQuiz, activeSlide, activeQuestionId } = useQuizStore();
  const [previewMode, setPreviewMode] = useState<"entire" | "current" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCloud, setShowCloud] = useState(false);
  const [sidePanel, setSidePanel] = useState<"none" | "branding" | "analytics">("none");

  const { data, isLoading } = trpc.quizMaker.getQuiz.useQuery(
    { quizId: quizId! },
    { enabled: !isNew }
  );

  useEffect(() => {
    if (isNew) {
      newQuiz();
      return;
    }
    if (data?.builderConfig) {
      loadQuiz(data.builderConfig as QuizFile, data.title);
    }
  }, [data, isNew]);

  const cloudId = (quiz.meta as { cloudId?: number }).cloudId ?? quizId;
  const viewMode = quiz.meta.editorViewMode ?? "form";

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <EditorToolbar
        onPreview={() => setPreviewMode("entire")}
        onSettings={() => setShowSettings(true)}
        onCloudOpen={() => setShowCloud(true)}
      />

      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <Button variant="ghost" size="sm" onClick={() => navigate(cloudId ? `/admin/quiz-creator/${cloudId}` : "/admin/quiz-creator")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Quiz Admin
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          disabled={!activeQuestionId}
          onClick={() => setPreviewMode("current")}
        >
          <Eye className="w-4 h-4 mr-1" /> Preview Current
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPreviewMode("entire")}>
          <ListChecks className="w-4 h-4 mr-1" /> Preview Entire Quiz
        </Button>
        <Button
          variant={sidePanel === "branding" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setSidePanel(sidePanel === "branding" ? "none" : "branding")}
        >
          <Palette className="w-4 h-4 mr-1" /> Design
        </Button>
        <Button
          variant={sidePanel === "analytics" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setSidePanel(sidePanel === "analytics" ? "none" : "analytics")}
        >
          <BarChart3 className="w-4 h-4 mr-1" /> Analytics
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        <GroupedQuestionList />

        {viewMode === "slide" || activeSlide ? (
          <SlideViewEditor />
        ) : (
          <QuestionEditor />
        )}

        {sidePanel === "branding" && (
          <div className="w-80 shrink-0 border-l border-gray-100 bg-white overflow-y-auto">
            <BrandingPanel quizId={cloudId ?? null} />
          </div>
        )}
        {sidePanel === "analytics" && (
          <div className="w-96 shrink-0 border-l border-gray-100 bg-white overflow-y-auto">
            <QuizAnalyticsPanel quizId={cloudId ?? null} />
          </div>
        )}
      </div>

      {previewMode && <QuizPreview mode={previewMode} currentQuestionId={activeQuestionId} onClose={() => setPreviewMode(null)} />}
      {showSettings && <QuizSettings onClose={() => setShowSettings(false)} />}
      {showCloud && <CloudQuizBrowser onClose={() => setShowCloud(false)} />}
    </div>
  );
}
