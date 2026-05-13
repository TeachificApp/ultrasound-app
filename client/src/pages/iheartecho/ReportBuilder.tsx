/*
  iHeartEcho™ — Echo Report Builder
  Structure based on UltraLinq clinical echo report template
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body, JetBrains Mono data
*/
import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PremiumOverlay } from "@/components/PremiumOverlay";
import Layout from "@/components/Layout";
import { FileText, Copy, Download, CheckCircle2, ChevronDown, ChevronUp, Printer, MessageSquarePlus, Trash2, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, Type, ClipboardCopy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";

// ─── RICH REPORT EDITOR ─────────────────────────────────────────────────────
function RichReportEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextStyle,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "outline-none min-h-[60vh] leading-relaxed",
        style: "font-family: Arial, sans-serif; font-size: 12pt; color: #1a1a1a;",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync plain-text report into editor whenever content changes
  useEffect(() => {
    if (!editor) return;
    // Convert plain-text report to HTML: section headers become <strong>, separator lines become <hr>
    const html = content
      .split("\n")
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return "<p><br></p>";
        // Separator lines (─────)
        if (/^[─\-]{10,}$/.test(trimmed)) return "<hr>";
        // ALL-CAPS section headers
        if (/^[A-Z][A-Z0-9 \-\/&:]+:?$/.test(trimmed) && trimmed.length < 60)
          return `<p><strong>${trimmed}</strong></p>`;
        return `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
      })
      .join("");
    // Only update if content actually differs (avoids cursor jumping)
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  const ToolBtn = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`p-1.5 rounded transition-all ${
        active ? "bg-[#189aa1] text-white" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        {/* Font family */}
        <select
          value={editor.getAttributes("textStyle").fontFamily ?? "Arial, sans-serif"}
          onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}
          className="text-xs border border-gray-200 rounded px-2 py-1 mr-1 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-[#189aa1]/40"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="Calibri, sans-serif">Calibri</option>
        </select>
        {/* Font size */}
        <select
          defaultValue="12pt"
          onChange={e => {
            editor.chain().focus().setFontSize(e.target.value).run();
          }}
          className="text-xs border border-gray-200 rounded px-2 py-1 mr-2 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-[#189aa1]/40"
        >
          {["8pt","9pt","10pt","11pt","12pt","14pt","16pt","18pt","20pt","24pt"].map(s => (
            <option key={s} value={s}>{s.replace("pt", " pt")}</option>
          ))}
        </select>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn active={false} onClick={() => editor.chain().focus().setContent(content.split("\n").map(l => l.trim() ? `<p>${l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>` : "<p><br></p>").join(""), { emitUpdate: false }).run()}>
          <Type className="w-3.5 h-3.5" />
        </ToolBtn>
        <span className="text-[10px] text-gray-400 ml-1">Reset</span>
      </div>
      {/* Editor area */}
      <div className="p-6 overflow-auto" style={{ maxHeight: "75vh" }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ─── UI PRIMITIVES ──────────────────────────────────────────────────────────

function Field({ label, value, onChange, unit, placeholder, hint, span2 }: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; hint?: string; span2?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal text-[10px]">{hint}</span>}
      </label>
      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#189aa1]/30 focus-within:border-[#189aa1]">
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? "--"}
          className="flex-1 px-2 py-1.5 text-sm outline-none bg-white" style={{ fontFamily: "JetBrains Mono, monospace" }} />
        {unit && <span className="px-2 py-1.5 text-[10px] text-gray-400 bg-gray-50 border-l border-gray-200 font-medium whitespace-nowrap">{unit}</span>}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, hint, span2 }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; hint?: string; span2?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal text-[10px]">{hint}</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] bg-white">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Section({ title, children, defaultOpen = true, comment, onCommentChange }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
  comment?: string; onCommentChange?: (v: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [notesOpen, setNotesOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #189aa1, #0e7a80)" }}>
        <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>{title}</h3>
        <div className="flex items-center gap-2">
          {comment && comment.trim() && (
            <span className="text-[10px] bg-[#4ad9e0]/30 text-white px-1.5 py-0.5 rounded-full font-semibold">note</span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-white/70" /> : <ChevronDown className="w-4 h-4 text-white/70" />}
        </div>
      </button>
      {open && (
        <div className="p-4 grid grid-cols-2 gap-3">
          {children}
          {onCommentChange && (
            <div className="col-span-2 mt-1">
              <button
                type="button"
                onClick={() => setNotesOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#189aa1] hover:text-[#0e7a80] transition-colors mb-1"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                {notesOpen ? "Hide section notes" : (comment && comment.trim() ? "Edit section notes" : "Add section notes")}
              </button>
              {notesOpen && (
                <textarea
                  value={comment ?? ""}
                  onChange={e => onCommentChange(e.target.value)}
                  rows={3}
                  placeholder="Enter custom notes or comments for this section..."
                  className="w-full border border-[#189aa1]/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] resize-none bg-[#f0fbfc]"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SEVERITY_OPTIONS = ["", "Trace", "Trace to Mild", "Mild", "Mild to Moderate", "Moderate", "Moderate to Severe", "Severe"];
const STUDY_QUALITY_OPTIONS = [
  "Technically adequate.",
  "Technically good.",
  "Technically very good.",
  "Technically fair.",
  "Technically limited.",
  "Technically limited secondary to poor acoustic windows.",
  "Technically limited secondary to patient body habitus.",
  "Technically limited secondary to patient motion.",
  "Technically limited secondary to patient uncooperative for study.",
  "Technically difficult study with limited visualization of intracardiac structure.",
  "Technically limited secondary to limited endocardial definition.",
  "Technically poor study.",
  "Technically challenging study despite effort.",
  "Technically difficult.",
  "Technically difficult, but adequate, study.",
];

// ─── DATA MODEL ─────────────────────────────────────────────────────────────

interface ReportData {
  // Study info
  indication: string;
  studyQuality: string;
  studyType: string;
  patientAge: string;
  bsa: string;
  bmi: string;
  bp: string;
  heartRate: string;
  caseNumber: string;
  patientStatus: string;
  sonographerComments: string;

  // M-Mode
  mRvid: string;
  mLvedd: string;
  mLveddIndex: string;
  mLvesd: string;
  mIvsd: string;
  mIvss: string;
  mLvpwd: string;
  mLvpws: string;
  mAoRoot: string;
  mAoRootIndex: string;
  mLa: string;
  mLvMass: string;
  mLvMassIndex: string;
  mEf: string;
  mFs: string;
  mGls: string;
  mSv: string;
  mSi: string;
  mCo: string;
  mCi: string;
  mEdv: string;
  mEsv: string;
  mEpss: string;

  // 2D
  dRvid: string;
  dRvBasal: string;
  dLvedd: string;
  dLveddIndex: string;
  dLvesd: string;
  dIvsd: string;
  dIvss: string;
  dLvpwd: string;
  dLvpws: string;
  dAoRoot: string;
  dSinusValsalva: string;
  dSinotubular: string;
  dAoAnnulus: string;
  dAscAorta: string;
  dLaArea: string;
  dRaArea: string;
  dEf: string;
  dSimpsonsEf: string;
  dAutoEf: string;
  dAutoEdv: string;
  dAutoEsv: string;
  dFs: string;
  dSv: string;
  dSi: string;
  dCo: string;
  dCi: string;
  dEdv: string;
  dSimpsonsEdv: string;
  dEdvIndex: string;
  dEsv: string;
  dSimpsonsEsv: string;
  dEsvIndex: string;
  dLa: string;
  dRa: string;
  dRaIndex: string;
  dIvc: string;
  dLvMass: string;
  dLvMassIndex: string;
  dLaVolume: string;
  dLaVolumeIndex: string;
  dLvotDiam: string;
  dMpaDiam: string;
  dMapse: string;
  dTdiDelay: string;

  // Mitral Valve
  mvRegurg: string;
  mvStenosis: string;
  mvPeakVel: string;
  mvPeakGrad: string;
  mvVti: string;
  mvEVel: string;
  mvEGrad: string;
  mvMeanVel: string;
  mvMeanGrad: string;
  mvAVel: string;
  mvAGrad: string;
  mvEaRatio: string;
  mvEPrimeLat: string;
  mvEPrimeMed: string;
  mvEePrimeLat: string;
  mvEePrimeMed: string;
  mvAPrimeLat: string;
  mvAPrimeMed: string;
  mvPisaRadius: string;
  mvAliasingVel: string;
  mvMrPeakVel: string;
  mvMrVti: string;
  mvEro: string;
  mvPht: string;
  mvArea: string;
  mvAreaPht: string;
  mvADur: string;
  mvDs: string;
  mvDt: string;
  mvAreaVti: string;
  pvADur: string;
  pvAVel: string;
  pvSysVel: string;
  pvDiaVel: string;
  pvSdRatio: string;
  vpColorMMode: string;
  ivrt: string;

  // Tricuspid Valve
  tvRegurg: string;
  tvPeakVel: string;
  tvPeakGrad: string;
  tvTrPeakVel: string;
  tvTrPeakGrad: string;
  tvTapse: string;
  tvRap: string;
  tvRvsp: string;
  tvQpQs: string;

  // Aortic Valve
  avRegurg: string;
  avStenosis: string;
  avaPlanimetry: string;
  avPeakVel: string;
  avPeakGrad: string;
  avMeanVel: string;
  avMeanGrad: string;
  avVti: string;
  avAreaVel: string;
  avAreaVti: string;
  avAreaIndex: string;
  avPht: string;
  lvotPeakVel: string;
  lvotPeakGrad: string;
  lvotVti: string;
  lvotCo: string;
  lvotSv: string;
  lvotDi: string;

  // Pulmonic Valve
  pvRegurg: string;
  pvPeakVel: string;
  pvPeakGrad: string;
  pvMeanGrad: string;
  pvAccelTime: string;
  pvPiedv: string;
  rvotDiam: string;
  rvotVti: string;
  rvotPeakVel: string;
  rvotPeakGrad: string;
  pvArea: string;
  paedp: string;

  // Physician Review (free text findings per chamber)
  findLv: string;
  findLa: string;
  findMv: string;
  findAv: string;
  findAorta: string;
  findPericardium: string;
  findSummary: string;
  findRv: string;
  findRa: string;
  findTv: string;
  findPv: string;
  findPa: string;
  findDiastolic: string;
  findOther: string;

  // Conclusions
  conclusions: string;

  // Per-section notes/comments
  noteStudy: string;
  noteMMode: string;
  note2D: string;
  noteMv: string;
  noteTv: string;
  noteAv: string;
  notePv: string;
  notePhysician: string;
}

// ─── REPORT GENERATOR ───────────────────────────────────────────────────────

function generateReport(d: ReportData): string {
  const lines: string[] = [];
  const sep = "─".repeat(64);

  const n = (v: string) => v && v.trim() !== "" && v !== "--";
  const num = (v: string) => parseFloat(v);

  // ── HEADER ──
  lines.push("ECHOCARDIOGRAPHIC REPORT");
  lines.push(sep);
  if (n(d.studyType)) lines.push(`Study Type:    ${d.studyType}`);
  if (n(d.caseNumber)) lines.push(`Case Number:   ${d.caseNumber}`);
  if (n(d.patientAge)) lines.push(`Patient Age:   ${d.patientAge}`);
  if (n(d.patientStatus)) lines.push(`Patient Status: ${d.patientStatus}`);
  if (n(d.bsa)) lines.push(`BSA:           ${d.bsa} m²`);
  if (n(d.bmi)) lines.push(`BMI:           ${d.bmi}`);
  if (n(d.bp)) lines.push(`Blood Pressure: ${d.bp} mmHg`);
  if (n(d.heartRate)) lines.push(`Heart Rate:    ${d.heartRate} bpm`);
  if (n(d.indication)) lines.push(`Indication:    ${d.indication}`);
  if (n(d.studyQuality)) lines.push(`Study Quality: ${d.studyQuality}`);
  if (n(d.noteStudy)) { lines.push(""); lines.push("STUDY NOTES:"); d.noteStudy.split("\n").forEach(l => lines.push(`  ${l}`)); }
  lines.push(sep);

  // ── MEASUREMENTS ──
  const mMode: string[] = [];
  if (n(d.mLvedd)) mMode.push(`LVIDd ${d.mLvedd} cm (nl 4.2–5.9)`);
  if (n(d.mLvesd)) mMode.push(`LVIDs ${d.mLvesd} cm (nl 2.1–4.0)`);
  if (n(d.mIvsd)) mMode.push(`IVSd ${d.mIvsd} cm (nl 0.6–1.0)`);
  if (n(d.mIvss)) mMode.push(`IVSs ${d.mIvss} cm`);
  if (n(d.mLvpwd)) mMode.push(`LVPWd ${d.mLvpwd} cm (nl 0.6–1.0)`);
  if (n(d.mLvpws)) mMode.push(`LVPWs ${d.mLvpws} cm`);
  if (n(d.mAoRoot)) mMode.push(`Aortic Root ${d.mAoRoot} cm (nl 2.0–3.7)`);
  if (n(d.mLa)) mMode.push(`LA ${d.mLa} cm (nl 3.0–4.0)`);
  if (n(d.mRvid)) mMode.push(`RVIDd ${d.mRvid} cm (nl 1.9–2.6)`);
  if (n(d.mEf)) mMode.push(`EF ${d.mEf}% (nl ≥55)`);
  if (n(d.mFs)) mMode.push(`FS ${d.mFs}% (nl 25–43)`);
  if (n(d.mGls)) mMode.push(`GLS ${d.mGls}%`);
  if (n(d.mLvMass)) mMode.push(`LV Mass ${d.mLvMass} g (nl 88–224)`);
  if (n(d.mLvMassIndex)) mMode.push(`LV Mass Index ${d.mLvMassIndex} g/m² (nl 49–115)`);
  if (n(d.mSv)) mMode.push(`SV ${d.mSv} mL (nl 70–100)`);
  if (n(d.mCo)) mMode.push(`CO ${d.mCo} L/min (nl 4–8)`);
  if (n(d.mCi)) mMode.push(`CI ${d.mCi} L/min/m² (nl 2.4–4.2)`);
  if (n(d.mEdv)) mMode.push(`EDV ${d.mEdv} mL (nl 67–155)`);
  if (n(d.mEsv)) mMode.push(`ESV ${d.mEsv} mL (nl 22–58)`);
  if (n(d.mEpss)) mMode.push(`EPSS ${d.mEpss} cm`);

  const twoDim: string[] = [];
  if (n(d.dLvedd)) twoDim.push(`LVIDd ${d.dLvedd} cm (nl 4.2–5.9)`);
  if (n(d.dLvesd)) twoDim.push(`LVIDs ${d.dLvesd} cm`);
  if (n(d.dIvsd)) twoDim.push(`IVSd ${d.dIvsd} cm (nl 0.6–1.0)`);
  if (n(d.dIvss)) twoDim.push(`IVSs ${d.dIvss} cm`);
  if (n(d.dLvpwd)) twoDim.push(`LVPWd ${d.dLvpwd} cm (nl 0.6–1.0)`);
  if (n(d.dLvpws)) twoDim.push(`LVPWs ${d.dLvpws} cm`);
  if (n(d.dAoRoot)) twoDim.push(`Aortic Root ${d.dAoRoot} cm (nl 2.0–3.7)`);
  if (n(d.dSinusValsalva)) twoDim.push(`Sinuses of Valsalva ${d.dSinusValsalva} cm`);
  if (n(d.dSinotubular)) twoDim.push(`Sinotubular Junction ${d.dSinotubular} cm`);
  if (n(d.dAoAnnulus)) twoDim.push(`Aortic Annulus ${d.dAoAnnulus} cm`);
  if (n(d.dAscAorta)) twoDim.push(`Ascending Aorta ${d.dAscAorta} cm`);
  if (n(d.dLa)) twoDim.push(`LA ${d.dLa} cm (nl 3.0–4.0)`);
  if (n(d.dRa)) twoDim.push(`RA ${d.dRa} cm`);
  if (n(d.dLaArea)) twoDim.push(`LA Area ${d.dLaArea} cm² (nl ≤20)`);
  if (n(d.dRaArea)) twoDim.push(`RA Area ${d.dRaArea} cm²`);
  if (n(d.dLaVolume)) twoDim.push(`LA Volume ${d.dLaVolume} mL (nl 18–58)`);
  if (n(d.dLaVolumeIndex)) twoDim.push(`LA Volume Index ${d.dLaVolumeIndex} mL/m² (nl 16–28)`);
  if (n(d.dRvid)) twoDim.push(`RVIDd ${d.dRvid} cm (nl 1.9–2.6)`);
  if (n(d.dRvBasal)) twoDim.push(`RV Basal Diam ${d.dRvBasal} cm`);
  if (n(d.dIvc)) twoDim.push(`IVC ${d.dIvc} cm`);
  if (n(d.dEf)) twoDim.push(`EF ${d.dEf}% (nl ≥55)`);
  if (n(d.dSimpsonsEf)) twoDim.push(`Simpson's EF ${d.dSimpsonsEf}%`);
  if (n(d.dFs)) twoDim.push(`FS ${d.dFs}% (nl 25–43)`);
  if (n(d.dLvMass)) twoDim.push(`LV Mass ${d.dLvMass} g (nl 88–224)`);
  if (n(d.dLvMassIndex)) twoDim.push(`LV Mass Index ${d.dLvMassIndex} g/m² (nl 49–115)`);
  if (n(d.dSv)) twoDim.push(`SV ${d.dSv} mL (nl 70–100)`);
  if (n(d.dCo)) twoDim.push(`CO ${d.dCo} L/min (nl 4–8)`);
  if (n(d.dCi)) twoDim.push(`CI ${d.dCi} L/min/m² (nl 2.4–4.2)`);
  if (n(d.dEdv)) twoDim.push(`EDV ${d.dEdv} mL (nl 67–155)`);
  if (n(d.dEsv)) twoDim.push(`ESV ${d.dEsv} mL (nl 22–58)`);
  if (n(d.dLvotDiam)) twoDim.push(`LVOT Diameter ${d.dLvotDiam} cm`);
  if (n(d.dMpaDiam)) twoDim.push(`MPA Diameter ${d.dMpaDiam} cm`);
  if (n(d.dMapse)) twoDim.push(`MAPSE ${d.dMapse} cm`);
  if (n(d.dTdiDelay)) twoDim.push(`Max TDI Delay ${d.dTdiDelay} m/s`);

  if (mMode.length > 0) {
    lines.push("");
    lines.push("M-MODE MEASUREMENTS:");
    mMode.forEach(m => lines.push(`  ${m}`));
    if (n(d.noteMMode)) { lines.push(""); lines.push("  NOTE:"); d.noteMMode.split("\n").forEach(l => lines.push(`    ${l}`)); }
  }
  if (twoDim.length > 0) {
    lines.push("");
    lines.push("2D MEASUREMENTS:");
    twoDim.forEach(m => lines.push(`  ${m}`));
    if (n(d.note2D)) { lines.push(""); lines.push("  NOTE:"); d.note2D.split("\n").forEach(l => lines.push(`    ${l}`)); }
  }

  // ── MITRAL VALVE ──
  const mvLines: string[] = [];
  if (n(d.mvRegurg)) {
    const regurgText = d.mvRegurg === "Trace"
      ? "There is trace mitral valve regurgitation."
      : d.mvRegurg === "Trace to Mild"
      ? "There is trace to mild mitral valve regurgitation."
      : d.mvRegurg === "Mild"
      ? "There is mild mitral valve regurgitation."
      : d.mvRegurg === "Mild to Moderate"
      ? "There is mild to moderate mitral valve regurgitation."
      : d.mvRegurg === "Moderate"
      ? "There is moderate mitral valve regurgitation."
      : d.mvRegurg === "Moderate to Severe"
      ? "There is moderate to severe mitral valve regurgitation."
      : d.mvRegurg === "Severe"
      ? "There is severe mitral valve regurgitation."
      : "";
    if (regurgText) mvLines.push(regurgText);
  }
  if (n(d.mvStenosis)) {
    const stenText = d.mvStenosis === "Mild" ? "There is mild mitral valve stenosis."
      : d.mvStenosis === "Mild to Moderate" ? "There is mild to moderate mitral valve stenosis."
      : d.mvStenosis === "Moderate" ? "There is moderate mitral valve stenosis."
      : d.mvStenosis === "Moderate to Severe" ? "There is moderate to severe mitral valve stenosis."
      : d.mvStenosis === "Severe" ? "There is severe mitral valve stenosis."
      : "";
    if (stenText) mvLines.push(stenText);
  }
  if (n(d.mvEVel)) mvLines.push(`Mitral valve peak E-wave velocity is ${d.mvEVel} m/s${n(d.mvEGrad) ? ` (peak gradient ${d.mvEGrad} mmHg)` : ""}.`);
  if (n(d.mvAVel)) mvLines.push(`Mitral valve peak A-wave velocity is ${d.mvAVel} m/s.`);
  if (n(d.mvEaRatio)) mvLines.push(`E/A ratio is ${d.mvEaRatio}.`);
  if (n(d.mvEPrimeLat)) mvLines.push(`Lateral e' velocity is ${d.mvEPrimeLat} cm/s${n(d.mvEePrimeLat) ? ` (E/e' lateral ${d.mvEePrimeLat})` : ""}.`);
  if (n(d.mvEPrimeMed)) mvLines.push(`Medial e' velocity is ${d.mvEPrimeMed} cm/s${n(d.mvEePrimeMed) ? ` (E/e' medial ${d.mvEePrimeMed})` : ""}.`);
  if (n(d.mvDt)) mvLines.push(`Mitral valve deceleration time is ${d.mvDt} ms (nl ≤200).`);
  if (n(d.mvPht)) mvLines.push(`Mitral valve pressure half-time is ${d.mvPht} ms.`);
  if (n(d.mvArea)) mvLines.push(`Mitral valve area is ${d.mvArea} cm² (nl 4–6).`);
  if (n(d.mvMeanGrad)) mvLines.push(`Mitral valve mean gradient is ${d.mvMeanGrad} mmHg.`);
  if (n(d.mvEro)) mvLines.push(`Mitral regurgitation effective regurgitant orifice area (ERO) is ${d.mvEro} cm².`);
  if (n(d.mvPisaRadius)) mvLines.push(`MR PISA radius ${d.mvPisaRadius} cm${n(d.mvAliasingVel) ? ` (aliasing velocity ${d.mvAliasingVel} m/s)` : ""}.`);
  if (n(d.pvSysVel)) mvLines.push(`Pulmonary vein systolic velocity ${d.pvSysVel} m/s (nl 0.40–0.80), diastolic ${n(d.pvDiaVel) ? d.pvDiaVel : "--"} m/s (nl 0.30–0.60).`);
  if (n(d.ivrt)) mvLines.push(`Isovolumic relaxation time (IVRT) is ${d.ivrt} ms.`);

  if (mvLines.length > 0) {
    lines.push("");
    lines.push("MITRAL VALVE:");
    mvLines.forEach(l => lines.push(`  ${l}`));
    if (n(d.noteMv)) { lines.push(""); lines.push("  NOTE:"); d.noteMv.split("\n").forEach(l => lines.push(`    ${l}`)); }
  }

  // ── TRICUSPID VALVE ──
  const tvLines: string[] = [];
  if (n(d.tvRegurg)) {
    const trText = d.tvRegurg === "Trace" ? "There is trace tricuspid valve regurgitation."
      : d.tvRegurg === "Trace to Mild" ? "There is trace to mild tricuspid valve regurgitation."
      : d.tvRegurg === "Mild" ? "There is mild tricuspid valve regurgitation."
      : d.tvRegurg === "Mild to Moderate" ? "There is mild to moderate tricuspid valve regurgitation."
      : d.tvRegurg === "Moderate" ? "There is moderate tricuspid valve regurgitation."
      : d.tvRegurg === "Moderate to Severe" ? "There is moderate to severe tricuspid valve regurgitation."
      : d.tvRegurg === "Severe" ? "There is severe tricuspid valve regurgitation."
      : "";
    if (trText) tvLines.push(trText);
  }
  if (n(d.tvTrPeakVel)) {
    const rvspCalc = n(d.tvRvsp) ? num(d.tvRvsp) : n(d.tvTrPeakVel) ? Math.round(4 * num(d.tvTrPeakVel) ** 2 + (n(d.tvRap) ? num(d.tvRap) : 5)) : null;
    const rvspInterp = rvspCalc !== null
      ? rvspCalc <= 35 ? "normal pulmonary artery pressure"
      : rvspCalc <= 50 ? "mildly elevated estimated right ventricular systolic pressure"
      : rvspCalc <= 70 ? "moderately elevated estimated right ventricular systolic pressure"
      : "severely elevated estimated right ventricular systolic pressure"
      : "";
    tvLines.push(`The tricuspid regurgitant jet reveals ${rvspInterp} at ${n(d.tvRvsp) ? d.tvRvsp : rvspCalc !== null ? rvspCalc.toString() : "--"} mmHg.`);
  }
  if (n(d.tvPeakVel)) tvLines.push(`Tricuspid valve peak velocity is ${d.tvPeakVel} m/s (nl 0.3–0.7)${n(d.tvPeakGrad) ? `, peak gradient ${d.tvPeakGrad} mmHg (nl ≤2)` : ""}.`);
  if (n(d.tvTapse)) tvLines.push(`Tricuspid annular plane systolic excursion (TAPSE) is ${d.tvTapse} cm.`);
  if (n(d.tvRap)) tvLines.push(`Estimated right atrial pressure is ${d.tvRap} mmHg (nl 5–10).`);
  if (n(d.tvRvsp) && !n(d.tvTrPeakVel)) tvLines.push(`Estimated right ventricular systolic pressure (RVSP) is ${d.tvRvsp} mmHg (nl ≤30).`);
  if (n(d.tvQpQs)) tvLines.push(`Qp/Qs ratio is ${d.tvQpQs}.`);

  if (tvLines.length > 0) {
    lines.push("");
    lines.push("TRICUSPID VALVE & RIGHT HEART PRESSURES:");
    tvLines.forEach(l => lines.push(`  ${l}`));
    if (n(d.noteTv)) { lines.push(""); lines.push("  NOTE:"); d.noteTv.split("\n").forEach(l => lines.push(`    ${l}`)); }
  }

  // ── AORTIC VALVE ──
  const avLines: string[] = [];
  if (n(d.avRegurg)) {
    const arText = d.avRegurg === "Trace" ? "There is trace aortic valve regurgitation."
      : d.avRegurg === "Trace to Mild" ? "There is trace to mild aortic valve regurgitation."
      : d.avRegurg === "Mild" ? "There is mild aortic valve regurgitation."
      : d.avRegurg === "Mild to Moderate" ? "There is mild to moderate aortic valve regurgitation."
      : d.avRegurg === "Moderate" ? "There is moderate aortic valve regurgitation."
      : d.avRegurg === "Moderate to Severe" ? "There is moderate to severe aortic valve regurgitation."
      : d.avRegurg === "Severe" ? "There is severe aortic valve regurgitation."
      : "";
    if (arText) avLines.push(arText);
  }
  if (n(d.avStenosis)) {
    const asText = d.avStenosis === "Trace" ? "There is trace aortic valve sclerosis."
      : d.avStenosis === "Trace to Mild" ? "There is trace to mild aortic valve stenosis."
      : d.avStenosis === "Mild" ? "There is mild aortic valve stenosis."
      : d.avStenosis === "Mild to Moderate" ? "There is mild to moderate aortic valve stenosis."
      : d.avStenosis === "Moderate" ? "There is moderate aortic valve stenosis."
      : d.avStenosis === "Moderate to Severe" ? "There is moderate to severe aortic valve stenosis."
      : d.avStenosis === "Severe" ? "There is severe aortic valve stenosis."
      : "";
    if (asText) avLines.push(asText);
  }
  if (n(d.avPeakVel)) avLines.push(`Aortic valve peak velocity is ${d.avPeakVel} m/s (nl ≤2.5)${n(d.avPeakGrad) ? `, peak gradient ${d.avPeakGrad} mmHg (nl ≤16)` : ""}.`);
  if (n(d.avMeanVel)) avLines.push(`Aortic valve mean velocity is ${d.avMeanVel} m/s${n(d.avMeanGrad) ? `, mean gradient ${d.avMeanGrad} mmHg (nl ≤5)` : ""}.`);
  if (n(d.avAreaVel)) avLines.push(`Aortic valve area (by velocity) is ${d.avAreaVel} cm² (nl 3–5).`);
  if (n(d.avAreaVti)) avLines.push(`Aortic valve area (by VTI) is ${d.avAreaVti} cm².`);
  if (n(d.avaPlanimetry)) avLines.push(`Aortic valve area (planimetry) is ${d.avaPlanimetry} cm².`);
  if (n(d.avAreaIndex)) avLines.push(`Aortic valve area index is ${d.avAreaIndex} cm²/m².`);
  if (n(d.lvotPeakVel)) avLines.push(`LVOT peak velocity is ${d.lvotPeakVel} m/s (nl 0.7–1.1)${n(d.lvotPeakGrad) ? `, gradient ${d.lvotPeakGrad} mmHg` : ""}.`);
  if (n(d.lvotVti)) avLines.push(`LVOT VTI is ${d.lvotVti} cm (nl 18–22).`);
  if (n(d.lvotSv)) avLines.push(`LVOT stroke volume is ${d.lvotSv} mL (nl 70–100).`);
  if (n(d.lvotCo)) avLines.push(`LVOT cardiac output is ${d.lvotCo} L/min (nl 4–8).`);
  if (n(d.lvotDi)) avLines.push(`Dimensionless index (DI) is ${d.lvotDi}.`);
  if (n(d.avPht)) avLines.push(`Aortic pressure half-time is ${d.avPht} ms.`);

  if (avLines.length > 0) {
    lines.push("");
    lines.push("AORTIC VALVE:");
    avLines.forEach(l => lines.push(`  ${l}`));
    if (n(d.noteAv)) { lines.push(""); lines.push("  NOTE:"); d.noteAv.split("\n").forEach(l => lines.push(`    ${l}`)); }
  }

  // ── PULMONIC VALVE ──
  const pvLines: string[] = [];
  if (n(d.pvRegurg)) {
    const prText = d.pvRegurg === "Trace" ? "There is trace pulmonic valve regurgitation."
      : d.pvRegurg === "Mild" ? "There is mild pulmonic valve regurgitation."
      : d.pvRegurg === "Moderate" ? "There is moderate pulmonic valve regurgitation."
      : d.pvRegurg === "Severe" ? "There is severe pulmonic valve regurgitation."
      : "";
    if (prText) pvLines.push(prText);
  }
  if (n(d.pvPeakVel)) pvLines.push(`Pulmonic valve peak velocity is ${d.pvPeakVel} m/s (nl 0.6–0.9)${n(d.pvPeakGrad) ? `, peak gradient ${d.pvPeakGrad} mmHg (nl ≤3)` : ""}.`);
  if (n(d.pvMeanGrad)) pvLines.push(`Pulmonic valve mean gradient is ${d.pvMeanGrad} mmHg.`);
  if (n(d.pvAccelTime)) pvLines.push(`Pulmonic valve acceleration time is ${d.pvAccelTime} ms.`);
  if (n(d.pvPiedv)) pvLines.push(`Pulmonary insufficiency end-diastolic velocity is ${d.pvPiedv} m/s.`);
  if (n(d.rvotPeakVel)) pvLines.push(`RVOT peak velocity is ${d.rvotPeakVel} m/s${n(d.rvotPeakGrad) ? `, gradient ${d.rvotPeakGrad} mmHg` : ""}.`);
  if (n(d.pvArea)) pvLines.push(`Pulmonic valve area is ${d.pvArea} cm².`);
  if (n(d.paedp)) pvLines.push(`Pulmonary artery end-diastolic pressure (PAEDP) is ${d.paedp} mmHg.`);

  if (pvLines.length > 0) {
    lines.push("");
    lines.push("PULMONIC VALVE & RVOT:");
    pvLines.forEach(l => lines.push(`  ${l}`));
    if (n(d.notePv)) { lines.push(""); lines.push("  NOTE:"); d.notePv.split("\n").forEach(l => lines.push(`    ${l}`)); }
  }

  // ── PHYSICIAN REVIEW FINDINGS ──
  const findingsSections: [string, string][] = [
    ["LEFT VENTRICLE", d.findLv],
    ["LEFT ATRIUM", d.findLa],
    ["MITRAL VALVE", d.findMv],
    ["AORTIC VALVE", d.findAv],
    ["AORTA", d.findAorta],
    ["PERICARDIUM", d.findPericardium],
    ["RIGHT VENTRICLE", d.findRv],
    ["RIGHT ATRIUM", d.findRa],
    ["TRICUSPID VALVE", d.findTv],
    ["PULMONIC VALVE", d.findPv],
    ["PULMONARY ARTERY", d.findPa],
    ["DIASTOLIC FUNCTION", d.findDiastolic],
    ["OTHER / ADDITIONAL FINDINGS", d.findOther],
    ["SUMMARY FINDINGS", d.findSummary],
  ];
  const hasFindings = findingsSections.some(([, v]) => n(v));
  if (hasFindings) {
    lines.push("");
    lines.push("PHYSICIAN REVIEW — FINDINGS:");
    findingsSections.forEach(([title, val]) => {
      if (n(val)) {
        lines.push(`  ${title}:`);
        val.split("\n").forEach(l => lines.push(`    ${l}`));
      }
    });
    if (n(d.notePhysician)) { lines.push(""); lines.push("  PHYSICIAN NOTES:"); d.notePhysician.split("\n").forEach(l => lines.push(`    ${l}`)); }
  }

  // ── AUTO-GENERATED CONCLUSIONS ──
  const autoConclusions: string[] = [];

  // RVSP / Pulmonary hypertension
  const rvspVal = n(d.tvRvsp) ? num(d.tvRvsp)
    : n(d.tvTrPeakVel) ? Math.round(4 * num(d.tvTrPeakVel) ** 2 + (n(d.tvRap) ? num(d.tvRap) : 5))
    : null;
  if (rvspVal !== null) {
    const phText = rvspVal > 70 ? "severe pulmonary hypertension"
      : rvspVal > 50 ? "moderate pulmonary hypertension"
      : rvspVal > 35 ? "mild pulmonary hypertension"
      : "normal pulmonary artery pressure";
    autoConclusions.push(`Right ventricular systolic pressure is consistent with ${phText}.`);
  }

  // TR
  if (n(d.tvRegurg) && d.tvRegurg !== "") {
    autoConclusions.push(`There is ${d.tvRegurg.toLowerCase()} tricuspid valve regurgitation.`);
    if (n(d.tvTrPeakVel) && rvspVal !== null) {
      autoConclusions.push(`The tricuspid regurgitant jet reveals ${rvspVal > 70 ? "severely" : rvspVal > 50 ? "moderately" : rvspVal > 35 ? "mildly" : ""} elevated estimated right ventricular systolic pressure at ${rvspVal} mmHg.`);
    }
  }

  // AVA
  if (n(d.avAreaVel)) {
    autoConclusions.push(`The aortic valve area is ${d.avAreaVel} cm².`);
  } else if (n(d.avAreaVti)) {
    autoConclusions.push(`The aortic valve area is ${d.avAreaVti} cm².`);
  } else if (n(d.avaPlanimetry)) {
    autoConclusions.push(`The aortic valve area by planimetry is ${d.avaPlanimetry} cm².`);
  }

  // AV peak gradient
  if (n(d.avPeakGrad)) {
    autoConclusions.push(`The aortic valve peak pressure gradient is ${d.avPeakGrad} mmHg.`);
  }

  // AS severity
  if (n(d.avStenosis) && d.avStenosis !== "") {
    autoConclusions.push(`There is ${d.avStenosis.toLowerCase()} aortic valve stenosis.`);
  }

  // AR severity
  if (n(d.avRegurg) && d.avRegurg !== "") {
    if (d.avRegurg === "Trace") {
      autoConclusions.push("There is mild aortic valve sclerosis.");
    } else {
      autoConclusions.push(`There is ${d.avRegurg.toLowerCase()} aortic valve regurgitation.`);
    }
  }

  // MR severity
  if (n(d.mvRegurg) && d.mvRegurg !== "") {
    autoConclusions.push(`There is ${d.mvRegurg.toLowerCase()} mitral valve regurgitation.`);
  }

  // MS severity
  if (n(d.mvStenosis) && d.mvStenosis !== "") {
    autoConclusions.push(`There is ${d.mvStenosis.toLowerCase()} mitral valve stenosis.`);
  }

  // PR severity
  if (n(d.pvRegurg) && d.pvRegurg !== "") {
    autoConclusions.push(`There is ${d.pvRegurg.toLowerCase()} pulmonic valve regurgitation.`);
  }

  // LA size
  const laVi = n(d.dLaVolumeIndex) ? num(d.dLaVolumeIndex) : n(d.dLaVolume) ? num(d.dLaVolume) : null;
  const laAp = n(d.dLa) ? num(d.dLa) : n(d.mLa) ? num(d.mLa) : null;
  if (laVi !== null && laVi > 34) {
    const laSev = laVi > 48 ? "severely" : laVi > 40 ? "moderately" : "mildly";
    autoConclusions.push(`The left atrium is ${laSev} dilated (LA volume index ${laVi} mL/m²).`);
  } else if (laAp !== null && laAp > 4.0) {
    autoConclusions.push(`The left atrium is mildly dilated.`);
  }

  // LVH
  const ivsdVal = n(d.dIvsd) ? num(d.dIvsd) : n(d.mIvsd) ? num(d.mIvsd) : null;
  const pwdVal = n(d.dLvpwd) ? num(d.dLvpwd) : n(d.mLvpwd) ? num(d.mLvpwd) : null;
  if ((ivsdVal !== null && ivsdVal > 1.2) || (pwdVal !== null && pwdVal > 1.2)) {
    const lvhSev = ((ivsdVal ?? 0) > 1.6 || (pwdVal ?? 0) > 1.6) ? "severe"
      : ((ivsdVal ?? 0) > 1.4 || (pwdVal ?? 0) > 1.4) ? "moderate"
      : "mild";
    autoConclusions.push(`There is ${lvhSev} left ventricular hypertrophy.`);
  }

  // EF
  const efVal = n(d.dEf) ? num(d.dEf) : n(d.dSimpsonsEf) ? num(d.dSimpsonsEf) : n(d.mEf) ? num(d.mEf) : null;
  if (efVal !== null) {
    const efText = efVal >= 55 ? "preserved systolic function"
      : efVal >= 50 ? "low-normal systolic function"
      : efVal >= 40 ? "mildly reduced systolic function"
      : efVal >= 30 ? "moderately reduced systolic function"
      : "severely reduced systolic function";
    autoConclusions.push(`The left ventricle demonstrates ${efText} with an ejection fraction of ${efVal}%.`);
  }

  // Remaining chambers normal
  autoConclusions.push("The remaining cardiac chambers are normal in size, with no evidence of intracardiac mass or thrombus.");

  // Sonographer comments
  if (n(d.sonographerComments)) {
    lines.push("");
    lines.push("SONOGRAPHER / TECHNICIAN COMMENTS:");
    lines.push(`  ${d.sonographerComments}`);
  }

  // Conclusions
  lines.push("");
  lines.push(sep);
  lines.push("CONCLUSIONS:");
  const finalConclusions = n(d.conclusions) ? d.conclusions : autoConclusions.join("\n");
  finalConclusions.split("\n").forEach((l, i) => lines.push(`  ${i + 1}. ${l}`));

  lines.push("");
  lines.push(sep);
  lines.push(`Interpreted by: ___________________________`);
  lines.push(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
  lines.push("© All About Ultrasound — iHeartEcho™ | www.iheartecho.com");

  return lines.join("\n");
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

const EMPTY: ReportData = {
  indication: "", studyQuality: STUDY_QUALITY_OPTIONS[0], studyType: "Transthoracic Echocardiogram (TTE)",
  patientAge: "", bsa: "", bmi: "", bp: "", heartRate: "", caseNumber: "", patientStatus: "Outpatient",
  sonographerComments: "",
  // M-Mode
  mRvid: "", mLvedd: "", mLveddIndex: "", mLvesd: "", mIvsd: "", mIvss: "", mLvpwd: "", mLvpws: "",
  mAoRoot: "", mAoRootIndex: "", mLa: "", mLvMass: "", mLvMassIndex: "", mEf: "", mFs: "", mGls: "",
  mSv: "", mSi: "", mCo: "", mCi: "", mEdv: "", mEsv: "", mEpss: "",
  // 2D
  dRvid: "", dRvBasal: "", dLvedd: "", dLveddIndex: "", dLvesd: "", dIvsd: "", dIvss: "", dLvpwd: "", dLvpws: "",
  dAoRoot: "", dSinusValsalva: "", dSinotubular: "", dAoAnnulus: "", dAscAorta: "",
  dLaArea: "", dRaArea: "", dEf: "", dSimpsonsEf: "", dAutoEf: "", dAutoEdv: "", dAutoEsv: "",
  dFs: "", dSv: "", dSi: "", dCo: "", dCi: "", dEdv: "", dSimpsonsEdv: "", dEdvIndex: "",
  dEsv: "", dSimpsonsEsv: "", dEsvIndex: "", dLa: "", dRa: "", dRaIndex: "", dIvc: "",
  dLvMass: "", dLvMassIndex: "", dLaVolume: "", dLaVolumeIndex: "", dLvotDiam: "", dMpaDiam: "", dMapse: "", dTdiDelay: "",
  // MV
  mvRegurg: "", mvStenosis: "", mvPeakVel: "", mvPeakGrad: "", mvVti: "", mvEVel: "", mvEGrad: "",
  mvMeanVel: "", mvMeanGrad: "", mvAVel: "", mvAGrad: "", mvEaRatio: "", mvEPrimeLat: "", mvEPrimeMed: "",
  mvEePrimeLat: "", mvEePrimeMed: "", mvAPrimeLat: "", mvAPrimeMed: "", mvPisaRadius: "", mvAliasingVel: "",
  mvMrPeakVel: "", mvMrVti: "", mvEro: "", mvPht: "", mvArea: "", mvAreaPht: "", mvADur: "", mvDs: "",
  mvDt: "", mvAreaVti: "", pvADur: "", pvAVel: "", pvSysVel: "", pvDiaVel: "", pvSdRatio: "",
  vpColorMMode: "", ivrt: "",
  // TV
  tvRegurg: "", tvPeakVel: "", tvPeakGrad: "", tvTrPeakVel: "", tvTrPeakGrad: "", tvTapse: "",
  tvRap: "5", tvRvsp: "", tvQpQs: "",
  // AV
  avRegurg: "", avStenosis: "", avaPlanimetry: "", avPeakVel: "", avPeakGrad: "", avMeanVel: "",
  avMeanGrad: "", avVti: "", avAreaVel: "", avAreaVti: "", avAreaIndex: "", avPht: "",
  lvotPeakVel: "", lvotPeakGrad: "", lvotVti: "", lvotCo: "", lvotSv: "", lvotDi: "",
  // PV
  pvRegurg: "", pvPeakVel: "", pvPeakGrad: "", pvMeanGrad: "", pvAccelTime: "", pvPiedv: "",
  rvotDiam: "", rvotVti: "", rvotPeakVel: "", rvotPeakGrad: "", pvArea: "", paedp: "",
  // Findings
  findLv: "", findLa: "", findMv: "", findAv: "", findAorta: "", findPericardium: "",
  findSummary: "", findRv: "", findRa: "", findTv: "", findPv: "", findPa: "",
  findDiastolic: "", findOther: "",
  conclusions: "",
  // Per-section notes
  noteStudy: "", noteMMode: "", note2D: "", noteMv: "", noteTv: "", noteAv: "", notePv: "", notePhysician: "",
};

export default function ReportBuilder() {
  const { loading: authLoading } = useAuth();
  const [data, setData] = useState<ReportData>(EMPTY);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"worksheet" | "report">("worksheet");
  const [richHtml, setRichHtml] = useState("");
  const report = useMemo(() => generateReport(data), [data]);
  const set = (key: keyof ReportData) => (v: string) => setData(d => ({ ...d, [key]: v }));
  const clearAll = useCallback(() => {
    if (window.confirm("Clear all measurements, findings, and notes? This cannot be undone.")) {
      setData(EMPTY);
      toast.success("Worksheet cleared.");
    }
  }, []);
  const copyReport = () => {
    // Copy as plain text (stripped of HTML tags)
    const tmp = document.createElement("div");
    tmp.innerHTML = richHtml || report;
    navigator.clipboard.writeText(tmp.innerText);
    setCopied(true);
    toast.success("Report copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };
  const copyRichText = async () => {
    // Copy as rich text so it pastes into Word/Epic with formatting
    const html = richHtml || `<pre style="font-family:Arial,sans-serif;font-size:12pt">${report.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>`;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([document.createElement("div").innerHTML = html, document.createElement("div").innerText || report], { type: "text/plain" }),
        }),
      ]);
      toast.success("Rich text copied — paste into Word or Epic!");
    } catch {
      // Fallback: copy plain text
      navigator.clipboard.writeText(report);
      toast.success("Copied as plain text (browser doesn't support rich copy).");
    }
  };
  const downloadDocx = async () => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, HorizontalPositionRelativeFrom } = await import("docx");
      const lines = report.split("\n");
      const paragraphs = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return new Paragraph({ children: [new TextRun("")], spacing: { after: 60 } });
        if (/^[─\-]{10,}$/.test(trimmed)) {
          return new Paragraph({ border: { bottom: { color: "CCCCCC", size: 6, space: 1, style: "single" } }, spacing: { after: 120 } });
        }
        if (/^[A-Z][A-Z0-9 \-\/&:]+:?$/.test(trimmed) && trimmed.length < 60) {
          return new Paragraph({
            children: [new TextRun({ text: trimmed, bold: true, font: "Arial", size: 24 })],
            spacing: { before: 160, after: 60 },
          });
        }
        return new Paragraph({
          children: [new TextRun({ text: line, font: "Arial", size: 24 })],
          spacing: { after: 40 },
        });
      });
      const doc = new Document({
        styles: {
          default: {
            document: {
              run: { font: "Arial", size: 24 },
              paragraph: { spacing: { line: 276 } },
            },
          },
        },
        sections: [{ properties: {}, children: paragraphs }],
      });
      const buffer = await Packer.toBlob(doc);
      const url = URL.createObjectURL(buffer);
      const a = document.createElement("a");
      a.href = url;
      a.download = `echo-report-${new Date().toISOString().split("T")[0]}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded as .docx!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate .docx — try plain text download.");
    }
  };
  const downloadReport = () => {
    const tmp = document.createElement("div");
    tmp.innerHTML = richHtml || report;
    const blob = new Blob([tmp.innerText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echo-report-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  };
  const printReport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const htmlBody = richHtml
      ? richHtml
      : `<pre style="white-space:pre-wrap">${report.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
    win.document.write(`<html><head><title>Echo Report</title><style>
      body { font-family: Arial, sans-serif; font-size: 12pt; padding: 24px; color: #000; line-height: 1.6; }
      hr { border: none; border-top: 1px solid #ccc; margin: 8px 0; }
      p { margin: 2px 0; }
    </style></head><body>${htmlBody}</body></html>`);
    win.document.close();
    win.print();
  };

  if (authLoading) return null;

  return (
    <Layout>
      <div className="container py-6">
        {/* Page title — always visible */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
            Echo Report Builder
          </h1>
          <p className="text-sm text-gray-500">
            Enter measurements and findings — a complete structured report is generated automatically.
          </p>
        </div>
        <PremiumOverlay featureName="Echo Report Builder">
        <div>
        {/* Header actions */}
        <div className="mb-5 flex items-end justify-end flex-wrap gap-3">
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-semibold">
            <button onClick={() => setActiveTab("worksheet")}
              className={`px-4 py-2 transition-all ${activeTab === "worksheet" ? "text-white" : "text-gray-600 bg-white hover:bg-gray-50"}`}
              style={activeTab === "worksheet" ? { background: "#189aa1" } : {}}>
              Worksheet
            </button>
            <button onClick={() => setActiveTab("report")}
              className={`px-4 py-2 transition-all border-l border-gray-200 ${activeTab === "report" ? "text-white" : "text-gray-600 bg-white hover:bg-gray-50"}`}
              style={activeTab === "report" ? { background: "#189aa1" } : {}}>
              Report Preview
            </button>
          </div>
          </div>
        </div>

        {activeTab === "worksheet" ? (
          <div className="space-y-4">

            {/* Study Info */}
            <Section title="Study Information" defaultOpen={false} comment={data.noteStudy} onCommentChange={set("noteStudy")}>
              <SelectField label="Study Type" span2 value={data.studyType} onChange={set("studyType")}
                options={["Transthoracic Echocardiogram (TTE)", "Limited TTE", "Stress Echo", "Contrast Echo", "3D TTE", "TEE", "ICE"]} />
              <Field label="Indication" span2 value={data.indication} onChange={set("indication")}
                placeholder="e.g. Dyspnea, chest pain, pre-op evaluation" />
              <SelectField label="Study Quality" span2 value={data.studyQuality} onChange={set("studyQuality")}
                options={STUDY_QUALITY_OPTIONS} />
              <Field label="Case Number" value={data.caseNumber} onChange={set("caseNumber")} placeholder="e.g. 092457" />
              <Field label="Patient Age" value={data.patientAge} onChange={set("patientAge")} unit="yrs" />
              <SelectField label="Patient Status" value={data.patientStatus} onChange={set("patientStatus")}
                options={["Outpatient", "Inpatient"]} />
              <Field label="BSA" value={data.bsa} onChange={set("bsa")} unit="m²" placeholder="e.g. 1.85" />
              <Field label="BMI" value={data.bmi} onChange={set("bmi")} placeholder="e.g. 27.4" />
              <Field label="Blood Pressure" value={data.bp} onChange={set("bp")} unit="mmHg" placeholder="e.g. 130/80" />
              <Field label="Heart Rate" value={data.heartRate} onChange={set("heartRate")} unit="bpm" placeholder="e.g. 72" />

            </Section>

            {/* M-Mode */}
            <Section title="M-Mode Measurements" defaultOpen={false} comment={data.noteMMode} onCommentChange={set("noteMMode")}>
              <Field label="RVIDd" value={data.mRvid} onChange={set("mRvid")} unit="cm" hint="(nl 1.9–2.6)" placeholder="1.9–2.6" />
              <Field label="LVIDd" value={data.mLvedd} onChange={set("mLvedd")} unit="cm" hint="(nl 4.2–5.9)" placeholder="4.2–5.9" />
              <Field label="LVIDd Index" value={data.mLveddIndex} onChange={set("mLveddIndex")} unit="cm/m²" hint="(nl 2.2–3.1)" />
              <Field label="LVIDs" value={data.mLvesd} onChange={set("mLvesd")} unit="cm" hint="(nl 2.1–4.0)" />
              <Field label="IVSd" value={data.mIvsd} onChange={set("mIvsd")} unit="cm" hint="(nl 0.6–1.0)" />
              <Field label="IVSs" value={data.mIvss} onChange={set("mIvss")} unit="cm" />
              <Field label="LVPWd" value={data.mLvpwd} onChange={set("mLvpwd")} unit="cm" hint="(nl 0.6–1.0)" />
              <Field label="LVPWs" value={data.mLvpws} onChange={set("mLvpws")} unit="cm" hint="(nl 0.9–1.4)" />
              <Field label="Aortic Root" value={data.mAoRoot} onChange={set("mAoRoot")} unit="cm" hint="(nl 2.0–3.7)" />
              <Field label="Aortic Root Index" value={data.mAoRootIndex} onChange={set("mAoRootIndex")} unit="cm/m²" />
              <Field label="LA" value={data.mLa} onChange={set("mLa")} unit="cm" hint="(nl 3.0–4.0)" />
              <Field label="LV Mass" value={data.mLvMass} onChange={set("mLvMass")} unit="g" hint="(nl 88–224)" />
              <Field label="LV Mass Index" value={data.mLvMassIndex} onChange={set("mLvMassIndex")} unit="g/m²" hint="(nl 49–115)" />
              <Field label="EF (Teichholz)" value={data.mEf} onChange={set("mEf")} unit="%" hint="(nl ≥55)" />
              <Field label="FS" value={data.mFs} onChange={set("mFs")} unit="%" hint="(nl 25–43)" />
              <Field label="GLS" value={data.mGls} onChange={set("mGls")} unit="%" hint="(nl ≤−18)" />
              <Field label="SV" value={data.mSv} onChange={set("mSv")} unit="mL" hint="(nl 70–100)" />
              <Field label="SI" value={data.mSi} onChange={set("mSi")} unit="mL/m²" />
              <Field label="CO" value={data.mCo} onChange={set("mCo")} unit="L/min" hint="(nl 4–8)" />
              <Field label="CI" value={data.mCi} onChange={set("mCi")} unit="L/min/m²" hint="(nl 2.4–4.2)" />
              <Field label="EDV" value={data.mEdv} onChange={set("mEdv")} unit="mL" hint="(nl 67–155)" />
              <Field label="ESV" value={data.mEsv} onChange={set("mEsv")} unit="mL" hint="(nl 22–58)" />
              <Field label="EPSS" value={data.mEpss} onChange={set("mEpss")} unit="cm" />
            </Section>

            {/* 2D */}
            <Section title="2D Measurements" defaultOpen={false} comment={data.note2D} onCommentChange={set("note2D")}>
              <Field label="RVIDd" value={data.dRvid} onChange={set("dRvid")} unit="cm" hint="(nl 1.9–2.6)" />
              <Field label="RV Basal Diam" value={data.dRvBasal} onChange={set("dRvBasal")} unit="cm" />
              <Field label="LVIDd" value={data.dLvedd} onChange={set("dLvedd")} unit="cm" hint="(nl 4.2–5.9)" />
              <Field label="LVIDd Index" value={data.dLveddIndex} onChange={set("dLveddIndex")} unit="cm/m²" hint="(nl 2.2–3.1)" />
              <Field label="LVIDs" value={data.dLvesd} onChange={set("dLvesd")} unit="cm" hint="(nl 2.1–4.0)" />
              <Field label="IVSd" value={data.dIvsd} onChange={set("dIvsd")} unit="cm" hint="(nl 0.6–1.0)" />
              <Field label="IVSs" value={data.dIvss} onChange={set("dIvss")} unit="cm" hint="(nl 0.7–1.1)" />
              <Field label="LVPWd" value={data.dLvpwd} onChange={set("dLvpwd")} unit="cm" hint="(nl 0.6–1.0)" />
              <Field label="LVPWs" value={data.dLvpws} onChange={set("dLvpws")} unit="cm" hint="(nl 0.9–1.4)" />
              <Field label="Aortic Root" value={data.dAoRoot} onChange={set("dAoRoot")} unit="cm" hint="(nl 2.0–3.7)" />
              <Field label="Sinuses of Valsalva" value={data.dSinusValsalva} onChange={set("dSinusValsalva")} unit="cm" />
              <Field label="Sinotubular Junction" value={data.dSinotubular} onChange={set("dSinotubular")} unit="cm" />
              <Field label="Aortic Annulus" value={data.dAoAnnulus} onChange={set("dAoAnnulus")} unit="cm" />
              <Field label="Ascending Aorta" value={data.dAscAorta} onChange={set("dAscAorta")} unit="cm" />
              <Field label="LA" value={data.dLa} onChange={set("dLa")} unit="cm" hint="(nl 3.0–4.0)" />
              <Field label="RA" value={data.dRa} onChange={set("dRa")} unit="cm" />
              <Field label="RA Diam Index" value={data.dRaIndex} onChange={set("dRaIndex")} unit="cm/m²" />
              <Field label="IVC" value={data.dIvc} onChange={set("dIvc")} unit="cm" />
              <Field label="LA Area" value={data.dLaArea} onChange={set("dLaArea")} unit="cm²" hint="(nl ≤20)" />
              <Field label="RA Area" value={data.dRaArea} onChange={set("dRaArea")} unit="cm²" />
              <Field label="LA Volume" value={data.dLaVolume} onChange={set("dLaVolume")} unit="mL" hint="(nl 18–58)" />
              <Field label="LA Volume Index" value={data.dLaVolumeIndex} onChange={set("dLaVolumeIndex")} unit="mL/m²" hint="(nl 16–28)" />
              <Field label="EF (2D)" value={data.dEf} onChange={set("dEf")} unit="%" hint="(nl ≥55)" />
              <Field label="Simpson's EF" value={data.dSimpsonsEf} onChange={set("dSimpsonsEf")} unit="%" />
              <Field label="Auto EF" value={data.dAutoEf} onChange={set("dAutoEf")} unit="%" />
              <Field label="Auto EDV" value={data.dAutoEdv} onChange={set("dAutoEdv")} unit="mL" />
              <Field label="Auto ESV" value={data.dAutoEsv} onChange={set("dAutoEsv")} unit="mL" />
              <Field label="FS" value={data.dFs} onChange={set("dFs")} unit="%" hint="(nl 25–43)" />
              <Field label="SV" value={data.dSv} onChange={set("dSv")} unit="mL" hint="(nl 70–100)" />
              <Field label="SI" value={data.dSi} onChange={set("dSi")} unit="mL/m²" />
              <Field label="CO" value={data.dCo} onChange={set("dCo")} unit="L/min" hint="(nl 4–8)" />
              <Field label="CI" value={data.dCi} onChange={set("dCi")} unit="L/min/m²" hint="(nl 2.4–4.2)" />
              <Field label="EDV" value={data.dEdv} onChange={set("dEdv")} unit="mL" hint="(nl 67–155)" />
              <Field label="Simpson's EDV" value={data.dSimpsonsEdv} onChange={set("dSimpsonsEdv")} unit="mL" />
              <Field label="EDV Index" value={data.dEdvIndex} onChange={set("dEdvIndex")} unit="mL/m²" hint="(nl 35–75)" />
              <Field label="ESV" value={data.dEsv} onChange={set("dEsv")} unit="mL" hint="(nl 22–58)" />
              <Field label="Simpson's ESV" value={data.dSimpsonsEsv} onChange={set("dSimpsonsEsv")} unit="mL" />
              <Field label="ESV Index" value={data.dEsvIndex} onChange={set("dEsvIndex")} unit="mL/m²" hint="(nl 12–30)" />
              <Field label="LV Mass" value={data.dLvMass} onChange={set("dLvMass")} unit="g" hint="(nl 88–224)" />
              <Field label="LV Mass Index" value={data.dLvMassIndex} onChange={set("dLvMassIndex")} unit="g/m²" hint="(nl 49–115)" />
              <Field label="LVOT Diameter" value={data.dLvotDiam} onChange={set("dLvotDiam")} unit="cm" />
              <Field label="MPA Diameter" value={data.dMpaDiam} onChange={set("dMpaDiam")} unit="cm" />
              <Field label="MAPSE" value={data.dMapse} onChange={set("dMapse")} unit="cm" />
              <Field label="Max TDI Delay" value={data.dTdiDelay} onChange={set("dTdiDelay")} unit="m/s" />
            </Section>

            {/* Mitral Valve */}
            <Section title="Mitral Valve" defaultOpen={false} comment={data.noteMv} onCommentChange={set("noteMv")}>
              <SelectField label="Regurgitation" value={data.mvRegurg} onChange={set("mvRegurg")} options={SEVERITY_OPTIONS} />
              <SelectField label="Stenosis" value={data.mvStenosis} onChange={set("mvStenosis")} options={SEVERITY_OPTIONS} />
              <Field label="Mitral PV" value={data.mvPeakVel} onChange={set("mvPeakVel")} unit="m/s" />
              <Field label="Mitral PG" value={data.mvPeakGrad} onChange={set("mvPeakGrad")} unit="mmHg" />
              <Field label="Mitral VTI" value={data.mvVti} onChange={set("mvVti")} unit="cm" />
              <Field label="Peak E" value={data.mvEVel} onChange={set("mvEVel")} unit="m/s" hint="(nl 0.6–1.3)" />
              <Field label="Peak E Gradient" value={data.mvEGrad} onChange={set("mvEGrad")} unit="mmHg" />
              <Field label="MV Mean Velocity" value={data.mvMeanVel} onChange={set("mvMeanVel")} unit="m/s" />
              <Field label="Mitral Mean Gradient" value={data.mvMeanGrad} onChange={set("mvMeanGrad")} unit="mmHg" />
              <Field label="Peak A" value={data.mvAVel} onChange={set("mvAVel")} unit="m/s" hint="(nl ≤0.7)" />
              <Field label="Peak A Gradient" value={data.mvAGrad} onChange={set("mvAGrad")} unit="mmHg" />
              <Field label="E/A Ratio" value={data.mvEaRatio} onChange={set("mvEaRatio")} hint="(nl 0.75–1.5)" />
              <Field label="e' Lateral" value={data.mvEPrimeLat} onChange={set("mvEPrimeLat")} unit="cm/s" hint="(nl ≥10)" />
              <Field label="e' Medial" value={data.mvEPrimeMed} onChange={set("mvEPrimeMed")} unit="cm/s" hint="(nl ≥10)" />
              <Field label="E/e' Lateral" value={data.mvEePrimeLat} onChange={set("mvEePrimeLat")} hint="(nl ≤8)" />
              <Field label="E/e' Medial" value={data.mvEePrimeMed} onChange={set("mvEePrimeMed")} hint="(nl ≤8)" />
              <Field label="A' Lateral" value={data.mvAPrimeLat} onChange={set("mvAPrimeLat")} unit="cm/s" />
              <Field label="A' Septal" value={data.mvAPrimeMed} onChange={set("mvAPrimeMed")} unit="cm/s" />
              <Field label="MR PISA Radius" value={data.mvPisaRadius} onChange={set("mvPisaRadius")} unit="cm" />
              <Field label="MR Aliasing Velocity" value={data.mvAliasingVel} onChange={set("mvAliasingVel")} unit="m/s" />
              <Field label="MR Peak Velocity" value={data.mvMrPeakVel} onChange={set("mvMrPeakVel")} unit="m/s" />
              <Field label="MR VTI" value={data.mvMrVti} onChange={set("mvMrVti")} />
              <Field label="ERO" value={data.mvEro} onChange={set("mvEro")} unit="cm²" />
              <Field label="PHT" value={data.mvPht} onChange={set("mvPht")} unit="ms" />
              <Field label="MVA" value={data.mvArea} onChange={set("mvArea")} unit="cm²" hint="(nl 4–6)" />
              <Field label="MVA by PHT" value={data.mvAreaPht} onChange={set("mvAreaPht")} unit="cm²" />
              <Field label="MVa Duration" value={data.mvADur} onChange={set("mvADur")} unit="ms" hint="(nl 122–170)" />
              <Field label="Deceleration Slope" value={data.mvDs} onChange={set("mvDs")} unit="cm/s" />
              <Field label="Deceleration Time (DT)" value={data.mvDt} onChange={set("mvDt")} unit="ms" hint="(nl ≤200)" />
              <Field label="MVA by VTI" value={data.mvAreaVti} onChange={set("mvAreaVti")} unit="cm²" />
              <Field label="PVa Duration" value={data.pvADur} onChange={set("pvADur")} unit="ms" />
              <Field label="PVa Velocity" value={data.pvAVel} onChange={set("pvAVel")} unit="m/s" />
              <Field label="PV Systolic Velocity" value={data.pvSysVel} onChange={set("pvSysVel")} unit="m/s" hint="(nl 0.40–0.80)" />
              <Field label="PV Diastolic Velocity" value={data.pvDiaVel} onChange={set("pvDiaVel")} unit="m/s" hint="(nl 0.30–0.60)" />
              <Field label="PV S/D Ratio" value={data.pvSdRatio} onChange={set("pvSdRatio")} hint="(nl 0.86–2.0)" />
              <Field label="Vp (Color M-Mode)" value={data.vpColorMMode} onChange={set("vpColorMMode")} unit="cm/s" />
              <Field label="IVRT" value={data.ivrt} onChange={set("ivrt")} unit="ms" />
            </Section>

            {/* Tricuspid Valve */}
            <Section title="Tricuspid Valve" defaultOpen={false} comment={data.noteTv} onCommentChange={set("noteTv")}>
              <SelectField label="Regurgitation" value={data.tvRegurg} onChange={set("tvRegurg")} options={SEVERITY_OPTIONS} />
              <Field label="Peak Velocity" value={data.tvPeakVel} onChange={set("tvPeakVel")} unit="m/s" hint="(nl 0.3–0.7)" />
              <Field label="Peak Gradient" value={data.tvPeakGrad} onChange={set("tvPeakGrad")} unit="mmHg" hint="(nl ≤2)" />
              <Field label="TR Peak Velocity" value={data.tvTrPeakVel} onChange={set("tvTrPeakVel")} unit="m/s" />
              <Field label="TR Peak Gradient" value={data.tvTrPeakGrad} onChange={set("tvTrPeakGrad")} unit="mmHg" />
              <Field label="TAPSE" value={data.tvTapse} onChange={set("tvTapse")} unit="cm" />
              <Field label="RAP" value={data.tvRap} onChange={set("tvRap")} unit="mmHg" hint="(nl 5–10)" />
              <Field label="RVSP" value={data.tvRvsp} onChange={set("tvRvsp")} unit="mmHg" hint="(nl ≤30)" />
              <Field label="Qp/Qs" value={data.tvQpQs} onChange={set("tvQpQs")} />
            </Section>

            {/* Aortic Valve */}
            <Section title="Aortic Valve" defaultOpen={false} comment={data.noteAv} onCommentChange={set("noteAv")}>
              <SelectField label="Regurgitation" value={data.avRegurg} onChange={set("avRegurg")} options={SEVERITY_OPTIONS} />
              <SelectField label="Stenosis" value={data.avStenosis} onChange={set("avStenosis")} options={SEVERITY_OPTIONS} />
              <Field label="AVA Planimetry" value={data.avaPlanimetry} onChange={set("avaPlanimetry")} unit="cm²" />
              <Field label="Peak Velocity" value={data.avPeakVel} onChange={set("avPeakVel")} unit="m/s" hint="(nl ≤2.5)" />
              <Field label="Peak Gradient" value={data.avPeakGrad} onChange={set("avPeakGrad")} unit="mmHg" hint="(nl ≤16)" />
              <Field label="Mean Velocity" value={data.avMeanVel} onChange={set("avMeanVel")} unit="m/s" />
              <Field label="Mean Gradient" value={data.avMeanGrad} onChange={set("avMeanGrad")} unit="mmHg" hint="(nl ≤5)" />
              <Field label="AV VTI" value={data.avVti} onChange={set("avVti")} unit="cm" />
              <Field label="AVA (by velocity)" value={data.avAreaVel} onChange={set("avAreaVel")} unit="cm²" hint="(nl 3–5)" />
              <Field label="AVA (by VTI)" value={data.avAreaVti} onChange={set("avAreaVti")} unit="cm²" hint="(nl 3–5)" />
              <Field label="AVA Index (BSA)" value={data.avAreaIndex} onChange={set("avAreaIndex")} unit="cm²/m²" />
              <Field label="AI PHT" value={data.avPht} onChange={set("avPht")} unit="ms" />
              <Field label="LVOT Peak Velocity" value={data.lvotPeakVel} onChange={set("lvotPeakVel")} unit="m/s" hint="(nl 0.7–1.1)" />
              <Field label="LVOT Peak Gradient" value={data.lvotPeakGrad} onChange={set("lvotPeakGrad")} unit="mmHg" />
              <Field label="LVOT VTI" value={data.lvotVti} onChange={set("lvotVti")} unit="cm" hint="(nl 18–22)" />
              <Field label="LVOT CO" value={data.lvotCo} onChange={set("lvotCo")} unit="L/min" hint="(nl 4–8)" />
              <Field label="LVOT SV" value={data.lvotSv} onChange={set("lvotSv")} unit="mL" hint="(nl 70–100)" />
              <Field label="Dimensionless Index" value={data.lvotDi} onChange={set("lvotDi")} />
            </Section>

            {/* Pulmonic Valve */}
            <Section title="Pulmonic Valve & RVOT" defaultOpen={false} comment={data.notePv} onCommentChange={set("notePv")}>
              <SelectField label="Regurgitation" value={data.pvRegurg} onChange={set("pvRegurg")} options={SEVERITY_OPTIONS} />
              <Field label="Peak Velocity" value={data.pvPeakVel} onChange={set("pvPeakVel")} unit="m/s" hint="(nl 0.6–0.9)" />
              <Field label="Peak Gradient" value={data.pvPeakGrad} onChange={set("pvPeakGrad")} unit="mmHg" hint="(nl ≤3)" />
              <Field label="Mean Gradient" value={data.pvMeanGrad} onChange={set("pvMeanGrad")} unit="mmHg" />
              <Field label="PV Accel Time" value={data.pvAccelTime} onChange={set("pvAccelTime")} unit="ms" />
              <Field label="PI End-Diastolic Velocity" value={data.pvPiedv} onChange={set("pvPiedv")} unit="m/s" />
              <Field label="RVOT Diameter" value={data.rvotDiam} onChange={set("rvotDiam")} unit="cm" />
              <Field label="RVOT VTI" value={data.rvotVti} onChange={set("rvotVti")} unit="cm" />
              <Field label="RVOT Peak Velocity" value={data.rvotPeakVel} onChange={set("rvotPeakVel")} unit="m/s" />
              <Field label="RVOT Peak Gradient" value={data.rvotPeakGrad} onChange={set("rvotPeakGrad")} unit="mmHg" />
              <Field label="Pulmonic Valve Area" value={data.pvArea} onChange={set("pvArea")} unit="cm²" />
              <Field label="PAEDP" value={data.paedp} onChange={set("paedp")} unit="mmHg" />
            </Section>

            {/* Physician Review */}
            <Section title="Physician Review — Findings by Chamber" defaultOpen={false} comment={data.notePhysician} onCommentChange={set("notePhysician")}>
              {([
                ["Left Ventricle", "findLv"],
                ["Left Atrium", "findLa"],
                ["Mitral Valve", "findMv"],
                ["Aortic Valve", "findAv"],
                ["Aorta", "findAorta"],
                ["Pericardium", "findPericardium"],
                ["Summary Findings", "findSummary"],
                ["Right Ventricle", "findRv"],
                ["Right Atrium", "findRa"],
                ["Tricuspid Valve", "findTv"],
                ["Pulmonic Valve", "findPv"],
                ["Pulmonary Artery", "findPa"],
                ["Diastolic Function", "findDiastolic"],
                ["Other / Additional Findings", "findOther"],
              ] as [string, keyof ReportData][]).map(([label, key]) => (
                <div key={key} className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <textarea value={data[key] as string} onChange={e => set(key)(e.target.value)}
                    rows={2} placeholder={`Enter ${label.toLowerCase()} findings...`}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] resize-none" />
                </div>
              ))}
            </Section>

            {/* Conclusions */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Conclusions
                <span className="ml-2 text-gray-400 font-normal text-[10px]">(leave blank to auto-generate from measurements)</span>
              </label>
              <textarea value={data.conclusions} onChange={e => set("conclusions")(e.target.value)}
                rows={5} placeholder="Leave blank for auto-generated conclusions based on entered measurements..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] resize-none" />
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setActiveTab("report")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                style={{ background: "#189aa1" }}>
                <FileText className="w-4 h-4" />
                View Report
              </button>
            </div>
          </div>
        ) : (
          /* Report Preview */
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, #189aa1, #0e7a80)" }}>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-white" />
                <h3 className="font-bold text-sm text-white" style={{ fontFamily: "Merriweather, serif" }}>Generated Report</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={printReport}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all">
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button onClick={downloadDocx}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all">
                  <FileDown className="w-3.5 h-3.5" />
                  .docx
                </button>
                <button onClick={downloadReport}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all">
                  <Download className="w-3.5 h-3.5" />
                  .txt
                </button>
                <button onClick={copyRichText}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all">
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  Copy Rich
                </button>
                <button onClick={copyReport}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all">
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div className="p-4">
              <RichReportEditor content={report} onChange={setRichHtml} />
            </div>
          </div>
        )}
        </div>
        </PremiumOverlay>
      </div>
    </Layout>
  );
}
