/**
 * useCrossDomainSso — Silent cross-domain SSO broadcaster
 *
 * When authenticated, issues short-lived tokens and pings other app domains so
 * each can set a first-party session cookie on its own TLD (.allaboutultrasound.com
 * vs .iheartecho.com cookies are never shared — SSO is required).
 *
 * NOTE: Uses localStorage (not sessionStorage) so the broadcast flag persists
 * across page reloads. sessionStorage is cleared on reload, which caused the
 * broadcast to re-fire on every reload, wasting tokens and causing race conditions.
 * The broadcast flag has a 30-minute TTL so it re-broadcasts after a while.
 */
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { broadcastStorageKey } from "@/lib/ssoSession";

/** How long to suppress re-broadcast after a successful broadcast (30 minutes) */
const BROADCAST_TTL_MS = 30 * 60 * 1000;

const ALL_DOMAINS = [
  "https://app.iheartecho.com",
  "https://app.iheartecho.net",
  "https://app.allaboutultrasound.com",
  "https://learn.allaboutultrasound.com",
  "https://members.allaboutultrasound.com",
  "https://accreditation.iheartecho.com",
] as const;

function isAccreditationDomain(): boolean {
  const host = window.location.hostname;
  return host === "accreditation.iheartecho.com" || host.includes("accreditation");
}

function hostnameFromOrigin(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

/**
 * Returns target domains to broadcast to, excluding the current domain.
 * On staging (*.manus.space / *.manus.computer), the current origin won't
 * match any of the production ALL_DOMAINS entries, so all production domains
 * will be included as targets — this is correct and intentional.
 */
function getTargetDomains(): string[] {
  const current = window.location.origin;
  return ALL_DOMAINS.filter((d) => d !== current);
}

function pingDomainWithImg(domain: string, token: string): void {
  const hostname = hostnameFromOrigin(domain);
  const url = `${domain}/api/sso/auto?token=${encodeURIComponent(token)}&domain=${encodeURIComponent(hostname)}`;
  const img = document.createElement("img");
  img.src = url;
  img.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
  img.setAttribute("aria-hidden", "true");
  document.body.appendChild(img);
  setTimeout(() => {
    try {
      document.body.removeChild(img);
    } catch {
      /* already removed */
    }
  }, 15_000);
}

/** CORS fetch ping — works when third-party img Set-Cookie is blocked */
async function pingDomain(domain: string, token: string): Promise<void> {
  const hostname = hostnameFromOrigin(domain);
  const url = `${domain}/api/sso/auto?token=${encodeURIComponent(token)}&domain=${encodeURIComponent(hostname)}`;
  try {
    await fetch(url, { method: "GET", credentials: "include", mode: "cors" });
  } catch {
    // fall through to img
  }
  pingDomainWithImg(domain, token);
}

/**
 * Check if the broadcast was already done recently for this user.
 * Uses localStorage with a TTL so it persists across page reloads but
 * re-broadcasts after 30 minutes (e.g., if the user opens a new tab later).
 */
function isBroadcastDone(userId: number): boolean {
  try {
    const key = broadcastStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    if (Date.now() - ts >= BROADCAST_TTL_MS) {
      localStorage.removeItem(key);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function markBroadcastDone(userId: number): void {
  try {
    localStorage.setItem(broadcastStorageKey(userId), String(Date.now()));
  } catch {
    /* storage full or private mode */
  }
}

export function useCrossDomainSso() {
  const { user, loading } = useAuth();
  const issueTokens = trpc.sso.issueTokens.useMutation();
  const lastUserId = useRef<number | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      lastUserId.current = null;
      return;
    }

    const userId = (user as { id?: number }).id;
    if (!userId) return;

    if (lastUserId.current === userId) return;
    lastUserId.current = userId;

    // localStorage-based TTL check — survives page reloads
    if (isBroadcastDone(userId)) return;

    const targets = getTargetDomains();
    if (targets.length === 0) return;

    const sourceIsAccreditation = isAccreditationDomain();

    issueTokens.mutate(
      { count: targets.length, sourceIsAccreditation },
      {
        onSuccess: ({ tokens, allowed }) => {
          if (!allowed || tokens.length === 0) return;
          // Mark broadcast done BEFORE pinging so concurrent renders don't double-broadcast
          markBroadcastDone(userId);
          targets.forEach((domain, i) => {
            const token = tokens[i];
            if (token) void pingDomain(domain, token);
          });
        },
      },
    );
  }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps
}
