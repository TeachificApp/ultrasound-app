/**
 * BulkCsvUploadPanel — shared component for bulk email onboarding via CSV.
 *
 * Supports:
 *   - Drag-and-drop CSV file upload
 *   - Manual paste of newline/comma-separated emails
 *   - Preview table of parsed emails (with dedup + validation)
 *   - Configurable action slot (role selector for Platform Admin, none for Lab Admin)
 *   - Results summary with per-row status chips
 *   - Download results as CSV
 */

import { useState, useRef, useCallback, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload, X, CheckCircle2, AlertCircle, Clock, Users,
  Download, RefreshCw, FileText, Trash2
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BulkRowStatus =
  | "success"
  | "already_assigned"
  | "pre_registered"
  | "seat_limit_reached"
  | "error";

export interface BulkResultRow {
  email: string;
  status: BulkRowStatus;
  displayName?: string;
  message?: string;
}

export interface BulkResult {
  total: number;
  succeeded: number;
  alreadyAssigned: number;
  preRegistered: number;
  seatLimitReached?: number;
  errors: number;
  rows: BulkResultRow[];
  seatUsage?: { used: number; total: number };
}

interface BulkCsvUploadPanelProps {
  /** Title shown in the panel header */
  title: string;
  /** Subtitle / description */
  description: string;
  /** Optional slot rendered between the email list and the submit button (e.g. role selector) */
  actionSlot?: React.ReactNode;
  /** Called with the validated email list when the user clicks Submit */
  onSubmit: (emails: string[]) => Promise<BulkResult>;
  /** Whether the mutation is currently running */
  isPending?: boolean;
  /** Accent color (defaults to brand teal) */
  accentColor?: string;
  /** Label for the submit button */
  submitLabel?: string;
  /** Optional: seat usage display */
  seatUsage?: { used: number; total: number };
}

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_META: Record<BulkRowStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  success:          { label: "Assigned",         color: "#16a34a", bg: "#dcfce7", Icon: CheckCircle2 },
  already_assigned: { label: "Already had role",  color: "#2563eb", bg: "#dbeafe", Icon: CheckCircle2 },
  pre_registered:   { label: "Pre-registered",    color: "#7c3aed", bg: "#ede9fe", Icon: CheckCircle2 },
  seat_limit_reached:{ label: "Seat limit",       color: "#dc2626", bg: "#fee2e2", Icon: AlertCircle },
  error:            { label: "Error",             color: "#dc2626", bg: "#fee2e2", Icon: AlertCircle },
};

function StatusChip({ status, message }: { status: BulkRowStatus; message?: string }) {
  const { label, color, bg, Icon } = STATUS_META[status];
  return (
    <span
      title={message}
      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: bg, color }}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseEmails(raw: string): string[] {
  // Split on newlines, commas, semicolons, tabs, and spaces
  const tokens = raw.split(/[\n,;\t\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
  // Basic email filter (not strict — server validates)
  const emails = tokens.filter(t => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t));
  // Deduplicate preserving order
  return Array.from(new Set(emails));
}

function parseCsvFile(text: string): string[] {
  // Accept CSV files where emails may be in any column
  const allTokens: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    for (const cell of line.split(",")) {
      allTokens.push(cell.trim().replace(/^["']|["']$/g, ""));
    }
  }
  return parseEmails(allTokens.join("\n"));
}

// ─── Download helper ──────────────────────────────────────────────────────────

function downloadResultsCsv(rows: BulkResultRow[], filename = "bulk-assignment-results.csv") {
  const header = "Email,Status,Display Name,Message";
  const lines = rows.map(r =>
    [r.email, r.status, r.displayName ?? "", r.message ?? ""]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BulkCsvUploadPanel({
  title,
  description,
  actionSlot,
  onSubmit,
  isPending = false,
  accentColor = "#189aa1",
  submitLabel = "Assign Roles",
  seatUsage,
}: BulkCsvUploadPanelProps) {
  const [emails, setEmails] = useState<string[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File drop ──────────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv" && file.type !== "text/plain") {
      toast.error("Please upload a .csv or .txt file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsvFile(text);
      if (parsed.length === 0) {
        toast.error("No valid email addresses found in the file");
        return;
      }
      setEmails(parsed);
      setResult(null);
      toast.success(`Parsed ${parsed.length} email${parsed.length !== 1 ? "s" : ""} from file`);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Paste ──────────────────────────────────────────────────────────────────

  const handlePasteApply = () => {
    const parsed = parseEmails(pasteText);
    if (parsed.length === 0) {
      toast.error("No valid email addresses found");
      return;
    }
    setEmails(prev => Array.from(new Set([...prev, ...parsed])));
    setPasteText("");
    setShowPaste(false);
    setResult(null);
    toast.success(`Added ${parsed.length} email${parsed.length !== 1 ? "s" : ""}`);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (emails.length === 0) return;
    try {
      const res = await onSubmit(emails);
      setResult(res);
      if (res.succeeded > 0) {
        toast.success(`${res.succeeded} user${res.succeeded !== 1 ? "s" : ""} assigned successfully`);
      } else if (res.alreadyAssigned === res.total) {
        toast.info("All users already had this role");
      } else if (res.preRegistered > 0 && res.succeeded === 0) {
        toast.success(`${res.preRegistered} user${res.preRegistered !== 1 ? "s" : ""} pre-registered and role assigned`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Bulk assignment failed");
    }
  };

  const handleReset = () => {
    setEmails([]);
    setResult(null);
    setPasteText("");
    setShowPaste(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        {seatUsage && (
          <div className="flex-shrink-0 text-right">
            <div className="text-xs font-semibold text-gray-700">
              {seatUsage.used} / {seatUsage.total === 999 ? "∞" : seatUsage.total} seats used
            </div>
            <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: seatUsage.total === 999 ? "0%" : `${Math.min(100, (seatUsage.used / seatUsage.total) * 100)}%`,
                  background: seatUsage.used >= seatUsage.total ? "#dc2626" : accentColor,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Drop zone */}
      {emails.length === 0 && !result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging ? "border-[#189aa1] bg-[#189aa1]/05" : "border-gray-200 hover:border-[#189aa1]/50 hover:bg-gray-50"
          }`}
          style={isDragging ? { borderColor: accentColor } : {}}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-semibold text-gray-600">
            {isDragging ? "Drop your CSV here" : "Drag & drop a CSV file"}
          </p>
          <p className="text-xs text-gray-400 mt-1">or click to browse — one email per row, or comma-separated</p>
        </div>
      )}

      {/* Paste toggle */}
      {emails.length === 0 && !result && (
        <div>
          <button
            className="text-xs font-semibold underline underline-offset-2"
            style={{ color: accentColor }}
            onClick={() => setShowPaste(v => !v)}
          >
            {showPaste ? "Hide paste area" : "Or paste emails manually"}
          </button>
          {showPaste && (
            <div className="mt-2 space-y-2">
              <Textarea
                className="text-xs h-28 resize-none font-mono"
                placeholder={"alice@hospital.org\nbob@clinic.com\ncarol@echo.net"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="text-white text-xs h-8"
                  style={{ background: accentColor }}
                  onClick={handlePasteApply}
                  disabled={!pasteText.trim()}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Parse & Add
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setShowPaste(false); setPasteText(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email preview list */}
      {emails.length > 0 && !result && (
        <Card className="border border-gray-100">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: accentColor }} />
                <span className="text-sm font-semibold text-gray-800">
                  {emails.length} email{emails.length !== 1 ? "s" : ""} ready
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-xs font-semibold underline underline-offset-2"
                  style={{ color: accentColor }}
                  onClick={() => setShowPaste(v => !v)}
                >
                  + Add more
                </button>
                <button
                  className="text-xs text-red-500 font-semibold underline underline-offset-2"
                  onClick={handleReset}
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Add more paste area */}
            {showPaste && (
              <div className="space-y-2">
                <Textarea
                  className="text-xs h-20 resize-none font-mono"
                  placeholder="Add more emails..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="text-white text-xs h-7" style={{ background: accentColor }} onClick={handlePasteApply} disabled={!pasteText.trim()}>
                    Add
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setShowPaste(false); setPasteText(""); }}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Scrollable email list */}
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {emails.map((email, i) => (
                <div key={email} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 group">
                  <span className="text-[10px] text-gray-300 w-5 text-right flex-shrink-0">{i + 1}</span>
                  <span className="text-xs text-gray-700 font-mono flex-1 truncate">{email}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400"
                    onClick={() => setEmails(prev => prev.filter(e => e !== email))}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Action slot (e.g. role selector) */}
            {actionSlot && (
              <div className="pt-1 border-t border-gray-100">
                {actionSlot}
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full text-white gap-2"
              style={{ background: accentColor }}
              disabled={isPending || emails.length === 0}
              onClick={handleSubmit}
            >
              {isPending ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Processing {emails.length} emails…</>
              ) : (
                <><Upload className="w-4 h-4" /> {submitLabel} ({emails.length})</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card className="border border-gray-100">
          <CardContent className="p-4 space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Assigned", value: result.succeeded, color: "#16a34a", bg: "#dcfce7" },
                { label: "Already had role", value: result.alreadyAssigned, color: "#2563eb", bg: "#dbeafe" },
                ...(result.preRegistered > 0
                  ? [{ label: "Pre-registered", value: result.preRegistered, color: "#7c3aed", bg: "#ede9fe" }]
                  : []),
                ...(result.seatLimitReached != null && result.seatLimitReached > 0
                  ? [{ label: "Seat limit", value: result.seatLimitReached, color: "#dc2626", bg: "#fee2e2" }]
                  : []),
                ...(result.errors > 0
                  ? [{ label: "Errors", value: result.errors, color: "#dc2626", bg: "#fee2e2" }]
                  : []),
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="rounded-lg p-3 text-center" style={{ background: bg }}>
                  <div className="text-xl font-black" style={{ color }}>{value}</div>
                  <div className="text-[10px] font-semibold mt-0.5" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Updated seat usage */}
            {result.seatUsage && (
              <div className="text-xs text-gray-500 text-center">
                Seat usage after assignment: <strong>{result.seatUsage.used}</strong> / {result.seatUsage.total === 999 ? "∞" : result.seatUsage.total}
              </div>
            )}

            {/* Per-row results table */}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Email</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.email} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-700 truncate max-w-[180px]">{row.email}</td>
                      <td className="px-3 py-2 text-gray-500">{row.displayName ?? "—"}</td>
                      <td className="px-3 py-2">
                        <StatusChip status={row.status} message={row.message} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 gap-1.5"
                onClick={() => downloadResultsCsv(result.rows)}
              >
                <Download className="w-3 h-3" />
                Download Results CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 gap-1.5"
                onClick={handleReset}
              >
                <Trash2 className="w-3 h-3" />
                New Batch
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
