import { useQuizStore } from "../store/quizStore";
import { McqEditor } from "./editors/McqEditor";
import { TfEditor, FillBlankEditor, ShortAnswerEditor, ImageChoiceEditor } from "./editors/SimpleEditors";
import { HotspotEditor } from "./editors/HotspotEditor";
import { MatchingEditor } from "./editors/MatchingEditor";
import { OrderingEditor, DragWordsEditor, DropdownEditor, NumericEditor, LikertEditor, EssayEditor, DragDropEditor } from "./editors/AdvancedEditors";
import { BranchingEditor } from "./BranchingEditor";
import type { QuizQuestion, QuestionData, BranchRule } from "../types/quiz";
import { Upload, Trash2, Music, Video, Image, Palette, GitBranch } from "lucide-react";
import { useState } from "react";

const TYPE_LABELS: Record<string, string> = {
  mcq: "Multiple Choice",
  tf: "True / False",
  matching: "Matching",
  hotspot: "Hotspot",
  fill_blank: "Fill in the Blank",
  short_answer: "Short Answer",
  image_choice: "Image Choice",
  ordering: "Sequence / Ordering",
  drag_drop: "Drag & Drop",
  drag_words: "Drag the Words",
  dropdown: "Select from Lists",
  numeric: "Numeric",
  likert: "Likert Scale",
  essay: "Essay",
};

export function QuestionEditor() {
  const { quiz, activeQuestionId, updateQuestion, deleteQuestion } = useQuizStore();
  const question = quiz.questions.find((q) => q.id === activeQuestionId);

  if (!question) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-5xl mb-3">📝</div>
          <p className="text-sm">Select a question from the list, or add a new one</p>
        </div>
      </div>
    );
  }

  const update = (updates: Partial<QuizQuestion>) => updateQuestion(question.id, updates);
  const updateData = (data: QuestionData) => update({ data });

  const [showMediaPanel, setShowMediaPanel] = useState(false);

  const uploadFile = (accept: string, callback: (url: string, name: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => callback(reader.result as string, file.name);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const uploadStemImage = () => {
    uploadFile("image/*", (url, name) => update({ image: { url, alt: name } }));
  };

  const uploadAudio = () => {
    uploadFile("audio/*", (url) => update({ audio: { url, label: "Audio" } }));
  };

  const uploadVideo = () => {
    uploadFile("video/*", (url) => update({ video: { url, type: "file" } }));
  };

  const uploadBackground = () => {
    uploadFile("image/*", (url) => update({ backgroundImageUrl: url }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: "#24abbc" }}>
              Q{question.order}
            </span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {TYPE_LABELS[question.type]}
            </span>
          </div>
          <textarea
            value={question.stem}
            onChange={(e) => update({ stem: e.target.value })}
            placeholder="Enter your question here..."
            rows={3}
            className="w-full px-4 py-3 text-base font-medium border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400 resize-none"
          />
        </div>
        <button
          onClick={() => deleteQuestion(question.id)}
          className="p-2 text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-8"
          title="Delete question"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Media attachments */}
      <div className="space-y-3">
        {/* Image */}
        {question.image ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <img src={question.image.url} alt={question.image.alt} className="w-full max-h-48 object-cover" />
            <button
              onClick={() => update({ image: null })}
              className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 rounded-full p-1.5 shadow transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}

        {/* Audio */}
        {question.audio ? (
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
            <Music className="w-4 h-4 text-purple-500 shrink-0" />
            <audio src={question.audio.url} controls className="flex-1 h-8" />
            <button
              onClick={() => update({ audio: null })}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}

        {/* Video */}
        {question.video ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <video src={question.video.url} controls className="w-full max-h-48" />
            <button
              onClick={() => update({ video: null })}
              className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 rounded-full p-1.5 shadow transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}

        {/* Background indicator */}
        {question.backgroundImageUrl && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
            <Palette className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs text-amber-700">Custom background set</span>
            <button
              onClick={() => update({ backgroundImageUrl: undefined, backgroundColor: undefined })}
              className="ml-auto text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Add media buttons */}
        <div className="flex flex-wrap gap-2">
          {!question.image && (
            <button
              onClick={uploadStemImage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-teal-600 border border-gray-200 hover:border-teal-300 rounded-lg transition-colors"
            >
              <Image className="w-3.5 h-3.5" /> Image
            </button>
          )}
          {!question.audio && (
            <button
              onClick={uploadAudio}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-purple-600 border border-gray-200 hover:border-purple-300 rounded-lg transition-colors"
            >
              <Music className="w-3.5 h-3.5" /> Audio
            </button>
          )}
          {!question.video && (
            <button
              onClick={uploadVideo}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg transition-colors"
            >
              <Video className="w-3.5 h-3.5" /> Video
            </button>
          )}
          {!question.backgroundImageUrl && (
            <button
              onClick={uploadBackground}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-amber-600 border border-gray-200 hover:border-amber-300 rounded-lg transition-colors"
            >
              <Palette className="w-3.5 h-3.5" /> Background
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Type-specific editor */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Answer</p>
        {question.type === "mcq" && (
          <McqEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "tf" && (
          <TfEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "matching" && (
          <MatchingEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "hotspot" && (
          <HotspotEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "fill_blank" && (
          <FillBlankEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "short_answer" && (
          <ShortAnswerEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "image_choice" && (
          <ImageChoiceEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "ordering" && (
          <OrderingEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "drag_drop" && (
          <DragDropEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "drag_words" && (
          <DragWordsEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "dropdown" && (
          <DropdownEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "numeric" && (
          <NumericEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "likert" && (
          <LikertEditor data={question.data as any} onChange={updateData} />
        )}
        {question.type === "essay" && (
          <EssayEditor data={question.data as any} onChange={updateData} />
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Question settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Points</label>
          <input
            type="number"
            min={0}
            max={100}
            value={question.points}
            onChange={(e) => update({ points: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => update({ required: e.target.checked })}
              className="accent-teal-500"
            />
            Required
          </label>
        </div>
      </div>

      {/* Group assignment & answer lock */}
      <div className="grid grid-cols-2 gap-4">
        {/* Group selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Question Group</label>
          <select
            value={question.groupId || ""}
            onChange={(e) => update({ groupId: e.target.value || undefined })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          >
            <option value="">No group</option>
            {(quiz.meta.groups || []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {question.groupId && (() => {
            const group = (quiz.meta.groups || []).find((g) => g.id === question.groupId);
            return group ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: group.color }} />
                <span className="text-xs text-gray-400">{group.name}</span>
              </div>
            ) : null;
          })()}
        </div>
        {/* Lock answer order */}
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={question.lockAnswerOrder ?? false}
              onChange={(e) => update({ lockAnswerOrder: e.target.checked })}
              className="accent-amber-500"
            />
            <span className="leading-tight">
              Lock answer order
              <span className="block text-xs text-gray-400">Override quiz-level shuffle</span>
            </span>
          </label>
        </div>
      </div>

      {/* Explanation / Feedback */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Explanation / Feedback (shown after answer)
        </label>
        <textarea
          value={question.explanation}
          onChange={(e) => update({ explanation: e.target.value })}
          rows={2}
          placeholder="Optional: explain why the answer is correct..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
        />
      </div>

      {/* Branching / Conditional Logic */}
      {quiz.meta.branchingEnabled && (
        <div className="border-t border-gray-100 pt-4">
          <BranchingEditor
            question={question}
            allQuestions={quiz.questions}
            onUpdate={(rules: BranchRule[]) => update({ branchRules: rules })}
          />
        </div>
      )}
    </div>
  );
}
