/**
 * Spreadsheet-style results table for General Form Builder.
 * Supports column-per-field view, inline edits, bulk edit/delete, and saved filters.
 */
import React, { useMemo, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Download,
  RefreshCw,
  Trash2,
  Edit2,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  isAdminOnlyItem,
  isInputItemType,
  evalFilterCondition,
  type SavedResultsFilter,
  type ResultsFilterCondition,
} from "@shared/formItemUtils";

const BRAND = "#0e7490";

type FilterLogic = "AND" | "OR";

type FilterCondition = ResultsFilterCondition & { id: string };

function parseResponses(s: { responses: string }): Record<string, unknown> {
  try {
    return JSON.parse(s.responses);
  } catch {
    return {};
  }
}

function cellValue(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

function EditableCell({
  item,
  value,
  options,
  onSave,
}: {
  item: any;
  value: unknown;
  options: any[];
  onSave: (val: string | string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cellValue(value));
  const itemOptions = options.filter(o => o.itemId === item.id);

  if (!editing) {
    return (
      <div
        className="min-h-[28px] px-1 py-0.5 cursor-pointer hover:bg-teal-50 rounded text-xs truncate max-w-[160px]"
        title={cellValue(value) || "Click to edit"}
        onClick={e => {
          e.stopPropagation();
          setDraft(cellValue(value));
          setEditing(true);
        }}
      >
        {cellValue(value) || <span className="text-gray-300 italic">—</span>}
      </div>
    );
  }

  const save = () => {
    if (item.itemType === "checkbox") {
      onSave(draft.split(",").map(s => s.trim()).filter(Boolean));
    } else {
      onSave(draft);
    }
    setEditing(false);
  };

  if (["dropdown", "radio", "yes_no"].includes(item.itemType) && itemOptions.length > 0) {
    return (
      <Select
        value={cellValue(value) || undefined}
        onValueChange={v => {
          onSave(v);
          setEditing(false);
        }}
      >
        <SelectTrigger className="h-7 text-xs" onClick={e => e.stopPropagation()}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {item.itemType === "yes_no" ? (
            <>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </>
          ) : (
            itemOptions.map(o => (
              <SelectItem key={o.id} value={o.value}>
                {o.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      className="h-7 text-xs"
      value={draft}
      autoFocus
      onClick={e => e.stopPropagation()}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

export default function FormResultsTable({
  formId,
  template,
}: {
  formId: number;
  template: { name: string; scoreEnabled?: boolean };
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "draft" | "reviewed">("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [savedFilterId, setSavedFilterId] = useState<string>("");
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkFields, setBulkFields] = useState<string[]>([]);
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [exportStatus, setExportStatus] = useState<"all" | "submitted" | "draft" | "reviewed">("all");
  const [detailSub, setDetailSub] = useState<any | null>(null);

  const { data, isLoading, refetch } = trpc.generalForm.getFormResults.useQuery({
    templateId: formId,
    page,
    pageSize: 50,
    status: statusFilter,
  });

  const { data: exportData, refetch: fetchExport } = trpc.generalForm.exportFormResults.useQuery(
    { templateId: formId, status: exportStatus },
    { enabled: false },
  );

  const updateStatus = trpc.generalForm.updateSubmissionStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const updateResponses = trpc.generalForm.updateSubmissionResponses.useMutation({
    onSuccess: () => refetch(),
    onError: e => toast.error(e.message),
  });

  const bulkUpdate = trpc.generalForm.bulkUpdateSubmissions.useMutation({
    onSuccess: d => {
      toast.success(`Updated ${d.updated} submission(s)`);
      setShowBulkEdit(false);
      setSelectedIds(new Set());
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const deleteSubmission = trpc.generalForm.deleteSubmission.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      refetch();
      setDetailSub(null);
    },
    onError: e => toast.error(e.message),
  });

  const bulkDelete = trpc.generalForm.bulkDeleteSubmissions.useMutation({
    onSuccess: d => {
      toast.success(`Deleted ${d.deleted} submission(s)`);
      setSelectedIds(new Set());
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const tableItems = useMemo(
    () => (data?.items ?? []).filter((it: any) => isInputItemType(it.itemType)),
    [data?.items],
  );

  const savedFilters: SavedResultsFilter[] = data?.resultsSettings?.savedFilters ?? [];

  const activeSavedFilter = useMemo(
    () => savedFilters.find(f => f.id === savedFilterId) ?? null,
    [savedFilters, savedFilterId],
  );

  const filteredSubmissions = useMemo(() => {
    const subs = data?.submissions ?? [];
    if (!activeSavedFilter || activeSavedFilter.conditions.length === 0) return subs;
    return subs.filter(sub => {
      const responses = parseResponses(sub);
      const results = activeSavedFilter.conditions.map(c =>
        evalFilterCondition(responses, c),
      );
      return activeSavedFilter.logic === "AND" ? results.every(Boolean) : results.some(Boolean);
    });
  }, [data?.submissions, activeSavedFilter]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSubmissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubmissions.map((s: any) => s.id)));
    }
  };

  const handleExport = async () => {
    const result = await fetchExport();
    const d = result.data ?? exportData;
    if (!d) return;
    const { submissions, items, userMap } = d;
    const headers = [
      "ID",
      "Submitted At",
      "Status",
      "User Name",
      "User Email",
      "Score",
      "Max Score",
      ...items.map((it: any) => it.label || it.itemType),
    ];
    const rows = submissions.map((s: any) => {
      const responses = parseResponses(s);
      const user = s.submittedByUserId ? (userMap as any)[s.submittedByUserId] : null;
      return [
        s.id,
        new Date(s.submittedAt).toISOString(),
        s.status,
        user?.name ?? "",
        user?.email ?? "",
        s.score,
        s.maxScore,
        ...items.map((it: any) => cellValue(responses[it.id.toString()])),
      ];
    });
    const csv = [headers, ...rows]
      .map(r => r.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "-")}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected submission(s)?`)) return;
    bulkDelete.mutate({ ids: Array.from(selectedIds) });
  };

  const handleBulkEditSave = () => {
    const fieldUpdates: Record<string, string> = {};
    for (const fid of bulkFields) {
      if (bulkValues[fid] !== undefined) fieldUpdates[fid] = bulkValues[fid];
    }
    if (Object.keys(fieldUpdates).length === 0) {
      toast.error("Set at least one field value");
      return;
    }
    bulkUpdate.mutate({ ids: Array.from(selectedIds), fieldUpdates });
  };

  const saveCell = useCallback(
    (subId: number, fieldId: string, val: string | string[]) => {
      updateResponses.mutate({ id: subId, fieldUpdates: { [fieldId]: val } });
    },
    [updateResponses],
  );

  const STATUS_TABS = [
    { id: "all", label: "All" },
    { id: "submitted", label: "Submitted" },
    { id: "draft", label: "Incomplete" },
    { id: "reviewed", label: "Reviewed" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50">
          {STATUS_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setStatusFilter(t.id);
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === t.id ? "bg-white shadow-sm text-[#0e7490]" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedFilters.length > 0 && (
            <Select
              value={savedFilterId || "__all__"}
              onValueChange={v => setSavedFilterId(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="All results" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All results</SelectItem>
                {savedFilters.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedIds.size > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => {
                  setBulkFields([]);
                  setBulkValues({});
                  setShowBulkEdit(true);
                }}
              >
                <Edit2 className="w-3.5 h-3.5" /> Bulk Edit ({selectedIds.size})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.size})
              </Button>
            </>
          )}
          <Select value={exportStatus} onValueChange={v => setExportStatus(v as typeof exportStatus)}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="draft">Incomplete</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-1 h-8" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {activeSavedFilter && (
        <p className="text-xs text-teal-700">
          Filter: <strong>{activeSavedFilter.name}</strong> — showing {filteredSubmissions.length} of{" "}
          {data?.submissions?.length ?? 0} on this page
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading…
            </div>
          ) : !data?.submissions?.length ? (
            <div className="text-center py-12 text-gray-400">No results found</div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No submissions match the selected filter</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-max">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="py-2 px-2 w-8 sticky left-0 bg-gray-50/80 z-10">
                      <Checkbox
                        checked={
                          filteredSubmissions.length > 0 &&
                          selectedIds.size === filteredSubmissions.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 whitespace-nowrap sticky left-8 bg-gray-50/80 z-10">
                      #
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Date
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      Submitter
                    </th>
                    {tableItems.map((item: any) => (
                      <th
                        key={item.id}
                        className="text-left py-2 px-2 text-xs font-semibold text-gray-600 whitespace-nowrap min-w-[120px]"
                      >
                        <span className="flex items-center gap-1">
                          {item.label || item.itemType}
                          {isAdminOnlyItem(item) && (
                            <Shield className="w-3 h-3 text-amber-600" title="Admin only" />
                          )}
                        </span>
                      </th>
                    ))}
                    {template.scoreEnabled && (
                      <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">Score</th>
                    )}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((sub: any) => {
                    const responses = parseResponses(sub);
                    const emailItem = tableItems.find((it: any) => it.itemType === "email");
                    const submitter =
                      sub.userName ||
                      sub.userEmail ||
                      (emailItem ? cellValue(responses[String(emailItem.id)]) : null) ||
                      sub.ipAddress ||
                      "Anonymous";
                    return (
                      <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50/40">
                        <td className="py-1 px-2 sticky left-0 bg-white z-10">
                          <Checkbox
                            checked={selectedIds.has(sub.id)}
                            onCheckedChange={() => toggleSelect(sub.id)}
                          />
                        </td>
                        <td className="py-1 px-2 font-mono text-xs text-gray-400 sticky left-8 bg-white z-10">
                          #{sub.id}
                        </td>
                        <td className="py-1 px-2" onClick={e => e.stopPropagation()}>
                          <Select
                            value={sub.status}
                            onValueChange={v =>
                              updateStatus.mutate({ id: sub.id, status: v as "submitted" | "reviewed" | "draft" })
                            }
                          >
                            <SelectTrigger className="h-6 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="reviewed">Reviewed</SelectItem>
                              <SelectItem value="draft">Incomplete</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-1 px-2 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(sub.submittedAt).toLocaleString()}
                        </td>
                        <td className="py-1 px-2 text-xs text-gray-700 max-w-[120px] truncate" title={submitter}>
                          {submitter}
                        </td>
                        {tableItems.map((item: any) => (
                          <td key={item.id} className="py-1 px-1 align-top">
                            <EditableCell
                              item={item}
                              value={responses[String(item.id)]}
                              options={data?.options ?? []}
                              onSave={val => saveCell(sub.id, String(item.id), val)}
                            />
                          </td>
                        ))}
                        {template.scoreEnabled && (
                          <td className="py-1 px-2 text-xs font-medium" style={{ color: BRAND }}>
                            {sub.maxScore > 0 ? `${sub.score}/${sub.maxScore}` : "—"}
                          </td>
                        )}
                        <td className="py-1 px-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400"
                            onClick={() => setDetailSub(sub)}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.total > 50 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {(page - 1) * 50 + 1}–{Math.min(page * 50, data.total)} of {data.total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page * 50 >= data.total}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk edit dialog */}
      <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Edit {selectedIds.size} Submission(s)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Select fields to update. The same value will be applied to all selected rows.
          </p>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto py-2">
            {tableItems.map((item: any) => {
              const checked = bulkFields.includes(String(item.id));
              return (
                <div key={item.id} className="flex items-start gap-3 border rounded-lg p-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={c => {
                      const fid = String(item.id);
                      if (c) setBulkFields(prev => [...prev, fid]);
                      else setBulkFields(prev => prev.filter(x => x !== fid));
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label className="text-sm flex items-center gap-1">
                      {item.label}
                      {isAdminOnlyItem(item) && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-700 border-amber-300">
                          Admin
                        </Badge>
                      )}
                    </Label>
                    {checked && (
                      <Input
                        className="h-8 text-sm"
                        placeholder="New value for all selected rows"
                        value={bulkValues[String(item.id)] ?? ""}
                        onChange={e =>
                          setBulkValues(prev => ({ ...prev, [String(item.id)]: e.target.value }))
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEdit(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkEditSave}
              disabled={bulkUpdate.isPending}
              className="text-white"
              style={{ background: BRAND }}
            >
              Apply to {selectedIds.size} row(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {detailSub && (
        <Dialog open={!!detailSub} onOpenChange={() => setDetailSub(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submission #{detailSub.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {tableItems.map((item: any) => {
                const v = parseResponses(detailSub)[String(item.id)];
                return (
                  <div key={item.id} className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                      {item.label}
                      {isAdminOnlyItem(item) && <Shield className="w-3 h-3 text-amber-600" />}
                    </p>
                    <p className="text-sm text-gray-800 mt-0.5">{cellValue(v) || "—"}</p>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailSub(null)}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Delete this submission?")) deleteSubmission.mutate({ id: detailSub.id });
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
