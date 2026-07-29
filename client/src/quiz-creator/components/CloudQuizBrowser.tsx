import { useState } from "react";
import { X, Cloud, Trash2, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useQuizStore } from "../store/quizStore";

interface Props {
  onClose: () => void;
}

export function CloudQuizBrowser({ onClose }: Props) {
  const { data: quizzes, isLoading } = trpc.quizMaker.listQuizzes.useQuery();
  const deleteQuizMutation = trpc.quizMaker.deleteQuiz.useMutation();
  const utils = trpc.useUtils();
  const { loadQuiz } = useQuizStore();
  const [opening, setOpening] = useState<number | null>(null);

  const handleOpen = async (quiz: any) => {
    setOpening(quiz.id);
    try {
      // The questions are stored as JSON in the instructions field
      const questionsJson = quiz.instructions || "[]";
      const questions = JSON.parse(questionsJson);
      const quizFile = {
        meta: {
          id: crypto.randomUUID(),
          title: quiz.title,
          description: quiz.description || "",
          author: "",
          authorEmail: "",
          createdAt: quiz.createdAt?.toISOString?.() || new Date().toISOString(),
          updatedAt: quiz.updatedAt?.toISOString?.() || new Date().toISOString(),
          version: 1,
          licenseKey: null,
          teachificOrgId: null,
          tags: [],
          passingScore: quiz.passingScore || 70,
          timeLimit: quiz.timeLimit || null,
          shuffleQuestions: quiz.shuffleQuestions || false,
          shuffleAnswers: quiz.shuffleAnswers || false,
          showFeedback: "immediate" as const,
          allowRetry: true,
          maxAttempts: quiz.maxAttempts || 0,
          cloudId: quiz.id,
        },
        questions,
      };
      loadQuiz(quizFile as any, quiz.title + " (cloud)");
      onClose();
    } catch (err) {
      alert("Failed to open quiz: " + (err as Error).message);
    } finally {
      setOpening(null);
    }
  };

  const handleDelete = async (quizId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this quiz from the cloud? This cannot be undone.")) return;
    try {
      await deleteQuizMutation.mutateAsync({ quizId });
      utils.quizMaker.listQuizzes.invalidate();
    } catch (err) {
      alert("Failed to delete: " + (err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#e0f7f9" }}>
              <Cloud className="w-5 h-5" style={{ color: "#189aa1" }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">My Cloud Quizzes</h2>
              <p className="text-xs text-gray-500">Select a quiz to open in the editor</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : !quizzes || quizzes.length === 0 ? (
            <div className="text-center py-12">
              <Cloud className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No cloud quizzes yet</p>
              <p className="text-gray-400 text-xs mt-1">Use File → Save to Cloud to save your first quiz</p>
            </div>
          ) : (
            <div className="space-y-2">
              {quizzes.map((q: any) => (
                <button
                  key={q.id}
                  onClick={() => handleOpen(q)}
                  disabled={opening === q.id}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all text-left group disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#e0f7f9" }}>
                    <span className="text-sm font-bold" style={{ color: "#189aa1" }}>Q</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{q.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-300" />
                      <span className="text-xs text-gray-400">
                        {new Date(q.updatedAt).toLocaleDateString()}
                      </span>
                      {q.description && (
                        <span className="text-xs text-gray-400 truncate">— {q.description}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(q.id, e)}
                    className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
