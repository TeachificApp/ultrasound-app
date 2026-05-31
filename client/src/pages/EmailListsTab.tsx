/**
 * EmailListsTab — Full email list management UI
 *
 * Features:
 *  - Create / rename / delete lists
 *  - Subscriber table with search + pagination + bulk remove
 *  - CSV import dialog (drag-and-drop or paste, with name column support)
 *  - Manual entry dialog (single email + name)
 *  - Integrations panel: webhook URL, API docs, Zapier guide, Google Sheets guide
 *  - Connected sources panel (which forms/widgets feed this list)
 */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Trash2, Edit, RefreshCw, Users, Upload, UserPlus,
  Webhook, Zap, Table2, Code, ChevronRight, ChevronLeft,
  X, CheckCircle2, AlertCircle, Copy, Eye, EyeOff, Link2,
  FileText, Search, RotateCcw,
} from "lucide-react";

// ─── CSV parsing helpers ──────────────────────────────────────────────────────

interface ParsedRow { email: string; name?: string; }

function parseCsvText(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  // Detect header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("email") || firstLine.includes("name");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Detect columns from header or assume email-only
  let emailCol = 0;
  let nameCol = -1;
  if (hasHeader) {
    const cols = lines[0].split(",").map(c => c.trim().toLowerCase().replace(/^["']|["']$/g, ""));
    emailCol = cols.findIndex(c => c.includes("email"));
    nameCol = cols.findIndex(c => c.includes("name") || c.includes("first") || c.includes("full"));
    if (emailCol < 0) emailCol = 0;
  }

  const rows: ParsedRow[] = [];
  const seen = new Set<string>();
  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
    const email = cells[emailCol]?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    const name = nameCol >= 0 ? cells[nameCol]?.trim() || undefined : undefined;
    rows.push({ email, name });
  }
  return rows;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CreateListDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createMutation = trpc.emailCampaign.createEmailList.useMutation({
    onSuccess: () => { toast.success("List created"); onCreated(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Email List</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">List Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Newsletter Subscribers" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description (optional)</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this list for?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#189aa1] hover:bg-[#147d83] text-white"
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate({ name: name.trim(), description: description.trim() || undefined })}
          >
            {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Create List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameListDialog({ list, onClose, onSaved }: { list: { id: number; name: string; description?: string | null }; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? "");
  const updateMutation = trpc.emailCampaign.updateEmailList.useMutation({
    onSuccess: () => { toast.success("List updated"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit List</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">List Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#189aa1] hover:bg-[#147d83] text-white"
            disabled={!name.trim() || updateMutation.isPending}
            onClick={() => updateMutation.mutate({ id: list.id, name: name.trim(), description: description.trim() || undefined })}
          >
            {updateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualEntryDialog({ listId, onClose, onAdded }: { listId: number; onClose: () => void; onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const addMutation = trpc.emailCampaign.addSubscriberManually.useMutation({
    onSuccess: () => { toast.success("Subscriber added"); onAdded(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-[#189aa1]" /> Add Subscriber</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Email *</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="subscriber@example.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Name (optional)</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#189aa1] hover:bg-[#147d83] text-white"
            disabled={!email.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate({ listId, email: email.trim(), name: name.trim() || undefined })}
          >
            {addMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CsvImportDialog({ listId, listName, onClose, onImported }: { listId: number; listName: string; onClose: () => void; onImported: () => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importMutation = trpc.emailCampaign.importSubscribersFromCsv.useMutation({
    onSuccess: (data) => { setResult(data); onImported(); },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsvText(text);
      setRows(parsed);
      if (parsed.length === 0) toast.error("No valid emails found in file");
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePaste = () => {
    const parsed = parseCsvText(pasteText);
    setRows(parsed);
    if (parsed.length === 0) toast.error("No valid emails found");
  };

  const handleImport = () => {
    if (rows.length === 0) return;
    importMutation.mutate({ listId, rows });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#189aa1]" /> Import Subscribers to "{listName}"
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Import Complete</p>
                <p className="text-sm text-green-700">{result.imported} imported · {result.skipped} skipped (duplicates/invalid) · {result.total} total</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={onClose} className="bg-[#189aa1] hover:bg-[#147d83] text-white">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragging ? "border-[#189aa1] bg-[#f0fbfc]" : "border-gray-200 hover:border-[#189aa1] hover:bg-gray-50"}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">Drop a CSV file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">CSV with email column (and optional name column). Up to 10,000 rows.</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            <div className="text-center text-xs text-gray-400">— or paste emails / CSV text below —</div>

            <div>
              <textarea
                className="w-full border rounded-lg p-3 text-sm font-mono resize-none h-28 focus:outline-none focus:ring-2 focus:ring-[#189aa1]"
                placeholder={"email,name\njane@example.com,Jane Smith\nbob@example.com,Bob Jones\n\nOr just emails, one per line:"}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <Button size="sm" variant="outline" className="mt-1" onClick={handlePaste} disabled={!pasteText.trim()}>
                Parse Text
              </Button>
            </div>

            {rows.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">{rows.length} contacts ready to import</p>
                  <Button size="sm" variant="ghost" onClick={() => setRows([])}><X className="w-4 h-4" /> Clear</Button>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">#</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 200).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5 text-gray-700">{r.email}</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.name ?? <span className="text-gray-300">—</span>}</td>
                        </tr>
                      ))}
                      {rows.length > 200 && (
                        <tr className="border-t bg-gray-50">
                          <td colSpan={3} className="px-3 py-2 text-center text-gray-400 text-xs">… and {rows.length - 200} more</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                className="bg-[#189aa1] hover:bg-[#147d83] text-white"
                disabled={rows.length === 0 || importMutation.isPending}
                onClick={handleImport}
              >
                {importMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                Import {rows.length > 0 ? `${rows.length} Contacts` : ""}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IntegrationsPanel({ list, onClose }: { list: { id: number; name: string; webhookToken?: string | null }; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [showToken, setShowToken] = useState(false);
  const [activeSection, setActiveSection] = useState<"webhook" | "zapier" | "sheets" | "api">("webhook");

  const generateTokenMutation = trpc.emailCampaign.generateWebhookToken.useMutation({
    onSuccess: () => { utils.emailCampaign.listEmailLists.invalidate(); toast.success("Webhook token generated"); },
    onError: (e) => toast.error(e.message),
  });

  const { data: sources } = trpc.emailCampaign.getListConnectedSources.useQuery({ listId: list.id });

  const webhookUrl = `${window.location.origin}/api/email-lists/${list.webhookToken ?? "YOUR_TOKEN"}/subscribe`;
  const curlExample = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "name": "Jane Smith"}'`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#189aa1]" /> Integrations — {list.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 flex-wrap mb-4">
          {(["webhook", "zapier", "sheets", "api"] as const).map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeSection === s ? "bg-[#189aa1] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {s === "webhook" ? "Webhook" : s === "zapier" ? "Zapier" : s === "sheets" ? "Google Sheets" : "API / cURL"}
            </button>
          ))}
        </div>

        {/* Webhook section */}
        {activeSection === "webhook" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Send a POST request to this URL to add subscribers from any external system, form, or automation tool.</p>

            <div className="bg-gray-50 border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Webhook URL</span>
                {list.webhookToken && (
                  <div className="flex gap-1">
                    <button onClick={() => setShowToken(!showToken)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                      {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {showToken ? "Hide" : "Show"} token
                    </button>
                    <button onClick={() => copyToClipboard(webhookUrl, "Webhook URL")} className="text-xs text-[#189aa1] hover:underline flex items-center gap-1 ml-2">
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                )}
              </div>
              <code className="text-xs break-all text-gray-700">
                {list.webhookToken
                  ? (showToken ? webhookUrl : webhookUrl.replace(list.webhookToken, "•".repeat(16)))
                  : <span className="text-gray-400 italic">Generate a token first</span>
                }
              </code>
            </div>

            {!list.webhookToken ? (
              <Button
                className="bg-[#189aa1] hover:bg-[#147d83] text-white"
                onClick={() => generateTokenMutation.mutate({ listId: list.id })}
                disabled={generateTokenMutation.isPending}
              >
                {generateTokenMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Webhook className="w-4 h-4 mr-1" />}
                Generate Webhook Token
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}>
                  <Copy className="w-4 h-4 mr-1" /> Copy URL
                </Button>
                <Button size="sm" variant="outline" className="text-orange-600 hover:bg-orange-50"
                  onClick={() => { if (confirm("Rotating the token will break existing integrations. Continue?")) generateTokenMutation.mutate({ listId: list.id }); }}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Rotate Token
                </Button>
              </div>
            )}

            <div className="bg-gray-50 border rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Request body (JSON)</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">{`{\n  "email": "user@example.com",   // required\n  "name": "Jane Smith",           // optional\n  "first_name": "Jane",           // optional (used if name not set)\n  "last_name": "Smith"            // optional\n}`}</pre>
            </div>
          </div>
        )}

        {/* API / cURL section */}
        {activeSection === "api" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Use cURL, Postman, or any HTTP client to add subscribers programmatically.</p>
            {!list.webhookToken && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Generate a webhook token first (in the Webhook tab) to get a working URL.
              </div>
            )}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400 font-mono">cURL</span>
                <button onClick={() => copyToClipboard(curlExample, "cURL example")} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <pre className="text-xs text-green-300 whitespace-pre-wrap font-mono overflow-x-auto">{curlExample}</pre>
            </div>
            <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p className="font-medium">Response</p>
              <p><code className="bg-gray-100 px-1 rounded">200</code> — <code className="bg-gray-100 px-1 rounded">{`{"ok": true, "list": "List Name"}`}</code></p>
              <p><code className="bg-gray-100 px-1 rounded">400</code> — Missing or invalid email</p>
              <p><code className="bg-gray-100 px-1 rounded">404</code> — Invalid token</p>
            </div>
          </div>
        )}

        {/* Zapier section */}
        {activeSection === "zapier" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Use Zapier's <strong>Webhooks by Zapier</strong> action to connect any trigger (form, CRM, payment, etc.) to this list.</p>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#189aa1] text-white text-xs flex items-center justify-center shrink-0 font-bold">1</span>
                <span>In Zapier, create a new Zap and choose your trigger app (e.g. Typeform, Stripe, HubSpot, Google Forms).</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#189aa1] text-white text-xs flex items-center justify-center shrink-0 font-bold">2</span>
                <span>For the Action, search for <strong>Webhooks by Zapier</strong> and select <strong>POST</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#189aa1] text-white text-xs flex items-center justify-center shrink-0 font-bold">3</span>
                <span>Set the URL to your webhook URL (generate it in the Webhook tab).</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#189aa1] text-white text-xs flex items-center justify-center shrink-0 font-bold">4</span>
                <span>Set <strong>Payload Type</strong> to <code className="bg-gray-100 px-1 rounded">json</code> and map the <code className="bg-gray-100 px-1 rounded">email</code> and <code className="bg-gray-100 px-1 rounded">name</code> fields from your trigger data.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#189aa1] text-white text-xs flex items-center justify-center shrink-0 font-bold">5</span>
                <span>Test and publish your Zap. Every trigger event will now add the contact to this list.</span>
              </li>
            </ol>
            {list.webhookToken && (
              <div className="bg-[#f0fbfc] border border-[#189aa1]/30 rounded-lg p-3">
                <p className="text-xs font-medium text-[#189aa1] mb-1">Your Webhook URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-700 flex-1 break-all">{webhookUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}><Copy className="w-3 h-3" /></Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Google Sheets section */}
        {activeSection === "sheets" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Use Google Apps Script to sync a Google Sheet with this email list automatically.</p>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#189aa1] text-white text-xs flex items-center justify-center shrink-0 font-bold">1</span>
                <span>Open your Google Sheet. Go to <strong>Extensions → Apps Script</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#189aa1] text-white text-xs flex items-center justify-center shrink-0 font-bold">2</span>
                <span>Paste the script below. Update <code className="bg-gray-100 px-1 rounded">WEBHOOK_URL</code> with your webhook URL.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#189aa1] text-white text-xs flex items-center justify-center shrink-0 font-bold">3</span>
                <span>Set a <strong>Time-driven trigger</strong> (e.g. every hour) or run <code className="bg-gray-100 px-1 rounded">syncToEmailList()</code> manually.</span>
              </li>
            </ol>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400 font-mono">Google Apps Script</span>
                <button onClick={() => copyToClipboard(
                  `const WEBHOOK_URL = "${webhookUrl}";\n\nfunction syncToEmailList() {\n  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();\n  const data = sheet.getDataRange().getValues();\n  const headers = data[0].map(h => String(h).toLowerCase().trim());\n  const emailCol = headers.indexOf('email');\n  const nameCol = headers.indexOf('name');\n  if (emailCol < 0) { Logger.log('No email column found'); return; }\n  for (let i = 1; i < data.length; i++) {\n    const email = String(data[i][emailCol]).trim();\n    if (!email || !email.includes('@')) continue;\n    const payload = { email };\n    if (nameCol >= 0) payload.name = String(data[i][nameCol]).trim();\n    UrlFetchApp.fetch(WEBHOOK_URL, {\n      method: 'post',\n      contentType: 'application/json',\n      payload: JSON.stringify(payload),\n      muteHttpExceptions: true,\n    });\n  }\n}`,
                  "Apps Script"
                )} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <pre className="text-xs text-green-300 whitespace-pre-wrap font-mono overflow-x-auto">{`const WEBHOOK_URL = "${list.webhookToken ? webhookUrl : "YOUR_WEBHOOK_URL"}";

function syncToEmailList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const emailCol = headers.indexOf('email');
  const nameCol = headers.indexOf('name');
  if (emailCol < 0) { Logger.log('No email column found'); return; }
  for (let i = 1; i < data.length; i++) {
    const email = String(data[i][emailCol]).trim();
    if (!email || !email.includes('@')) continue;
    const payload = { email };
    if (nameCol >= 0) payload.name = String(data[i][nameCol]).trim();
    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  }
}`}</pre>
            </div>
          </div>
        )}

        {/* Connected sources */}
        {sources && (sources.widgets.length > 0 || sources.forms.length > 0) && (
          <div className="mt-4 border-t pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><Link2 className="w-3 h-3" /> Connected Sources</p>
            <div className="flex flex-wrap gap-2">
              {sources.widgets.map(w => (
                <Badge key={w.id} variant="secondary" className="text-xs"><Zap className="w-3 h-3 mr-1" />{w.name}</Badge>
              ))}
              {sources.forms.map(f => (
                <Badge key={f.id} variant="secondary" className="text-xs"><FileText className="w-3 h-3 mr-1" />{f.name}</Badge>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubscriberTable({ list, onBack }: { list: { id: number; name: string; subscriberCount: number; webhookToken?: string | null }; onBack: () => void }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const utils = trpc.useUtils();
  const PAGE_SIZE = 50;

  const { data, refetch, isLoading } = trpc.emailCampaign.getEmailListSubscribers.useQuery(
    { listId: list.id, page, pageSize: PAGE_SIZE, search: search || undefined },
    { enabled: true }
  );

  const removeMutation = trpc.emailCampaign.removeSubscriber.useMutation({
    onSuccess: () => { toast.success("Removed"); refetch(); utils.emailCampaign.listEmailLists.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const bulkRemoveMutation = trpc.emailCampaign.bulkRemoveSubscribers.useMutation({
    onSuccess: (r) => { toast.success(`${r.removed} subscribers removed`); setSelected(new Set()); refetch(); utils.emailCampaign.listEmailLists.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const subscribers = data?.subscribers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === subscribers.length) setSelected(new Set());
    else setSelected(new Set(subscribers.map(s => s.id)));
  };

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  return (
    <div>
      {showManualEntry && <ManualEntryDialog listId={list.id} onClose={() => setShowManualEntry(false)} onAdded={() => { refetch(); utils.emailCampaign.listEmailLists.invalidate(); }} />}
      {showCsvImport && <CsvImportDialog listId={list.id} listName={list.name} onClose={() => setShowCsvImport(false)} onImported={() => { refetch(); utils.emailCampaign.listEmailLists.invalidate(); }} />}
      {showIntegrations && <IntegrationsPanel list={list} onClose={() => setShowIntegrations(false)} />}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onBack} className="text-gray-500">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Lists
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{list.name}</h3>
          <p className="text-xs text-gray-500">{list.subscriberCount.toLocaleString()} subscribers</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowManualEntry(true)}>
            <UserPlus className="w-4 h-4 mr-1" /> Add
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowCsvImport(true)}>
            <Upload className="w-4 h-4 mr-1" /> Import CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowIntegrations(true)}>
            <Link2 className="w-4 h-4 mr-1" /> Integrations
          </Button>
        </div>
      </div>

      {/* Search + bulk actions */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex gap-1 flex-1 min-w-0">
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search by email or name…"
            className="text-sm max-w-xs"
          />
          <Button size="sm" variant="outline" onClick={handleSearch}><Search className="w-4 h-4" /></Button>
          {search && <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}><X className="w-4 h-4" /></Button>}
        </div>
        {selected.size > 0 && (
          <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50"
            onClick={() => { if (confirm(`Remove ${selected.size} subscribers?`)) bulkRemoveMutation.mutate({ listId: list.id, subscriberIds: Array.from(selected) }); }}>
            <Trash2 className="w-4 h-4 mr-1" /> Remove {selected.size}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
      ) : subscribers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? "No subscribers match your search." : "No subscribers yet. Import a CSV or add manually."}</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" checked={selected.size === subscribers.length && subscribers.length > 0} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Source</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Added</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s: any) => (
                  <tr key={s.id} className={`border-t hover:bg-gray-50 ${selected.has(s.id) ? "bg-blue-50" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="rounded" />
                    </td>
                    <td className="px-3 py-2 text-gray-700 font-mono text-xs">{s.email}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{s.name ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="text-xs capitalize">{(s.source ?? "unknown").replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={s.status === "subscribed" ? "default" : "destructive"} className="text-xs capitalize">{s.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                      {s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => { if (confirm("Remove this subscriber?")) removeMutation.mutate({ subscriberId: s.id }); }}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
              <span>Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="px-3 py-1 text-xs">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main EmailListsTab ───────────────────────────────────────────────────────

export default function EmailListsTab() {
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [editingList, setEditingList] = useState<any | null>(null);
  const [viewingList, setViewingList] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: lists, refetch, isLoading } = trpc.emailCampaign.listEmailLists.useQuery();

  const deleteMutation = trpc.emailCampaign.deleteEmailList.useMutation({
    onSuccess: () => { toast.success("List deleted"); refetch(); setDeleteConfirmId(null); },
    onError: (e) => toast.error(e.message),
  });

  if (viewingList) {
    return (
      <SubscriberTable
        list={viewingList}
        onBack={() => {
          setViewingList(null);
          refetch();
        }}
      />
    );
  }

  return (
    <div>
      {showCreate && <CreateListDialog onClose={() => setShowCreate(false)} onCreated={() => refetch()} />}
      {editingList && <RenameListDialog list={editingList} onClose={() => setEditingList(null)} onSaved={() => refetch()} />}

      {/* Delete confirm dialog */}
      {deleteConfirmId !== null && (
        <Dialog open onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete List?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600 py-2">This will permanently delete the list and all subscriber records. This cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: deleteConfirmId! })} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Email Lists</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage subscriber lists, import contacts, and connect integrations.</p>
        </div>
        <Button size="sm" className="bg-[#189aa1] hover:bg-[#147d83] text-white" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New List
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
      ) : !lists || lists.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm mb-3">No email lists yet.</p>
          <Button size="sm" className="bg-[#189aa1] hover:bg-[#147d83] text-white" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Your First List
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((list: any) => (
            <div key={list.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <button className="flex-1 text-left min-w-0" onClick={() => setViewingList(list)}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{list.name}</span>
                    {list.name === "All Contacts" && <Badge variant="secondary" className="text-xs shrink-0">Auto</Badge>}
                    {!list.isActive && <Badge variant="destructive" className="text-xs shrink-0">Inactive</Badge>}
                  </div>
                  {list.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{list.description}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {(list.subscriberCount ?? 0).toLocaleString()} subscribers
                    </span>
                    {list.webhookToken && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Webhook className="w-3 h-3" /> Webhook active
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setViewingList(list)} title="View subscribers">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingList(list)} title="Edit list">
                    <Edit className="w-4 h-4" />
                  </Button>
                  {list.name !== "All Contacts" && (
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteConfirmId(list.id)} title="Delete list">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">📋 About Email Lists</p>
        <p className="text-xs text-blue-600">
          The <strong>All Contacts</strong> list is automatically populated with every contact who registers, purchases, enrolls, or submits a form.
          Create additional lists to segment your audience and target specific campaigns. Use <strong>Integrations</strong> on any list to get a webhook URL for Zapier, Google Sheets, or custom API connections.
        </p>
      </div>
    </div>
  );
}
