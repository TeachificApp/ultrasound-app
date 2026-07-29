import { useState } from "react";
import { useQuizStore } from "../store/quizStore";
import { X, Upload, Trash2, Plus, Palette } from "lucide-react";
import type { QuestionGroup, DrawConfig, GroupDrawConfig } from "../types/quiz";

interface Props {
  onClose: () => void;
}

type Tab = "general" | "scoring" | "branding" | "navigation" | "groups" | "intro" | "results";

export function QuizSettings({ onClose }: Props) {
  const { quiz, updateMeta } = useQuizStore();
  const m = quiz.meta;
  const [tab, setTab] = useState<Tab>("general");

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "scoring", label: "Scoring & Rules" },
    { id: "branding", label: "Branding" },
    { id: "navigation", label: "Navigation" },
    { id: "groups", label: "Groups & Pools" },
    { id: "intro", label: "Intro Slide" },
    { id: "results", label: "Result Slide" },
  ];

  const GROUP_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#a855f7", "#ec4899"];

  const addGroup = () => {
    const groups = m.groups || [];
    const newGroup: QuestionGroup = {
      id: crypto.randomUUID(),
      name: `Group ${groups.length + 1}`,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
    };
    updateMeta({ groups: [...groups, newGroup] });
  };

  const updateGroup = (id: string, patch: Partial<QuestionGroup>) => {
    const groups = (m.groups || []).map((g) => (g.id === id ? { ...g, ...patch } : g));
    updateMeta({ groups });
  };

  const deleteGroup = (id: string) => {
    const groups = (m.groups || []).filter((g) => g.id !== id);
    // Also remove from drawConfig
    const drawConfig = m.drawConfig;
    if (drawConfig) {
      updateMeta({ groups, drawConfig: { ...drawConfig, groupDraws: drawConfig.groupDraws.filter((gd) => gd.groupId !== id) } });
    } else {
      updateMeta({ groups });
    }
  };

  const updateDrawConfig = (patch: Partial<DrawConfig>) => {
    const current: DrawConfig = m.drawConfig || { enabled: false, totalQuestions: quiz.questions.length, groupDraws: [], ungroupedDrawCount: quiz.questions.length };
    updateMeta({ drawConfig: { ...current, ...patch } });
  };

  const updateGroupDraw = (groupId: string, drawCount: number) => {
    const current: DrawConfig = m.drawConfig || { enabled: false, totalQuestions: quiz.questions.length, groupDraws: [], ungroupedDrawCount: quiz.questions.length };
    const existing = current.groupDraws.find((gd) => gd.groupId === groupId);
    let groupDraws: GroupDrawConfig[];
    if (existing) {
      groupDraws = current.groupDraws.map((gd) => (gd.groupId === groupId ? { ...gd, drawCount } : gd));
    } else {
      groupDraws = [...current.groupDraws, { groupId, drawCount }];
    }
    const total = groupDraws.reduce((s, gd) => s + gd.drawCount, 0) + (current.ungroupedDrawCount || 0);
    updateMeta({ drawConfig: { ...current, groupDraws, totalQuestions: total } });
  };

  const uploadImage = (callback: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => callback(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-800">Quiz Settings</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 pt-3 border-b border-gray-100 shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "text-teal-700 bg-teal-50 border-b-2 border-teal-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "general" && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Quiz Title</label>
                <input
                  type="text"
                  value={m.title}
                  onChange={(e) => updateMeta({ title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                <textarea
                  value={m.description}
                  onChange={(e) => updateMeta({ description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Author Name</label>
                  <input
                    type="text"
                    value={m.author}
                    onChange={(e) => updateMeta({ author: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Author Email</label>
                  <input
                    type="email"
                    value={m.authorEmail}
                    onChange={(e) => updateMeta({ authorEmail: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={m.tags.join(", ")}
                  onChange={(e) => updateMeta({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  placeholder="anatomy, cardiology, beginner"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                />
              </div>
            </div>
          )}

          {tab === "scoring" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Passing Score (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={m.passingScore}
                    onChange={(e) => updateMeta({ passingScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Time Limit (minutes)</label>
                  <input
                    type="number"
                    min={0}
                    value={m.timeLimit ?? ""}
                    onChange={(e) => updateMeta({ timeLimit: e.target.value ? Number(e.target.value) : null })}
                    placeholder="No limit"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Attempts</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={m.maxAttempts}
                    onChange={(e) => updateMeta({ maxAttempts: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Show Feedback</label>
                  <select
                    value={m.showFeedback}
                    onChange={(e) => updateMeta({ showFeedback: e.target.value as "immediate" | "deferred" | "never" })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  >
                    <option value="immediate">Immediately after each question</option>
                    <option value="deferred">After quiz submission</option>
                    <option value="never">Never show feedback</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Randomization</h4>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.shuffleQuestions}
                    onChange={(e) => updateMeta({ shuffleQuestions: e.target.checked })}
                    className="accent-teal-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-sm text-gray-700">Shuffle question order</span>
                    <p className="text-xs text-gray-400">Randomize the order questions appear for each attempt</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.shuffleAnswers}
                    onChange={(e) => updateMeta({ shuffleAnswers: e.target.checked })}
                    className="accent-teal-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-sm text-gray-700">Shuffle answer choices</span>
                    <p className="text-xs text-gray-400">Randomize answer order for all questions. Override per-question with "Lock answer order"</p>
                  </div>
                </label>
                {m.shuffleAnswers && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg ml-7">
                    Tip: For questions where answer order matters (e.g. "All of the above"), enable "Lock answer order" on that specific question in the editor.
                  </p>
                )}
              </div>
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.allowRetry}
                    onChange={(e) => updateMeta({ allowRetry: e.target.checked })}
                    className="accent-teal-500 w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Allow retry after failure</span>
                </label>
              </div>
            </div>
          )}

          {tab === "branding" && (
            <div className="space-y-5">
              <p className="text-xs text-gray-500">Customize the look and feel of your quiz player.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={m.branding?.primaryColor || "#24abbc"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, primaryColor: e.target.value, backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={m.branding?.primaryColor || "#24abbc"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, primaryColor: e.target.value, backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={m.branding?.backgroundColor || "#ffffff"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, backgroundColor: e.target.value, primaryColor: m.branding?.primaryColor || "#24abbc" } })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={m.branding?.backgroundColor || "#ffffff"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, backgroundColor: e.target.value, primaryColor: m.branding?.primaryColor || "#24abbc" } })}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={m.branding?.textColor || "#1a1a1a"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, textColor: e.target.value, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={m.branding?.textColor || "#1a1a1a"}
                      onChange={(e) => updateMeta({ branding: { ...m.branding, textColor: e.target.value, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Font Family</label>
                  <select
                    value={m.branding?.fontFamily || ""}
                    onChange={(e) => updateMeta({ branding: { ...m.branding, fontFamily: e.target.value || undefined, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  >
                    <option value="">Default (Inter)</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="'Roboto', sans-serif">Roboto</option>
                    <option value="'Open Sans', sans-serif">Open Sans</option>
                    <option value="'Montserrat', sans-serif">Montserrat</option>
                    <option value="'Lato', sans-serif">Lato</option>
                    <option value="'Poppins', sans-serif">Poppins</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Logo</label>
                {m.branding?.logoUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={m.branding.logoUrl} alt="Logo" className="h-10 rounded border border-gray-200" />
                    <button
                      onClick={() => updateMeta({ branding: { ...m.branding!, logoUrl: undefined } })}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => uploadImage((url) => updateMeta({ branding: { ...m.branding, logoUrl: url, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } }))}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600"
                  >
                    <Upload className="w-4 h-4" /> Upload logo
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Background Image</label>
                {m.branding?.backgroundImageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200">
                    <img src={m.branding.backgroundImageUrl} alt="Background" className="w-full max-h-32 object-cover" />
                    <button
                      onClick={() => updateMeta({ branding: { ...m.branding!, backgroundImageUrl: undefined } })}
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 rounded-full p-1 shadow"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => uploadImage((url) => updateMeta({ branding: { ...m.branding, backgroundImageUrl: url, primaryColor: m.branding?.primaryColor || "#24abbc", backgroundColor: m.branding?.backgroundColor || "#ffffff" } }))}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600"
                  >
                    <Upload className="w-4 h-4" /> Upload background image
                  </button>
                )}
                {m.branding?.backgroundImageUrl && (
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">Overlay Opacity</label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={(m.branding?.backgroundOverlay ?? 0.3) * 100}
                      onChange={(e) => updateMeta({ branding: { ...m.branding!, backgroundOverlay: Number(e.target.value) / 100 } })}
                      className="w-full accent-teal-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "navigation" && (
            <div className="space-y-5">
              <p className="text-xs text-gray-500">Control how learners navigate through the quiz.</p>
              <div className="space-y-3">
                {[
                  { key: "allowBackNavigation", label: "Allow going back to previous questions" },
                  { key: "showProgressBar", label: "Show progress bar" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(m as any)[key] ?? true}
                      onChange={(e) => updateMeta({ [key]: e.target.checked })}
                      className="accent-teal-500 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Questions Per Page</label>
                <select
                  value={m.questionsPerPage ?? ""}
                  onChange={(e) => updateMeta({ questionsPerPage: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                >
                  <option value="">One at a time</option>
                  <option value="5">5 per page</option>
                  <option value="10">10 per page</option>
                  <option value="999">All on one page</option>
                </select>
              </div>

              {/* Branching / Conditional Logic */}
              <div className="border-t border-gray-100 pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.branchingEnabled ?? false}
                    onChange={(e) => updateMeta({ branchingEnabled: e.target.checked })}
                    className="accent-purple-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-sm text-gray-700 font-medium">Enable Branching Logic</span>
                    <p className="text-xs text-gray-400 mt-0.5">Route students to different questions based on their answers. When enabled, each question can have branching rules.</p>
                  </div>
                </label>
                {m.branchingEnabled && (
                  <p className="mt-2 text-xs text-purple-600 bg-purple-50 px-3 py-2 rounded-lg">
                    Branching is active. Edit individual questions to configure branching rules (If correct → jump to Q5, etc.)
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === "groups" && (
            <div className="space-y-5">
              <p className="text-xs text-gray-500">Organize questions into groups and optionally enable pool mode to draw a subset per attempt.</p>

              {/* Pool Mode Toggle */}
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.drawConfig?.enabled ?? false}
                    onChange={(e) => updateDrawConfig({ enabled: e.target.checked })}
                    className="accent-indigo-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-sm text-gray-700 font-medium">Enable Question Pool / Draw Mode</span>
                    <p className="text-xs text-gray-400 mt-0.5">When enabled, each attempt draws a random subset of questions from each group instead of showing all questions.</p>
                  </div>
                </label>
              </div>

              {/* Groups List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question Groups</h4>
                  <button
                    onClick={addGroup}
                    className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Group
                  </button>
                </div>

                {(!m.groups || m.groups.length === 0) && (
                  <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                    No groups yet. Create groups to organize your questions.
                  </div>
                )}

                <div className="space-y-2">
                  {(m.groups || []).map((group) => {
                    const questionsInGroup = quiz.questions.filter((q) => q.groupId === group.id).length;
                    const groupDraw = m.drawConfig?.groupDraws?.find((gd) => gd.groupId === group.id);
                    return (
                      <div key={group.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl">
                        {/* Color swatch */}
                        <div className="relative">
                          <input
                            type="color"
                            value={group.color}
                            onChange={(e) => updateGroup(group.id, { color: e.target.value })}
                            className="w-6 h-6 rounded-full border-2 border-white shadow cursor-pointer appearance-none"
                            style={{ backgroundColor: group.color }}
                          />
                        </div>
                        {/* Name */}
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                        />
                        {/* Question count badge */}
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {questionsInGroup} Q{questionsInGroup !== 1 ? "s" : ""}
                        </span>
                        {/* Draw count (only when pool mode enabled) */}
                        {m.drawConfig?.enabled && (
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">Draw:</label>
                            <input
                              type="number"
                              min={0}
                              max={questionsInGroup}
                              value={groupDraw?.drawCount ?? questionsInGroup}
                              onChange={(e) => updateGroupDraw(group.id, Math.max(0, Number(e.target.value)))}
                              className="w-14 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/50 text-center"
                            />
                          </div>
                        )}
                        {/* Delete */}
                        <button
                          onClick={() => deleteGroup(group.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ungrouped draw count (when pool mode enabled) */}
              {m.drawConfig?.enabled && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-700 font-medium">Ungrouped Questions</span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {quiz.questions.filter((q) => !q.groupId).length} questions not assigned to any group
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Draw:</label>
                      <input
                        type="number"
                        min={0}
                        max={quiz.questions.filter((q) => !q.groupId).length}
                        value={m.drawConfig?.ungroupedDrawCount ?? quiz.questions.filter((q) => !q.groupId).length}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          const groupTotal = (m.drawConfig?.groupDraws || []).reduce((s, gd) => s + gd.drawCount, 0);
                          updateDrawConfig({ ungroupedDrawCount: val, totalQuestions: groupTotal + val });
                        }}
                        className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/50 text-center"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              {m.drawConfig?.enabled && (
                <div className="text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
                  Each attempt will show <strong>{m.drawConfig.totalQuestions}</strong> questions out of <strong>{quiz.questions.length}</strong> total.
                </div>
              )}
            </div>
          )}

          {tab === "intro" && (
            <div className="space-y-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={m.introSlide?.enabled ?? false}
                  onChange={(e) => updateMeta({ introSlide: { ...m.introSlide, enabled: e.target.checked } })}
                  className="accent-teal-500 w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Show intro slide before quiz starts</span>
              </label>
              {m.introSlide?.enabled && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Intro Title</label>
                    <input
                      type="text"
                      value={m.introSlide?.title || ""}
                      onChange={(e) => updateMeta({ introSlide: { ...m.introSlide!, title: e.target.value } })}
                      placeholder={m.title}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Intro Description</label>
                    <textarea
                      value={m.introSlide?.description || ""}
                      onChange={(e) => updateMeta({ introSlide: { ...m.introSlide!, description: e.target.value } })}
                      rows={3}
                      placeholder="Welcome to this quiz..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start Button Text</label>
                    <input
                      type="text"
                      value={m.introSlide?.buttonText || ""}
                      onChange={(e) => updateMeta({ introSlide: { ...m.introSlide!, buttonText: e.target.value } })}
                      placeholder="Start Quiz"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Intro Image</label>
                    {m.introSlide?.imageUrl ? (
                      <div className="relative rounded-lg overflow-hidden border border-gray-200 inline-block">
                        <img src={m.introSlide.imageUrl} alt="Intro" className="max-h-32 object-cover" />
                        <button
                          onClick={() => updateMeta({ introSlide: { ...m.introSlide!, imageUrl: undefined } })}
                          className="absolute top-1 right-1 bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 rounded-full p-1 shadow"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => uploadImage((url) => updateMeta({ introSlide: { ...m.introSlide!, imageUrl: url } }))}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600"
                      >
                        <Upload className="w-4 h-4" /> Upload image
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "results" && (
            <div className="space-y-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={m.resultSlide?.enabled ?? true}
                  onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide, enabled: e.target.checked } })}
                  className="accent-teal-500 w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Show result slide after quiz completion</span>
              </label>
              {(m.resultSlide?.enabled ?? true) && (
                <>
                  <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                    <h4 className="text-sm font-semibold text-green-700 mb-3">Pass Result</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Title</label>
                        <input
                          type="text"
                          value={m.resultSlide?.passTitle || ""}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, passTitle: e.target.value } })}
                          placeholder="Congratulations!"
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Message</label>
                        <textarea
                          value={m.resultSlide?.passMessage || ""}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, passMessage: e.target.value } })}
                          rows={2}
                          placeholder="You passed the quiz!"
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <h4 className="text-sm font-semibold text-red-700 mb-3">Fail Result</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Title</label>
                        <input
                          type="text"
                          value={m.resultSlide?.failTitle || ""}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, failTitle: e.target.value } })}
                          placeholder="Not quite..."
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Message</label>
                        <textarea
                          value={m.resultSlide?.failMessage || ""}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, failMessage: e.target.value } })}
                          rows={2}
                          placeholder="Review the material and try again."
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400/50 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { key: "showScore", label: "Show score on result slide" },
                      { key: "showPassFail", label: "Show pass/fail status" },
                      { key: "showReviewButton", label: "Show 'Review Answers' button" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(m.resultSlide as any)?.[key] ?? true}
                          onChange={(e) => updateMeta({ resultSlide: { ...m.resultSlide!, [key]: e.target.checked } })}
                          className="accent-teal-500 w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #24abbc, #0d8a9a)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
