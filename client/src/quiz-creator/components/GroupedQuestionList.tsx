import { useState } from "react";
import { useQuizStore } from "../store/quizStore";
import { QuestionList } from "./QuestionList";
import type { QuestionGroup } from "../types/quiz";
import { LayoutList, Presentation, Search, Shuffle, ChevronDown, ChevronRight, PlayCircle, Trophy, XCircle } from "lucide-react";

const GROUP_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#a855f7", "#ec4899"];

export function GroupedQuestionList() {
  const { quiz, updateMeta, activeSlide, setActiveSlide, setEditorViewMode } = useQuizStore();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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
    ? quiz.questions.filter((q) => q.stem.toLowerCase().includes(search.toLowerCase()))
    : null;

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
          <div className="p-2">
            {filteredQuestions.map((q) => (
              <div key={q.id} className="px-3 py-2 text-sm text-gray-600 truncate">{q.order}. {q.stem || "Untitled"}</div>
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
        <div className="flex-1 min-h-0">
          <QuestionList compact />
        </div>

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
