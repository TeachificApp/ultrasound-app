/** Max content width for platform email campaigns (matches editor + sent mail). */
export const EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX = 750;

/** Default width for image blocks when not explicitly set narrower. */
export const EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH = "100%";

/** Resolve stored/legacy image width to the campaign default when appropriate. */
export function resolveCampaignImageWidth(width?: string | null): string {
  const w = (width ?? "").trim();
  if (!w) return EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH;
  return w;
}

/** Image block HTML used by the campaign editor. */
export function renderCampaignImageHtml(opts: {
  src: string;
  alt?: string;
  width?: string | null;
  align?: string;
  borderRadius?: number;
}): string {
  if (!opts.src) return "";
  const align = opts.align ?? "left";
  const width = resolveCampaignImageWidth(opts.width);
  const br = opts.borderRadius ?? 8;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td align="${align}"><img src="${opts.src}" alt="${opts.alt || ""}" width="${width}" style="max-width:${width};width:${width};border-radius:${br}px;display:block;" /></td></tr></table>`;
}

/** Branded wrapper for campaign emails (header, body slot, footer with unsubscribe placeholder). */
export function wrapInBrandedCampaignEmail(
  bodyHtml: string,
  previewText?: string,
  headerTitle?: string | null,
  headerSubtext?: string | null,
  headerColor?: string | null,
  headerEnabled?: boolean | null,
): string {
  const w = EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX;
  const preview = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : "";
  const title = headerTitle ?? "All About Ultrasound™";
  const subtext = headerSubtext ?? "ECHOCARDIOGRAPHY CLINICAL COMPANION";
  const showHeader = headerEnabled !== false;
  const bgColor = headerColor || null;
  const headerBg = bgColor
    ? `background:${bgColor};`
    : "background:linear-gradient(135deg,#0e1e2e 0%,#0e4a50 60%,#189aa1 100%);";
  const headerRow = showHeader ? `
      <tr>
        <td style="${headerBg}padding:28px 32px;">
          <span style="font-family:Merriweather,Georgia,serif;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${title}</span>
          <div style="font-size:11px;color:#4ad9e0;font-weight:600;margin-top:2px;letter-spacing:0.5px;">${subtext}</div>
        </td>
      </tr>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>All About Ultrasound™</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f8;font-family:'Open Sans',Arial,sans-serif;">
${preview}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;padding:32px 0;">
  <tr><td align="center">
    <table width="${w}" cellpadding="0" cellspacing="0" style="max-width:${w}px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      ${headerRow}
      <tr>
        <td style="padding:32px;color:#1a2e3b;font-size:15px;line-height:1.7;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="background:#f4f7f8;padding:20px 32px;border-top:1px solid #e5eaec;">
          <p style="margin:0;font-size:11px;color:#8a9bb0;text-align:center;line-height:1.6;">
            © ${new Date().getFullYear()} All About Ultrasound™<br/>
            You are receiving this email because you have an account on All About Ultrasound™.<br/>
            <a href="{{UNSUBSCRIBE_URL}}" style="color:#189aa1;text-decoration:none;">Unsubscribe</a> · <a href="https://app.allaboutultrasound.com/profile" style="color:#189aa1;text-decoration:none;">Manage preferences</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function normalizeImgTag(attrs: string): string {
  // Only intervene when no explicit width is set at all — preserve any existing width.
  const widthMatch = attrs.match(/\bwidth=["']([^"']+)["']/i);
  const width = widthMatch?.[1]?.trim();
  if (width) return `<img${attrs}>`;

  // No width attribute — apply default
  let newAttrs = attrs;

  if (/\bstyle=/i.test(newAttrs)) {
    newAttrs = newAttrs.replace(/\bstyle=["']([^"']*)["']/i, (_m, style: string) => {
      let s = style;
      if (!/width\s*:/i.test(s)) s += `;width:${EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH}`;
      if (!/max-width\s*:/i.test(s)) s += `;max-width:${EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH}`;
      if (!/display\s*:/i.test(s)) s += ";display:block";
      return `style="${s}"`;
    });
  } else {
    newAttrs += ` style="max-width:${EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH};width:${EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH};display:block;"`;
  }

  newAttrs += ` width="${EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH}"`;

  return `<img${newAttrs}>`;
}

/**
 * Normalize stored/sent campaign HTML:
 * - Upgrade legacy 600px containers to 750px
 * - Apply default width to images that have no explicit width set
 */
export function normalizeCampaignEmailHtml(html: string): string {
  const w = EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX;
  let out = html
    .replace(/max-width:\s*600px/gi, `max-width:${w}px`)
    .replace(/\bwidth=["']600["']/gi, `width="${w}"`);

  out = out.replace(/<img\b([^>]*)>/gi, (_match, attrs: string) => normalizeImgTag(attrs));
  return out;
}
