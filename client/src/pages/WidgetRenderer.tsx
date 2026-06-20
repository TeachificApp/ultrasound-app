import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Card {
  id: number;
  slug: string | null;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  type: string;
  price: number | null;
  isFree: boolean;
  pricingType: string | null;
  subscriptionInterval: string | null;
  currency: string | null;
  brand: string | null;
  itemType: string;
  // Course details (workshops/cohorts) — present when showCourseDetails is enabled
  nextInstanceDate?: Date | string | null;
  nextInstanceEndDate?: Date | string | null;
  locationType?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  venueState?: string | null;
  timezone?: string | null;
  enrollmentCloseDate?: Date | string | null;
  // Cohort group info
  cohortGroupName?: string | null;
  cohortGroupStartDate?: Date | string | null;
  cohortGroupEndDate?: Date | string | null;
}

interface WidgetConfig {
  id: number;
  name: string;
  title: string | null;
  subtitle: string | null;
  layout: "grid" | "carousel" | "list";
  theme: "light" | "dark" | "brand";
  cardStyle: "standard" | "compact" | "minimal";
  showPrice: boolean;
  showEnrollButton: boolean;
  showCourseDetails: boolean;
  buttonText: string | null;
  buttonUrl: string | null;
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const THEMES = {
  light: {
    bg: "#ffffff",
    cardBg: "#f8fafc",
    cardBorder: "#e2e8f0",
    text: "#0f172a",
    subtext: "#64748b",
    accent: "#179ca3",
    accentHover: "#0e8a91",
    btnText: "#ffffff",
    priceColor: "#179ca3",
    shadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  dark: {
    bg: "#0f172a",
    cardBg: "#1e293b",
    cardBorder: "#334155",
    text: "#f1f5f9",
    subtext: "#94a3b8",
    accent: "#179ca3",
    accentHover: "#0e8a91",
    btnText: "#ffffff",
    priceColor: "#4ad9e0",
    shadow: "0 1px 3px rgba(0,0,0,0.4)",
  },
  brand: {
    bg: "#f0fdfa",
    cardBg: "#ffffff",
    cardBorder: "#99f6e4",
    text: "#134e4a",
    subtext: "#0f766e",
    accent: "#179ca3",
    accentHover: "#0e8a91",
    btnText: "#ffffff",
    priceColor: "#179ca3",
    shadow: "0 1px 3px rgba(23,156,163,0.12)",
  },
};

// ─── Price formatter ──────────────────────────────────────────────────────────

const INTERVAL_LABEL: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr" };
function formatPrice(card: Card): string {
  if (card.isFree || card.pricingType === "free") return "Free";
  if (!card.price) return "Free";
  const currency = card.currency?.toUpperCase() ?? "USD";
  const base = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(card.price);
  if (card.pricingType === "subscription") return base + (INTERVAL_LABEL[card.subscriptionInterval ?? "monthly"] ?? "/mo");
  if (card.pricingType === "payment_plan") return base + " (plan)";
  return base;
}

// ─── Product type metadata ───────────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  course: "🎓", quiz: "📝", cohort: "🗓️", download: "📥", bundle: "📦",
  webinar: "🎤️", membership: "⭐", physical: "🛒", workshop: "🛠️", community: "👥",
};
const TYPE_LABEL: Record<string, string> = {
  course: "Course", quiz: "Quiz", cohort: "Cohort", download: "Download", bundle: "Bundle",
  webinar: "Webinar", membership: "Membership", physical: "Product", workshop: "Workshop", community: "Community",
};
function typeEmoji(t: string) { return TYPE_EMOJI[t] ?? "📄"; }
function typeLabel(t: string) { return TYPE_LABEL[t] ?? t; }

// ─── Course URL builder ───────────────────────────────────────────────────────

function courseUrl(card: Card): string {
  const base = "https://learn.allaboutultrasound.com";
  if (!card.slug) return `${base}/education-library`;
  switch (card.type) {
    case "course": return `${base}/courses/${card.slug}`;
    case "quiz": return `${base}/quizzes/${card.slug}`;
    case "cohort": return `${base}/cohorts/${card.slug}`;
    case "download": return `${base}/downloads/${card.slug}`;
    case "bundle": return `${base}/bundles/${card.slug}`;
    case "webinar": return `${base}/webinars/${card.slug}`;
    case "membership": return `${base}/membership/${card.slug}`;
    case "physical": return `${base}/product/${card.slug}`;
    case "workshop": return `${base}/workshops/${card.slug}`;
    case "community": return `${base}/community/${card.slug}`;
    default: return `${base}/education-library`;
  }
}

// ─── Card components ──────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateRange(start: Date | string | null | undefined, end: Date | string | null | undefined): string {
  if (!start) return "";
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (!end) return s.toLocaleDateString("en-US", opts);
  const e = new Date(end);
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) {
      return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

function CourseDetailsRow({ card, theme }: { card: Card; theme: typeof THEMES.light }) {
  // Workshop
  if (card.type === "workshop") {
    if (!card.nextInstanceDate) {
      return (
        <div style={{ fontSize: 11, color: "#d97706", display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontWeight: 500 }}>
          ⏰ Enrollment Closed — Join Waitlist
        </div>
      );
    }
    const dateStr = formatDateRange(card.nextInstanceDate, card.nextInstanceEndDate);
    const isVirtual = card.locationType === "virtual" || card.locationType === "online";
    const locationParts = isVirtual
      ? ["Virtual / Online"]
      : [card.venueName, [card.venueCity, card.venueState].filter(Boolean).join(", ")].filter(Boolean);
    const locationStr = locationParts.join(" · ");
    return (
      <div style={{ fontSize: 11, color: theme.subtext, display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
        {dateStr && <span style={{ color: theme.accent, fontWeight: 500 }}>📅 {dateStr}</span>}
        {locationStr && <span>📍 {locationStr}</span>}
      </div>
    );
  }
  // Cohort
  if (card.type === "cohort") {
    if (!card.cohortGroupStartDate) {
      return (
        <div style={{ fontSize: 11, color: "#d97706", display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontWeight: 500 }}>
          ⏰ Enrollment Closed — Join Waitlist
        </div>
      );
    }
    const dateStr = formatDateRange(card.cohortGroupStartDate, card.cohortGroupEndDate);
    return (
      <div style={{ fontSize: 11, color: theme.subtext, display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
        {card.cohortGroupName && <span style={{ color: theme.accent, fontWeight: 500 }}>🗓️ {card.cohortGroupName}</span>}
        {dateStr && <span>📅 {dateStr}</span>}
      </div>
    );
  }
  return null;
}

function StandardCard({
  card,
  theme,
  showPrice,
  showEnrollButton,
  showCourseDetails,
  buttonText,
  buttonUrl,
}: {
  card: Card;
  theme: typeof THEMES.light;
  showPrice: boolean;
  showEnrollButton: boolean;
  showCourseDetails: boolean;
  buttonText: string | null;
  buttonUrl: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const href = buttonUrl || courseUrl(card);
  return (
    <div
      style={{
        background: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: theme.shadow,
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.15s, box-shadow 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        cursor: "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => window.open(href, "_blank", "noopener")}
    >
      {/* Thumbnail */}
      <div style={{ aspectRatio: "16/9", background: theme.cardBorder, overflow: "hidden" }}>
        {card.coverImageUrl ? (
          <img
            src={card.coverImageUrl}
            alt={card.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${theme.accent}22, ${theme.accent}44)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            {typeEmoji(card.type)}
          </div>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.accent }}>
          {typeLabel(card.type)}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, lineHeight: 1.35 }}>{card.title}</div>
        {card.subtitle && (
          <div style={{ fontSize: 13, color: theme.subtext, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {card.subtitle}
          </div>
        )}
        {showCourseDetails && <CourseDetailsRow card={card} theme={theme} />}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          {showPrice && (
            <span style={{ fontSize: 14, fontWeight: 700, color: theme.priceColor }}>{formatPrice(card)}</span>
          )}
          {showEnrollButton && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                background: theme.accent,
                color: theme.btnText,
                padding: "7px 14px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = theme.accentHover)}
              onMouseLeave={e => (e.currentTarget.style.background = theme.accent)}
            >
              {buttonText || "Enroll Now"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function CompactCard({
  card,
  theme,
  showPrice,
  showEnrollButton,
  showCourseDetails,
  buttonText,
  buttonUrl,
}: {
  card: Card;
  theme: typeof THEMES.light;
  showPrice: boolean;
  showEnrollButton: boolean;
  showCourseDetails: boolean;
  buttonText: string | null;
  buttonUrl: string | null;
}) {
  const href = buttonUrl || courseUrl(card);
  return (
    <div
      style={{
        background: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: theme.shadow,
        display: "flex",
        flexDirection: "row",
        gap: 0,
        cursor: "pointer",
      }}
      onClick={() => window.open(href, "_blank", "noopener")}
    >
      <div style={{ width: 80, minWidth: 80, background: theme.cardBorder, overflow: "hidden" }}>
        {card.coverImageUrl ? (
          <img src={card.coverImageUrl} alt={card.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        ) : (
          <div style={{ width: "100%", height: "100%", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
            {typeEmoji(card.type)}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, lineHeight: 1.3 }}>{card.title}</div>
        {showCourseDetails && <CourseDetailsRow card={card} theme={theme} />}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showPrice && <span style={{ fontSize: 12, fontWeight: 700, color: theme.priceColor }}>{formatPrice(card)}</span>}
          {showEnrollButton && (
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ fontSize: 12, fontWeight: 600, color: theme.accent, textDecoration: "none" }}>
              {buttonText || "Enroll →"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function MinimalCard({
  card,
  theme,
  showPrice,
  showEnrollButton,
  showCourseDetails,
  buttonText,
  buttonUrl,
}: {
  card: Card;
  theme: typeof THEMES.light;
  showPrice: boolean;
  showEnrollButton: boolean;
  showCourseDetails: boolean;
  buttonText: string | null;
  buttonUrl: string | null;
}) {
  const href = buttonUrl || courseUrl(card);
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${theme.cardBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 20 }}>{typeEmoji(card.type)}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{card.title}</div>
        {showCourseDetails && <CourseDetailsRow card={card} theme={theme} />}
        {showPrice && <div style={{ fontSize: 12, color: theme.priceColor, fontWeight: 600 }}>{formatPrice(card)}</div>}
      </div>
      {showEnrollButton && (
        <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textDecoration: "none", whiteSpace: "nowrap" }}>
          {buttonText || "View →"}
        </a>
      )}
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export default function WidgetRenderer() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, error } = trpc.widgetPublic.getByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // Auto-resize iframe when content changes
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      const h = containerRef.current?.scrollHeight ?? 0;
      window.parent?.postMessage({ type: "ultrasound-widget-resize", height: h }, "*");
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120, fontFamily: "system-ui, sans-serif", color: "#64748b" }}>
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 80, fontFamily: "system-ui, sans-serif", color: "#94a3b8", fontSize: 13 }}>
        Widget unavailable
      </div>
    );
  }

  const { widget, cards } = data;
  const theme = THEMES[widget.theme] ?? THEMES.light;

  const gridCols = widget.layout === "list" ? 1 : widget.cardStyle === "compact" ? 1 : Math.min(cards.length, 3);

  return (
    <div
      ref={containerRef}
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: theme.bg,
        padding: "16px",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {/* Header */}
      {(widget.title || widget.subtitle) && (
        <div style={{ marginBottom: 16, textAlign: "center" }}>
          {widget.title && (
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: theme.text }}>{widget.title}</h2>
          )}
          {widget.subtitle && (
            <p style={{ margin: "4px 0 0", fontSize: 14, color: theme.subtext }}>{widget.subtitle}</p>
          )}
        </div>
      )}

      {/* Cards */}
      {cards.length === 0 ? (
        <div style={{ textAlign: "center", color: theme.subtext, fontSize: 14, padding: "24px 0" }}>No courses available</div>
      ) : widget.cardStyle === "minimal" ? (
        <div>
          {cards.map(card => (
            <MinimalCard
              key={card.id}
              card={card}
              theme={theme}
              showPrice={widget.showPrice}
              showEnrollButton={widget.showEnrollButton}
              showCourseDetails={widget.showCourseDetails}
              buttonText={widget.buttonText}
              buttonUrl={widget.buttonUrl}
            />
          ))}
        </div>
      ) : widget.cardStyle === "compact" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 640px)", gap: 10, justifyContent: "center" }}>
          {cards.map(card => (
            <CompactCard
              key={card.id}
              card={card}
              theme={theme}
              showPrice={widget.showPrice}
              showEnrollButton={widget.showEnrollButton}
              showCourseDetails={widget.showCourseDetails}
              buttonText={widget.buttonText}
              buttonUrl={widget.buttonUrl}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 320px))`,
            gap: 16,
            justifyContent: "center",
          }}
        >
          {cards.map(card => (
            <StandardCard
              key={card.id}
              card={card}
              theme={theme}
              showPrice={widget.showPrice}
              showEnrollButton={widget.showEnrollButton}
              showCourseDetails={widget.showCourseDetails}
              buttonText={widget.buttonText}
              buttonUrl={widget.buttonUrl}
            />
          ))}
        </div>
      )}

      {/* Powered by */}
      <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: theme.subtext, opacity: 0.7 }}>
        Powered by{" "}
        <a href="https://allaboutultrasound.com" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent, textDecoration: "none", fontWeight: 600 }}>
          All About Ultrasound
        </a>
      </div>
    </div>
  );
}
