/**
 * InstructorPortal.tsx
 * Self-service portal for instructors to:
 *   - View assigned courses and revenue share percentages
 *   - Submit publish requests for courses
 *   - View publish request history
 *   - Configure payout settings (PayPal, ACH, Stripe)
 *   - View payout request history
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BookOpen, DollarSign, Send, Clock, CheckCircle, XCircle,
  Settings, CreditCard, ChevronRight, AlertCircle, Eye, RefreshCw
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  if (status === "pending") return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Pending Review</Badge>;
  if (status === "approved") return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">Approved</Badge>;
  if (status === "rejected") return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">Rejected</Badge>;
  if (status === "public") return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">Published</Badge>;
  if (status === "draft") return <Badge variant="outline" className="text-gray-500 border-gray-300">Draft</Badge>;
  if (status === "private") return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">Private</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── My Courses Tab ───────────────────────────────────────────────────────────

function MyCoursesTab() {
  const utils = trpc.useUtils();
  const { data: courses, isLoading } = trpc.lms.getMyInstructorCourses.useQuery();
  const [publishDialogCourse, setPublishDialogCourse] = useState<{ id: number; title: string } | null>(null);
  const [publishNote, setPublishNote] = useState("");

  const requestPublishMut = trpc.lms.requestCoursePublish.useMutation({
    onSuccess: () => {
      toast.success("Publish request submitted! The admin will review it shortly.");
      setPublishDialogCourse(null);
      setPublishNote("");
      utils.lms.getMyInstructorCourses.invalidate();
      utils.lms.getMyPublishRequests.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No courses assigned yet</p>
        <p className="text-sm mt-1">Contact your administrator to get assigned to a course.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {courses.map((c) => {
          const isPending = c.latestPublishRequest?.status === "pending";
          const canRequestPublish = c.courseStatus !== "public" && !c.canSelfPublish && !isPending;
          const canSelfPublish = c.canSelfPublish && c.courseStatus !== "public";

          return (
            <Card key={c.permId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Thumbnail */}
                  {c.courseThumbnail ? (
                    <img src={c.courseThumbnail} alt="" className="w-full sm:w-20 h-32 sm:h-14 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-full sm:w-20 h-14 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-6 h-6 text-teal-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{c.courseTitle ?? "Untitled Course"}</h3>
                      {statusBadge(c.courseStatus ?? "draft")}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Revenue share: <strong className="text-foreground">{c.revenueSharePct}%</strong>
                      </span>
                      {c.canSelfPublish && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Can self-publish
                        </span>
                      )}
                    </div>
                    {/* Latest publish request status */}
                    {c.latestPublishRequest && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Last request:</span>
                        {statusBadge(c.latestPublishRequest.status)}
                        <span className="text-muted-foreground">{fmtDate(c.latestPublishRequest.requestedAt)}</span>
                        {c.latestPublishRequest.reviewNote && (
                          <span className="text-muted-foreground italic">— "{c.latestPublishRequest.reviewNote}"</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap sm:flex-col gap-2 sm:items-end flex-shrink-0">
                    {c.courseSlug && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/learn/${c.courseSlug}`}>
                          <Eye className="w-3 h-3 mr-1" /> Preview
                        </Link>
                      </Button>
                    )}
                    {canRequestPublish && (
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                        onClick={() => setPublishDialogCourse({ id: c.courseId!, title: c.courseTitle ?? "Course" })}
                      >
                        <Send className="w-3 h-3 mr-1" /> Request Publish
                      </Button>
                    )}
                    {canSelfPublish && (
                      <Button size="sm" variant="outline" className="text-green-600 border-green-300">
                        <CheckCircle className="w-3 h-3 mr-1" /> Publish Now
                      </Button>
                    )}
                    {isPending && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                        <Clock className="w-3 h-3 mr-1" /> Awaiting Review
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Publish Request Dialog */}
      <Dialog open={!!publishDialogCourse} onOpenChange={() => setPublishDialogCourse(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Course Publish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Submitting a publish request for <strong>{publishDialogCourse?.title}</strong>. An admin will review and approve or reject it.
            </p>
            <div className="space-y-2">
              <Label>Note to admin (optional)</Label>
              <Textarea
                placeholder="e.g. All content is finalized and ready for review."
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogCourse(null)}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={requestPublishMut.isPending}
              onClick={() => {
                if (!publishDialogCourse) return;
                requestPublishMut.mutate({ courseId: publishDialogCourse.id, note: publishNote || undefined });
              }}
            >
              {requestPublishMut.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Publish History Tab ──────────────────────────────────────────────────────

function PublishHistoryTab() {
  const { data: requests, isLoading } = trpc.lms.getMyPublishRequests.useQuery();

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No publish requests yet</p>
        <p className="text-sm mt-1">When you submit a publish request for a course, it will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Course</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Submitted</th>
            <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Reviewed</th>
            <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Review Note</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {requests.map((r) => (
            <tr key={r.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium max-w-[200px] truncate">{r.courseTitle ?? "—"}</td>
              <td className="px-4 py-3">{statusBadge(r.status)}</td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{fmtDate(r.requestedAt)}</td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{fmtDate(r.reviewedAt)}</td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell italic text-xs max-w-[200px] truncate">{r.reviewNote ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Payout Settings Tab ──────────────────────────────────────────────────────

function PayoutSettingsTab() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.lmsEnrollmentAdmin.getMyInstructorPayoutConfig.useQuery();
  const { data: payoutHistory, isLoading: histLoading } = trpc.lmsEnrollmentAdmin.getMyPayoutRequests.useQuery();

  const [method, setMethod] = useState<"stripe" | "paypal" | "ach">("paypal");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [achRouting, setAchRouting] = useState("");
  const [achAccount, setAchAccount] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);

  // Pre-fill form from existing config
  if (config && !configLoaded) {
    setConfigLoaded(true);
    setMethod((config.preferredMethod as "stripe" | "paypal" | "ach") ?? "paypal");
    try {
      const details = JSON.parse(config.paymentDetails ?? "{}");
      if (details.paypal_email) setPaypalEmail(details.paypal_email);
      if (details.ach_routing) setAchRouting(details.ach_routing);
      if (details.ach_account) setAchAccount(details.ach_account);
      if (details.stripe_account_id) setStripeAccountId(details.stripe_account_id);
    } catch {}
  }

  const saveMut = trpc.lmsEnrollmentAdmin.saveInstructorPayoutConfig.useMutation({
    onSuccess: () => {
      toast.success("Payout settings saved!");
      utils.lmsEnrollmentAdmin.getMyInstructorPayoutConfig.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const details: Record<string, string> = {};
    if (method === "paypal" && paypalEmail) details.paypal_email = paypalEmail;
    if (method === "ach") { details.ach_routing = achRouting; details.ach_account = achAccount; }
    if (method === "stripe" && stripeAccountId) details.stripe_account_id = stripeAccountId;
    saveMut.mutate({ preferredMethod: method, paymentDetails: details });
  };

  return (
    <div className="space-y-6">
      {/* Payout Config Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-teal-600" />
            Payout Method
          </CardTitle>
          <CardDescription>Configure how you'd like to receive your revenue share payments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Preferred Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as "stripe" | "paypal" | "ach")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="ach">ACH Bank Transfer</SelectItem>
                    <SelectItem value="stripe">Stripe Connect</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {method === "paypal" && (
                <div className="space-y-2">
                  <Label>PayPal Email</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                  />
                </div>
              )}

              {method === "ach" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Routing Number</Label>
                    <Input
                      placeholder="9-digit routing number"
                      value={achRouting}
                      onChange={(e) => setAchRouting(e.target.value)}
                      maxLength={9}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      placeholder="Account number"
                      value={achAccount}
                      onChange={(e) => setAchAccount(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {method === "stripe" && (
                <div className="space-y-2">
                  <Label>Stripe Connect Account ID</Label>
                  <Input
                    placeholder="acct_..."
                    value={stripeAccountId}
                    onChange={(e) => setStripeAccountId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Contact admin to set up your Stripe Connect account.</p>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saveMut.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {saveMut.isPending ? "Saving..." : "Save Payout Settings"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-teal-600" />
            Payout Request History
          </CardTitle>
          <CardDescription>Track the status of your payout requests.</CardDescription>
        </CardHeader>
        <CardContent>
          {histLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !payoutHistory || payoutHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No payout requests yet. Contact your administrator to request a payout.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Amount</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Requested</th>
                    <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payoutHistory.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {p.amountCents ? `$${(p.amountCents / 100).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2">{statusBadge(p.status ?? "pending")}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{fmtDate(p.requestedAt)}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell text-xs italic">{p.reviewNote ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InstructorPortal() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="space-y-3 w-full max-w-lg px-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md text-center p-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">Please sign in to access the Instructor Portal.</p>
          <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white">
            <a href={getLoginUrl("/instructor-portal")}>Sign In</a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-teal-600" />
                Instructor Portal
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Welcome back, <strong>{user.name}</strong>
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/learn">
                <ChevronRight className="w-4 h-4 mr-1" /> Back to Library
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Tabs defaultValue="courses">
          <TabsList className="mb-6 w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="courses" className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>My Courses</span>
            </TabsTrigger>
            <TabsTrigger value="publish-history" className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Publish</span> History
            </TabsTrigger>
            <TabsTrigger value="payout" className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Payouts</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses">
            <MyCoursesTab />
          </TabsContent>

          <TabsContent value="publish-history">
            <PublishHistoryTab />
          </TabsContent>

          <TabsContent value="payout">
            <PayoutSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
