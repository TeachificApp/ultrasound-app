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

export function defaultPdfBodyHtml(paragraphs: string[]) {
  if (!paragraphs.length) return "<p></p>";
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/** One PDF page section inside a continuous converted document. */
export function pdfDocumentPageSectionHtml(imageUrl: string, paragraphs: string[], pageIndex = 1) {
  const image = `<figure data-document-page-image="1" style="margin:0 0 1rem"><img src="${escapeAttribute(imageUrl)}" alt="Page ${pageIndex}" style="max-width:100%;height:auto;display:block;border-radius:8px" /></figure>`;
  const body = defaultPdfBodyHtml(paragraphs);
  return `<section data-document-page="${pageIndex}" style="margin:0">${image}${body}</section>`;
}

export const DOCUMENT_SECTION_BREAK_HTML = '<hr data-document-page-break="1" style="border:none;border-top:1px solid #e5e7eb;margin:2rem 0" />';

export function wrapContinuousDocumentHtml(sections: string[]) {
  const body = sections.filter(Boolean).join(DOCUMENT_SECTION_BREAK_HTML);
  return `<div data-converted-document="1" style="display:flex;flex-direction:column;gap:0">${body || "<p></p>"}</div>`;
}
