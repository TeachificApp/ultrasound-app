/**
 * Case Mix Staff Linking — unit tests
 * Tests the logic for resolving sonographer/physician from lab staff
 * and auto-setting IAC flags based on role.
 */
import { describe, it, expect } from "vitest";

// ─── Mirrors the staffLabel helper from CaseMixSubmission.tsx ─────────────────
function staffLabel(m: { displayName?: string | null; inviteEmail?: string; credentials?: string | null; role: string }): string {
  const name = m.displayName || m.inviteEmail || "Unknown";
  const creds = m.credentials ? `, ${m.credentials}` : "";
  const roleLabel =
    m.role === "technical_director" ? " [Tech Dir]" :
    m.role === "medical_director" ? " [Med Dir]" : "";
  return `${name}${creds}${roleLabel}`;
}

// ─── Mirrors the staff resolution logic from handleSubmit ────────────────────
function resolveStaff(
  memberId: number | "_freetext_" | null,
  freeText: string,
  members: Array<{ id: number; displayName?: string | null; inviteEmail?: string; role: string }>
): { id?: number; name?: string } {
  if (memberId === "_freetext_") {
    return { name: freeText || undefined };
  } else if (typeof memberId === "number") {
    const m = members.find(s => s.id === memberId);
    return {
      id: memberId,
      name: m ? (m.displayName || m.inviteEmail) : undefined,
    };
  }
  return {};
}

// ─── Mirrors the IAC auto-flag logic from handleSonographerSelect ─────────────
function shouldAutoSetTechDir(memberId: number | "_freetext_" | null, members: Array<{ id: number; role: string }>): boolean {
  if (typeof memberId !== "number") return false;
  const member = members.find(s => s.id === memberId);
  return member?.role === "technical_director";
}

function shouldAutoSetMedDir(memberId: number | "_freetext_" | null, members: Array<{ id: number; role: string }>): boolean {
  if (typeof memberId !== "number") return false;
  const member = members.find(p => p.id === memberId);
  return member?.role === "medical_director";
}

// ─── Test data ────────────────────────────────────────────────────────────────
const MOCK_SONOGRAPHERS = [
  { id: 1, displayName: "Jane Smith", inviteEmail: "jane@lab.com", credentials: "RDCS", role: "technical_director" },
  { id: 2, displayName: "Bob Lee", inviteEmail: "bob@lab.com", credentials: "RDCS", role: "technical_staff" },
  { id: 3, displayName: null, inviteEmail: "anon@lab.com", credentials: null, role: "technical_staff" },
];

const MOCK_PHYSICIANS = [
  { id: 10, displayName: "Dr. Alice Chen", inviteEmail: "alice@lab.com", credentials: "MD, FACC", role: "medical_director" },
  { id: 11, displayName: "Dr. Mark Wu", inviteEmail: "mark@lab.com", credentials: "MD", role: "medical_staff" },
];

// ─── staffLabel tests ─────────────────────────────────────────────────────────
describe("staffLabel", () => {
  it("formats technical_director with credentials and role tag", () => {
    const label = staffLabel(MOCK_SONOGRAPHERS[0]);
    expect(label).toBe("Jane Smith, RDCS [Tech Dir]");
  });

  it("formats technical_staff with credentials, no role tag", () => {
    const label = staffLabel(MOCK_SONOGRAPHERS[1]);
    expect(label).toBe("Bob Lee, RDCS");
  });

  it("falls back to email when displayName is null", () => {
    const label = staffLabel(MOCK_SONOGRAPHERS[2]);
    expect(label).toBe("anon@lab.com");
  });

  it("formats medical_director with credentials and role tag", () => {
    const label = staffLabel(MOCK_PHYSICIANS[0]);
    expect(label).toBe("Dr. Alice Chen, MD, FACC [Med Dir]");
  });

  it("formats medical_staff with credentials, no role tag", () => {
    const label = staffLabel(MOCK_PHYSICIANS[1]);
    expect(label).toBe("Dr. Mark Wu, MD");
  });
});

// ─── resolveStaff tests ───────────────────────────────────────────────────────
describe("resolveStaff", () => {
  it("returns labMemberId and name when a member is selected", () => {
    const result = resolveStaff(1, "", MOCK_SONOGRAPHERS);
    expect(result.id).toBe(1);
    expect(result.name).toBe("Jane Smith");
  });

  it("returns only name (no id) for free-text entry", () => {
    const result = resolveStaff("_freetext_", "External Sono", MOCK_SONOGRAPHERS);
    expect(result.id).toBeUndefined();
    expect(result.name).toBe("External Sono");
  });

  it("returns empty object when nothing is selected", () => {
    const result = resolveStaff(null, "", MOCK_SONOGRAPHERS);
    expect(result.id).toBeUndefined();
    expect(result.name).toBeUndefined();
  });

  it("returns undefined name for free-text with empty string", () => {
    const result = resolveStaff("_freetext_", "", MOCK_SONOGRAPHERS);
    expect(result.name).toBeUndefined();
  });

  it("uses inviteEmail as fallback when displayName is null", () => {
    const result = resolveStaff(3, "", MOCK_SONOGRAPHERS);
    expect(result.id).toBe(3);
    expect(result.name).toBe("anon@lab.com");
  });
});

// ─── IAC auto-flag tests ──────────────────────────────────────────────────────
describe("IAC flag auto-set logic", () => {
  it("auto-sets Tech Dir flag when technical_director is selected", () => {
    expect(shouldAutoSetTechDir(1, MOCK_SONOGRAPHERS)).toBe(true);
  });

  it("does NOT auto-set Tech Dir flag for technical_staff", () => {
    expect(shouldAutoSetTechDir(2, MOCK_SONOGRAPHERS)).toBe(false);
  });

  it("does NOT auto-set Tech Dir flag for free-text entry", () => {
    expect(shouldAutoSetTechDir("_freetext_", MOCK_SONOGRAPHERS)).toBe(false);
  });

  it("does NOT auto-set Tech Dir flag when nothing is selected", () => {
    expect(shouldAutoSetTechDir(null, MOCK_SONOGRAPHERS)).toBe(false);
  });

  it("auto-sets Med Dir flag when medical_director is selected", () => {
    expect(shouldAutoSetMedDir(10, MOCK_PHYSICIANS)).toBe(true);
  });

  it("does NOT auto-set Med Dir flag for medical_staff", () => {
    expect(shouldAutoSetMedDir(11, MOCK_PHYSICIANS)).toBe(false);
  });

  it("does NOT auto-set Med Dir flag for free-text entry", () => {
    expect(shouldAutoSetMedDir("_freetext_", MOCK_PHYSICIANS)).toBe(false);
  });

  it("does NOT auto-set Med Dir flag when nothing is selected", () => {
    expect(shouldAutoSetMedDir(null, MOCK_PHYSICIANS)).toBe(false);
  });
});

// ─── getLabStaff role filtering logic ────────────────────────────────────────
describe("getLabStaff role filtering", () => {
  const ALL_MEMBERS = [
    { id: 1, role: "technical_director" },
    { id: 2, role: "technical_staff" },
    { id: 3, role: "medical_director" },
    { id: 4, role: "medical_staff" },
    { id: 5, role: "admin" },
  ];

  it("sonographers include technical_director, technical_staff, and admin", () => {
    const sonographers = ALL_MEMBERS.filter(
      m => m.role === "technical_director" || m.role === "technical_staff" || m.role === "admin"
    );
    expect(sonographers.map(s => s.id)).toEqual([1, 2, 5]);
  });

  it("physicians include medical_director, medical_staff, and admin", () => {
    const physicians = ALL_MEMBERS.filter(
      m => m.role === "medical_director" || m.role === "medical_staff" || m.role === "admin"
    );
    expect(physicians.map(p => p.id)).toEqual([3, 4, 5]);
  });

  it("admin appears in both sonographers and physicians lists", () => {
    const sonoIds = ALL_MEMBERS.filter(
      m => m.role === "technical_director" || m.role === "technical_staff" || m.role === "admin"
    ).map(m => m.id);
    const mdIds = ALL_MEMBERS.filter(
      m => m.role === "medical_director" || m.role === "medical_staff" || m.role === "admin"
    ).map(m => m.id);
    expect(sonoIds).toContain(5);
    expect(mdIds).toContain(5);
  });
});
