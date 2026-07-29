/**
 * Shared drag-and-drop quiz interaction components using @dnd-kit.
 * Used by both QuizPreview (builder) and PublicQuizPlayerPage (student-facing).
 */
import React, { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

// ─── Sortable Ordering Question ─────────────────────────────────────────────

interface OrderingItem {
  id: string;
  text: string;
}

interface DndOrderingProps {
  items: OrderingItem[];
  currentOrder: string[];
  onReorder: (newOrder: string[]) => void;
  primaryColor: string;
  disabled?: boolean;
}

function SortableOrderItem({ id, text, index, primaryColor, disabled }: { id: string; text: string; index: number; primaryColor: string; disabled?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-white transition-shadow ${
        isDragging ? "shadow-lg border-gray-300" : "border-gray-200 hover:shadow-sm"
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none ${disabled ? "opacity-30 pointer-events-none" : ""}`}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <span className="text-xs font-bold w-5 shrink-0" style={{ color: primaryColor }}>
        {index + 1}.
      </span>
      <span className="flex-1 text-sm text-gray-700">{text}</span>
    </div>
  );
}

export function DndOrdering({ items, currentOrder, onReorder, primaryColor, disabled }: DndOrderingProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      onReorder(arrayMove(currentOrder, oldIndex, newIndex));
    }
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
        <GripVertical className="h-3 w-3" /> Drag items to put them in the correct order
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={currentOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {currentOrder.map((id, idx) => {
              const item = items.find((i) => i.id === id);
              return (
                <SortableOrderItem
                  key={id}
                  id={id}
                  text={item?.text || ""}
                  index={idx}
                  primaryColor={primaryColor}
                  disabled={disabled}
                />
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeItem ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-300 bg-white shadow-xl">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-bold w-5" style={{ color: primaryColor }}>•</span>
              <span className="flex-1 text-sm text-gray-700">{activeItem.text}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ─── Drag Words Question ────────────────────────────────────────────────────

interface DragWordsBlank {
  id: string;
  correctWord: string;
}

interface DndDragWordsProps {
  template: string;
  blanks: DragWordsBlank[];
  distractorWords?: string[];
  selections: Record<string, string>;
  onSelectionChange: (selections: Record<string, string>) => void;
  primaryColor: string;
  disabled?: boolean;
}

function DraggableWord({ id, word, isUsed, primaryColor }: { id: string; word: string; isUsed: boolean; primaryColor: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: isUsed,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : isUsed ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`inline-flex px-3 py-1.5 text-sm border rounded-lg select-none touch-none transition-all ${
        isUsed
          ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
          : isDragging
          ? "border-gray-300 bg-white shadow-lg cursor-grabbing"
          : "border-gray-200 bg-white hover:bg-gray-50 cursor-grab hover:shadow-sm"
      }`}
    >
      {word}
    </div>
  );
}

function DroppableBlank({ id, word, primaryColor, onRemove }: { id: string; word?: string; primaryColor: string; onRemove: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id });

  if (word) {
    return (
      <span
        ref={setNodeRef}
        className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded text-sm text-white cursor-pointer transition-transform hover:scale-105"
        style={{ background: primaryColor }}
        onClick={onRemove}
        title="Click to remove"
      >
        {word}
        <span className="text-white/70 text-xs">×</span>
      </span>
    );
  }

  return (
    <span
      ref={setNodeRef}
      className={`inline-block w-24 h-7 mx-1 border-2 border-dashed rounded transition-colors align-middle ${
        isOver ? "border-gray-500 bg-gray-100" : "border-gray-300 bg-gray-50"
      }`}
      style={isOver ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : undefined}
    />
  );
}

export function DndDragWords({ template, blanks, distractorWords, selections, onSelectionChange, primaryColor, disabled }: DndDragWordsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const allWords = useMemo(
    () => [...blanks.map((b) => b.correctWord), ...(distractorWords || [])].sort(() => 0.5 - Math.random()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blanks.length, distractorWords?.length]
  );

  const usedWords = Object.values(selections);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const word = active.id as string;
    const blankId = over.id as string;
    const blank = blanks.find((b) => b.id === blankId);
    if (!blank) return;

    // If blank already has a word, put it back
    const next = { ...selections };
    next[blankId] = word;
    onSelectionChange(next);
  };

  const parts = template.split(/\{\{(\w+)\}\}/);

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="text-sm text-gray-700 leading-loose">
          {parts.map((part, i) => {
            const blank = blanks.find((b) => b.id === part);
            if (blank) {
              return (
                <DroppableBlank
                  key={`blank-${i}`}
                  id={blank.id}
                  word={selections[blank.id]}
                  primaryColor={primaryColor}
                  onRemove={() => {
                    const next = { ...selections };
                    delete next[blank.id];
                    onSelectionChange(next);
                  }}
                />
              );
            }
            return <span key={`text-${i}`}>{part}</span>;
          })}
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">Drag words into the blanks above:</p>
          <div className="flex flex-wrap gap-2">
            {allWords.map((word, i) => (
              <DraggableWord
                key={`${word}-${i}`}
                id={word}
                word={word}
                isUsed={usedWords.includes(word)}
                primaryColor={primaryColor}
              />
            ))}
          </div>
        </div>

        {!disabled && (
          <p className="text-xs text-gray-400 italic">
            Tip: You can also click a filled blank to remove it, then drag a different word in.
          </p>
        )}
      </DndContext>
    </div>
  );
}
