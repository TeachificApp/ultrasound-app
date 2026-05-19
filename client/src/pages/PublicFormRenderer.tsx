/**
 * PublicFormRenderer.tsx
 * Public-facing form renderer — no auth required.
 * Route: /forms/:slug  (full page)
 *        /forms/:slug/embed  (iframe-friendly, isEmbed=true)
 */
import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, AlertCircle, RefreshCw, Lock } from "lucide-react";

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
  // Layout
  layoutMode: "condensed" | "fullpage";
  stickyHeader: boolean;
  // Background
  bgType: "color" | "gradient" | "image";
  bgGradientFrom: string;
  bgGradientTo: string;
  bgGradientAngle: number;
  bgImageUrl: string;
  bgOpacity: number;
  // Card
  cardShadow: "none" | "sm" | "md" | "lg";
  cardBgOpacity: number;
  // Dropdown accent
  dropdownAccentColor: string;
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
};

function parseTheme(raw?: string | null): ThemeSettings {
  try { return { ...DEFAULT_THEME, ...JSON.parse(raw ?? "{}") }; }
  catch { return DEFAULT_THEME; }
}

// ─── Single field renderer ────────────────────────────────────────────────────
function FormField({
  item, options, value, onChange, theme, error,
}: {
  item: any; options: any[]; value: any;
  onChange: (v: any) => void; theme: ThemeSettings; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    border: `1px solid ${error ? "#ef4444" : focused ? theme.primaryColor : theme.borderColor}`,
    borderRadius: `${theme.borderRadius}px`,
    color: theme.textColor,
    fontSize: `${theme.fontSize}px`,
    fontFamily: theme.fontFamily,
    background: "#fff",
    width: "100%",
    padding: "8px 12px",
    outline: "none",
    boxSizing: "border-box",
    boxShadow: focused ? `0 0 0 2px ${theme.primaryColor}22` : "none",
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

  return (
    <div>
      <label style={{ display: "block", fontSize: parseInt(theme.fontSize) - 1, fontWeight: 500, marginBottom: 4, color: theme.labelColor }}>
        {item.label}
        {item.isRequired && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
      </label>
      {item.helpText && <p style={{ fontSize: parseInt(theme.fontSize) - 2, color: theme.textColor, opacity: 0.6, marginBottom: 6 }}>{item.helpText}</p>}

      {(item.itemType === "short_text") && (
        <input type="text" value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? ""} style={base} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {(item.itemType === "long_text") && (
        <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? ""} rows={4} style={{ ...base, resize: "vertical" }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {(item.itemType === "email") && (
        <input type="email" value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? "your@email.com"} style={base} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {(item.itemType === "phone") && (
        <input type="tel" value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? "+1 (555) 000-0000"} style={base} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {(item.itemType === "number") && (
        <input type="number" value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={item.placeholder ?? "0"} style={{ ...base, width: "auto", minWidth: 120 }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {(item.itemType === "date") && (
        <input type="date" value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ ...base, width: "auto" }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {(item.itemType === "time") && (
        <input type="time" value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ ...base, width: "auto" }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {(item.itemType === "dropdown") && (
        <>
          <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={base} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
            <option value="">— Select —</option>
            {options.map((o: any) => <option key={o.id} value={o.value}>{o.label}</option>)}
          </select>
          {/* Inject accent color for native select option:checked highlight */}
          <style>{`select option:checked { background: ${theme.dropdownAccentColor ?? theme.primaryColor} !important; color: #fff !important; }`}</style>
        </>
      )}
      {(item.itemType === "radio") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {options.map((o: any) => (
            <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="radio" name={`item-${item.id}`} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} style={{ accentColor: theme.primaryColor, width: 16, height: 16 }} />
              <span style={{ fontSize: parseInt(theme.fontSize), color: theme.textColor }}>{o.label}</span>
            </label>
          ))}
        </div>
      )}
      {(item.itemType === "checkbox") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {options.map((o: any) => {
            const checked = Array.isArray(value) ? value.includes(o.value) : false;
            return (
              <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={checked} onChange={e => {
                  const arr = Array.isArray(value) ? [...value] : [];
                  onChange(e.target.checked ? [...arr, o.value] : arr.filter((v: string) => v !== o.value));
                }} style={{ accentColor: theme.primaryColor, width: 16, height: 16 }} />
                <span style={{ fontSize: parseInt(theme.fontSize), color: theme.textColor }}>{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {(item.itemType === "yes_no") && (
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          {["Yes", "No"].map(opt => (
            <button key={opt} type="button" onClick={() => onChange(opt.toLowerCase())} style={{
              padding: "8px 24px", borderRadius: `${theme.borderRadius}px`,
              border: `2px solid ${value === opt.toLowerCase() ? theme.primaryColor : theme.borderColor}`,
              background: value === opt.toLowerCase() ? `${theme.primaryColor}18` : "#fff",
              color: value === opt.toLowerCase() ? theme.primaryColor : theme.textColor,
              fontWeight: value === opt.toLowerCase() ? 600 : 400,
              cursor: "pointer", fontSize: parseInt(theme.fontSize), transition: "all 0.15s",
            }}>{opt}</button>
          ))}
        </div>
      )}
      {(item.itemType === "rating") && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} type="button" onClick={() => onChange(star)} style={{
              fontSize: 28, background: "none", border: "none", cursor: "pointer",
              color: (value ?? 0) >= star ? "#f59e0b" : "#d1d5db", transition: "color 0.1s",
            }}>★</button>
          ))}
        </div>
      )}
      {(item.itemType === "scale") && (
        <div style={{ marginTop: 8 }}>
          <input type="range" min={1} max={10} value={value ?? 5} onChange={e => onChange(parseInt(e.target.value))} style={{ accentColor: theme.primaryColor, width: "100%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4, opacity: 0.6, color: theme.textColor }}>
            <span>1</span><span style={{ color: theme.primaryColor, fontWeight: 600 }}>{value ?? 5}</span><span>10</span>
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle style={{ width: 12, height: 12 }} />{error}
        </p>
      )}
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

  const [responses, setResponses] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submitMutation = trpc.generalForm.submitForm.useMutation({
    onSuccess: () => { setSubmitting(false); setSubmitted(true); },
    onError: (e) => { setSubmitting(false); setGlobalError(e.message); },
  });

  const theme = useMemo(() => parseTheme(data?.template?.themeSettings), [data?.template?.themeSettings]);

  const getOptions = (itemId: number) =>
    (data?.options ?? []).filter((o: any) => o.itemId === itemId).sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const hiddenIds = useMemo(() => {
    const hidden = new Set<number>();
    for (const rule of data?.branchRules ?? []) {
      try {
        const r = JSON.parse(rule.ruleJson ?? "{}");
        const tv = responses[r.triggerItemId?.toString()];
        const met = r.operator === "equals" ? tv === r.value
          : r.operator === "not_equals" ? tv !== r.value
          : r.operator === "contains" ? (Array.isArray(tv) ? tv.includes(r.value) : String(tv ?? "").includes(r.value))
          : false;
        if (!met && r.action === "show") hidden.add(r.targetItemId);
        if (met && r.action === "hide") hidden.add(r.targetItemId);
      } catch {}
    }
    return hidden;
  }, [data?.branchRules, responses]);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const item of data?.items ?? []) {
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

  const handleSubmit = () => {
    setGlobalError("");
    if (!validate()) return;
    setSubmitting(true);
    submitMutation.mutate({ templateId: data!.template.id, responses: JSON.stringify(responses) });
  };

  // ── States ──
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

  const { template, sections } = data;

  if (template.status === "closed") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: theme.backgroundColor, fontFamily: theme.fontFamily }}>
      <Lock style={{ width: 40, height: 40, color: "#9ca3af" }} />
      <p style={{ color: theme.textColor, fontWeight: 600, fontSize: 18 }}>This form is closed</p>
      <p style={{ color: "#9ca3af", fontSize: 14 }}>No longer accepting responses.</p>
    </div>
  );

  if (submitted) return (
    <div style={{ minHeight: isEmbed ? "auto" : "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, background: theme.backgroundColor, fontFamily: theme.fontFamily }}>
      <div style={{ background: theme.formBackground, borderRadius: `${parseInt(theme.borderRadius) + 4}px`, padding: "40px 32px", textAlign: "center", maxWidth: 480, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <CheckCircle2 style={{ width: 48, height: 48, color: theme.primaryColor, margin: "0 auto 16px" }} />
        <h2 style={{ color: theme.textColor, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Thank you!</h2>
        <p style={{ color: theme.textColor, opacity: 0.8, fontSize: parseInt(theme.fontSize) }}>
          {template.successMessage || "Your response has been submitted successfully."}
        </p>
      </div>
    </div>
  );

  // ── Derived style helpers ──
  const bgStyle: React.CSSProperties = (() => {
    if (theme.bgType === "gradient") {
      return { background: `linear-gradient(${theme.bgGradientAngle}deg, ${theme.bgGradientFrom}, ${theme.bgGradientTo})` };
    }
    if (theme.bgType === "image" && theme.bgImageUrl) {
      return {
        backgroundImage: `url(${theme.bgImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
    return { background: theme.backgroundColor };
  })();

  const cardShadowMap: Record<string, string> = {
    none: "none",
    sm: "0 1px 6px rgba(0,0,0,0.07)",
    md: "0 4px 20px rgba(0,0,0,0.10)",
    lg: "0 8px 40px rgba(0,0,0,0.16)",
  };
  const cardShadow = cardShadowMap[theme.cardShadow ?? "md"];

  const cardBg = (() => {
    const hex = theme.formBackground ?? "#f9fafb";
    const opacity = Math.round(((theme.cardBgOpacity ?? 100) / 100) * 255).toString(16).padStart(2, "0");
    return hex.startsWith("#") && hex.length === 7 ? hex + opacity : hex;
  })();

  const isFullPage = theme.layoutMode === "fullpage";

  // ── Main form ──
  return (
    <div style={{ minHeight: isEmbed ? "auto" : "100vh", fontFamily: theme.fontFamily, fontSize: `${theme.fontSize}px`, color: theme.textColor, position: "relative", ...bgStyle }}>
      {/* Background image opacity overlay */}
      {theme.bgType === "image" && theme.bgImageUrl && theme.bgOpacity < 100 && (
        <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 1 - (theme.bgOpacity / 100), pointerEvents: "none", zIndex: 0 }} />
      )}
      {/* Admin preview banner */}
      {isPreview && (
        <div style={{ background: "#fef3c7", borderBottom: "2px solid #f59e0b", padding: "8px 24px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#92400e", fontWeight: 500, position: "relative", zIndex: 1 }}>
          <span style={{ fontSize: 16 }}>&#128065;</span>
          Admin Preview — this form may not be publicly visible yet. Submissions made here are real.
        </div>
      )}
      {/* Header */}
      <div style={{
        background: theme.headerBackground,
        color: theme.headerTextColor,
        padding: "24px 32px",
        position: theme.stickyHeader && isFullPage ? "sticky" : "relative",
        top: 0,
        zIndex: 10,
      }}>
        {theme.showLogo && theme.logoUrl && <img src={theme.logoUrl} alt="Logo" style={{ height: 40, marginBottom: 12, objectFit: "contain" }} />}
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: theme.headerTextColor }}>{theme.headerTitle || template.name}</h1>
        {(theme.headerSubtitle || template.description) && (
          <p style={{ margin: "6px 0 0", opacity: 0.85, fontSize: parseInt(theme.fontSize) - 1, color: theme.headerTextColor }}>
            {theme.headerSubtitle || template.description}
          </p>
        )}
      </div>

      {/* Body */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: isFullPage ? "100%" : 680, margin: "0 auto", padding: isFullPage ? "32px 48px" : "32px 16px" }}>
        <div style={{ background: cardBg, borderRadius: isFullPage ? 0 : `${parseInt(theme.borderRadius) + 4}px`, padding: isFullPage ? "32px 0" : 32, boxShadow: isFullPage ? "none" : cardShadow }}>
          {sections.map((section: any) => {
            const items = (data.items ?? [])
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
                  {items.map((item: any) => (
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
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: "100%", padding: "12px 24px",
              background: submitting ? "#9ca3af" : theme.buttonColor,
              color: theme.buttonTextColor, border: "none",
              borderRadius: `${theme.borderRadius}px`,
              fontSize: parseInt(theme.fontSize), fontWeight: 600,
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
