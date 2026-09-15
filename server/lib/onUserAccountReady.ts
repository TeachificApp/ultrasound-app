/**
 * Hooks when a user account is created or becomes active (login session).
 */
import { scheduleEnsureFreeMembership } from "./ensureFreeMembership";

/** Every authenticated member should have the free membership plan (idempotent). */
export function onUserAccountReady(userId: number): void {
  scheduleEnsureFreeMembership(userId);
}

/** New registrations: free membership + community signup workflows. */
export function onNewUserRegistered(userId: number): void {
  onUserAccountReady(userId);
  import("./communityAutoJoin")
    .then(({ fireCommunityWorkflowRules }) => {
      fireCommunityWorkflowRules(userId, { type: "any_signup" }).catch(() => {});
    })
    .catch(() => {});
}
