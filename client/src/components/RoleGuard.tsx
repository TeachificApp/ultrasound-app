/**
 * RoleGuard — wraps routes that require specific app roles.
 *
 * Usage:
 *   <RoleGuard roles={["diy_admin", "diy_user"]}>
 *     <AccreditationTool />
 *   </RoleGuard>
 *
 * Behavior:
 *  - While auth is loading: shows a full-page spinner (no flash)
 *  - If unauthenticated: redirects to login
 *  - If authenticated but missing required role: shows "Access Required" page
 *  - If authorised: renders children
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";
import { AdminLoginRedirect } from "@/components/AdminLoginRedirect";
import { Loader2, ShieldAlert, ArrowLeft, CheckCircle2, Send, Crown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PremiumPearlGate } from "@/components/PremiumPearlGate";
import { getLoginUrl } from "@/const";

type AppRole = "user" | "premium_user" | "diy_admin" | "diy_user" | "platform_admin" | "accreditation_manager" | "education_manager" | "education_admin" | "education_student" | "platform_owner" | "platform_moderator" | "instructor" | "team_admin" | "affiliate";

interface RoleGuardProps {
  /** At least one of these roles must be present for access */
  roles: AppRole[];
  /** Optional: also allow platform_admin through (default: true) */
  allowAdmin?: boolean;
  /** How many px of content to show as teaser before the gate card. Default 340. Set 0 for no teaser. */
  teaserHeight?: number;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<AppRole, string> = {
  user: "User",
  premium_user: "Premium User",
  diy_admin: "DIY Accreditation Admin",
  diy_user: "DIY Accreditation User",
  platform_admin: "Platform Admin",
  accreditation_manager: "Accreditation Manager",
  education_manager: "Education Manager",
  education_admin: "Education Admin",
  education_student: "Education Student",
  platform_owner: "Platform Owner",
  platform_moderator: "Platform Moderator",
  instructor: "Instructor",
  team_admin: "Team Admin",
  affiliate: "Affiliate",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  diy_admin: "Lab Admin access to the DIY Accreditation Tool™",
  diy_user: "Seat-based access to the DIY Accreditation Tool™",
  premium_user: "Premium subscription access",
  platform_admin: "Full platform management access",
  accreditation_manager: "Full access to all DIY Accreditation organizations and managed accounts",
  platform_owner: "Owner-level access — full platform control",
  platform_moderator: "Moderation access — content review and member management",
  instructor: "Instructor access — create and manage courses and content",
  team_admin: "Team administration — manage team members and settings",
  affiliate: "Affiliate partner access — referral tracking and commission management",
};

export function RoleGuard({ roles, allowAdmin = true, teaserHeight, children }: RoleGuardProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [message, setMessage] = useState("");
  const [requested, setRequested] = useState(false);

  const isAdminRole = useMemo(
    () =>
      roles.some(r =>
        [
          "platform_admin",
          "platform_owner",
          "platform_moderator",
          "education_admin",
          "education_manager",
          "diy_admin",
          "team_admin",
          "accreditation_manager",
          "instructor",
        ].includes(r),
      ),
    [roles],
  );

  const requestAccess = trpc.system.requestAccess.useMutation({
    onSuccess: (data) => {
      setRequested(true);
      if (data.success) {
        toast.success("Request sent — the platform administrator has been notified.");
      } else {
        toast.success("Request submitted — please contact support@allaboutultrasound.com if you need immediate assistance.");
      }
    },
    onError: () => {
      toast.error("Could not send request. Please email support@allaboutultrasound.com directly.");
    },
  });

  // Loading state — don't flash the access-denied page
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </div>
    );
  }

  // Not authenticated — handle based on role type
  if (!isAuthenticated || !user) {
    if (isAdminRole) {
      const returnPath = window.location.pathname + window.location.search;
      return <AdminLoginRedirect returnPath={returnPath} />;
    }
    // For content roles (premium_user, diy_user), show blurred overlay with login/upgrade CTA
    const hasPremiumRole = roles.includes("premium_user");
    const isDiyOnlyGate = !hasPremiumRole && roles.some(r => ["diy_admin", "diy_user"].includes(r));
    return (
      <PremiumPearlGate type={isDiyOnlyGate ? "diy" : "login"} teaserHeight={teaserHeight}>
        {children}
      </PremiumPearlGate>
    );
  }

  // Check roles — appRoles is the array returned by auth.me
  // Also treat user.role === "admin" (the base DB admin flag) as platform_admin for allowAdmin gates
  const userRoles: AppRole[] = (user as any).appRoles ?? [];
  const isPlatformAdmin = userRoles.includes("platform_admin") || userRoles.includes("platform_owner") || (user as any).role === "admin";
  const hasRequiredRole = roles.some(r => userRoles.includes(r));
  const isAuthorised = hasRequiredRole || (allowAdmin && isPlatformAdmin);

   if (isAuthorised) {
    return <>{children}</>;
  }
  // If the required role is premium_user, show BlurredOverlay premium gate over actual content
  // This applies even when diy roles are also listed — premium_user takes precedence for the overlay type
  const isPremiumGate = roles.includes("premium_user");
  if (isPremiumGate) {
    return (
      <PremiumPearlGate type="premium" teaserHeight={teaserHeight}>
        {children}
      </PremiumPearlGate>
    );
  }
  // DEAD CODE BELOW — kept for reference only, never reached for premium gate
  if (false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              <Crown className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Merriweather, serif" }}>Premium Feature</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              This feature requires a <strong>Premium membership</strong>. Upgrade to unlock all clinical protocols, ScanCoach guides, EchoAssist™ engines, and more.
            </p>
          </div>
          <div className="rounded-xl p-4 text-left space-y-2 border" style={{ borderColor: "#f59e0b30", background: "#f59e0b08" }}>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Included with Premium</p>
            <ul className="space-y-1 text-sm text-foreground">
              {["All EchoNavigator protocols (TEE, ICE, Stress, HOCM, Structural, PulmHTN)", "All EchoAssist™ clinical engines", "Unlimited Ultrasound Flashcards", "Daily Challenge Archive", "Report Builder"].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/premium">
              <Button className="w-full font-semibold gap-2" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white" }}>
                <Crown className="w-4 h-4" />
                Upgrade to Premium
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Already a member?{" "}
            <a href="/premium" className="underline" style={{ color: "#189aa1" }}>Sync your subscription</a>
          </p>
        </div>
      </div>
    );
  }
  // DIY gate — show BlurredOverlay with DIY membership CTA over actual content
  const isDiyGate2 = roles.some(r => ["diy_admin", "diy_user"].includes(r));
  if (isDiyGate2) {
    return (
      <PremiumPearlGate type="diy" teaserHeight={teaserHeight}>
        {children}
      </PremiumPearlGate>
    );
  }

  // Access denied — show clear message with contact CTA
  const requiredRoleLabels = roles.map(r => ROLE_LABELS[r]).join(" or ");
  const description = roles.map(r => ROLE_DESCRIPTIONS[r] ?? ROLE_LABELS[r]).join(" or ");

  const handleRequestAccess = () => {
    requestAccess.mutate({
      requestedRoute: location,
      message: message.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}
          >
            {requested ? (
              <CheckCircle2 className="w-10 h-10 text-white" />
            ) : (
              <ShieldAlert className="w-10 h-10 text-white" />
            )}
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            {requested ? "Request Sent" : "Access Required"}
          </h1>
          {requested ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your access request has been sent to the platform administrator. You will be notified when access is granted.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              This section requires <strong>{requiredRoleLabels}</strong> access.
              {description && (
                <span className="block mt-1 text-xs text-muted-foreground/70">
                  {description} is needed to view this page.
                </span>
              )}
            </p>
          )}
        </div>

        {/* Role info */}
        <div
          className="rounded-xl p-4 text-left space-y-2 border"
          style={{ borderColor: "#189aa1" + "30", background: "#189aa1" + "08" }}
        >
          <p className="text-xs font-semibold text-[#189aa1] uppercase tracking-wider">
            Your current roles
          </p>
          {userRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles assigned yet</p>
          ) : (
            <ul className="space-y-1">
              {userRoles.map(r => (
                <li key={r} className="text-sm text-foreground flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "#189aa1" }}
                  />
                  {ROLE_LABELS[r]}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        {!requested ? (
          <div className="flex flex-col gap-3">
            {/* Optional message */}
            <Textarea
              placeholder="Optional: describe why you need access or your role at the lab…"
              className="text-sm resize-none"
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={500}
            />
            <Button
              className="w-full font-semibold gap-2"
              style={{ background: "#189aa1" }}
              onClick={handleRequestAccess}
              disabled={requestAccess.isPending}
            >
              {requestAccess.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Request Access
                </>
              )}
            </Button>
            <Link href="/">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Link href="/">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        )}

        {/* Help text */}
        <p className="text-xs text-muted-foreground">
          If you believe this is an error, contact your Lab Admin or{" "}
          <a
            href="mailto:support@allaboutultrasound.com"
            className="underline"
            style={{ color: "#189aa1" }}
          >
            support@allaboutultrasound.com
          </a>
        </p>
      </div>
    </div>
  );
}
