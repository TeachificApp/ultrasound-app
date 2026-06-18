/**
 * QuizQuestionGroups.tsx
 * Admin component for managing question groups on a quiz.
 * Used inside the quiz builder (LMSAdmin.tsx → QuizBuilderInline / QuizBuilderDialog).
 *
 * Features:
 *  - Toggle "Use Question Groups" mode on the quiz
 *  - List groups with question count and displayCount
 *  - Create / edit / delete groups
 *  - Browse question bank and add/remove questions per group
 */
import React, { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronRight, Loader2,
  Database, Search, X, BookOpen, Layers,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizGroup {
  id: number;
  quizId: number;
  name: string;
  description: string | null;
  displayCount: number;
  sortOrder: number;
  questionCount: number;
}

interface GroupQuestion {
  id: number;
  question: string;
  type: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  questionImageUrl: string | null;
  sortOrder: number;
  mappingId: number;
}

interface BankQuestion {
  id: number;
  question: string;
  type: string | null;
  correctAnswer: string | null;
  folderId?: number | null;
}

// ─── QuizQuestionGroups ───────────────────────────────────────────────────────

interface Props {
  quizId: number;
  lessonId: number;
  useQuestionGroups: boolean;
  onModeChange?: () => void; // called after toggling mode so parent can refetch
}

export function QuizQuestionGroups({ quizId, lessonId, useQuestionGroups, onModeChange }: Props) {
  const utils = trpc.useUtils();

  // ── Mode toggle ──────────────────────────────────────────────────────────
  const setMode = trpc.lmsAdmin.setQuizGroupMode.useMutation({
    onSuccess: () => {
      toast.success(useQuestionGroups ? "Question groups disabled" : "Question groups enabled");
      onModeChange?.();
    },
    onError: e => toast.error(e.message),
  });

  // ── Groups list ──────────────────────────────────────────────────────────
  const { data: groups, isLoading: groupsLoading, refetch: refetchGroups } = trpc.lmsAdmin.getQuizGroups.useQuery(
    { quizId },
    { enabled: useQuestionGroups }
  );

  // ── Create group dialog ──────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", displayCount: 1 });
  const createGroup = trpc.lmsAdmin.createQuizGroup.useMutation({
    onSuccess: () => {
      toast.success("Group created");
      setShowCreate(false);
      setCreateForm({ name: "", description: "", displayCount: 1 });
      refetchGroups();
    },
    onError: e => toast.error(e.message),
  });

  // ── Edit group dialog ────────────────────────────────────────────────────
  const [editingGroup, setEditingGroup] = useState<QuizGroup | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", displayCount: 1 });
  const updateGroup = trpc.lmsAdmin.updateQuizGroup.useMutation({
    onSuccess: () => {
      toast.success("Group updated");
      setEditingGroup(null);
      refetchGroups();
    },
    onError: e => toast.error(e.message),
  });

  // ── Delete group ─────────────────────────────────────────────────────────
  const deleteGroup = trpc.lmsAdmin.deleteQuizGroup.useMutation({
    onSuccess: () => { toast.success("Group deleted"); refetchGroups(); },
    onError: e => toast.error(e.message),
  });

  // ── Expanded group (shows questions) ────────────────────────────────────
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);

  // ── Question bank browser ────────────────────────────────────────────────
  const [bankSearch, setBankSearch] = useState("");
  const [bankFolderId, setBankFolderId] = useState<number | null | undefined>(undefined);
  const [bankPage, setBankPage] = useState(1);

  const { data: foldersData } = trpc.questionBank.listFolders.useQuery();
  const { data: bankData, isLoading: bankLoading } = trpc.questionBank.listQuestions.useQuery(
    { search: bankSearch || undefined, folderId: bankFolderId, page: bankPage, pageSize: 20 },
    { enabled: expandedGroupId !== null }
  );

  // ── Group questions ──────────────────────────────────────────────────────
  const { data: groupQuestions, refetch: refetchGroupQuestions } = trpc.lmsAdmin.getGroupQuestions.useQuery(
    { groupId: expandedGroupId! },
    { enabled: expandedGroupId !== null }
  );

  const addToGroup = trpc.lmsAdmin.addQuestionsToGroup.useMutation({
    onSuccess: (data) => {
      if (data.added === 0) {
        toast.info("Question already in group");
      } else {
        toast.success(`Added ${data.added} question${data.added === 1 ? "" : "s"}`);
      }
      refetchGroupQuestions();
      refetchGroups();
    },
    onError: e => toast.error(e.message),
  });

  const removeFromGroup = trpc.lmsAdmin.removeQuestionFromGroup.useMutation({
    onSuccess: () => { toast.success("Question removed"); refetchGroupQuestions(); refetchGroups(); },
    onError: e => toast.error(e.message),
  });

  const groupQuestionsSet = new Set((groupQuestions ?? []).map(q => q.id));

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleExpand = useCallback((groupId: number) => {
    setExpandedGroupId(prev => prev === groupId ? null : groupId);
    setBankSearch("");
    setBankPage(1);
  }, []);

  const handleEditOpen = (group: QuizGroup) => {
    setEditingGroup(group);
    setEditForm({ name: group.name, description: group.description ?? "", displayCount: group.displayCount });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50">
        <div>
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600" />
            Question Groups Mode
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            When enabled, questions are drawn randomly from each group on every attempt.
            The total questions shown = sum of each group's display count.
          </p>
        </div>
        <Switch
          checked={useQuestionGroups}
          onCheckedChange={v => setMode.mutate({ quizId, useQuestionGroups: v })}
          disabled={setMode.isPending}
        />
      </div>

      {!useQuestionGroups && (
        <p className="text-xs text-gray-400 text-center py-2">
          Enable Question Groups Mode above to configure randomized question pools.
        </p>
      )}

      {useQuestionGroups && (
        <>
          {/* Groups list */}
          {groupsLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading groups...
            </div>
          ) : (
            <div className="space-y-3">
              {(groups ?? []).length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  No question groups yet. Create your first group below.
                </div>
              )}
              {(groups ?? []).map(group => (
                <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleToggleExpand(group.id)}>
                    <button className="text-gray-400 hover:text-gray-600">
                      {expandedGroupId === group.id
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{group.name}</p>
                      {group.description && (
                        <p className="text-xs text-gray-500 truncate">{group.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className="text-xs border-teal-200 text-teal-700 bg-teal-50">
                        Show {group.displayCount} of {group.questionCount}
                      </Badge>
                      <button
                        className="text-gray-400 hover:text-blue-600 p-1"
                        onClick={e => { e.stopPropagation(); handleEditOpen(group); }}
                        title="Edit group"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="text-gray-400 hover:text-red-600 p-1"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`Delete group "${group.name}"? This will remove all ${group.questionCount} question assignments.`)) {
                            deleteGroup.mutate({ groupId: group.id });
                          }
                        }}
                        title="Delete group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: questions + bank browser */}
                  {expandedGroupId === group.id && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                      {/* Current questions in group */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                          Questions in this group ({groupQuestions?.length ?? 0})
                        </h4>
                        {(groupQuestions ?? []).length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">No questions yet. Add from the bank below.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {(groupQuestions ?? []).map(q => (
                              <div key={q.mappingId} className="flex items-start gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-700 line-clamp-2">{q.question}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{q.type ?? "mcq"}</p>
                                </div>
                                <button
                                  className="text-gray-300 hover:text-red-500 shrink-0 mt-0.5"
                                  onClick={() => removeFromGroup.mutate({ mappingId: q.mappingId })}
                                  title="Remove from group"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Question bank browser */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5" /> Browse Question Bank
                        </h4>
                        <div className="flex gap-2 mb-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <Input
                              value={bankSearch}
                              onChange={e => { setBankSearch(e.target.value); setBankPage(1); }}
                              placeholder="Search questions..."
                              className="pl-8 h-8 text-xs"
                            />
                          </div>
                          <Select
                            value={bankFolderId === undefined ? "__all__" : bankFolderId === null ? "__none__" : String(bankFolderId)}
                            onValueChange={v => {
                              setBankPage(1);
                              if (v === "__all__") setBankFolderId(undefined);
                              else if (v === "__none__") setBankFolderId(null);
                              else setBankFolderId(Number(v));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-44">
                              <SelectValue placeholder="All folders" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">All folders</SelectItem>
                              <SelectItem value="__none__">No folder</SelectItem>
                              {(foldersData ?? []).map(f => (
                                <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {bankLoading ? (
                          <div className="flex items-center justify-center py-4 gap-2 text-gray-400 text-xs">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-56 overflow-y-auto">
                            {(bankData?.questions ?? []).length === 0 && (
                              <p className="text-xs text-gray-400 text-center py-3">No questions found.</p>
                            )}
                            {(bankData?.questions ?? []).map(q => {
                              const inGroup = groupQuestionsSet.has(q.id);
                              return (
                                <div key={q.id} className={`flex items-start gap-2 border rounded-lg px-3 py-2 ${inGroup ? "bg-teal-50 border-teal-200" : "bg-white border-gray-100"}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-700 line-clamp-2">{q.question}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{q.type ?? "mcq"}</p>
                                  </div>
                                  <button
                                    className={`shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                                      inGroup
                                        ? "bg-teal-100 text-teal-700 cursor-default"
                                        : "bg-teal-600 text-white hover:bg-teal-700"
                                    }`}
                                    disabled={inGroup || addToGroup.isPending}
                                    onClick={() => !inGroup && addToGroup.mutate({ groupId: group.id, questionBankIds: [q.id] })}
                                  >
                                    {inGroup ? "Added" : "Add"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Pagination */}
                        {bankData && bankData.total > 20 && (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">{bankData.total} total</span>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                                disabled={bankPage <= 1}
                                onClick={() => setBankPage(p => p - 1)}>Prev</Button>
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                                disabled={bankPage * 20 >= bankData.total}
                                onClick={() => setBankPage(p => p + 1)}>Next</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add group button */}
          <Button
            size="sm"
            variant="outline"
            className="border-dashed border-teal-300 text-teal-600 hover:bg-teal-50 w-full"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Question Group
          </Button>
        </>
      )}

      {/* Create group dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Question Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Group Name *</Label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Cardiac Anatomy, Doppler Physics"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Description (optional)</Label>
              <Input
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this group's topic"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Questions to show per attempt *</Label>
              <Input
                type="number"
                min={1}
                value={createForm.displayCount}
                onChange={e => setCreateForm(f => ({ ...f, displayCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="mt-1 w-32"
              />
              <p className="text-xs text-gray-500 mt-1">
                How many questions from this group's pool to randomly select each attempt.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={!createForm.name.trim() || createGroup.isPending}
              onClick={() => createGroup.mutate({
                quizId,
                name: createForm.name.trim(),
                description: createForm.description.trim() || undefined,
                displayCount: createForm.displayCount,
                sortOrder: (groups?.length ?? 0),
              })}
            >
              {createGroup.isPending ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit group dialog */}
      <Dialog open={!!editingGroup} onOpenChange={open => !open && setEditingGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Question Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Group Name *</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Description (optional)</Label>
              <Input
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Questions to show per attempt *</Label>
              <Input
                type="number"
                min={1}
                value={editForm.displayCount}
                onChange={e => setEditForm(f => ({ ...f, displayCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="mt-1 w-32"
              />
              {editingGroup && editingGroup.questionCount > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Pool size: {editingGroup.questionCount} question{editingGroup.questionCount === 1 ? "" : "s"}.
                  {editForm.displayCount > editingGroup.questionCount && (
                    <span className="text-amber-600"> Display count exceeds pool size — all questions will be shown.</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={!editForm.name.trim() || updateGroup.isPending}
              onClick={() => editingGroup && updateGroup.mutate({
                groupId: editingGroup.id,
                name: editForm.name.trim(),
                description: editForm.description.trim() || undefined,
                displayCount: editForm.displayCount,
              })}
            >
              {updateGroup.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default QuizQuestionGroups;
