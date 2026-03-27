/**
 * NavigatorEditor — Admin page for editing Navigator protocol checklists.
 * Features:
 *  - Module selector (all 19 navigator modules)
 *  - Loads current static content as seed data if no DB overrides exist
 *  - Section accordion with inline edit for probe description
 *  - Per-item: edit label, detail, critical flag, drag-to-reorder (dnd-kit), delete
 *  - Add new items to any section
 *  - Add new sections to any module
 *  - Reorder sections via up/down arrows
 *  - Save / discard changes per section
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ChevronDown, ChevronUp, Plus, Trash2, Save, GripVertical,
  AlertTriangle, CheckCircle2, ArrowUp, ArrowDown, Edit3, X, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { STATIC_NAVIGATOR_DATA } from "@/lib/navigatorStaticData";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Helper: generate a unique item ID ───────────────────────────────────────
function genId(module: string, sectionName: string) {
  return `${module}_${sectionName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  critical: boolean;
  sortOrder: number;
}

interface SectionData {
  id?: number;
  sectionName: string;
  probe: string;
  items: ChecklistItem[];
  sortOrder: number;
  isDirty: boolean;
}

// ─── Sortable Item Row ────────────────────────────────────────────────────────
interface SortableItemRowProps {
  item: ChecklistItem;
  sectionIdx: number;
  itemIdx: number;
  totalItems: number;
  isEditing: boolean;
  onEdit: () => void;
  onDoneEdit: () => void;
  onUpdate: (field: keyof ChecklistItem, value: string | boolean | number) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
}

function SortableItemRow({
  item, sectionIdx, itemIdx, totalItems,
  isEditing, onEdit, onDoneEdit, onUpdate, onDelete, onMove,
}: SortableItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
      <div
      ref={setNodeRef}
      style={style}
      draggable={false}
      className={`border-b border-gray-50 last:border-0 ${item.critical ? "bg-amber-50/30" : ""}`}
    >
      <div className="flex items-start gap-2 px-4 py-2.5">
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex-shrink-0 mt-1 touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </span>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-1.5">
              <Input
                className="text-sm h-8"
                value={item.label}
                onChange={e => onUpdate("label", e.target.value)}
                placeholder="Checklist item label"
                autoFocus
              />
              <Textarea
                className="text-xs min-h-[60px] resize-none"
                value={item.detail}
                onChange={e => onUpdate("detail", e.target.value)}
                placeholder="Detail / explanation (optional)"
              />
              <label className="flex items-center gap-2 text-xs text-amber-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.critical}
                  onChange={e => onUpdate("critical", e.target.checked)}
                  className="accent-amber-500"
                />
                <AlertTriangle className="w-3 h-3" />
                Mark as critical item
              </label>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5">
                {item.critical && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                <span className={`text-sm font-medium ${item.label ? "text-gray-700" : "text-gray-300 italic"}`}>
                  {item.label || "Empty label — click edit"}
                </span>
              </div>
              {item.detail && (
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.detail}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onMove("up")}
            disabled={itemIdx === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ArrowUp className="w-3 h-3 text-gray-400" />
          </button>
          <button
            onClick={() => onMove("down")}
            disabled={itemIdx === totalItems - 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ArrowDown className="w-3 h-3 text-gray-400" />
          </button>
          <button
            onClick={isEditing ? onDoneEdit : onEdit}
            className="p-1.5 rounded hover:bg-blue-100 text-blue-500"
            title={isEditing ? "Done editing" : "Edit item"}
          >
            {isEditing ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-100 text-red-400"
            title="Delete item"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function NavigatorEditor() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const authLoading = false;
  const [selectedModule, setSelectedModule] = useState("abdominal");
  const [sections, setSections] = useState<SectionData[]>([]);
  const [expandedSection, setExpandedSection] = useState<number | null>(0);
  const [savingSection, setSavingSection] = useState<number | null>(null);
  const [deletingSection, setDeletingSection] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Section-level drag (HTML5 — sections are not inside DndContext)
  const dragSectionIdx = useRef<number | null>(null);

  // dnd-kit sensors for item drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") navigate("/");
  }, [user, authLoading, navigate]);

  const { data: modules } = trpc.navigatorAdmin.listModules.useQuery();
  const { data: dbSections, refetch: refetchSections } = trpc.navigatorAdmin.listSections.useQuery(
    { module: selectedModule },
    { enabled: !!selectedModule }
  );

  const upsertSection = trpc.navigatorAdmin.upsertSection.useMutation();
  const deleteSection = trpc.navigatorAdmin.deleteSection.useMutation();
  const reorderSections = trpc.navigatorAdmin.reorderSections.useMutation();

  // Merge DB data with static seed data
  useEffect(() => {
    if (!dbSections) return;
    const staticData = STATIC_NAVIGATOR_DATA[selectedModule] ?? [];
    if (dbSections.length > 0) {
      setSections(
        dbSections.map((s) => ({
          id: s.id,
          sectionName: s.sectionName,
          probe: s.probe,
          items: s.items.map((item, i) => ({ ...item, sortOrder: item.sortOrder ?? i })),
          sortOrder: s.sortOrder,
          isDirty: false,
        }))
      );
    } else {
      setSections(
        staticData.map((s, idx) => ({
          sectionName: s.sectionName,
          probe: s.probe,
          items: s.items.map((item, i) => ({ ...item, sortOrder: i })),
          sortOrder: idx,
          isDirty: false,
        }))
      );
    }
    setExpandedSection(0);
  }, [dbSections, selectedModule]);

  const markDirty = useCallback((sectionIdx: number) => {
    setSections(prev => prev.map((s, i) => i === sectionIdx ? { ...s, isDirty: true } : s));
  }, []);

  const handleSaveSection = async (sectionIdx: number) => {
    const section = sections[sectionIdx];
    setSavingSection(sectionIdx);
    try {
      await upsertSection.mutateAsync({
        module: selectedModule,
        sectionName: section.sectionName,
        probe: section.probe,
        items: section.items,
        sortOrder: section.sortOrder,
      });
      setSections(prev => prev.map((s, i) => i === sectionIdx ? { ...s, isDirty: false } : s));
      await refetchSections();
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < sections.length; i++) {
      await handleSaveSection(i);
    }
  };

  const handleDeleteSection = async (sectionIdx: number) => {
    const section = sections[sectionIdx];
    if (!section.id) {
      setSections(prev => prev.filter((_, i) => i !== sectionIdx));
      return;
    }
    if (!confirm(`Delete section "${section.sectionName}"? This cannot be undone.`)) return;
    setDeletingSection(sectionIdx);
    try {
      await deleteSection.mutateAsync({ id: section.id });
      await refetchSections();
    } finally {
      setDeletingSection(null);
    }
  };

  const handleAddSection = () => {
    const newSection: SectionData = {
      sectionName: "New Section",
      probe: "",
      items: [],
      sortOrder: sections.length,
      isDirty: true,
    };
    setSections(prev => [...prev, newSection]);
    setExpandedSection(sections.length);
  };

  const handleMoveSection = async (sectionIdx: number, direction: "up" | "down") => {
    const newSections = [...sections];
    const targetIdx = direction === "up" ? sectionIdx - 1 : sectionIdx + 1;
    if (targetIdx < 0 || targetIdx >= newSections.length) return;
    [newSections[sectionIdx], newSections[targetIdx]] = [newSections[targetIdx], newSections[sectionIdx]];
    const reordered = newSections.map((s, i) => ({ ...s, sortOrder: i, isDirty: true }));
    setSections(reordered);
    if (expandedSection === sectionIdx) setExpandedSection(targetIdx);
    else if (expandedSection === targetIdx) setExpandedSection(sectionIdx);
    const allInDb = reordered.every(s => s.id);
    if (allInDb) {
      try {
        await reorderSections.mutateAsync({
          module: selectedModule,
          orderedIds: reordered.map(s => s.id!),
        });
      } catch { /* non-fatal */ }
    }
  };

  // Section-level HTML5 drag (kept for section reordering)
  const handleSectionDragStart = (e: React.DragEvent, idx: number) => {
    dragSectionIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const handleSectionDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const from = dragSectionIdx.current;
    if (from === null || from === idx) return;
    const newSections = [...sections];
    const [moved] = newSections.splice(from, 1);
    newSections.splice(idx, 0, moved);
    const reordered = newSections.map((s, i) => ({ ...s, sortOrder: i, isDirty: true }));
    dragSectionIdx.current = idx;
    if (expandedSection === from) setExpandedSection(idx);
    else if (expandedSection === idx) setExpandedSection(from);
    setSections(reordered);
  };
  const handleSectionDragEnd = async () => {
    const allInDb = sections.every(s => s.id);
    if (allInDb) {
      try {
        await reorderSections.mutateAsync({
          module: selectedModule,
          orderedIds: sections.map(s => s.id!),
        });
      } catch { /* non-fatal */ }
    }
    dragSectionIdx.current = null;
  };

  // dnd-kit item drag end handler
  const handleItemDragEnd = (event: DragEndEvent, sectionIdx: number) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections(prev => prev.map((s, si) => {
      if (si !== sectionIdx) return s;
      const oldIndex = s.items.findIndex(item => item.id === active.id);
      const newIndex = s.items.findIndex(item => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return s;
      const newItems = arrayMove(s.items, oldIndex, newIndex).map((item, i) => ({
        ...item,
        sortOrder: i,
      }));
      return { ...s, items: newItems, isDirty: true };
    }));
  };

  const handleUpdateSectionField = (sectionIdx: number, field: "sectionName" | "probe", value: string) => {
    setSections(prev => prev.map((s, i) => i === sectionIdx ? { ...s, [field]: value, isDirty: true } : s));
  };

  const handleAddItem = (sectionIdx: number) => {
    const section = sections[sectionIdx];
    const newItem: ChecklistItem = {
      id: genId(selectedModule, section.sectionName),
      label: "",
      detail: "",
      critical: false,
      sortOrder: section.items.length,
    };
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx ? { ...s, items: [...s.items, newItem], isDirty: true } : s
    ));
    setEditingItem(newItem.id);
  };

  const handleUpdateItem = (sectionIdx: number, itemId: string, field: keyof ChecklistItem, value: string | boolean | number) => {
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx
        ? { ...s, items: s.items.map(item => item.id === itemId ? { ...item, [field]: value } : item), isDirty: true }
        : s
    ));
  };

  const handleDeleteItem = (sectionIdx: number, itemId: string) => {
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx
        ? { ...s, items: s.items.filter(item => item.id !== itemId).map((item, idx) => ({ ...item, sortOrder: idx })), isDirty: true }
        : s
    ));
  };

  const handleMoveItem = (sectionIdx: number, itemIdx: number, direction: "up" | "down") => {
    const section = sections[sectionIdx];
    const newItems = [...section.items];
    const targetIdx = direction === "up" ? itemIdx - 1 : itemIdx + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    [newItems[itemIdx], newItems[targetIdx]] = [newItems[targetIdx], newItems[itemIdx]];
    const reordered = newItems.map((item, idx) => ({ ...item, sortOrder: idx }));
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx ? { ...s, items: reordered, isDirty: true } : s
    ));
  };

  const handleSeedModule = async () => {
    if (!confirm(`Seed all sections for "${selectedModule}" to the database? This will overwrite any existing DB data for this module.`)) return;
    setIsSeeding(true);
    try {
      for (let i = 0; i < sections.length; i++) {
        await upsertSection.mutateAsync({
          module: selectedModule,
          sectionName: sections[i].sectionName,
          probe: sections[i].probe,
          items: sections[i].items,
          sortOrder: i,
        });
      }
      await refetchSections();
    } finally {
      setIsSeeding(false);
    }
  };

  const dirtyCount = sections.filter(s => s.isDirty).length;

  if (authLoading) return <Layout><div className="container py-10 text-center text-gray-400">Loading…</div></Layout>;
  if (!user || user.role !== "admin") return null;

  return (
    <Layout>
      <div style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }} className="py-8">
        <div className="container">
          <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
            Navigator Editor
          </h1>
          <p className="text-[#4ad9e0] text-sm mt-1">Edit protocol checklists for all Navigator modules</p>
        </div>
      </div>

      <div className="container py-6">
        {/* Module selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(modules ?? []).map(m => (
            <button
              key={m.key}
              onClick={() => setSelectedModule(m.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: selectedModule === m.key ? "#189aa1" : "white",
                color: selectedModule === m.key ? "white" : "#189aa1",
                border: `1px solid ${selectedModule === m.key ? "#189aa1" : "#189aa1" + "40"}`,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1">
            <span className="text-sm font-semibold text-gray-700">
              {sections.length} sections
              {dirtyCount > 0 && (
                <span className="ml-2 text-amber-600">· {dirtyCount} unsaved</span>
              )}
            </span>
          </div>
          {dirtyCount > 0 && (
            <Button
              size="sm"
              onClick={handleSaveAll}
              style={{ background: "#189aa1", color: "white" }}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save All Changes
            </Button>
          )}
          {sections.length > 0 && !sections[0]?.id && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeedModule}
              disabled={isSeeding}
              className="border-[#189aa1] text-[#189aa1]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSeeding ? "animate-spin" : ""}`} />
              {isSeeding ? "Seeding…" : "Seed to Database"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddSection}
            className="border-[#189aa1] text-[#189aa1]"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Section
          </Button>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {sections.map((section, si) => {
            const isExpanded = expandedSection === si;
            return (
              <div
                key={si}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden ${section.isDirty ? "border-amber-300" : "border-gray-100"}`}
              >
                {/* Section header */}
                <div
                  className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100"
                  onDragOver={e => handleSectionDragOver(e, si)}
                  onDrop={e => { e.preventDefault(); }}
                >
                  <span
                    draggable
                    onDragStart={e => handleSectionDragStart(e, si)}
                    onDragEnd={handleSectionDragEnd}
                    className="cursor-grab active:cursor-grabbing flex-shrink-0"
                    title="Drag to reorder section"
                  >
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <input
                      className="font-bold text-sm text-gray-800 bg-transparent border-none outline-none w-full"
                      style={{ fontFamily: "Merriweather, serif" }}
                      value={section.sectionName}
                      onChange={e => handleUpdateSectionField(si, "sectionName", e.target.value)}
                      placeholder="Section name"
                    />
                    <input
                      className="text-xs text-gray-400 bg-transparent border-none outline-none w-full mt-0.5"
                      value={section.probe}
                      onChange={e => handleUpdateSectionField(si, "probe", e.target.value)}
                      placeholder="Probe / approach description"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {section.isDirty && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">unsaved</Badge>
                    )}
                    <span className="text-xs text-gray-400 mr-1">{section.items.length} items</span>
                    <button onClick={() => handleMoveSection(si, "up")} disabled={si === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
                      <ArrowUp className="w-3 h-3 text-gray-500" />
                    </button>
                    <button onClick={() => handleMoveSection(si, "down")} disabled={si === sections.length - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
                      <ArrowDown className="w-3 h-3 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleSaveSection(si)}
                      disabled={savingSection === si || !section.isDirty}
                      className="p-1.5 rounded hover:bg-green-100 disabled:opacity-30 text-green-600"
                      title="Save section"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSection(si)}
                      disabled={deletingSection === si}
                      className="p-1.5 rounded hover:bg-red-100 text-red-400"
                      title="Delete section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setExpandedSection(isExpanded ? null : si)} className="p-1.5 rounded hover:bg-gray-200">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>
                  </div>
                </div>

                {/* Items — wrapped in DndContext per section */}
                {isExpanded && (
                  <div>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleItemDragEnd(event, si)}
                    >
                      <SortableContext
                        items={section.items.map(item => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {section.items.map((item, ii) => (
                          <SortableItemRow
                            key={item.id}
                            item={item}
                            sectionIdx={si}
                            itemIdx={ii}
                            totalItems={section.items.length}
                            isEditing={editingItem === item.id}
                            onEdit={() => setEditingItem(item.id)}
                            onDoneEdit={() => setEditingItem(null)}
                            onUpdate={(field, value) => handleUpdateItem(si, item.id, field, value)}
                            onDelete={() => handleDeleteItem(si, item.id)}
                            onMove={(dir) => handleMoveItem(si, ii, dir)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>

                    {/* Add item button */}
                    <div className="px-4 py-2.5 bg-gray-50/50">
                      <button
                        onClick={() => handleAddItem(si)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#189aa1] hover:text-[#0e7a80] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add checklist item
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {sections.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No sections found for this module.</p>
              <button onClick={handleAddSection} className="mt-3 text-[#189aa1] text-sm font-semibold hover:underline">
                + Add first section
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
