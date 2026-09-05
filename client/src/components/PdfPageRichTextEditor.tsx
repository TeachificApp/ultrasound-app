import React from "react";
import { FileText, Image as ImageIcon } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import { pdfDocumentPageSectionHtml, wrapContinuousDocumentHtml, type PdfRichPage } from "@shared/pdfRichPage";

type Props = {
  value: PdfRichPage;
  pageIndex?: number;
  onChange: (next: PdfRichPage) => void;
};

export default function PdfPageRichTextEditor({ value, pageIndex = 1, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-800"><FileText size={14} /> Converted PDF page</p>
        <p className="mt-1 text-xs leading-5 text-teal-700">The page image preserves the original layout. Edit the extracted text below without overlapping layers.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-2">
        <img src={value.imageUrl} alt={`Page ${pageIndex}`} className="block w-full rounded-md bg-white shadow-sm" />
      </div>

      <div>
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><ImageIcon size={13} /> Page image URL</label>
        <input
          value={value.imageUrl}
          onChange={(event) => onChange({ ...value, imageUrl: event.target.value, version: 1 })}
          className="h-9 w-full rounded border border-gray-200 bg-white px-2 text-xs"
          placeholder="https://…"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Editable page text</label>
        <RichTextEditor
          value={value.bodyHtml ?? ""}
          onChange={(bodyHtml) => onChange({ ...value, bodyHtml: bodyHtml || "<p></p>", version: 1 })}
          minHeight={240}
          maxHeight={720}
          placeholder="Edit the extracted PDF text…"
        />
      </div>
    </div>
  );
}

export function syncPdfPageHtml(page: PdfRichPage, pageIndex = 1) {
  const section = pdfDocumentPageSectionHtml(page.imageUrl, [], pageIndex).replace(/<p><\/p>\s*$/, page.bodyHtml || "<p></p>");
  return wrapContinuousDocumentHtml([section]);
}
