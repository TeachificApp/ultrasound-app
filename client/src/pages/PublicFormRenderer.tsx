/**
 * PublicFormRenderer.tsx
 * Public-facing form renderer — no auth required.
 * Routes:
 *   /forms/:slug          (full page)
 *   /forms/:slug/embed    (iframe-friendly, isEmbed=true)
 *   /forms/:slug/preview  (admin preview, isPreview=true)
 *
 * Display modes (set in form Settings tab):
 *   classic   — single page with header (default, original behaviour)
 *   typeform  — welcome screen → page-by-page (one question per screen)
 *   paginated — page-by-page without welcome screen
 *   inline    — single page without header (embed-friendly)
 */
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, AlertCircle, RefreshCw, Lock, ArrowRight, ArrowLeft, ChevronDown } from "lucide-react";
import { RichTextDisplay } from "@/components/RichTextEditor";

// ─── Theme helpers ────────────────────────────────────────────────────────────
interface ThemeSettings {
  backgroundColor: string;
  formBackground: string;
  primaryColor: string;
  textColor: string;
  labelColor: string;
  borderColor: string;
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
  buttonColor: string;
  buttonTextColor: string;
  headerBackground: string;
  headerTextColor: string;
  showLogo: boolean;
  logoUrl: string;
  headerTitle: string;
  headerSubtitle: string;
  layoutMode: "condensed" | "fullpage";
  stickyHeader: boolean;
  bgType: "color" | "gradient" | "image" | "transparent";
  bgGradientFrom: string;
  bgGradientTo: string;
  bgGradientAngle: number;
  bgImageUrl: string;
  bgOpacity: number;
  cardShadow: "none" | "sm" | "md" | "lg";
  cardBgOpacity: number;
  dropdownAccentColor: string;
  // Welcome / Start page
  welcomeBgColor: string;
  welcomeTextColor: string;
  welcomeButtonColor: string;
  welcomeButtonTextColor: string;
  // Typeform page transition animation
  pageAnimation: "fade" | "slideUp" | "slideDown" | "slideLeft" | "slideRight" | "bounce" | "zoom" | "none";
}

const DEFAULT_THEME: ThemeSettings = {
  backgroundColor: "#ffffff",
  formBackground: "#f9fafb",
  primaryColor: "#0e7490",
  textColor: "#111827",
  labelColor: "#374151",
  borderColor: "#d1d5db",
  borderRadius: "8",
  fontFamily: "Inter, sans-serif",
  fontSize: "15",
  buttonColor: "#0e7490",
  buttonTextColor: "#ffffff",
  headerBackground: "#0e7490",
  headerTextColor: "#ffffff",
  showLogo: false,
  logoUrl: "",
  headerTitle: "",
  headerSubtitle: "",
  layoutMode: "condensed",
  stickyHeader: false,
  bgType: "color",
  bgGradientFrom: "#e0f7fa",
  bgGradientTo: "#ffffff",
  bgGradientAngle: 135,
  bgImageUrl: "",
  bgOpacity: 100,
  cardShadow: "md",
  cardBgOpacity: 100,
  dropdownAccentColor: "#1d6fa4",
  // Welcome / Start page
  welcomeBgColor: "#0e7490",
  welcomeTextColor: "#ffffff",
  welcomeButtonColor: "#ffffff",
  welcomeButtonTextColor: "#0e7490",
  // Typeform page transition animation
  pageAnimation: "slideUp",
};

function parseTheme(raw?: string | null): ThemeSettings {
  try { return { ...DEFAULT_THEME, ...JSON.parse(raw ?? "{}") }; }
  catch { return DEFAULT_THEME; }
}

function getBgStyle(theme: ThemeSettings): React.CSSProperties {
  if (theme.bgType === "transparent") return { background: "transparent" };
  if (theme.bgType === "gradient") {
    return { background: `linear-gradient(${theme.bgGradientAngle}deg, ${theme.bgGradientFrom}, ${theme.bgGradientTo})` };
  }
  if (theme.bgType === "image" && theme.bgImageUrl) {
    return { backgroundImage: `url(${theme.bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" };
  }
  return { background: theme.backgroundColor };
}

// ─── Single field renderer ────────────────────────────────────────────────────
function FormField({
  item, options, value, onChange, theme, error, autoFocus,
}: {
  item: any; options: any[]; value: any;
  onChange: (v: any) => void; theme: ThemeSettings; error?: string; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [autoFocus]);

  const base: React.CSSProperties = {
    border: `1px solid ${error ? "#ef4444" : focused ? theme.primaryColor : theme.borderColor}`,
    borderRadius: `${theme.borderRadius}px`,
    color: theme.textColor,
    fontSize: `${theme.fontSize}px`,
    fontFamily: theme.fontFamily,
    background: "#fff",
    width: "100%",
    padding: "10px 14px",
    outline: "none",
    boxSizing: "border-box",
    boxShadow: focused ? `0 0 0 3px ${theme.primaryColor}22` : "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  if (item.itemType === "section_break" || item.itemType === "rich_text") {
    return (
      <div className="py-2">
        <h3 style={{ color: theme.textColor, fontWeight: 600, fontSize: parseInt(theme.fontSize) + 1 }}>{item.label}</h3>
        {item.helpText && <p style={{ color: theme.textColor, opacity: 0.65, fontSize: parseInt(theme.fontSize) - 1, marginTop: 4 }}>{item.helpText}</p>}
      </div>
    );
  }

  if (item.itemType === "heading") {
    return <h2 style={{ color: theme.textColor, fontSize: parseInt(theme.fontSize) + 4, fontWeight: 700, margin: "8px 0 4px" }}>{item.label}</h2>;
  }
  if (item.itemType === "paragraph") {
    return <p style={{ color: theme.textColor, opacity: 0.8, fontSize: parseInt(theme.fontSize), lineHeight: 1.6, margin: "4px 0" }}>{item.label}</p>;
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: parseInt(theme.fontSize), fontWeight: 600, marginBottom: 6, color: theme.labelColor }}>
        {item.label}
        {item.isRequired && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
      </label>
      {item.helpText && <p style={{ fontSize: parseInt(theme.fontSize) - 2, color: theme.textColor, opacity: 0.6, marginBottom: 8 }}>{item.helpText}</p>}

      {item.itemType === "short_text" && (
        <input ref={inputRef as any} type="text" value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? ""} style={base} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {item.itemType === "long_text" && (
        <textarea ref={inputRef as any} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? ""} rows={4} style={{ ...base, resize: "vertical" }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {item.itemType === "email" && (
        <input ref={inputRef as any} type="email" value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? "your@email.com"} style={base} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {item.itemType === "phone" && (
        <input ref={inputRef as any} type="tel" value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? "+1 (555) 000-0000"} style={base} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {item.itemType === "number" && (
        <input ref={inputRef as any} type="number" value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? "0"} style={{ ...base, width: "auto", minWidth: 140 }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {item.itemType === "date" && (
        <input type="date" value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ ...base, width: "auto" }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {item.itemType === "time" && (
        <input type="time" value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ ...base, width: "auto" }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {item.itemType === "dropdown" && (
        <>
          <div style={{ position: "relative" }}>
            <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ ...base, appearance: "none", paddingRight: 36, cursor: "pointer" }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
              <option value="">— Select an option —</option>
              {options.map((o: any) => <option key={o.id} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: theme.textColor, opacity: 0.5, pointerEvents: "none" }} />
          </div>
          <style>{`select option:checked { background: ${theme.dropdownAccentColor ?? theme.primaryColor} !important; color: #fff !important; }`}</style>
        </>
      )}
      {item.itemType === "radio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          {options.map((o: any) => (
            <label key={o.id} onClick={() => onChange(o.value)} style={{
              display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              padding: "10px 14px", borderRadius: `${theme.borderRadius}px`,
              border: `2px solid ${value === o.value ? theme.primaryColor : theme.borderColor}`,
              background: value === o.value ? `${theme.primaryColor}12` : "#fff",
              transition: "all 0.12s",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${value === o.value ? theme.primaryColor : theme.borderColor}`,
                background: value === o.value ? theme.primaryColor : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {value === o.value && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <span style={{ fontSize: parseInt(theme.fontSize), color: theme.textColor, fontWeight: value === o.value ? 500 : 400 }}>{o.label}</span>
            </label>
          ))}
        </div>
      )}
      {item.itemType === "checkbox" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          {options.map((o: any) => {
            const checked = Array.isArray(value) ? value.includes(o.value) : false;
            return (
              <label key={o.id} onClick={() => {
                const arr = Array.isArray(value) ? [...value] : [];
                onChange(checked ? arr.filter((v: string) => v !== o.value) : [...arr, o.value]);
              }} style={{
                display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                padding: "10px 14px", borderRadius: `${theme.borderRadius}px`,
                border: `2px solid ${checked ? theme.primaryColor : theme.borderColor}`,
                background: checked ? `${theme.primaryColor}12` : "#fff",
                transition: "all 0.12s",
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${checked ? theme.primaryColor : theme.borderColor}`,
                  background: checked ? theme.primaryColor : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontSize: parseInt(theme.fontSize), color: theme.textColor, fontWeight: checked ? 500 : 400 }}>{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {item.itemType === "yes_no" && (
        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
          {["Yes", "No"].map(opt => (
            <button key={opt} type="button" onClick={() => onChange(opt.toLowerCase())} style={{
              padding: "10px 32px", borderRadius: `${theme.borderRadius}px`,
              border: `2px solid ${value === opt.toLowerCase() ? theme.primaryColor : theme.borderColor}`,
              background: value === opt.toLowerCase() ? `${theme.primaryColor}18` : "#fff",
              color: value === opt.toLowerCase() ? theme.primaryColor : theme.textColor,
              fontWeight: value === opt.toLowerCase() ? 600 : 400,
              cursor: "pointer", fontSize: parseInt(theme.fontSize), transition: "all 0.15s",
            }}>{opt}</button>
          ))}
        </div>
      )}
      {item.itemType === "rating" && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} type="button" onClick={() => onChange(star)} style={{
              fontSize: 32, background: "none", border: "none", cursor: "pointer",
              color: (value ?? 0) >= star ? "#f59e0b" : "#d1d5db", transition: "color 0.1s",
            }}>★</button>
          ))}
        </div>
      )}
      {item.itemType === "scale" && (
        <div style={{ marginTop: 10 }}>
          <input type="range" min={1} max={10} value={value ?? 5} onChange={e => onChange(parseInt(e.target.value))} style={{ accentColor: theme.primaryColor, width: "100%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4, opacity: 0.6, color: theme.textColor }}>
            <span>1</span><span style={{ color: theme.primaryColor, fontWeight: 600 }}>{value ?? 5}</span><span>10</span>
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle style={{ width: 12, height: 12 }} />{error}
        </p>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ current, total, theme }: { current: number; total: number; theme: ThemeSettings }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 4, background: `${theme.primaryColor}22` }}>
      <div style={{ height: "100%", background: theme.primaryColor, width: `${pct}%`, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────
function WelcomeScreen({ template, theme, onStart }: { template: any; theme: ThemeSettings; onStart: () => void }) {
  const bgStyle = getBgStyle(theme);
  const title = template.welcomeTitle || theme.headerTitle || template.name;
  const subtitle = template.welcomeSubtitle || theme.headerSubtitle || template.description;
  const btnText = template.welcomeButtonText || "Start";

  // Use welcome-specific colors, falling back to form colors if not set
  const wBg = theme.welcomeBgColor || theme.backgroundColor;
  const wText = theme.welcomeTextColor || theme.textColor;
  const wBtn = theme.welcomeButtonColor || theme.buttonColor;
  const wBtnText = theme.welcomeButtonTextColor || theme.buttonTextColor;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", fontFamily: theme.fontFamily, background: wBg }}>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 640, width: "100%", textAlign: "center" }}>
        {theme.showLogo && theme.logoUrl && (
          <img src={theme.logoUrl} alt="Logo" style={{ height: 56, marginBottom: 32, objectFit: "contain", display: "block", margin: "0 auto 32px" }} />
        )}
        {template.welcomeImageUrl && (
          <img src={template.welcomeImageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain", display: "block", margin: "0 auto 32px", borderRadius: `${parseInt(theme.borderRadius) + 4}px` }} />
        )}
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, color: wText, lineHeight: 1.15, marginBottom: 16 }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: wText, opacity: 0.85, lineHeight: 1.6, marginBottom: 40 }}>{subtitle}</p>
        )}
        <button onClick={onStart} style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "14px 36px", borderRadius: `${theme.borderRadius}px`,
          background: wBtn, color: wBtnText,
          border: "none", fontSize: parseInt(theme.fontSize) + 1, fontWeight: 700,
          cursor: "pointer", fontFamily: theme.fontFamily,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          transition: "transform 0.1s, box-shadow 0.1s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)"; }}
        >
          {btnText} <ArrowRight style={{ width: 18, height: 18 }} />
        </button>
        <p style={{ fontSize: 12, color: wText, opacity: 0.4, marginTop: 24 }}>Press Enter ↵ to continue</p>
      </div>
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── Page animation helper ──────────────────────────────────────────────────
type PageAnim = ThemeSettings["pageAnimation"];

function getPageAnimStyle(anim: PageAnim, animating: boolean, direction: "forward" | "back"): React.CSSProperties {
  const dur = "0.32s";
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  if (anim === "none") return {};
  if (anim === "fade") return {
    opacity: animating ? 0 : 1,
    transition: `opacity ${dur} ${ease}`,
  };
  if (anim === "slideUp") return {
    opacity: animating ? 0 : 1,
    transform: animating ? (direction === "forward" ? "translateY(28px)" : "translateY(-28px)") : "translateY(0)",
    transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
  };
  if (anim === "slideDown") return {
    opacity: animating ? 0 : 1,
    transform: animating ? (direction === "forward" ? "translateY(-28px)" : "translateY(28px)") : "translateY(0)",
    transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
  };
  if (anim === "slideLeft") return {
    opacity: animating ? 0 : 1,
    transform: animating ? (direction === "forward" ? "translateX(40px)" : "translateX(-40px)") : "translateX(0)",
    transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
  };
  if (anim === "slideRight") return {
    opacity: animating ? 0 : 1,
    transform: animating ? (direction === "forward" ? "translateX(-40px)" : "translateX(40px)") : "translateX(0)",
    transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
  };
  if (anim === "zoom") return {
    opacity: animating ? 0 : 1,
    transform: animating ? (direction === "forward" ? "scale(0.88)" : "scale(1.08)") : "scale(1)",
    transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
  };
  if (anim === "bounce") return {
    opacity: animating ? 0 : 1,
    transform: animating ? "translateY(20px)" : "translateY(0)",
    transition: animating ? `opacity 0.18s ease, transform 0.18s ease` : `opacity 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)`,
  };
  // fallback
  return {
    opacity: animating ? 0 : 1,
    transition: `opacity ${dur} ${ease}`,
  };
}

// ─── Page-by-page renderer ────────────────────────────────────────────────────
function PageByPageRenderer({
  template, items, sections, options, branchRules, theme, isEmbed, isPreview, onSubmit, submitting, globalError,
}: {
  template: any; items: any[]; sections: any[]; options: any[]; branchRules: any[];
  theme: ThemeSettings; isEmbed: boolean; isPreview: boolean;
  onSubmit: (responses: Record<string, any>) => void;
  submitting: boolean; globalError: string;
}) {
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fieldError, setFieldError] = useState("");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hiddenIds = useMemo(() => {
    const hidden = new Set<number>();
    for (const rule of branchRules ?? []) {
      if (!rule.isEnabled) continue;
      try {
        const conditions: Array<{fieldId?: string; itemId?: number; operator: string; value: string}> = JSON.parse(rule.conditions ?? "[]");
        if (!conditions.length) continue;
        const results = conditions.map((c: any) => {
          const key = c.fieldId != null ? String(c.fieldId) : String(c.itemId ?? "");
          const tv = responses[key];
          const strVal = String(tv ?? "");
          const numVal = parseFloat(strVal);
          if (c.operator === "equals") return Array.isArray(tv) ? tv.includes(c.value) : strVal === c.value;
          if (c.operator === "not_equals") return Array.isArray(tv) ? !tv.includes(c.value) : strVal !== c.value;
          if (c.operator === "contains") return Array.isArray(tv) ? tv.includes(c.value) : strVal.toLowerCase().includes(c.value.toLowerCase());
          if (c.operator === "not_contains") return Array.isArray(tv) ? !tv.includes(c.value) : !strVal.toLowerCase().includes(c.value.toLowerCase());
          if (c.operator === "starts_with") return strVal.toLowerCase().startsWith(c.value.toLowerCase());
          if (c.operator === "is_empty") return !tv || (Array.isArray(tv) ? !tv.length : strVal === "");
          if (c.operator === "is_not_empty") return !!(tv && (Array.isArray(tv) ? tv.length : strVal !== ""));
          if (c.operator === "greater_than") return !isNaN(numVal) && numVal > parseFloat(c.value);
          if (c.operator === "less_than") return !isNaN(numVal) && numVal < parseFloat(c.value);
          return false;
        });
        const met = rule.logicOperator === "all" ? results.every(Boolean) : results.some(Boolean);
        if (!met && rule.action === "show") hidden.add(rule.targetId);
        if (met && rule.action === "hide") hidden.add(rule.targetId);
      } catch {}
    }
    return hidden;
  }, [branchRules, responses]);

  // Filter to answerable items (skip headings/paragraphs for navigation, but show them inline)
  const visibleItems = useMemo(() =>
    items.filter(i => !hiddenIds.has(i.id)).sort((a, b) => a.sortOrder - b.sortOrder),
    [items, hiddenIds]
  );

  // Group all items in the same section onto one page (one section = one page).
  // Falls back to one-question-per-page if no sections are provided.
  const pages = useMemo(() => {
    if (sections && sections.length > 0) {
      const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
      const result: any[][] = [];
      for (const section of sortedSections) {
        const sectionItems = visibleItems
          .filter(i => i.sectionId === section.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (sectionItems.length > 0) result.push(sectionItems);
      }
      // Safety net: orphan items with no matching section
      const assignedIds = new Set(result.flat().map(i => i.id));
      const orphans = visibleItems.filter(i => !assignedIds.has(i.id));
      if (orphans.length > 0) result.push(orphans);
      return result;
    }
    // Legacy fallback: one question per page
    const result: any[][] = [];
    let pending: any[] = [];
    for (const item of visibleItems) {
      if (item.itemType === "heading" || item.itemType === "paragraph" || item.itemType === "section_break" || item.itemType === "rich_text") {
        pending.push(item);
      } else {
        result.push([...pending, item]);
        pending = [];
      }
    }
    if (pending.length > 0) result.push(pending);
    return result;
  }, [visibleItems, sections]);

  const currentPage = pages[currentIdx];
  // All answerable questions on the current page (for multi-question-per-page validation)
  const currentQuestions = (currentPage ?? []).filter(i => !["heading", "paragraph", "section_break", "rich_text"].includes(i.itemType));
  const currentQuestion = currentQuestions[0];
  const isLast = currentIdx === pages.length - 1;
  const getOptions = (itemId: number) => (options ?? []).filter((o: any) => o.itemId === itemId).sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const validate = () => {
    // Validate all required questions on the current page
    for (const q of currentQuestions) {
      if (q.isRequired) {
        const v = responses[q.id.toString()];
        if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) {
          setFieldError("Please answer all required fields before continuing");
          return false;
        }
      }
    }
    setFieldError("");
    return true;
  };

  const goNext = useCallback(() => {
    if (!validate()) return;
    if (isLast) {
      onSubmit(responses);
      return;
    }
    setDirection("forward");
    setAnimating(true);
    setTimeout(() => {
      setCurrentIdx(i => i + 1);
      setFieldError("");
      setAnimating(false);
    }, 180);
  }, [currentIdx, isLast, responses, validate]);

  const goBack = useCallback(() => {
    if (currentIdx === 0) return;
    setDirection("back");
    setAnimating(true);
    setTimeout(() => {
      setCurrentIdx(i => i - 1);
      setFieldError("");
      setAnimating(false);
    }, 180);
  }, [currentIdx]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "TEXTAREA") return; // allow newlines in textarea
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext]);

  const bgStyle = getBgStyle(theme);

  return (
    <div ref={containerRef} style={{ minHeight: "100vh", fontFamily: theme.fontFamily, fontSize: `${theme.fontSize}px`, color: theme.textColor, position: "relative", display: "flex", flexDirection: "column", ...bgStyle }}>
      {theme.bgType === "image" && theme.bgImageUrl && theme.bgOpacity < 100 && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", opacity: 1 - (theme.bgOpacity / 100), pointerEvents: "none", zIndex: 0 }} />
      )}
      <ProgressBar current={currentIdx} total={pages.length} theme={theme} />

      {isPreview && (
        <div style={{ background: "#fef3c7", borderBottom: "2px solid #f59e0b", padding: "8px 24px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#92400e", fontWeight: 500, position: "relative", zIndex: 1 }}>
          <span style={{ fontSize: 16 }}>&#128065;</span>
          Admin Preview — submissions made here are real.
        </div>
      )}

      {/* Question area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px 100px", position: "relative", zIndex: 1 }}>
        <div style={{
          maxWidth: 640, width: "100%",
          ...getPageAnimStyle(theme.pageAnimation ?? "slideUp", animating, direction),
        }}>
          {/* Question number */}
          {currentQuestion && (
            <div style={{ fontSize: 13, color: theme.primaryColor, fontWeight: 600, marginBottom: 12, opacity: 0.8 }}>
              {currentIdx + 1} / {pages.length}
            </div>
          )}

          {/* Items on this page */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {currentPage?.map((item: any) => (
              <FormField
                key={item.id}
                item={item}
                options={getOptions(item.id)}
                value={responses[item.id.toString()]}
                onChange={v => {
                  setResponses(r => ({ ...r, [item.id.toString()]: v }));
                  setFieldError("");
                }}
                theme={theme}
                error={item.id === currentQuestion?.id ? fieldError : undefined}
                autoFocus={item.id === currentQuestion?.id}
              />
            ))}
          </div>

          {/* Global error */}
          {globalError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: `${theme.borderRadius}px`, padding: "12px 16px", marginTop: 16, color: "#dc2626", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />{globalError}
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={goNext}
              disabled={submitting}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 28px", borderRadius: `${theme.borderRadius}px`,
                background: submitting ? "#9ca3af" : theme.buttonColor,
                color: theme.buttonTextColor, border: "none",
                fontSize: parseInt(theme.fontSize), fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: theme.fontFamily, transition: "opacity 0.15s",
              }}
            >
              {submitting && <RefreshCw style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />}
              {isLast ? (template.submitButtonText || "Submit") : "OK"}
              {!isLast && !submitting && <ArrowRight style={{ width: 16, height: 16 }} />}
            </button>
            {!isLast && (
              <span style={{ fontSize: 12, color: theme.textColor, opacity: 0.45 }}>press <strong>Enter ↵</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "flex-end", padding: "12px 24px", gap: 8, background: "transparent" }}>
        <button
          onClick={goBack}
          disabled={currentIdx === 0}
          style={{
            width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.borderColor}`,
            background: "#fff", cursor: currentIdx === 0 ? "not-allowed" : "pointer",
            opacity: currentIdx === 0 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16, color: theme.textColor }} />
        </button>
        <button
          onClick={goNext}
          disabled={submitting}
          style={{
            width: 36, height: 36, borderRadius: 8, border: "none",
            background: theme.primaryColor, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ArrowRight style={{ width: 16, height: 16, color: "#fff" }} />
        </button>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Classic / Inline renderer (single page) ─────────────────────────────────
function ClassicRenderer({
  template, sections, items, options, branchRules, theme, isEmbed, isPreview, showHeader,
  onSubmit, submitting, globalError,
}: {
  template: any; sections: any[]; items: any[]; options: any[]; branchRules: any[];
  theme: ThemeSettings; isEmbed: boolean; isPreview: boolean; showHeader: boolean;
  onSubmit: (responses: Record<string, any>) => void;
  submitting: boolean; globalError: string;
}) {
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hiddenIds = useMemo(() => {
    const hidden = new Set<number>();
    for (const rule of branchRules ?? []) {
      if (!rule.isEnabled) continue;
      try {
        const conditions: Array<{fieldId?: string; itemId?: number; operator: string; value: string}> = JSON.parse(rule.conditions ?? "[]");
        if (!conditions.length) continue;
        const results = conditions.map((c: any) => {
          // Support both fieldId (new) and itemId (legacy)
          const key = c.fieldId != null ? String(c.fieldId) : String(c.itemId ?? "");
          const tv = responses[key];
          const strVal = String(tv ?? "");
          const numVal = parseFloat(strVal);
          if (c.operator === "equals") return Array.isArray(tv) ? tv.includes(c.value) : strVal === c.value;
          if (c.operator === "not_equals") return Array.isArray(tv) ? !tv.includes(c.value) : strVal !== c.value;
          if (c.operator === "contains") return Array.isArray(tv) ? tv.includes(c.value) : strVal.toLowerCase().includes(c.value.toLowerCase());
          if (c.operator === "not_contains") return Array.isArray(tv) ? !tv.includes(c.value) : !strVal.toLowerCase().includes(c.value.toLowerCase());
          if (c.operator === "starts_with") return strVal.toLowerCase().startsWith(c.value.toLowerCase());
          if (c.operator === "is_empty") return !tv || (Array.isArray(tv) ? !tv.length : strVal === "");
          if (c.operator === "is_not_empty") return !!(tv && (Array.isArray(tv) ? tv.length : strVal !== ""));
          if (c.operator === "greater_than") return !isNaN(numVal) && numVal > parseFloat(c.value);
          if (c.operator === "less_than") return !isNaN(numVal) && numVal < parseFloat(c.value);
          return false;
        });
        const met = rule.logicOperator === "all" ? results.every(Boolean) : results.some(Boolean);
        if (!met && rule.action === "show") hidden.add(rule.targetId);
        if (met && rule.action === "hide") hidden.add(rule.targetId);
      } catch {}
    }
    return hidden;
  }, [branchRules, responses]);

  const getOptions = (itemId: number) => (options ?? []).filter((o: any) => o.itemId === itemId).sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const item of items ?? []) {
      if (hiddenIds.has(item.id)) continue;
      if (item.isRequired) {
        const v = responses[item.id.toString()];
        if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length))
          errs[item.id.toString()] = "This field is required";
      }
    }
    setFieldErrors(errs);
    return !Object.keys(errs).length;
  };

  const bgStyle = getBgStyle(theme);
  const cardShadowMap: Record<string, string> = { none: "none", sm: "0 1px 6px rgba(0,0,0,0.07)", md: "0 4px 20px rgba(0,0,0,0.10)", lg: "0 8px 40px rgba(0,0,0,0.16)" };
  const cardShadow = cardShadowMap[theme.cardShadow ?? "md"];
  const hex = theme.formBackground ?? "#f9fafb";
  const opacity = Math.round(((theme.cardBgOpacity ?? 100) / 100) * 255).toString(16).padStart(2, "0");
  const cardBg = hex.startsWith("#") && hex.length === 7 ? hex + opacity : hex;
  const isFullPage = theme.layoutMode === "fullpage";

  return (
    <div style={{ minHeight: isEmbed ? "auto" : "100vh", fontFamily: theme.fontFamily, fontSize: `${theme.fontSize}px`, color: theme.textColor, position: "relative", ...bgStyle }}>
      {theme.bgType === "image" && theme.bgImageUrl && theme.bgOpacity < 100 && (
        <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 1 - (theme.bgOpacity / 100), pointerEvents: "none", zIndex: 0 }} />
      )}
      {isPreview && (
        <div style={{ background: "#fef3c7", borderBottom: "2px solid #f59e0b", padding: "8px 24px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#92400e", fontWeight: 500, position: "relative", zIndex: 1 }}>
          <span style={{ fontSize: 16 }}>&#128065;</span>
          Admin Preview — submissions made here are real.
        </div>
      )}

      {showHeader && (
        <div style={{
          background: theme.headerBackground, color: theme.headerTextColor,
          padding: "24px 32px",
          position: theme.stickyHeader && isFullPage ? "sticky" : "relative",
          top: 0, zIndex: 10,
        }}>
          {theme.showLogo && theme.logoUrl && <img src={theme.logoUrl} alt="Logo" style={{ height: 40, marginBottom: 12, objectFit: "contain" }} />}
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: theme.headerTextColor }}>{theme.headerTitle || template.name}</h1>
          {(theme.headerSubtitle || template.description) && (
            <p style={{ margin: "6px 0 0", opacity: 0.85, fontSize: parseInt(theme.fontSize) - 1, color: theme.headerTextColor }}>
              {theme.headerSubtitle || template.description}
            </p>
          )}
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: isFullPage ? "100%" : 680, margin: "0 auto", padding: isFullPage ? "32px 48px" : "32px 16px" }}>
        <div style={{ background: cardBg, borderRadius: isFullPage ? 0 : `${parseInt(theme.borderRadius) + 4}px`, padding: isFullPage ? "32px 0" : 32, boxShadow: isFullPage ? "none" : cardShadow }}>
          {sections.map((section: any) => {
            const sectionItems = (items ?? [])
              .filter((i: any) => i.sectionId === section.id && !hiddenIds.has(i.id))
              .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
            return (
              <div key={section.id} style={{ marginBottom: 28 }}>
                {sections.length > 1 && (
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ fontSize: parseInt(theme.fontSize) + 2, fontWeight: 700, color: theme.textColor, margin: "0 0 4px" }}>{section.title}</h2>
                    {section.description && <p style={{ fontSize: parseInt(theme.fontSize) - 1, color: theme.textColor, opacity: 0.65, margin: 0 }}>{section.description}</p>}
                    <hr style={{ border: "none", borderTop: `1px solid ${theme.borderColor}`, marginTop: 10 }} />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {sectionItems.map((item: any) => (
                    <FormField
                      key={item.id}
                      item={item}
                      options={getOptions(item.id)}
                      value={responses[item.id.toString()]}
                      onChange={v => {
                        setResponses(r => ({ ...r, [item.id.toString()]: v }));
                        if (fieldErrors[item.id.toString()]) setFieldErrors(e => { const n = { ...e }; delete n[item.id.toString()]; return n; });
                      }}
                      theme={theme}
                      error={fieldErrors[item.id.toString()]}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {globalError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: `${theme.borderRadius}px`, padding: "12px 16px", marginBottom: 16, color: "#dc2626", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />{globalError}
            </div>
          )}

          <button
            onClick={() => { if (validate()) onSubmit(responses); }}
            disabled={submitting}
            style={{
              width: "100%", padding: "13px 24px",
              background: submitting ? "#9ca3af" : theme.buttonColor,
              color: theme.buttonTextColor, border: "none",
              borderRadius: `${theme.borderRadius}px`,
              fontSize: parseInt(theme.fontSize), fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "opacity 0.15s", fontFamily: theme.fontFamily, marginTop: 8,
            }}
          >
            {submitting && <RefreshCw style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
            {submitting ? "Submitting…" : (template.submitButtonText || "Submit")}
          </button>
        </div>

        {!isEmbed && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 24 }}>
            Powered by UltrasoundAssist™
          </p>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PublicFormRenderer({ isEmbed = false, isPreview = false }: { isEmbed?: boolean; isPreview?: boolean }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";

  const publicQuery = trpc.generalForm.getPublicForm.useQuery(
    { slug },
    { enabled: !!slug && !isPreview, retry: false }
  );
  const previewQuery = trpc.generalForm.getFormPreview.useQuery(
    { slug },
    { enabled: !!slug && isPreview, retry: false }
  );
  const { data, isLoading, error } = isPreview ? previewQuery : publicQuery;

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);

  const submitMutation = trpc.generalForm.submitForm.useMutation({
    onSuccess: () => { setSubmitting(false); setSubmitted(true); },
    onError: (e) => { setSubmitting(false); setGlobalError(e.message); },
  });

  const theme = useMemo(() => parseTheme(data?.template?.themeSettings), [data?.template?.themeSettings]);
  const displayMode: "classic" | "typeform" | "paginated" | "inline" = (data?.template?.displayMode as any) ?? "classic";

  const handleSubmit = (responses: Record<string, any>) => {
    setGlobalError("");
    setSubmitting(true);
    submitMutation.mutate({ templateId: data!.template.id, responses: JSON.stringify(responses) });
  };

  // ── Loading ──
  if (isLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <RefreshCw style={{ width: 28, height: 28, color: "#9ca3af", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#f9fafb" }}>
      <AlertCircle style={{ width: 40, height: 40, color: "#ef4444" }} />
      <p style={{ color: "#374151", fontWeight: 600 }}>Form not found</p>
      <p style={{ color: "#9ca3af", fontSize: 14 }}>This form may be private or the link is incorrect.</p>
    </div>
  );

  const { template, sections, items, options, branchRules } = data;

  if (template.status === "closed") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, ...getBgStyle(theme), fontFamily: theme.fontFamily }}>
      <Lock style={{ width: 40, height: 40, color: "#9ca3af" }} />
      <p style={{ color: theme.textColor, fontWeight: 600, fontSize: 18 }}>This form is closed</p>
      <p style={{ color: "#9ca3af", fontSize: 14 }}>No longer accepting responses.</p>
    </div>
  );

  if (submitted) {
    const bgStyle = getBgStyle(theme);
    if (template.successRedirectUrl) {
      window.location.href = template.successRedirectUrl;
      return null;
    }
    return (
      <div style={{ minHeight: isEmbed ? "auto" : "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: theme.fontFamily, ...bgStyle }}>
        <div style={{ background: theme.formBackground, borderRadius: `${parseInt(theme.borderRadius) + 4}px`, padding: "48px 40px", textAlign: "center", maxWidth: 480, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          <CheckCircle2 style={{ width: 52, height: 52, color: theme.primaryColor, margin: "0 auto 20px" }} />
          <h2 style={{ color: theme.textColor, fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Thank you!</h2>
          {template.successMessage && template.successMessage.trim().startsWith("<") ? (
            <div style={{ color: theme.textColor, opacity: 0.85, fontSize: parseInt(theme.fontSize), textAlign: "left" }}>
              <RichTextDisplay html={template.successMessage} />
            </div>
          ) : (
            <p style={{ color: theme.textColor, opacity: 0.8, fontSize: parseInt(theme.fontSize) }}>
              {template.successMessage || "Your response has been submitted successfully."}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Welcome screen (typeform mode only) ──
  if (displayMode === "typeform" && showWelcome) {
    return <WelcomeScreen template={template} theme={theme} onStart={() => setShowWelcome(false)} />;
  }

  // ── Page-by-page modes ──
  if (displayMode === "typeform" || displayMode === "paginated") {
    return (
      <PageByPageRenderer
        template={template}
        items={items}
        sections={sections}
        options={options}
        branchRules={branchRules}
        theme={theme}
        isEmbed={isEmbed}
        isPreview={isPreview}
        onSubmit={handleSubmit}
        submitting={submitting}
        globalError={globalError}
      />
    );
  }

  // ── Classic / Inline (single page) ──
  return (
    <ClassicRenderer
      template={template}
      sections={sections}
      items={items}
      options={options}
      branchRules={branchRules}
      theme={theme}
      isEmbed={isEmbed}
      isPreview={isPreview}
      showHeader={displayMode !== "inline"}
      onSubmit={handleSubmit}
      submitting={submitting}
      globalError={globalError}
    />
  );
}
