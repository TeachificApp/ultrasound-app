/**
 * MembershipAdmin.tsx — Admin management for brand memberships (AAUS + iHeartEcho)
 */
import { useState } from "react";
import { UserSearchCombobox, type SelectedUser } from "@/components/UserSearchCombobox";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, UserPlus, UserX, RefreshCw, Search, Crown } from "lucide-react";

type Brand = "aaus" | "iheartecho";

function MemberRow({
  member,
  onRevoke,
}: {
  member: {
    id: number;
    userId: number;
    brand: string;
    tier: string;
    status: string;
    source: string | null;
    grantedAt: number | null;
    expiresAt: number | null;
    stripeSubscriptionId: string | null;
    userName: string | null;
    userEmail: string | null;
  };
  onRevoke: (userId: number, brand: Brand) => void;
}) {
  const statusColor =
    member.status === "active"
      ? "bg-green-100 text-green-700"
      : member.status === "cancelled"
      ? "bg-red-100 text-red-700"
      : "bg-yellow-100 text-yellow-700";

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
        {(member.userName || member.userEmail || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{member.userName || "—"}</p>
        <p className="text-xs text-muted-foreground truncate">{member.userEmail || "—"}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
          {member.status}
        </span>
        <span className="text-xs text-muted-foreground">
          {member.source || "stripe"}
        </span>
        {member.grantedAt && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            {new Date(member.grantedAt).toLocaleDateString()}
          </span>
        )}
        {member.status === "active" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
            onClick={() => onRevoke(member.userId, member.brand as Brand)}
          >
            <UserX className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function GrantMembershipDialog({
  open,
  onClose,
  defaultBrand,
}: {
  open: boolean;
  onClose: () => void;
  defaultBrand: Brand;
}) {
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [brand, setBrand] = useState<Brand>(defaultBrand);
  const utils = trpc.useUtils();

  const grantMut = trpc.brandMembership.adminGrant.useMutation({
    onSuccess: () => {
      toast.success("Membership granted");
      utils.brandMembership.adminList.invalidate();
      onClose();
      setSelectedUser(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleGrant = async () => {
    if (!selectedUser || selectedUser.isNew || !selectedUser.id) { toast.error("Select an existing user"); return; }
    await grantMut.mutateAsync({ userId: selectedUser.id, brand });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelectedUser(null); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Grant Membership</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Search User</Label>
            <UserSearchCombobox onSelect={setSelectedUser} placeholder="Search by name or email…" existingOnly />
          </div>
          <div>
            <Label>Brand</Label>
            <Select value={brand} onValueChange={(v) => setBrand(v as Brand)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aaus">All About Ultrasound™</SelectItem>
                <SelectItem value="iheartecho">iHeartEcho™</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setSelectedUser(null); onClose(); }}>Cancel</Button>
          <Button
            onClick={handleGrant}
            disabled={!selectedUser || grantMut.isPending}
          >
            {grantMut.isPending ? "Granting..." : "Grant Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrandMembersPanel({ brand, label }: { brand: Brand; label: string }) {
  const [search, setSearch] = useState("");
  const [showGrant, setShowGrant] = useState(false);
  const utils = trpc.useUtils();

  const { data: members, isLoading, refetch } = trpc.brandMembership.adminList.useQuery({ brand });

  const revokeMut = trpc.brandMembership.adminRevoke.useMutation({
    onSuccess: () => {
      toast.success("Membership revoked");
      utils.brandMembership.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (members || []).filter((m) => {
    const q = search.toLowerCase();
    return (
      !q ||
      m.userName?.toLowerCase().includes(q) ||
      m.userEmail?.toLowerCase().includes(q)
    );
  });

  const activeCount = (members || []).filter((m) => m.status === "active").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-teal-600" />
            {label}
            <Badge variant="secondary" className="text-xs">{activeCount} active</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setShowGrant(true)}>
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Grant
            </Button>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {search ? "No members match your search" : "No members yet"}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {filtered.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                onRevoke={(userId, b) => revokeMut.mutate({ userId, brand: b })}
              />
            ))}
          </div>
        )}
      </CardContent>
      <GrantMembershipDialog open={showGrant} onClose={() => setShowGrant(false)} defaultBrand={brand} />
    </Card>
  );
}

export default function MembershipAdmin() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-teal-600" />
        <div>
          <h1 className="text-xl font-bold">Membership Management</h1>
          <p className="text-sm text-muted-foreground">Manage premium memberships for AAUS and iHeartEcho</p>
        </div>
      </div>

      <div className="grid gap-6">
        <BrandMembersPanel brand="aaus" label="All About Ultrasound™ — Premium Members" />
        <BrandMembersPanel brand="iheartecho" label="iHeartEcho™ — Premium Members" />
      </div>
    </div>
  );
}
