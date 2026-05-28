/**
 * AssignmentBlockEditor.tsx
 * A lightweight block editor for cohort assignments.
 * Supports a subset of content blocks (text, image, video, audio, bullets,
 * divider, alert, data_table, file_upload, embed) with inline editing.
 * Unlike LessonBlockEditor it is self-contained — it just calls onChange
 * with the updated block array, no lesson-save API required.
 */
import React, { useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, Type, Image, Video, List, Minus, AlertTriangle, Table2, Upload, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { BlockPreview, Block, BlockType } from "@/components/BlockPreview";
import { Button } from "@/components/ui/button";

// ─── Block catalog (subset relevant for assignments) ─────────────────────────
const ASSIGNMENT_BLOCKS: { type: BlockType; label: string; icon: React.ReactNode; defaultData: Record<string, any> }[] = [
  { type: "text", label: "Text / Rich Text", icon: <Type size={14} />, defaultData: { html: "<p>Enter your text here...</p>", bgColor: "#ffffff" } },
  { type: "image", label: "Image", icon: <Image size={14} />, defaultData: { src: "", alt: "", caption: "", bgColor: "#ffffff" } },
  { type: "video", label: "Video", icon: <Video size={14} />, defaultData: { url: "", caption: "", bgColor: "#ffffff" } },
  { type: "bullets", label: "Bullet List", icon: <List size={14} />, defaultData: { headline: "", items: ["Item 1", "Item 2"], bgColor: "#ffffff" } },
  { type: "alert", label: "Alert / Callout", icon: <AlertTriangle size={14} />, defaultData: { type: "info", title: "", message: "Important note for students.", bgColor: "#ffffff" } },
  { type: "divider", label: "Divider", icon: <Minus size={14} />, defaultData: { color: "#e5e7eb", thickness: 1 } },
  { type: "data_table", label: "Data Table", icon: <Table2 size={14} />, defaultData: { rows: [["Header 1", "Header 2", "Header 3"], ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"]], hasHeader: true, bordered: true, striped: true, bgColor: "#ffffff" } },
  { type: "file_upload", label: "File Upload", icon: <Upload size={14} />, defaultData: { label: "Upload Your File", instructions: "Please upload your completed work below.", acceptedTypes: "PDF, Word, Images", maxSizeMb: 10, accentColor: "#0d9488", bgColor: "#f8fafc" } },
  { type: "embed", label: "Embed / iFrame", icon: <Globe size={14} />, defaultData: { url: "", height: 400, bgColor: "#ffffff" } },
];

// ─── Inline block settings (simple key/value fields) ─────────────────────────
function BlockSettings({ block, onUpdate }: { block: Block; onUpdate: (data: Record<string, any>) => void }) {
  const d = block.data;
  const set = (key: string, val: any) => onUpdate({ ...d, [key]: val });

  switch (block.type) {
    case "text":
      return (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">HTML Content</label>
          <textarea
            value={d.html ?? ""}
            onChange={e => set("html", e.target.value)}
            rows={6}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-teal-400 resize-y"
            placeholder="<p>Your content...</p>"
          />
          <p className="text-[10px] text-gray-400">Supports HTML. Use &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;, &lt;h2&gt;, etc.</p>
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">Image URL</label>
          <input value={d.src ?? ""} onChange={e => set("src", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="https://..." />
          <label className="text-xs text-gray-500 block">Alt Text</label>
          <input value={d.alt ?? ""} onChange={e => set("alt", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="Describe the image" />
          <label className="text-xs text-gray-500 block">Caption</label>
          <input value={d.caption ?? ""} onChange={e => set("caption", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="Optional caption" />
        </div>
      );
    case "video":
      return (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">Video URL (YouTube, Vimeo, or direct)</label>
          <input value={d.url ?? ""} onChange={e => set("url", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="https://youtube.com/watch?v=..." />
          <label className="text-xs text-gray-500 block">Caption</label>
          <input value={d.caption ?? ""} onChange={e => set("caption", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="Optional caption" />
        </div>
      );
    case "bullets":
      return (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">Headline (optional)</label>
          <input value={d.headline ?? ""} onChange={e => set("headline", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="Section heading" />
          <label className="text-xs text-gray-500 block">Items (one per line)</label>
          <textarea
            value={(d.items ?? []).join("\n")}
            onChange={e => set("items", e.target.value.split("\n"))}
            rows={5}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="Item 1&#10;Item 2&#10;Item 3"
          />
        </div>
      );
    case "alert":
      return (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">Type</label>
          <select value={d.type ?? "info"} onChange={e => set("type", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs">
            <option value="info">Info (blue)</option>
            <option value="warning">Warning (amber)</option>
            <option value="success">Success (green)</option>
            <option value="error">Error (red)</option>
          </select>
          <label className="text-xs text-gray-500 block">Title</label>
          <input value={d.title ?? ""} onChange={e => set("title", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="Alert title" />
          <label className="text-xs text-gray-500 block">Message</label>
          <textarea value={d.message ?? ""} onChange={e => set("message", e.target.value)} rows={3} className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="Alert message..." />
        </div>
      );
    case "data_table": {
      const rows: string[][] = d.rows ?? [["Header 1", "Header 2"], ["Cell 1", "Cell 2"]];
      const updateCell = (ri: number, ci: number, val: string) => {
        const next = rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : [...r]);
        set("rows", next);
      };
      const addRow = () => set("rows", [...rows, Array(rows[0]?.length ?? 2).fill("")]);
      const removeRow = (ri: number) => { if (rows.length > 1) set("rows", rows.filter((_, i) => i !== ri)); };
      const addCol = () => set("rows", rows.map(r => [...r, ""]));
      const removeCol = () => { if ((rows[0]?.length ?? 0) > 1) set("rows", rows.map(r => r.slice(0, -1))); };
      return (
        <div className="space-y-2">
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={ri === 0 && d.hasHeader !== false ? "bg-teal-50" : ri % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-gray-200 p-0">
                        <input value={cell} onChange={e => updateCell(ri, ci, e.target.value)} className="w-full px-1.5 py-1 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-teal-400 min-w-[60px]" placeholder={ri === 0 && d.hasHeader !== false ? `Header ${ci + 1}` : `R${ri}C${ci + 1}`} />
                      </td>
                    ))}
                    <td className="border border-gray-200 px-1"><button onClick={() => removeRow(ri)} className="text-red-400 hover:text-red-600 text-[10px]">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={addRow} className="px-2 py-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded hover:bg-teal-100">+ Row</button>
            <button onClick={addCol} className="px-2 py-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded hover:bg-teal-100">+ Column</button>
            <button onClick={removeCol} className="px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100">− Last Column</button>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={d.hasHeader !== false} onChange={e => set("hasHeader", e.target.checked)} className="w-3.5 h-3.5" />
            <span className="text-xs text-gray-600">First row is header</span>
          </div>
          {/* Paste from spreadsheet */}
          <PasteFromSpreadsheet onPaste={pastedRows => set("rows", pastedRows)} />
        </div>
      );
    }
    case "file_upload":
      return (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">Label</label>
          <input value={d.label ?? ""} onChange={e => set("label", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="Upload Your File" />
          <label className="text-xs text-gray-500 block">Instructions</label>
          <textarea value={d.instructions ?? ""} onChange={e => set("instructions", e.target.value)} rows={2} className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="Please upload your completed work below." />
          <label className="text-xs text-gray-500 block">Accepted File Types (display text)</label>
          <input value={d.acceptedTypes ?? ""} onChange={e => set("acceptedTypes", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="PDF, Word, Images" />
          <label className="text-xs text-gray-500 block">Max File Size (MB)</label>
          <input type="number" value={d.maxSizeMb ?? 10} onChange={e => set("maxSizeMb", Number(e.target.value))} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" min={1} max={100} />
          <p className="text-[10px] text-gray-400">In assignments, uploaded files are stored to the student's submission. On other pages, files go to the Media Library.</p>
        </div>
      );
    case "embed":
      return (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">URL to Embed</label>
          <input value={d.url ?? ""} onChange={e => set("url", e.target.value)} className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" placeholder="https://..." />
          <label className="text-xs text-gray-500 block">Height (px)</label>
          <input type="number" value={d.height ?? 400} onChange={e => set("height", Number(e.target.value))} className="w-full h-7 rounded border border-gray-200 px-2 text-xs" min={100} max={1200} />
        </div>
      );
    default:
      return <p className="text-xs text-gray-400">No settings for this block type.</p>;
  }
}

// ─── Paste from spreadsheet helper ───────────────────────────────────────────
function PasteFromSpreadsheet({ onPaste }: { onPaste: (rows: string[][]) => void }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const apply = () => {
    const rows = raw.trim().split("\n").map(line => line.split("\t"));
    if (rows.length > 0 && rows[0].length > 0) {
      onPaste(rows);
      setOpen(false);
      setRaw("");
    }
  };
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="text-xs text-teal-600 hover:underline">Paste from spreadsheet</button>
      {open && (
        <div className="mt-2 space-y-2">
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            rows={5}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="Paste tab-separated content from Excel or Google Sheets here..."
          />
          <div className="flex gap-2">
            <button onClick={apply} className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700">Apply</button>
            <button onClick={() => setOpen(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Block card ───────────────────────────────────────────────────────────────
function BlockCard({ block, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  block: Block;
  onUpdate: (data: Record<string, any>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = ASSIGNMENT_BLOCKS.find(b => b.type === block.type)?.label ?? block.type;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <span className="text-xs font-medium text-gray-600 flex-1 truncate">{label}</span>
        <button onClick={() => setExpanded(e => !e)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button onClick={onMoveUp} disabled={isFirst} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30">↑</button>
        <button onClick={onMoveDown} disabled={isLast} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30">↓</button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
          <Trash2 size={13} />
        </button>
      </div>
      {/* Preview */}
      <div className="pointer-events-none select-none overflow-hidden" style={{ maxHeight: 200 }}>
        <BlockPreview block={block} />
      </div>
      {/* Settings */}
      {expanded && (
        <div className="border-t border-gray-100 p-3 bg-gray-50">
          <BlockSettings block={block} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export interface AssignmentBlockEditorProps {
  blocks: any[];
  onChange: (blocks: any[]) => void;
}

export default function AssignmentBlockEditor({ blocks, onChange }: AssignmentBlockEditorProps) {
  const [showPicker, setShowPicker] = useState(false);

  const addBlock = useCallback((type: BlockType, defaultData: Record<string, any>) => {
    const newBlock: Block = { id: Math.random().toString(36).slice(2, 10), type, data: { ...defaultData } };
    onChange([...blocks, newBlock]);
    setShowPicker(false);
  }, [blocks, onChange]);

  const updateBlock = useCallback((id: string, data: Record<string, any>) => {
    onChange(blocks.map(b => b.id === id ? { ...b, data } : b));
  }, [blocks, onChange]);

  const deleteBlock = useCallback((id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  }, [blocks, onChange]);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const next = [...blocks];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  }, [blocks, onChange]);

  return (
    <div className="p-4 space-y-3">
      {/* Block list */}
      {blocks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
          <Upload size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No content blocks yet</p>
          <p className="text-xs mt-1">Add blocks below to build the assignment content</p>
        </div>
      )}
      {blocks.map((block, idx) => (
        <BlockCard
          key={block.id}
          block={block}
          onUpdate={data => updateBlock(block.id, data)}
          onDelete={() => deleteBlock(block.id)}
          onMoveUp={() => moveBlock(block.id, -1)}
          onMoveDown={() => moveBlock(block.id, 1)}
          isFirst={idx === 0}
          isLast={idx === blocks.length - 1}
        />
      ))}

      {/* Add block button */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed border-teal-300 text-teal-600 hover:bg-teal-50 hover:border-teal-400"
          onClick={() => setShowPicker(p => !p)}
        >
          <Plus size={14} className="mr-1" /> Add Block
        </Button>
        {showPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Choose a block type</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ASSIGNMENT_BLOCKS.map(b => (
                <button
                  key={b.type}
                  onClick={() => addBlock(b.type, b.defaultData)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-teal-50 hover:text-teal-700 border border-gray-100 hover:border-teal-200 transition-colors text-left"
                >
                  <span className="text-gray-400">{b.icon}</span>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
