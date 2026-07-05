import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plane, Search, Users, MapPin, Award, Clock, CheckCircle, ExternalLink } from "lucide-react";

const TRAVEL_TYPE_LABELS: Record<string, string> = {
  short_term: "Short-Term (<13 wks)",
  long_term: "Long-Term (13+ wks)",
  both: "Both",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  closed: "bg-green-500/20 text-green-300 border-green-500/30",
};

interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  registryCredentials: string | null;
  travelType: string;
  currentLocation: string | null;
  travelAgency: string | null;
  yearsTravel: string | null;
  scanSpecialties: string | null;
  additionalInfo: string | null;
  communityAccessGranted: boolean;
  status: string;
  adminNotes: string | null;
  createdAt: number;
}

export default function AdminSonoTravelers() {
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "contacted" | "closed">("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editStatus, setEditStatus] = useState<"new" | "contacted" | "closed">("new");
  const [editNotes, setEditNotes] = useState("");

  const { data, isLoading, refetch } = trpc.sonoTravelers.adminListLeads.useQuery({
    status: statusFilter,
    limit: 200,
    offset: 0,
  });

  const updateMutation = trpc.sonoTravelers.adminUpdateLead.useMutation({
    onSuccess: () => {
      toast.success("Lead updated successfully.");
      setSelectedLead(null);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Update failed.");
    },
  });

  const leads: Lead[] = (data?.leads ?? []) as Lead[];
  const total = data?.total ?? 0;

  const filtered = leads.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.firstName.toLowerCase().includes(q) ||
      l.lastName.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.currentLocation ?? "").toLowerCase().includes(q) ||
      (l.travelAgency ?? "").toLowerCase().includes(q) ||
      (l.registryCredentials ?? "").toLowerCase().includes(q)
    );
  });

  const openLead = (lead: Lead) => {
    setSelectedLead(lead);
    setEditStatus(lead.status as "new" | "contacted" | "closed");
    setEditNotes(lead.adminNotes ?? "");
  };

  const handleSave = () => {
    if (!selectedLead) return;
    updateMutation.mutate({
      id: selectedLead.id,
      status: editStatus,
      adminNotes: editNotes,
    });
  };

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    closed: leads.filter((l) => l.status === "closed").length,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center">
          <Plane className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Sono Travelers — Admin</h1>
          <p className="text-slate-400 text-sm">Manage community leads and member access</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-teal-600 text-teal-300 hover:bg-teal-900"
            onClick={() => window.open("/sono-travelers", "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-1.5" />
            View Join Page
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-teal-600 text-teal-300 hover:bg-teal-900"
            onClick={() => window.open("/community/sono-travelers", "_blank")}
          >
            <Users className="w-4 h-4 mr-1.5" />
            View Community
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Members", value: total, icon: <Users className="w-4 h-4" />, color: "text-teal-400" },
          { label: "New", value: stats.new, icon: <Clock className="w-4 h-4" />, color: "text-blue-400" },
          { label: "Contacted", value: stats.contacted, icon: <Award className="w-4 h-4" />, color: "text-yellow-400" },
          { label: "Closed", value: stats.closed, icon: <CheckCircle className="w-4 h-4" />, color: "text-green-400" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className={`flex items-center gap-1.5 ${color} text-sm mb-1`}>
              {icon}
              {label}
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, location, agency..."
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
            <Plane className="w-8 h-8 opacity-30" />
            <p className="text-sm">No leads found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Credentials</th>
                  <th className="text-left px-4 py-3">Travel Type</th>
                  <th className="text-left px-4 py-3">Location</th>
                  <th className="text-left px-4 py-3">Agency</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => openLead(lead)}
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {lead.firstName} {lead.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{lead.email}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{lead.registryCredentials || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-teal-300">
                        {TRAVEL_TYPE_LABELS[lead.travelType] ?? lead.travelType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      <span className="flex items-center gap-1">
                        {lead.currentLocation ? (
                          <>
                            <MapPin className="w-3 h-3" />
                            {lead.currentLocation}
                          </>
                        ) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{lead.travelAgency || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[lead.status] ?? ""}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {lead.communityAccessGranted && (
                        <Badge variant="outline" className="text-xs border-teal-600 text-teal-400">
                          Access Granted
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-slate-500 text-xs mt-3">
        Showing {filtered.length} of {total} total leads
      </p>

      {/* Lead detail dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(o) => !o && setSelectedLead(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5 text-teal-400" />
              {selectedLead?.firstName} {selectedLead?.lastName}
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  { label: "Email", value: selectedLead.email },
                  { label: "Travel Type", value: TRAVEL_TYPE_LABELS[selectedLead.travelType] ?? selectedLead.travelType },
                  { label: "Credentials", value: selectedLead.registryCredentials || "—" },
                  { label: "Location", value: selectedLead.currentLocation || "—" },
                  { label: "Agency", value: selectedLead.travelAgency || "—" },
                  { label: "Years Traveling", value: selectedLead.yearsTravel || "—" },
                  { label: "Specialties", value: selectedLead.scanSpecialties || "—" },
                  { label: "Community Access", value: selectedLead.communityAccessGranted ? "Granted" : "Not granted" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-slate-400 text-xs">{label}</div>
                    <div className="text-white font-medium">{value}</div>
                  </div>
                ))}
              </div>

              {selectedLead.additionalInfo && (
                <div>
                  <div className="text-slate-400 text-xs mb-1">Additional Info</div>
                  <p className="text-slate-300 text-sm bg-white/5 rounded-lg p-3">
                    {selectedLead.additionalInfo}
                  </p>
                </div>
              )}

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-medium">Status</label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as typeof editStatus)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-medium">Admin Notes</label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Internal notes..."
                  rows={3}
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLead(null)} className="border-white/20 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-teal-600 hover:bg-teal-500 text-white"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
