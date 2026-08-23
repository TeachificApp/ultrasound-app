import { ENV } from "../_core/env";
import { resolvePlatformAdminEmail } from "../../shared/platformAdminEmail";

/** Canonical platform admin notification inbox (PLATFORM_ADMIN_EMAIL env override). */
export function getPlatformAdminNotificationEmail(): string {
  return resolvePlatformAdminEmail(ENV.platformAdminEmail);
}

export function getPlatformAdminRecipient(name = "Admin"): { name: string; email: string } {
  return { name, email: getPlatformAdminNotificationEmail() };
}
