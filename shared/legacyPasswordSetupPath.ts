export function resolveLegacyPasswordSetupPath(pathname: string, search = "", hash = ""): string | null {
  return pathname === "/auth/reset-password" ? `/reset-password${search}${hash}` : null;
}
