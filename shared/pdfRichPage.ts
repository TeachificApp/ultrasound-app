export type PdfRichPage = {
  version: 1;
  imageUrl: string;
  bodyHtml: string;
};

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const escapeAttribute = (value: string) => escapeHtml(value).replace(/`/g, "&#096;");

export function pdfRichPageToHtml(page: PdfRichPage, pageIndex = 1) {
  const image = `<figure data-pdf-page-image="1" style="margin:0 0 1rem"><img src="${escapeAttribute(page.imageUrl)}" alt="Page ${pageIndex}" style="max-width:100%;height:auto;display:block;border-radius:8px" /></figure>`;
  const body = page.bodyHtml?.trim() || "<p></p>";
  return `<div data-pdf-page="1" style="display:flex;flex-direction:column;gap:1rem">${image}<div data-pdf-editable-text="1">${body}</div></div>`;
}

export function defaultPdfBodyHtml(paragraphs: string[]) {
  if (!paragraphs.length) return "<p></p>";
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}
