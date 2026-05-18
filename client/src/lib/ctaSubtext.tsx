/**
 * Shared helper for rendering CTA button subtext with color, size, and font style.
 * Used across PublicFunnelPage, BlockPreview, CourseLanding, DownloadLanding.
 */

const SIZE_MAP: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

export function ButtonSubtext({ d }: { d: Record<string, any> }) {
  if (!d.buttonSubtext) return null;

  const color = d.buttonSubtextColor ?? "#179ca3";
  const sizeClass = SIZE_MAP[d.buttonSubtextSize ?? "xs"] ?? "text-xs";
  const fontStyle: React.CSSProperties = {
    color,
    fontStyle: d.buttonSubtextItalic ? "italic" : "normal",
    fontWeight: d.buttonSubtextBold ? "bold" : "normal",
  };

  const inner = d.buttonSubtextUrl ? (
    <a href={d.buttonSubtextUrl} style={{ color, textDecoration: "underline" }}>
      {d.buttonSubtext}
    </a>
  ) : (
    d.buttonSubtext
  );

  return (
    <p className={`mt-3 ${sizeClass}`} style={fontStyle}>
      {inner}
    </p>
  );
}
