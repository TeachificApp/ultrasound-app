import React, { useEffect, useMemo, useState } from "react";
import { Image, Layers, Type } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import { plainTextFromRichHtml, pptxRichSlideToHtml, type PptxRichSlide } from "@shared/pptxRichSlide";

type Props = {
  value: PptxRichSlide;
  onChange: (next: PptxRichSlide) => void;
};

export default function PptxSlideRichTextEditor({ value, onChange }: Props) {
  const editableLayers = useMemo(
    () => value.elements.filter((element) => element.type === "text" || element.type === "image"),
    [value.elements],
  );
  const [selectedId, setSelectedId] = useState<string>(editableLayers[0]?.id ?? "");
  const selected = editableLayers.find((element) => element.id === selectedId) ?? editableLayers[0];

  useEffect(() => {
    if (!editableLayers.some((element) => element.id === selectedId)) setSelectedId(editableLayers[0]?.id ?? "");
  }, [editableLayers, selectedId]);

  const updateElement = (id: string, patch: Record<string, unknown>) => {
    onChange({
      ...value,
      elements: value.elements.map((element) => element.id === id ? { ...element, ...patch } : element),
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-800"><Layers size={14} /> Converted PowerPoint slide</p>
        <p className="mt-1 text-xs leading-5 text-teal-700">Select a text or image layer below to edit that layer. The complete slide composition remains together as one rich-text lesson block.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-2">
        <div
          className="mx-auto max-w-[520px] bg-white shadow-sm [&_[data-pptx-text-box]]:m-0 [&_[data-pptx-image]]:max-w-none"
          dangerouslySetInnerHTML={{ __html: pptxRichSlideToHtml(value) }}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Slide layers</label>
        <select
          value={selected?.id ?? ""}
          onChange={(event) => setSelectedId(event.target.value)}
          className="h-9 w-full rounded border border-gray-200 bg-white px-2 text-xs"
        >
          {editableLayers.map((element, index) => (
            <option key={element.id} value={element.id}>
              {element.type === "text" ? "Text" : "Image"} {index + 1}{element.type === "text" && element.content ? ` — ${element.content.slice(0, 44)}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selected?.type === "text" && (
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><Type size={13} /> Edit selected text layer</label>
          <RichTextEditor
            value={selected.contentHtml ?? selected.content ?? ""}
            onChange={(contentHtml) => updateElement(selected.id, { contentHtml, content: plainTextFromRichHtml(contentHtml, selected.content ?? "") })}
            minHeight={120}
            maxHeight={300}
            placeholder="Edit this PowerPoint text layer…"
          />
        </div>
      )}

      {selected?.type === "image" && (
        <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
          <label className="flex items-center gap-1 text-xs font-medium text-gray-600"><Image size={13} /> Image URL</label>
          <input
            value={selected.src ?? ""}
            onChange={(event) => updateElement(selected.id, { src: event.target.value })}
            className="h-9 w-full rounded border border-gray-200 bg-white px-2 text-xs"
            placeholder="https://…"
          />
          <p className="text-[11px] leading-4 text-gray-500">Replace the extracted image only when needed; its original size and position stay intact.</p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Slide background</label>
        <input
          type="color"
          value={value.backgroundColor || "#ffffff"}
          onChange={(event) => onChange({ ...value, backgroundColor: event.target.value })}
          className="h-9 w-full cursor-pointer rounded border border-gray-200 bg-white p-1"
        />
      </div>
    </div>
  );
}
