/**
 * ContactsAdmin.tsx — Admin Contacts/Leads Management
 * Lists all captured leads with filtering, search, and a detail view
 * showing IP, user agent, referrer, timezone, source page, tags, etc.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Users,
  Mail,
  Phone,
  Globe,
  Clock,
  MapPin,
  Tag,
  ExternalLink,
  Trash2,
  Edit2,
  Check,
  X,
  Monitor,
  Link2,
} from "lucide-react";

type ViewMode = "list" | "detail";

export default function ContactsAdmin() {
  const [view, setView] = useState<ViewMode>("list");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className="min-h-screen bg-gray-50">
      {view === "list" ? (
        <LeadsList
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          onViewDetail={(id) => { setSelectedLeadId(id); setView("detail"); }}
        />
      ) : (
        <LeadDetail
          leadId={selectedLeadId!}
          onBack={() => setView("list")}
        />
      )}
    </div>
  );
}

// ─── List View ──────────────────────────────────────────────────────────────

function LeadsList({
  searchTerm, setSearchTerm, sourceFilter, setSourceFilter, currentPage, setCurrentPage, onViewDetail,
}: {
  searchTerm: string; setSearchTerm: (s: string) => void;
  sourceFilter: string; setSourceFilter: (s: string) => void;
  currentPage: number; setCurrentPage: (n: number) => void;
  onViewDetail: (id: number) => void;
}) {
  const { data, isLoading } = trpc.funnel.listLeads.useQuery({
    page: currentPage,
    limit: 50,
    search: searchTerm || undefined,
    source: sourceFilter || undefined,
  });

  const deleteLeads = trpc.funnel.deleteLeads.useMutation({
    onSuccess: () => toast.success("Lead(s) deleted"),
  });

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} lead(s)?`)) return;
    await deleteLeads.mutateAsync({ ids: Array.from(selectedIds) });
    setSelectedIds(new Set());
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-teal-600" />
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          {data && <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{data.total} total</span>}
        </div>
        {selectedIds.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleteLeads.isPending}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Search by name, email, or phone..."
            className="pl-9 h-9"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
          className="h-9 text-sm rounded border border-gray-200 px-3 bg-white"
        >
          <option value="">All Sources</option>
          <option value="funnel">Funnel Lead Capture</option>
          <option value="checkout_form">Checkout Form</option>
          <option value="landing_page">Landing Page</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={data?.leads?.length ? selectedIds.size === data.leads.length : false}
                  onChange={(e) => {
                    if (e.target.checked && data?.leads) setSelectedIds(new Set(data.leads.map(l => l.id)));
                    else setSelectedIds(new Set());
                  }}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Contact</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Source</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Timezone</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">IP Address</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Loading contacts...</td></tr>
            ) : !data?.leads?.length ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No contacts found</td></tr>
            ) : (
              data.leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onViewDetail(lead.id)}>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
                        {(lead.name || lead.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{lead.name || "—"}</div>
                        <div className="text-xs text-gray-500">{lead.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      lead.source === "checkout_form" ? "bg-green-100 text-green-700" :
                      lead.source === "funnel" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {lead.source || "unknown"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{lead.timezone || "—"}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 font-mono">{lead.ipAddress || "—"}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => onViewDetail(lead.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage >= data.totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail View ────────────────────────────────────────────────────────────

function LeadDetail({ leadId, onBack }: { leadId: number; onBack: () => void }) {
  const { data, isLoading, refetch } = trpc.funnel.getLeadById.useQuery({ id: leadId });
  const updateLead = trpc.funnel.updateLead.useMutation({
    onSuccess: () => { toast.success("Contact updated"); refetch(); },
  });

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || "");
  };

  const saveEdit = async () => {
    if (!editingField) return;
    const updates: any = { id: leadId };
    updates[editingField] = editValue;
    await updateLead.mutateAsync(updates);
    setEditingField(null);
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-gray-400">Contact not found</div>;

  const { lead, funnel, page } = data;
  let customFields: Record<string, any> = {};
  try { customFields = lead.customFields ? JSON.parse(lead.customFields) : {}; } catch {}

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>

      {/* Contact Header Card */}
      <Card className="mb-6 border-teal-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-lg font-bold">
              {(lead.name || lead.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{lead.name || lead.email}</h2>
              <p className="text-sm text-gray-500">{lead.email}</p>
              {lead.lastActiveAt && (
                <p className="text-xs text-gray-400">Last active: {new Date(lead.lastActiveAt).toLocaleString()}</p>
              )}
            </div>
            <div className="text-right text-xs text-gray-400">
              Created: {new Date(lead.createdAt).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column — Contact Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Contact Information</CardTitle>
                <Button variant="ghost" size="sm" className="text-teal-600 text-xs" onClick={() => startEdit("name", lead.name || "")}>
                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={<Users className="w-4 h-4" />} label="Name" value={lead.name || "—"} field="name" editingField={editingField} editValue={editValue} setEditValue={setEditValue} onStartEdit={startEdit} onSave={saveEdit} onCancel={() => setEditingField(null)} />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={lead.email} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={lead.phone || "—"} field="phone" editingField={editingField} editValue={editValue} setEditValue={setEditValue} onStartEdit={startEdit} onSave={saveEdit} onCancel={() => setEditingField(null)} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Timezone" value={lead.timezone || "—"} />
              <InfoRow icon={<Tag className="w-4 h-4" />} label="Tags" value={lead.tags || "—"} field="tags" editingField={editingField} editValue={editValue} setEditValue={setEditValue} onStartEdit={startEdit} onSave={saveEdit} onCancel={() => setEditingField(null)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Source & Attribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={<Link2 className="w-4 h-4" />} label="Source" value={lead.source || "—"} />
              <InfoRow icon={<Globe className="w-4 h-4" />} label="Source Page" value={lead.sourcePage || "—"} isUrl />
              <InfoRow icon={<ExternalLink className="w-4 h-4" />} label="Referrer" value={lead.referrer || "—"} isUrl />
              {funnel && <InfoRow icon={<Link2 className="w-4 h-4" />} label="Funnel" value={funnel.name} />}
              {page && <InfoRow icon={<Link2 className="w-4 h-4" />} label="Page" value={`${page.title} (${page.pageType})`} />}
            </CardContent>
          </Card>
        </div>

        {/* Right Column — Technical Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Access Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="IP Address" value={lead.ipAddress || "—"} />
              <div className="flex items-start gap-3">
                <Monitor className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-500 block">User Agent</span>
                  <span className="text-gray-700 text-xs break-all">{lead.userAgent || "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {Object.keys(customFields).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">Custom Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.entries(customFields).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3">
                    <span className="text-xs text-gray-500 font-medium min-w-[100px]">{key}</span>
                    <span className="text-gray-700 text-xs break-all">
                      {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper: Info Row ───────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, field, editingField, editValue, setEditValue, onStartEdit, onSave, onCancel, isUrl,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  field?: string;
  editingField?: string | null;
  editValue?: string;
  setEditValue?: (v: string) => void;
  onStartEdit?: (field: string, value: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
  isUrl?: boolean;
}) {
  const isEditing = field && editingField === field;

  return (
    <div className="flex items-center gap-3 group">
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-500 block">{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-1 mt-0.5">
            <Input
              value={editValue}
              onChange={(e) => setEditValue?.(e.target.value)}
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") onSave?.(); if (e.key === "Escape") onCancel?.(); }}
            />
            <button onClick={onSave} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {isUrl && value !== "—" ? (
              <a href={value} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline text-xs truncate max-w-[250px]">{value}</a>
            ) : (
              <span className="text-gray-700 text-xs">{value}</span>
            )}
            {field && onStartEdit && (
              <button onClick={() => onStartEdit(field, value === "—" ? "" : value)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-teal-600 transition-opacity">
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
