import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useQuizStore } from "../store/quizStore";
import { QuestionList } from "./QuestionList";
import type { QuestionGroup } from "../types/quiz";
import type { QuizFile } from "../types/quiz";
import { LayoutList, Presentation, Search, Shuffle, ChevronDown, ChevronRight, PlayCircle, Trophy, XCircle, Replace } from "lucide-react";

const GROUP_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#a855f7", "#ec4899"];

function questionSearchText(question: Record<string, unknown>) {
  return JSON.stringify({
    stem: question.stem,
    stemHtml: question.stemHtml,
    explanation: question.explanation,
    explanationHtml: question.explanationHtml,
    feedback: question.feedback,
    data: question.data,
  }).toLowerCase();
}

export function GroupedQuestionList() {
  const { quiz, updateMeta, activeSlide, setActiveSlide, setEditorViewMode, loadQuiz } = useQuizStore();
  const [search, setSearch] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [replaceScope, setReplaceScope] = useState<"quiz" | "questionBank">("quiz");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const findAndReplace = trpc.quizMaker.findAndReplaceText.useMutation({
    onSuccess: (result) => {
      loadQuiz(result.builderConfig as QuizFile, quiz.meta.title);
      setSearch("");
      alert(`${result.replacementCount} replacement${result.replacementCount === 1 ? "" : "s"} applied${result.updatedQuestionBankRecords ? ` and ${result.updatedQuestionBankRecords} linked Question Bank record${result.updatedQuestionBankRecords === 1 ? "" : "s"} synchronized` : " to this quiz only"}.`);
    },
    onError: (error) => alert(error.message),
  });
  const viewMode = quiz.meta.editorViewMode ?? "form";
  const groups = quiz.meta.groups ?? [];
  const drawConfig = quiz.meta.drawConfig;

  const toggleGroup = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const questionsByGroup = (groupId: string | null) =>
    quiz.questions.filter((q) => (groupId ? q.groupId === groupId : !q.groupId));

  const getDrawRatio = (groupId: string) => {
    const total = questionsByGroup(groupId).length;
    const draw = drawConfig?.groupDraws.find((g) => g.groupId === groupId)?.drawCount ?? total;
    return `${draw}/${total}`;
  };

  const filteredQuestions = search.trim()
    ? quiz.questions.filter((q) => questionSearchText(q as unknown as Record<string, unknown>).includes(search.toLowerCase()))
    : null;

  const handleFindAndReplace = () => {
    const quizId = Number((quiz.meta as { cloudId?: number }).cloudId);
    if (!quizId) {
      alert("Save this quiz to the database before using find and replace.");
      return;
    }
    if (!findText) {
      alert("Enter the word or phrase to find.");
      return;
    }
    const scopeLabel = replaceScope === "questionBank" ? "this quiz and its linked Question Bank records" : "this quiz only";
    if (!window.confirm(`Replace every exact occurrence of “${findText}” with “${replaceText}” in ${scopeLabel}? This cannot be undone automatically.`)) return;
    findAndReplace.mutate({ quizId, find: findText, replace: replaceText, updateQuestionBank: replaceScope === "questionBank" });
  };

  const addGroup = () => {
    const newGroup: QuestionGroup = {
      id: crypto.randomUUID(),
      name: `Group ${groups.length + 1}`,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
    };
    updateMeta({ groups: [...groups, newGroup] });
  };

  return (
    <div className="w-80 shrink-0 border-r border-gray-100 flex flex-col h-full bg-white">
      {/* View toggle — Form View / Slide View */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-100">
        <div className="flex rounded-lg bg-gray-100 p-0.5">
          <button
            onClick={() => setEditorViewMode("form")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "form" ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" /> Form View
          </button>
          <button
            onClick={() => setEditorViewMode("slide")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "slide" ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Presentation className="w-3.5 h-3.5" /> Slide View
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        </div>
        {search.trim() && <p className="mt-1.5 text-xs text-gray-500">{filteredQuestions?.length ?? 0} matching question{filteredQuestions?.length === 1 ? "" : "s"}</p>}
        <button type="button" onClick={() => setShowReplace((current) => !current)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900">
          <Replace className="h-3.5 w-3.5" /> Find and replace
        </button>
        {showReplace && (
          <div className="mt-2 space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-2.5">
            <input value={findText} onChange={(event) => setFindText(event.target.value)} placeholder="Find exact word or phrase" className="w-full rounded border border-teal-200 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-teal-500" />
            <input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="Replace with" className="w-full rounded border border-teal-200 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-teal-500" />
            <fieldset className="space-y-1 text-xs text-gray-700"><legend className="mb-1 font-medium text-teal-900">Apply replacements to</legend><label className="flex items-start gap-1.5"><input type="radio" checked={replaceScope === "quiz"} onChange={() => setReplaceScope("quiz")} /> <span><strong>This quiz only</strong><br /><span className="text-gray-500">Keeps linked Question Bank records unchanged.</span></span></label><label className="flex items-start gap-1.5"><input type="radio" checked={replaceScope === "questionBank"} onChange={() => setReplaceScope("questionBank")} /> <span><strong>This quiz and linked Question Bank records</strong><br /><span className="text-gray-500">Synchronizes exact replacements to this quiz’s linked bank questions.</span></span></label></fieldset>
            <button type="button" disabled={findAndReplace.isPending || !findText} onClick={handleFindAndReplace} className="w-full rounded bg-teal-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{findAndReplace.isPending ? "Replacing…" : "Replace in selected scope"}</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Special slides */}
        <div className="px-2 py-2 space-y-0.5 border-b border-gray-50">
          <button
            onClick={() => setActiveSlide("intro")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeSlide === "intro" ? "bg-teal-50 text-teal-700 border border-teal-200" : "hover:bg-gray-50 text-gray-700"
            }`}
          >
            <PlayCircle className="w-4 h-4 shrink-0" /> Intro Slide
          </button>
        </div>

        {/* Groups */}
        {filteredQuestions ? (
          <div className="p-2 space-y-0.5">
            {filteredQuestions.length === 0 && <p className="px-3 py-4 text-center text-xs text-gray-500">No question content matches this search.</p>}
            {filteredQuestions.map((q) => (
              <button type="button" key={q.id} onClick={() => useQuizStore.getState().setActiveQuestion(q.id)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-teal-50 truncate">{q.order}. {q.stem || "Untitled"}</button>
            ))}
          </div>
        ) : (
          <>
            {groups.map((group) => {
              const qs = questionsByGroup(group.id);
              const isCollapsed = collapsed[group.id];
              return (
                <div key={group.id} className="border-b border-gray-50">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="flex-1 text-left text-sm font-medium text-gray-700 truncate">{group.name}</span>
                    {drawConfig?.enabled && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                        <Shuffle className="w-3 h-3" /> {getDrawRatio(group.id)}
                      </span>
                    )}
                  </button>
                  {!isCollapsed && qs.length > 0 && (
                    <div className="px-2 pb-2 space-y-0.5">
                      {qs.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => useQuizStore.getState().setActiveQuestion(q.id)}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-teal-50 rounded-lg truncate"
                        >
                          {q.order}. {q.stem || "Untitled question"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped questions header */}
            {questionsByGroup(null).length > 0 && groups.length > 0 && (
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Ungrouped</div>
            )}
          </>
        )}

        {/* Question list (flat, with DnD) */}
        {!filteredQuestions && <div className="flex-1 min-h-0"><QuestionList compact /></div>}

        {/* Result slides */}
        <div className="px-2 py-2 space-y-0.5 border-t border-gray-100">
          <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Result Slides</p>
          <button
            onClick={() => setActiveSlide("pass")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeSlide === "pass" ? "bg-green-50 text-green-700 border border-green-200" : "hover:bg-gray-50 text-gray-700"
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0" /> Passing Result
          </button>
          <button
            onClick={() => setActiveSlide("fail")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeSlide === "fail" ? "bg-red-50 text-red-700 border border-red-200" : "hover:bg-gray-50 text-gray-700"
            }`}
          >
            <XCircle className="w-4 h-4 shrink-0" /> Failing Result
          </button>
        </div>
      </div>

      <div className="p-2 border-t border-gray-100">
        <button
          onClick={addGroup}
          className="w-full py-2 text-xs font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
        >
          + Add Question Group
        </button>
      </div>
    </div>
  );
}
