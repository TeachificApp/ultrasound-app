import { v4 as uuidv4 } from "uuid";
import { Trash2, Plus, GripVertical, ArrowRight } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MatchingData, MatchingPair } from "../../types/quiz";

interface Props {
  data: MatchingData;
  onChange: (data: MatchingData) => void;
}

function SortablePair({
  pair,
  onUpdate,
  onDelete,
  canDelete,
}: {
  pair: MatchingPair;
  onUpdate: (updates: Partial<MatchingPair>) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: pair.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 group">
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <input
        type="text"
        value={pair.premise}
        onChange={(e) => onUpdate({ premise: e.target.value })}
        placeholder="Premise (left side)"
        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400"
      />

      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />

      <input
        type="text"
        value={pair.response}
        onChange={(e) => onUpdate({ response: e.target.value })}
        placeholder="Response (right side)"
        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400"
      />

      <button
        onClick={onDelete}
        disabled={!canDelete}
        className="p-1.5 text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function MatchingEditor({ data, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = data.pairs.findIndex((p) => p.id === active.id);
    const newIndex = data.pairs.findIndex((p) => p.id === over.id);
    onChange({ pairs: arrayMove(data.pairs, oldIndex, newIndex) });
  };

  const addPair = () => {
    onChange({
      pairs: [
        ...data.pairs,
        { id: uuidv4(), premise: "", response: "" },
      ],
    });
  };

  const updatePair = (id: string, updates: Partial<MatchingPair>) => {
    onChange({ pairs: data.pairs.map((p) => (p.id === id ? { ...p, ...updates } : p)) });
  };

  const deletePair = (id: string) => {
    if (data.pairs.length <= 2) return;
    onChange({ pairs: data.pairs.filter((p) => p.id !== id) });
  };

  return (
    <div className="space-y-3">
      {/* Column headers */}
      <div className="flex items-center gap-2 pl-7">
        <div className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide pl-3">
          Premise
        </div>
        <div className="w-4" />
        <div className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide pl-3">
          Response
        </div>
        <div className="w-7" />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={data.pairs.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {data.pairs.map((pair) => (
              <SortablePair
                key={pair.id}
                pair={pair}
                onUpdate={(updates) => updatePair(pair.id, updates)}
                onDelete={() => deletePair(pair.id)}
                canDelete={data.pairs.length > 2}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={addPair}
        className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add pair
      </button>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-600">
        <strong>How matching works:</strong> Students will see the premises in order and the responses shuffled. They drag or select responses to match each premise.
      </div>
    </div>
  );
}
