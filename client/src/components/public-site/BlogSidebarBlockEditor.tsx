import { useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { type Block, type BlockType } from "@/components/BlockPreview";
import { BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock, uid } from "@/pages/admin/LandingPageBuilder";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function BlogSidebarBlockEditor({
  label,
  description,
  blocks,
  onChange,
}: {
  label: string;
  description: string;
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState("Layout");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const selected = useMemo(() => blocks.find((block) => block.id === selectedId) ?? null, [blocks, selectedId]);

  const add = (type: BlockType) => {
    const definition = BLOCK_CATALOG.find((item) => item.type === type);
    if (!definition) return;
    const block: Block = { id: uid(), type, data: { ...definition.defaultData } };
    onChange([...blocks, block]);
    setSelectedId(block.id);
  };

  const move = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const from = blocks.findIndex((block) => block.id === event.active.id);
    const to = blocks.findIndex((block) => block.id === event.over?.id);
    if (from >= 0 && to >= 0) onChange(arrayMove(blocks, from, to));
  };

  return (
    <section className="space-y-4">
      <div><Label className="text-sm font-semibold">{label}</Label><p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p></div>
      <div className="grid gap-4 lg:grid-cols-[168px_minmax(0,1fr)_280px]">
        <aside className="rounded-lg border bg-slate-50 p-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Add sidebar content</p>
          <div className="mt-2 space-y-1">{CATALOG_CATEGORIES.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`w-full rounded px-2 py-1.5 text-left text-xs ${category === item ? "bg-teal-100 font-semibold text-teal-900" : "text-slate-600 hover:bg-white"}`}>{item}</button>)}</div>
          <div className="mt-3 space-y-1">{BLOCK_CATALOG.filter((item) => item.category === category).map((item) => <Button key={item.type} type="button" variant="outline" size="sm" className="h-auto w-full justify-start whitespace-normal text-left text-xs" onClick={() => add(item.type)}>+ {item.label}</Button>)}</div>
        </aside>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={move}>
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <div className="min-h-44 rounded-lg border bg-white p-2">
              {blocks.length === 0 ? <p className="px-4 py-12 text-center text-sm text-slate-400">No promotional blocks yet. Add a CTA, image, text, or other content above.</p> : blocks.map((block, index) => <SortableBlock key={block.id} block={block} isSelected={selectedId === block.id} onSelect={() => setSelectedId(block.id)} onDelete={() => { onChange(blocks.filter((item) => item.id !== block.id)); if (selectedId === block.id) setSelectedId(null); }} onDuplicate={() => { const copy = { ...block, id: uid(), data: { ...block.data } }; onChange([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]); }} onMoveUp={index > 0 ? () => onChange(arrayMove(blocks, index, index - 1)) : undefined} onMoveDown={index < blocks.length - 1 ? () => onChange(arrayMove(blocks, index, index + 1)) : undefined} />)}
            </div>
          </SortableContext>
        </DndContext>
        <aside className="rounded-lg border bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected block</p>
          {selected ? <div className="mt-3"><BlockSettings block={selected} onChange={(data) => onChange(blocks.map((block) => block.id === selected.id ? { ...block, data } : block))} /></div> : <p className="mt-3 text-sm text-slate-400">Select a block to edit its content.</p>}
        </aside>
      </div>
    </section>
  );
}

export default BlogSidebarBlockEditor;
