import { useAuth } from "@/_core/hooks/useAuth";
import { clearStudentLoginSession } from "@/lib/studentLoginSession";
import { LogOut, UserRoundCheck } from "lucide-react";

/**
 * Shown in every app shell while a Platform Admin is deliberately using a
 * short-lived student session. It is intentionally distinct from Demo Mode:
 * actions in this tab are performed as the learner.
 */
export default function StudentLoginBanner() {
  const { user } = useAuth();
  if (!user || !(user as any).studentLoginMode) return null;

  const studentName = (user as any).displayName ?? (user as any).name ?? "this student";
  const returnToAdmin = () => {
    clearStudentLoginSession();
    // The Platform Admin's original first-party session was never changed.
    window.location.replace("https://app.allaboutultrasound.com/platform-admin");
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-[10000] flex items-center justify-between gap-3 bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-lg"
      role="status"
      data-student-login-banner
    >
      <div className="flex min-w-0 items-center gap-2">
        <UserRoundCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          <strong>Student Login</strong> — you are signed in as <strong>{studentName}</strong>. Actions in this tab affect this student’s account.
        </span>
      </div>
      <button
        type="button"
        onClick={returnToAdmin}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/80"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Return to Admin
      </button>
    </div>
  );
}
