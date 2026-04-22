/**
 * NavigatorEditor — Admin page for editing Navigator protocol checklists.
 * Both section-level and item-level drag-and-drop use @dnd-kit/sortable.
 */
import { useState, useEffect, useCallback, useId, useRef } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ChevronDown, ChevronUp, Plus, Trash2, Save, GripVertical,
  AlertTriangle, CheckCircle2, ArrowUp, ArrowDown, Edit3, X, RefreshCw,
  Image as ImageIcon, Upload, Loader2
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
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  critical: boolean;
  sortOrder: number;
}

interface NavigatorImage {
  id: string; // client-side stable id
  url: string;
  fileKey: string;
  caption: string;
  sortOrder: number;
  uploading?: boolean;
}

interface SectionData {
  /** Stable client-side key for dnd-kit (never changes for the lifetime of this section in state) */
  dndKey: string;
  id?: number;
  sectionName: string;
  probe: string;
  items: ChecklistItem[];
  images: NavigatorImage[];
  sortOrder: number;
  isDirty: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _counter = 0;
function uniqueKey(prefix = "k") {
  return `${prefix}_${Date.now()}_${++_counter}`;
}

// ─── Sortable Item Row ────────────────────────────────────────────────────────
interface SortableItemRowProps {
  item: ChecklistItem;
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
  item, itemIdx, totalItems,
  isEditing, onEdit, onDoneEdit, onUpdate, onDelete, onMove,
}: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? "relative" as const : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0 group ${item.critical ? "bg-amber-50/40" : "bg-white"} hover:bg-[#f0fbfc] transition-all`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex-shrink-0 mt-0.5 touch-none p-0.5 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder item"
      >
        <GripVertical className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {/* Circle icon — mirrors live Navigator */}
      <div className="flex-shrink-0 mt-0.5">
        {item.critical
          ? <AlertTriangle className="w-5 h-5 text-amber-400" />
          : <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
      </div>

      {/* Item content */}
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-sm font-medium ${item.label ? "text-gray-700" : "text-gray-300 italic"}`}>
                {item.label || "Empty label — click edit"}
              </span>
              {item.critical && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Critical</span>
              )}
            </div>
            {item.detail && (
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.detail}</p>
            )}
          </div>
        )}
      </div>

      {/* Edit controls */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={() => onMove("up")} disabled={itemIdx === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" title="Move up">
          <ArrowUp className="w-3 h-3 text-gray-400" />
        </button>
        <button type="button" onClick={() => onMove("down")} disabled={itemIdx === totalItems - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" title="Move down">
          <ArrowDown className="w-3 h-3 text-gray-400" />
        </button>
        <button
          type="button"
          onClick={isEditing ? onDoneEdit : onEdit}
          className="p-1.5 rounded hover:bg-blue-100 text-blue-500"
          title={isEditing ? "Done editing" : "Edit item"}
        >
          {isEditing ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={onDelete} className="p-1.5 rounded hover:bg-red-100 text-red-400" title="Delete item">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Sortable Section Card ────────────────────────────────────────────────────
interface SortableSectionCardProps {
  onAddImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (imgId: string) => void;
  onUpdateImageCaption: (imgId: string, caption: string) => void;
  uploadingImages: Set<string>;
  section: SectionData;
  si: number;
  totalSections: number;
  isExpanded: boolean;
  savingSection: number | null;
  deletingSection: number | null;
  editingItem: string | null;
  sensors: ReturnType<typeof useSensors>;
  onToggleExpand: () => void;
  onMoveSection: (direction: "up" | "down") => void;
  onSaveSection: () => void;
  onDeleteSection: () => void;
  onUpdateSectionField: (field: "sectionName" | "probe", value: string) => void;
  onAddItem: () => void;
  onItemDragEnd: (event: DragEndEvent) => void;
  onUpdateItem: (itemId: string, field: keyof ChecklistItem, value: string | boolean | number) => void;
  onDeleteItem: (itemId: string) => void;
  onMoveItem: (itemIdx: number, direction: "up" | "down") => void;
  onEditItem: (itemId: string) => void;
  onDoneEditItem: () => void;
}

function SortableSectionCard({
  section, si, totalSections, isExpanded,
  savingSection, deletingSection, editingItem, sensors,
  onToggleExpand, onMoveSection, onSaveSection, onDeleteSection,
  onUpdateSectionField, onAddItem, onItemDragEnd,
  onUpdateItem, onDeleteItem, onMoveItem, onEditItem, onDoneEditItem,
  onAddImage, onRemoveImage, onUpdateImageCaption, uploadingImages,
}: SortableSectionCardProps) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.dndKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${section.isDirty ? "border-amber-300" : "border-gray-100"}`}>
        {/* Section header — mirrors live Navigator section card */}
        <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#f0fbfc] transition-colors border-b border-gray-100">
          {/* Drag handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none p-0.5 rounded hover:bg-gray-200"
            title="Drag to reorder section"
          >
            <GripVertical className="w-4 h-4 text-gray-300" />
          </button>

          {/* Teal numbered circle — exactly as in live Navigator */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
            style={{ background: section.isDirty ? "#f59e0b" : "#189aa1" }}
          >
            {si + 1}
          </div>

          {/* Section name + probe — editable inline */}
          <div className="flex-1 min-w-0">
            <input
              className="font-bold text-sm text-gray-800 bg-transparent border-none outline-none w-full"
              style={{ fontFamily: "Merriweather, serif" }}
              value={section.sectionName}
              onChange={e => onUpdateSectionField("sectionName", e.target.value)}
              placeholder="Section name"
              onClick={e => e.stopPropagation()}
            />
            <input
              className="text-xs text-gray-400 bg-transparent border-none outline-none w-full mt-0.5"
              value={section.probe}
              onChange={e => onUpdateSectionField("probe", e.target.value)}
              placeholder="Probe / approach"
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {section.isDirty && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs mr-1">unsaved</Badge>
            )}
            <span className="text-xs text-gray-400 mr-1">{section.items.length}/{section.items.length}</span>
            <button type="button" onClick={() => onMoveSection("up")} disabled={si === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" title="Move up">
              <ArrowUp className="w-3 h-3 text-gray-400" />
            </button>
            <button type="button" onClick={() => onMoveSection("down")} disabled={si === totalSections - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" title="Move down">
              <ArrowDown className="w-3 h-3 text-gray-400" />
            </button>
            <button
              type="button"
              onClick={onSaveSection}
              disabled={savingSection === si || !section.isDirty}
              className="p-1.5 rounded hover:bg-green-100 disabled:opacity-30 text-green-600"
              title="Save section"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDeleteSection}
              disabled={deletingSection === si}
              className="p-1.5 rounded hover:bg-red-100 text-red-400"
              title="Delete section"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onToggleExpand} className="p-1.5 rounded hover:bg-gray-100" title={isExpanded ? "Collapse" : "Expand"}>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Items */}
        {isExpanded && (
          <div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onItemDragEnd}
            >
              <SortableContext
                items={section.items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {section.items.map((item, ii) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    itemIdx={ii}
                    totalItems={section.items.length}
                    isEditing={editingItem === item.id}
                    onEdit={() => onEditItem(item.id)}
                    onDoneEdit={onDoneEditItem}
                    onUpdate={(field, value) => onUpdateItem(item.id, field, value)}
                    onDelete={() => onDeleteItem(item.id)}
                    onMove={(dir) => onMoveItem(ii, dir)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* ── Clinical Images ─────────────────────────────────────────── */}
            <div className="px-4 pt-3 pb-2 border-t border-gray-100 bg-[#f8fffe]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#189aa1]" />
                  Clinical Images
                  <span className="text-gray-400 font-normal">({section.images.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs font-semibold text-[#189aa1] hover:text-[#0e7a80] transition-colors"
                >
                  <Upload className="w-3 h-3" /> Add Image
                </button>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onAddImage as any}
                />
              </div>
              {section.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                  {section.images.map((img) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                      {img.uploading ? (
                        <div className="w-full h-24 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-[#189aa1] animate-spin" />
                        </div>
                      ) : (
                        <img src={img.url} alt={img.caption || "Clinical image"} className="w-full h-24 object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveImage(img.id)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <input
                        type="text"
                        value={img.caption}
                        onChange={(e) => onUpdateImageCaption(img.id, e.target.value)}
                        placeholder="Image title (optional)"
                        className="w-full text-xs px-2 py-1 border-t border-gray-200 bg-white outline-none focus:bg-[#f0fbfc]"
                        maxLength={200}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 bg-gray-50/50">
              <button
                type="button"
                onClick={onAddItem}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#189aa1] hover:text-[#0e7a80] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add checklist item
              </button>
            </div>
          </div>
        )}
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
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set());
  // Track which module has already been loaded into local state to avoid
  // wiping unsaved changes (e.g. newly uploaded images) on every refetch.
  const initialisedModuleRef = useRef<string | null>(null);

  // Shared sensors for both section and item dnd-kit contexts
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  // When the module selector changes, clear the initialised flag so the
  // next dbSections load triggers a full reset.
  useEffect(() => {
    initialisedModuleRef.current = null;
  }, [selectedModule]);

  useEffect(() => {
    if (!dbSections) return;
    // Only do a full reset when the module actually changes (not on every refetch
    // after save — that would wipe unsaved images/changes in other sections).
    if (initialisedModuleRef.current === selectedModule) return;
    initialisedModuleRef.current = selectedModule;

    const staticData = STATIC_NAVIGATOR_DATA[selectedModule] ?? [];
    if (dbSections.length > 0) {
      setSections(
        dbSections.map((s) => ({
          dndKey: uniqueKey("sec"),
          id: s.id,
          sectionName: s.sectionName,
          probe: s.probe,
          items: s.items.map((item, i) => ({ ...item, sortOrder: item.sortOrder ?? i })),
          images: ((s as any).images ?? []).map((img: any, i: number) => ({
            id: uniqueKey("img"),
            url: img.url,
            fileKey: img.fileKey ?? "",
            caption: img.caption ?? "",
            sortOrder: img.sortOrder ?? i,
          })),
          sortOrder: s.sortOrder,
          isDirty: false,
        }))
      );
    } else {
      setSections(
        staticData.map((s, idx) => ({
          dndKey: uniqueKey("sec"),
          sectionName: s.sectionName,
          probe: s.probe,
          items: s.items.map((item, i) => ({ ...item, sortOrder: i })),
          images: [],
          sortOrder: idx,
          isDirty: false,
        }))
      );
    }
    setExpandedSection(0);
  }, [dbSections, selectedModule]);

  // ── Section drag end (dnd-kit) ──────────────────────────────────────────────
  const handleSectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections(prev => {
      const oldIndex = prev.findIndex(s => s.dndKey === active.id);
      const newIndex = prev.findIndex(s => s.dndKey === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const moved = arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, sortOrder: i, isDirty: true }));
      // Update expanded section tracker
      if (expandedSection === oldIndex) setExpandedSection(newIndex);
      else if (expandedSection === newIndex) setExpandedSection(oldIndex);
      return moved;
    });
  };

  // Persist section order after drag
  useEffect(() => {
    // We only auto-persist if all sections are already in the DB
    const allInDb = sections.length > 0 && sections.every(s => s.id);
    if (!allInDb) return;
    // Check if any are dirty from a drag (sortOrder changed)
    // We don't auto-save here to avoid spamming; user uses Save All or per-section save
  }, [sections]);

  const handleSaveSection = async (sectionIdx: number) => {
    const section = sections[sectionIdx];
    setSavingSection(sectionIdx);
    try {
      await upsertSection.mutateAsync({
        module: selectedModule,
        sectionName: section.sectionName,
        probe: section.probe,
        items: section.items,
        images: section.images.map(({ id: _id, uploading: _u, ...img }) => img),
        sortOrder: section.sortOrder,
      });
      setSections(prev => prev.map((s, i) => i === sectionIdx ? { ...s, isDirty: false } : s));
      await refetchSections();
    } finally {
      setSavingSection(null);
    }
  };

  // ── Image upload handler ────────────────────────────────────────────────────
  const handleAddImages = async (sectionIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    for (const file of files) {
      const tempId = uniqueKey("img");
      // Add placeholder with uploading state
      setSections(prev => prev.map((s, i) => i !== sectionIdx ? s : {
        ...s,
        images: [...s.images, { id: tempId, url: "", fileKey: "", caption: "", sortOrder: s.images.length, uploading: true }],
        isDirty: true,
      }));
      setUploadingImages(prev => new Set(prev).add(tempId));
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload-navigator-image", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const { url, fileKey } = await res.json() as { url: string; fileKey: string };
        setSections(prev => prev.map((s, i) => i !== sectionIdx ? s : {
          ...s,
          images: s.images.map(img => img.id === tempId ? { ...img, url, fileKey, uploading: false } : img),
        }));
      } catch {
        // Remove failed placeholder
        setSections(prev => prev.map((s, i) => i !== sectionIdx ? s : {
          ...s,
          images: s.images.filter(img => img.id !== tempId),
        }));
      } finally {
        setUploadingImages(prev => { const n = new Set(prev); n.delete(tempId); return n; });
      }
    }
  };

  const handleRemoveImage = (sectionIdx: number, imgId: string) => {
    setSections(prev => prev.map((s, i) => i !== sectionIdx ? s : {
      ...s,
      images: s.images.filter(img => img.id !== imgId).map((img, idx) => ({ ...img, sortOrder: idx })),
      isDirty: true,
    }));
  };

  const handleUpdateImageCaption = (sectionIdx: number, imgId: string, caption: string) => {
    setSections(prev => prev.map((s, i) => i !== sectionIdx ? s : {
      ...s,
      images: s.images.map(img => img.id === imgId ? { ...img, caption } : img),
      isDirty: true,
    }));
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].isDirty) await handleSaveSection(i);
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
      dndKey: uniqueKey("sec"),
      sectionName: "New Section",
      probe: "",
      items: [],
      images: [],
      sortOrder: sections.length,
      isDirty: true,
    };
    setSections(prev => [...prev, newSection]);
    setExpandedSection(sections.length);
  };

  const handleMoveSection = (sectionIdx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? sectionIdx - 1 : sectionIdx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    setSections(prev => {
      const moved = arrayMove(prev, sectionIdx, targetIdx).map((s, i) => ({ ...s, sortOrder: i, isDirty: true }));
      return moved;
    });
    if (expandedSection === sectionIdx) setExpandedSection(targetIdx);
    else if (expandedSection === targetIdx) setExpandedSection(sectionIdx);
  };

  // ── Item drag end (dnd-kit) ─────────────────────────────────────────────────
  const handleItemDragEnd = (event: DragEndEvent, sectionIdx: number) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections(prev => prev.map((s, si) => {
      if (si !== sectionIdx) return s;
      const oldIndex = s.items.findIndex(item => item.id === active.id);
      const newIndex = s.items.findIndex(item => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return s;
      const newItems = arrayMove(s.items, oldIndex, newIndex).map((item, i) => ({ ...item, sortOrder: i }));
      return { ...s, items: newItems, isDirty: true };
    }));
  };

  const handleUpdateSectionField = (sectionIdx: number, field: "sectionName" | "probe", value: string) => {
    setSections(prev => prev.map((s, i) => i === sectionIdx ? { ...s, [field]: value, isDirty: true } : s));
  };

  const handleAddItem = (sectionIdx: number) => {
    const section = sections[sectionIdx];
    const newItem: ChecklistItem = {
      id: uniqueKey(`${selectedModule}_item`),
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
    const targetIdx = direction === "up" ? itemIdx - 1 : itemIdx + 1;
    if (targetIdx < 0 || targetIdx >= section.items.length) return;
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      const newItems = arrayMove(s.items, itemIdx, targetIdx).map((item, idx) => ({ ...item, sortOrder: idx }));
      return { ...s, items: newItems, isDirty: true };
    }));
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
          images: sections[i].images.map(({ id: _id, uploading: _u, ...img }) => img),
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
              type="button"
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
              {dirtyCount > 0 && <span className="ml-2 text-amber-600">· {dirtyCount} unsaved</span>}
            </span>
          </div>
          {dirtyCount > 0 && (
            <Button size="sm" onClick={handleSaveAll} style={{ background: "#189aa1", color: "white" }}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save All Changes
            </Button>
          )}
          {sections.length > 0 && !sections[0]?.id && (
            <Button size="sm" variant="outline" onClick={handleSeedModule} disabled={isSeeding} className="border-[#189aa1] text-[#189aa1]">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSeeding ? "animate-spin" : ""}`} />
              {isSeeding ? "Seeding…" : "Seed to Database"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleAddSection} className="border-[#189aa1] text-[#189aa1]">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Section
          </Button>
        </div>

        {/* Sections — outer DndContext for section-level drag */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSectionDragEnd}
        >
          <SortableContext
            items={sections.map(s => s.dndKey)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sections.map((section, si) => (
                <SortableSectionCard
                  key={section.dndKey}
                  section={section}
                  si={si}
                  totalSections={sections.length}
                  isExpanded={expandedSection === si}
                  savingSection={savingSection}
                  deletingSection={deletingSection}
                  editingItem={editingItem}
                  sensors={sensors}
                  onToggleExpand={() => setExpandedSection(expandedSection === si ? null : si)}
                  onMoveSection={(dir) => handleMoveSection(si, dir)}
                  onSaveSection={() => handleSaveSection(si)}
                  onDeleteSection={() => handleDeleteSection(si)}
                  onUpdateSectionField={(field, value) => handleUpdateSectionField(si, field, value)}
                  onAddItem={() => handleAddItem(si)}
                  onItemDragEnd={(event) => handleItemDragEnd(event, si)}
                  onUpdateItem={(itemId, field, value) => handleUpdateItem(si, itemId, field, value)}
                  onDeleteItem={(itemId) => handleDeleteItem(si, itemId)}
                  onMoveItem={(itemIdx, dir) => handleMoveItem(si, itemIdx, dir)}
                  onEditItem={(itemId) => setEditingItem(itemId)}
                  onDoneEditItem={() => setEditingItem(null)}
                  onAddImage={(e: React.ChangeEvent<HTMLInputElement>) => { handleAddImages(si, e); }}
                  onRemoveImage={(imgId) => handleRemoveImage(si, imgId)}
                  onUpdateImageCaption={(imgId, caption) => handleUpdateImageCaption(si, imgId, caption)}
                  uploadingImages={uploadingImages}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {sections.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No sections found for this module.</p>
            <button type="button" onClick={handleAddSection} className="mt-3 text-[#189aa1] text-sm font-semibold hover:underline">
              + Add first section
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
