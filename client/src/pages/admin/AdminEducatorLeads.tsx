/**
 * AdminEducatorLeads.tsx — /admin/educator-leads
 * Admin view for educator/instructor interest form submissions
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  GraduationCap,
  Search,
  Mail,
  Phone,
  Tag,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  X,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-teal-100 text-teal-700" },
  contacted: { label: "Contacted", color: "bg-blue-100 text-blue-700" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-500" },
};

export default function AdminEducatorLeads() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

  const { data: leads, isLoading, refetch } = trpc.educator.adminListEducatorLeads.useQuery();

  const updateMutation = trpc.educator.adminUpdateEducatorLead.useMutation({
    onSuccess: () => {
      toast.success("Lead updated");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = (leads ?? []).filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.firstName.toLowerCase().includes(q) ||
      l.lastName.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.credentials ?? "").toLowerCase().includes(q)
    );
  });

  const handleStatusChange = (id: number, status: "new" | "contacted" | "closed") => {
    updateMutation.mutate({ id, status });
  };

  const handleSaveNotes = (id: number) => {
    updateMutation.mutate({ id, adminNotes: editingNotes[id] ?? "" });
    setEditingNotes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-100 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Educator Leads</h1>
              <p className="text-xs text-gray-500">Instructor interest form submissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{leads?.length ?? 0}</span> total
            <span className="mx-1">·</span>
            <span className="font-semibold text-teal-600">
              {leads?.filter((l) => l.status === "new").length ?? 0}
            </span> new
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or credentials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Leads list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No educator leads yet</p>
            <p className="text-sm mt-1">Submissions from the /teach-with-us form will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((lead) => {
              const isExpanded = expandedId === lead.id;
              const statusCfg = STATUS_LABELS[lead.status] ?? STATUS_LABELS.new;
              const isEditingNote = lead.id in editingNotes;

              return (
                <div
                  key={lead.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  {/* Row header */}
                  <button
                    className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          {lead.firstName} {lead.lastName}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        {lead.tags && (
                          <span className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Tag className="h-2.5 w-2.5" />
                            {lead.tags}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </span>
                        {lead.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </span>
                        )}
                        {lead.credentials && (
                          <span className="text-gray-400">{lead.credentials}</span>
                        )}
                        <span className="text-gray-300">
                          {new Date(lead.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                      {/* Message */}
                      {lead.message && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                            {lead.message}
                          </p>
                        </div>
                      )}

                      {/* Status buttons */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
                        <div className="flex gap-2 flex-wrap">
                          {(["new", "contacted", "closed"] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(lead.id, s)}
                              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                                lead.status === s
                                  ? "border-teal-500 bg-teal-50 text-teal-700"
                                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                              }`}
                            >
                              {s === "new" && <Clock className="h-3 w-3" />}
                              {s === "contacted" && <Check className="h-3 w-3" />}
                              {s === "closed" && <X className="h-3 w-3" />}
                              {STATUS_LABELS[s].label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Admin notes */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Admin Notes</p>
                        {isEditingNote ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-teal-300"
                              rows={3}
                              value={editingNotes[lead.id]}
                              onChange={(e) =>
                                setEditingNotes((prev) => ({ ...prev, [lead.id]: e.target.value }))
                              }
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-teal-600 hover:bg-teal-700 text-white h-7 text-xs"
                                onClick={() => handleSaveNotes(lead.id)}
                                disabled={updateMutation.isPending}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() =>
                                  setEditingNotes((prev) => {
                                    const next = { ...prev };
                                    delete next[lead.id];
                                    return next;
                                  })
                                }
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors min-h-[48px]"
                            onClick={() =>
                              setEditingNotes((prev) => ({
                                ...prev,
                                [lead.id]: lead.adminNotes ?? "",
                              }))
                            }
                          >
                            {lead.adminNotes || (
                              <span className="text-gray-400 italic">Click to add notes...</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-2 pt-1">
                        <a
                          href={`mailto:${lead.email}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                        >
                          <Mail className="h-3 w-3" />
                          Send Email
                        </a>
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                          >
                            <Phone className="h-3 w-3" />
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
