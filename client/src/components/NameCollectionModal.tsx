/**
 * NameCollectionModal — Prompts authenticated users who have not yet set
 * a first and last name to complete their profile before continuing.
 *
 * Shown once per session after OAuth login. Cannot be dismissed without
 * providing at least a first name and last name.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User } from "lucide-react";

const BRAND = "#189aa1";

/** Placeholder values that should be treated as "not set" */
const PLACEHOLDER_VALUES = new Set([
  "last name", "lastname", "last",
  "first name", "firstname", "first",
  "name", "your name", "my name",
  "full name", "fullname",
  "enter name", "enter last name", "enter first name",
  "type your name", "type name",
]);

function isPlaceholder(val: string | null | undefined): boolean {
  if (!val) return true;
  return PLACEHOLDER_VALUES.has(val.trim().toLowerCase());
}

/** Returns true if the user's name looks like a real full name (has at least two words,
 *  neither of which is an email username pattern). */
function hasFullName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  // Reject names that look like email usernames (contain dots/underscores but no spaces)
  if (!trimmed.includes(" ")) return false;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  // Reject if it looks like a Thinkific merged account
  if (trimmed.startsWith("[Merged into #")) return false;
  return true;
}

export default function NameCollectionModal() {
  const { user, loading, refresh } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Pre-fill inputs once user data is available
  useEffect(() => {
    if (!user || initialized) return;
    const rawFirst = (user as any)?.firstName as string | null | undefined;
    const rawLast = (user as any)?.lastName as string | null | undefined;
    if (!isPlaceholder(rawFirst)) setFirstName(rawFirst ?? "");
    if (!isPlaceholder(rawLast)) setLastName(rawLast ?? "");
    setInitialized(true);
  }, [user, initialized]);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      refresh?.();
    },
    onError: (err) => {
      setError(err.message || "Failed to save. Please try again.");
    },
  });

  // Don't render during auth loading or for unauthenticated users
  if (loading || !user) return null;

  // Don't show if the user already has a proper full name
  const userName = (user as any).name as string | null | undefined;
  const userFirstName = (user as any).firstName as string | null | undefined;
  const userLastName = (user as any).lastName as string | null | undefined;
  // If both firstName and lastName are set to real values (not placeholders), skip the modal
  const hasRealFirstName = !isPlaceholder(userFirstName);
  const hasRealLastName = !isPlaceholder(userLastName);
  if (hasRealFirstName && hasRealLastName) return null;
  // If the name field already looks like a full name (and neither part is a placeholder), skip
  if (hasFullName(userName)) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn) { setError("Please enter your first name."); return; }
    if (!ln) { setError("Please enter your last name."); return; }
    setError("");
    updateProfile.mutate({
      firstName: fn,
      lastName: ln,
    });
  };

  return (
    <Dialog open={true} onOpenChange={() => {/* non-dismissible */}}>
      <DialogContent
        className="sm:max-w-md"
        // Prevent closing by clicking outside or pressing Escape
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: BRAND }}
            >
              <User className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Complete Your Profile
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-500">
            Please enter your first and last name to continue. This helps your
            instructors and fellow community members identify you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                autoFocus
                className="border-gray-300 focus:border-[#189aa1] focus:ring-[#189aa1]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="border-gray-300 focus:border-[#189aa1] focus:ring-[#189aa1]"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full text-white font-medium"
            style={{ background: BRAND }}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              "Save & Continue"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
