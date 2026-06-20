/**
 * CourseWaitlistTab.tsx
 * Waitlist settings + entries management for LMS cohort/workshop courses.
 * Used in LMSAdmin course editor Waitlist tab.
 */
import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RichTextEditor from "@/components/RichTextEditor";
import { Download, Mail, UserCheck, Loader2, Users, Settings2, ChevronDown, ChevronUp, DollarSign } from "lucide-react";

interface CourseWaitlistTabProps {
  courseId: number;
  course: { title: string; price?: number | null; type?: string };
}

export function CourseWaitlistTab({ courseId, course }: CourseWaitlistTabProps) {
  const [activeSection, setActiveSection] = useState<"settings" | "entries">("entries");

  // ── Settings ──────────────────────────────────────────────────────────────
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } =
    trpc.lmsAdmin.getCourseWaitlistSettings.useQuery({ courseId });

  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setWaitlistEnabled(settings.waitlistEnabled ?? false);
      setHeading(settings.waitlistHeading ?? "");
      setBody(settings.waitlistBody ?? "");
      setCtaLabel(settings.waitlistCtaLabel ?? "");
      setCtaUrl(settings.waitlistCtaUrl ?? "");
      setRedirectUrl(settings.waitlistRedirectUrl ?? "");
      setSuccessMessage(settings.waitlistSuccessMessage ?? "");
      setSettingsDirty(false);
    }
  }, [settings]);

  const saveSettings = trpc.lmsAdmin.saveCourseWaitlistSettings.useMutation({
    onSuccess: () => { toast.success("Waitlist settings saved"); setSettingsDirty(false); refetchSettings(); },
    onError: e => toast.error(`Failed to save: ${e.message}`),
  });

  const handleSaveSettings = () => {
    saveSettings.mutate({
      courseId,
      waitlistEnabled,
      waitlistHeading: heading || undefined,
      waitlistBody: body || undefined,
      waitlistCtaLabel: ctaLabel || undefined,
      waitlistCtaUrl: ctaUrl || undefined,
      waitlistRedirectUrl: redirectUrl || undefined,
      waitlistSuccessMessage: successMessage || undefined,
    });
  };

  // ── Entries ────────────────────────────────────────────────────────────────
  const { data: entries, isLoading: entriesLoading, refetch: refetchEntries } =
    trpc.lmsAdmin.getCourseWaitlistEntries.useQuery({ courseId });

  const exportCsv = trpc.lmsAdmin.exportCourseWaitlistCsv.useQuery(
    { courseId },
    { enabled: false }
  );

  const handleExport = async () => {
    const result = await exportCsv.refetch();
    if (result.data?.csv) {
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waitlist-course-${courseId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ── Grant Access Dialog ────────────────────────────────────────────────────
  const [grantEntry, setGrantEntry] = useState<any>(null);
  const [accessType, setAccessType] = useState<"free" | "paid">("paid");
  const [priceOverride, setPriceOverride] = useState<string>("");
  const [useOverride, setUseOverride] = useState(false);

  const grantAccess = trpc.lmsAdmin.grantCourseWaitlistAccess.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setGrantEntry(null);
      refetchEntries();
    },
    onError: e => toast.error(`Failed to grant access: ${e.message}`),
  });

  const handleGrant = () => {
    if (!grantEntry) return;
    const priceOverrideCents = useOverride && priceOverride
      ? Math.round(parseFloat(priceOverride) * 100)
      : undefined;
    grantAccess.mutate({
      entryId: grantEntry.id,
      courseId,
      accessType,
      priceOverrideCents,
      origin: window.location.origin,
    });
  };

  const defaultPriceDollars = course.price ? Number(course.price).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {/* Section Switcher */}
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        <button
          onClick={() => setActiveSection("entries")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
            activeSection === "entries"
              ? "bg-teal-50 text-teal-700 border-b-2 border-teal-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5" />
          Sign-ups {entries ? `(${entries.length})` : ""}
        </button>
        <button
          onClick={() => setActiveSection("settings")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
            activeSection === "settings"
              ? "bg-teal-50 text-teal-700 border-b-2 border-teal-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Settings2 className="w-4 h-4 inline mr-1.5" />
          Waitlist Settings
        </button>
      </div>

      {/* Entries Section */}
      {activeSection === "entries" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Waitlist Sign-ups</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {entries?.length ?? 0} people on the waitlist for <strong>{course.title}</strong>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exportCsv.isFetching || !entries?.length}
            >
              {exportCsv.isFetching ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Download className="w-3 h-3 mr-1.5" />}
              Export CSV
            </Button>
          </div>

          {entriesLoading ? (
            <div className="text-center py-8 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading entries...
            </div>
          ) : !entries?.length ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No waitlist sign-ups yet</p>
              <p className="text-sm text-gray-400 mt-1">Enable the waitlist in Settings to start collecting sign-ups.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Message</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: any) => (
                    <TableRow key={entry.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm font-medium">{entry.name}</TableCell>
                      <TableCell className="text-sm text-gray-600">{entry.email}</TableCell>
                      <TableCell className="text-sm text-gray-500">{entry.phone || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-xs truncate">{entry.message || "—"}</TableCell>
                      <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-teal-600 border-teal-200 hover:bg-teal-50"
                          onClick={() => {
                            setGrantEntry(entry);
                            setAccessType("paid");
                            setPriceOverride("");
                            setUseOverride(false);
                          }}
                        >
                          <UserCheck className="w-3 h-3 mr-1" />
                          Grant Access
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Settings Section */}
      {activeSection === "settings" && (
        <div className="space-y-6 max-w-2xl">
          {settingsLoading ? (
            <div className="text-center py-8 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : (
            <>
              {/* Enable Toggle */}
              <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="font-semibold text-gray-900">Enable Waitlist Mode</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Switch CTAs to waitlist capture when enrollment is unavailable.
                  </p>
                </div>
                <Switch
                  checked={waitlistEnabled}
                  onCheckedChange={v => { setWaitlistEnabled(v); setSettingsDirty(true); }}
                />
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Heading</Label>
                  <Input
                    value={heading}
                    onChange={e => { setHeading(e.target.value); setSettingsDirty(true); }}
                    placeholder="Join the Waitlist"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Body / Intro Text</Label>
                  <div className="mt-1">
                    <RichTextEditor
                      value={body}
                      onChange={v => { setBody(v); setSettingsDirty(true); }}
                      placeholder="Write here..."
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">CTA Button Label</Label>
                  <Input
                    value={ctaLabel}
                    onChange={e => { setCtaLabel(e.target.value); setSettingsDirty(true); }}
                    placeholder="Join Waitlist"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">CTA URL (optional — leave blank to use built-in form)</Label>
                  <Input
                    value={ctaUrl}
                    onChange={e => { setCtaUrl(e.target.value); setSettingsDirty(true); }}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Redirect URL after sign-up (optional)</Label>
                  <Input
                    value={redirectUrl}
                    onChange={e => { setRedirectUrl(e.target.value); setSettingsDirty(true); }}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Success Message</Label>
                  <div className="mt-1">
                    <RichTextEditor
                      value={successMessage}
                      onChange={v => { setSuccessMessage(v); setSettingsDirty(true); }}
                      placeholder="You're on the list! We'll notify you when enrollment opens."
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={saveSettings.isPending || !settingsDirty}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {saveSettings.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Waitlist Settings
              </Button>
            </>
          )}
        </div>
      )}

      {/* Grant Access Dialog */}
      <Dialog open={!!grantEntry} onOpenChange={open => !open && setGrantEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grant Access to {grantEntry?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Granting access to <strong>{course.title}</strong> for <strong>{grantEntry?.email}</strong>.
            </p>

            <div>
              <Label className="text-sm font-medium">Access Type</Label>
              <Select value={accessType} onValueChange={v => setAccessType(v as "free" | "paid")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid — send checkout link via email</SelectItem>
                  <SelectItem value="free">Free — grant immediate access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {accessType === "paid" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={useOverride}
                    onCheckedChange={setUseOverride}
                    id="price-override-toggle"
                  />
                  <Label htmlFor="price-override-toggle" className="text-sm cursor-pointer">
                    Override price (default: ${defaultPriceDollars})
                  </Label>
                </div>
                {useOverride && (
                  <div>
                    <Label className="text-sm font-medium">Price Override (USD)</Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceOverride}
                        onChange={e => setPriceOverride(e.target.value)}
                        placeholder="0.00"
                        className="pl-8"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Enter 0 to grant free access via paid flow.</p>
                  </div>
                )}
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <Mail className="w-4 h-4 inline mr-1.5" />
                  A checkout link will be emailed to <strong>{grantEntry?.email}</strong>.
                </div>
              </div>
            )}

            {accessType === "free" && (
              <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
                <UserCheck className="w-4 h-4 inline mr-1.5" />
                Immediate access will be granted and a welcome email sent to <strong>{grantEntry?.email}</strong>.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantEntry(null)}>Cancel</Button>
            <Button
              onClick={handleGrant}
              disabled={grantAccess.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {grantAccess.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
              {accessType === "free" ? "Grant Free Access" : "Send Checkout Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
