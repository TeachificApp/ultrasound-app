/*
  Form Builder Admin — iHeartEcho™
  Platform-admin-only WYSIWYG editor for accreditation review form templates.
  Features:
  - Template list with create/delete
  - Full form editor: sections, items, options
  - Branching logic builder (item-level conditional display)
  - Org-based visibility rules (show/hide items/sections per OrgID)
  - Quality score weighting
  - Live preview panel with org filter simulation
*/

import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  ChevronLeft,
  ClipboardList,
  Trash2,
  Edit3,
  Eye,
  GitBranch,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Circle,
  Type,
  AlignLeft,
  List,
  CheckSquare,
  ToggleLeft,
  Info,
  Heading,
  X,
  Save,
  RefreshCw,
  Building2,
  GripVertical,
  Mail,
  FileCode,
} from "lucide-react";
import { Link } from "wouter";
import FormPreview from "@/components/FormPreview";
import RichTextEditor from "@/components/RichTextEditor";

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemType = "text" | "textarea" | "email" | "richtext" | "radio" | "checkbox" | "select" | "scale" | "heading" | "info";
type BranchAction = "show" | "hide";
type OrgVisAction = "show_only_for" | "hide_for";
type OrgVisRuleType = "item" | "section";

interface FormOption {
  id?: number;
  itemId?: number;
  label: string;
  value: string;
  sortOrder: number;
  qualityScore: number;
}

interface FormItem {
  id: number;
  sectionId: number;
  templateId: number;
  label: string;
  helpText: string | null;
  itemType: ItemType;
  isRequired: boolean;
  sortOrder: number;
  scaleMin: number | null;
  scaleMax: number | null;
  scaleMinLabel: string | null;
  scaleMaxLabel: string | null;
  scoreWeight: number;
  richTextContent: string | null;
  emailRoutingRules: string | null;
  placeholder: string | null;
  validationRegex: string | null;
  createdAt: Date;
}

interface FormSection {
  id: number;
  templateId: number;
  title: string;
  description: string | null;
  sortOrder: number;
  isCollapsible: boolean;
  createdAt: Date;
}

interface BranchRule {
  id: number;
  templateId: number;
  targetItemId: number;
  conditionItemId: number;
  conditionValue: string;
  action: BranchAction;
  createdAt: Date;
}

interface OrgVisibilityRule {
  id: number;
  templateId: number;
  ruleType: OrgVisRuleType;
  targetId: number;
  action: OrgVisAction;
  orgIds: string; // JSON array
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Organization {
  id: number;
  name: string;
  accreditationTypes: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_TYPE_META: Record<ItemType, { label: string; icon: React.ElementType; description: string }> = {
  text: { label: "Short Text", icon: Type, description: "Single-line text input" },
  textarea: { label: "Long Text", icon: AlignLeft, description: "Multi-line text area" },
  email: { label: "Email", icon: Mail, description: "Email input with optional routing rules" },
  richtext: { label: "Rich Text", icon: FileCode, description: "WYSIWYG editor with image/video/HTML" },
  radio: { label: "Single Choice", icon: Circle, description: "Radio buttons — pick one" },
  checkbox: { label: "Multi Choice", icon: CheckSquare, description: "Checkboxes — pick multiple" },
  select: { label: "Dropdown", icon: List, description: "Dropdown select" },
  scale: { label: "Scale / Rating", icon: ToggleLeft, description: "Numeric scale (e.g. 1–5)" },
  heading: { label: "Section Heading", icon: Heading, description: "Visual heading, not a question" },
  info: { label: "Info Text", icon: Info, description: "Informational paragraph" },
};

const FORM_TYPES = [
  { value: "image_quality", label: "Image Quality Review" },
  { value: "peer_review", label: "Sonographer Peer Review" },
  { value: "physician_peer_review", label: "Physician Peer Review" },
  { value: "case_mix", label: "Case Mix Submission" },
  { value: "accreditation_readiness", label: "Accreditation Readiness" },
  { value: "custom", label: "Custom Form" },
];

const BRAND = "#0891b2";

// ─── Assignments Panel ────────────────────────────────────────────────────────
function AssignmentsPanel({ templates }: { templates: Array<{ id: number; name: string; formType: string; isActive: boolean }> }) {
  const [assignFormType, setAssignFormType] = useState("");
  const [assignTemplateId, setAssignTemplateId] = useState<number | null>(null);
  const [assignOrgId, setAssignOrgId] = useState<number | null>(null);

  const { data: assignments, refetch: refetchAssignments } = trpc.formBuilder.listAssignments.useQuery();
  const { data: orgs } = trpc.formBuilder.listOrganizations.useQuery();

  const assignMutation = trpc.formBuilder.assignTemplate.useMutation({
    onSuccess: () => { toast.success("Template assigned — it will now appear in the Quality Improvement menu"); refetchAssignments(); setAssignFormType(""); setAssignTemplateId(null); setAssignOrgId(null); },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = trpc.formBuilder.removeAssignment.useMutation({
    onSuccess: () => { toast.success("Assignment removed"); refetchAssignments(); },
    onError: (e) => toast.error(e.message),
  });

  const activeTemplates = templates.filter(t => t.isActive);

  return (
    <div className="space-y-6">
      <div className="bg-[#f0fbfc] border border-[#189aa1]/20 rounded-lg p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Publish a Form to Quality Improvement Menus</h3>
        <p className="text-xs text-gray-500 mb-4">Assign an active template to a form type. It will automatically appear as a menu item in Lab Admin and DIY Member Portal Quality Improvement sections. Org-specific assignments override global ones.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Form Type *</label>
            <Select value={assignFormType} onValueChange={setAssignFormType}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select form type" /></SelectTrigger>
              <SelectContent>
                {FORM_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Template *</label>
            <Select value={assignTemplateId ? String(assignTemplateId) : ""} onValueChange={v => setAssignTemplateId(Number(v))}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select template" /></SelectTrigger>
              <SelectContent>
                {activeTemplates.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Organization (optional — global if blank)</label>
            <Select value={assignOrgId ? String(assignOrgId) : "global"} onValueChange={v => setAssignOrgId(v === "global" ? null : Number(v))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">All Organizations (Global)</SelectItem>
                {(orgs ?? []).map((o: { id: number; name: string }) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          className="mt-3 text-white gap-2" size="sm" style={{ background: BRAND }}
          disabled={!assignFormType || !assignTemplateId || assignMutation.isPending}
          onClick={() => assignMutation.mutate({ formType: assignFormType, templateId: assignTemplateId!, orgId: assignOrgId ?? undefined })}
        >
          {assignMutation.isPending ? "Publishing…" : "Publish to Menu"}
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">Active Assignments</h3>
        {!assignments || assignments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No forms published yet. Use the panel above to assign a template.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a: { id: number; formType: string; templateId: number; orgId: number | null; isActive: boolean }) => {
              const template = templates.find(t => t.id === a.templateId);
              const org = (orgs ?? []).find((o: { id: number; name: string }) => o.id === a.orgId);
              const formLabel = FORM_TYPES.find(f => f.value === a.formType)?.label ?? a.formType;
              return (
                <div key={a.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.isActive ? "bg-green-400" : "bg-gray-300"}`} />
                    <div>
                      <div className="text-sm font-medium text-gray-800">{formLabel}</div>
                      <div className="text-xs text-gray-400">
                        {template?.name ?? `Template #${a.templateId}`}
                        {org ? ` · ${org.name}` : " · All Organizations"}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                    onClick={() => { if (confirm("Remove this assignment? The form will no longer appear in menus.")) removeMutation.mutate({ id: a.id }); }}
                  >
                    <X className="w-3 h-3" /> Remove
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Template List ────────────────────────────────────────────────────────────
function TemplateList() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("image_quality");
  const [newDesc, setNewDesc] = useState("");
  const [listTab, setListTab] = useState<"templates" | "assignments">("templates");

  const { data: templates, isLoading, refetch } = trpc.formBuilder.listTemplates.useQuery();

  const createMutation = trpc.formBuilder.createTemplate.useMutation({
    onSuccess: ({ id }) => {
      toast.success("Form template created");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      refetch();
      navigate(`/admin/form-builder/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.formBuilder.deleteTemplate.useMutation({
    onSuccess: () => { toast.success("Template deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/platform-admin">
            <Button variant="ghost" size="sm" className="gap-1 text-gray-500">
              <ChevronLeft className="w-4 h-4" /> Platform Admin
            </Button>
          </Link>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND + "18" }}>
              <ClipboardList className="w-4 h-4" style={{ color: BRAND }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>
                Form Builder
              </h1>
              <p className="text-xs text-gray-500">Accreditation review form templates</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} style={{ background: BRAND }} className="text-white gap-2" size="sm">
          <Plus className="w-4 h-4" /> New Form
        </Button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["templates", "assignments"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setListTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              listTab === tab ? "border-[#0891b2] text-[#0891b2]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "templates" ? "Form Templates" : "Publish to Menus"}
          </button>
        ))}
      </div>

      {listTab === "assignments" ? (
        <AssignmentsPanel templates={templates ?? []} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading templates…
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No form templates yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first accreditation review form</p>
          <Button onClick={() => setCreateOpen(true)} style={{ background: BRAND }} className="text-white gap-2 mt-4" size="sm">
            <Plus className="w-4 h-4" /> Create Form Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND + "15" }}>
                    <ClipboardList className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-800 text-sm mb-1">{t.name}</h3>
                <p className="text-xs text-gray-400 mb-1">{FORM_TYPES.find(f => f.value === t.formType)?.label ?? t.formType}</p>
                {t.description && <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{t.description}</p>}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                  <Link href={`/admin/form-builder/${t.id}`} className="flex-1">
                    <Button size="sm" className="w-full gap-1 text-xs" style={{ background: BRAND }} variant="default">
                      <Edit3 className="w-3 h-3" /> Edit Form
                    </Button>
                  </Link>
                  <Button
                    size="sm" variant="outline"
                    className="gap-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => { if (confirm(`Delete "${t.name}"? This cannot be undone.`)) deleteMutation.mutate({ id: t.id }); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" style={{ color: BRAND }} /> New Form Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Form Name *</label>
              <Input placeholder="e.g. Image Quality Review 2025" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Form Type *</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORM_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Description (optional)</label>
              <Input placeholder="Brief description of this form's purpose" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ name: newName.trim(), formType: newType, description: newDesc || undefined })}
              disabled={!newName.trim() || createMutation.isPending}
              style={{ background: BRAND }} className="text-white"
            >
              {createMutation.isPending ? "Creating…" : "Create Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Item Type Picker ─────────────────────────────────────────────────────────

function ItemTypePicker({ value, onChange }: { value: ItemType; onChange: (v: ItemType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(Object.entries(ITEM_TYPE_META) as [ItemType, typeof ITEM_TYPE_META[ItemType]][]).map(([type, meta]) => (
        <button
          key={type} type="button" onClick={() => onChange(type)}
          className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-xs ${
            value === type ? "border-[#0891b2] bg-[#0891b2]/5 text-[#0891b2]" : "border-gray-200 hover:border-gray-300 text-gray-600"
          }`}
        >
          <meta.icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">{meta.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Option Editor ────────────────────────────────────────────────────────────

function OptionEditor({ options, onChange }: { options: FormOption[]; onChange: (opts: FormOption[]) => void }) {
  const addOption = () => {
    onChange([...options, { label: `Option ${options.length + 1}`, value: `option_${options.length + 1}`, sortOrder: options.length, qualityScore: 0 }]);
  };

  const updateOption = (idx: number, field: keyof FormOption, val: string | number) => {
    onChange(options.map((o, i) => i === idx ? { ...o, [field]: val } : o));
  };

  const removeOption = (idx: number) => onChange(options.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Answer Options</label>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addOption}>
          <Plus className="w-3 h-3" /> Add Option
        </Button>
      </div>
      {options.length === 0 && <p className="text-xs text-gray-400 italic">No options yet. Add at least one.</p>}
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
          <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0" />
          <Input
            className="h-7 text-xs flex-1"
            placeholder="Option label"
            value={opt.label}
            onChange={e => {
              updateOption(idx, "label", e.target.value);
              updateOption(idx, "value", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
            }}
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-gray-400">Score:</span>
            <Input className="h-7 text-xs w-16" type="number" min={0} max={100} placeholder="0"
              value={opt.qualityScore} onChange={e => updateOption(idx, "qualityScore", parseInt(e.target.value) || 0)} />
          </div>
          <button type="button" onClick={() => removeOption(idx)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      {options.length > 0 && <p className="text-xs text-gray-400">Score (0–100): contribution to quality score when this option is selected.</p>}
    </div>
  );
}

// ─── Item Editor Dialog ───────────────────────────────────────────────────────

interface ItemEditorProps {
  open: boolean;
  onClose: () => void;
  item?: FormItem | null;
  existingOptions?: FormOption[];
  sectionId: number;
  templateId: number;
  onSaved: () => void;
}

function ItemEditorDialog({ open, onClose, item, existingOptions, sectionId, templateId, onSaved }: ItemEditorProps) {
  const isEdit = !!item;
  const [label, setLabel] = useState(item?.label ?? "");
  const [helpText, setHelpText] = useState(item?.helpText ?? "");
  const [itemType, setItemType] = useState<ItemType>(item?.itemType ?? "radio");
  const [isRequired, setIsRequired] = useState(item?.isRequired ?? false);
  const [scoreWeight, setScoreWeight] = useState(item?.scoreWeight ?? 1);
  const [scaleMin, setScaleMin] = useState(item?.scaleMin ?? 1);
  const [scaleMax, setScaleMax] = useState(item?.scaleMax ?? 5);
  const [scaleMinLabel, setScaleMinLabel] = useState(item?.scaleMinLabel ?? "");
  const [scaleMaxLabel, setScaleMaxLabel] = useState(item?.scaleMaxLabel ?? "");
   const [options, setOptions] = useState<FormOption[]>(existingOptions ?? []);
  const [richTextContent, setRichTextContent] = useState(item?.richTextContent ?? "");
  const [placeholder, setPlaceholder] = useState(item?.placeholder ?? "");
  const [validationRegex, setValidationRegex] = useState(item?.validationRegex ?? "");
  const [emailRoutingRules, setEmailRoutingRules] = useState(item?.emailRoutingRules ?? "");
  const createMutation = trpc.formBuilder.createItem.useMutation({
    onSuccess: () => { toast.success("Item added"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.formBuilder.updateItem.useMutation({
    onSuccess: () => { toast.success("Item updated"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!label.trim()) { toast.error("Label is required"); return; }
    const hasOptions = ["radio", "checkbox", "select"].includes(itemType);
    if (hasOptions && options.length === 0) { toast.error("Add at least one option"); return; }

    const payload = {
      label: label.trim(),
      helpText: helpText.trim() || undefined,
      itemType,
      isRequired,
      scoreWeight,
      scaleMin: itemType === "scale" ? scaleMin : undefined,
      scaleMax: itemType === "scale" ? scaleMax : undefined,
      scaleMinLabel: itemType === "scale" ? scaleMinLabel || undefined : undefined,
      scaleMaxLabel: itemType === "scale" ? scaleMaxLabel || undefined : undefined,
      richTextContent: ["richtext", "info"].includes(itemType) ? richTextContent || undefined : undefined,
      emailRoutingRules: itemType === "email" && emailRoutingRules.trim() ? emailRoutingRules : undefined,
      placeholder: ["text", "textarea", "email"].includes(itemType) ? placeholder || undefined : undefined,
      validationRegex: ["text", "email"].includes(itemType) ? validationRegex || undefined : undefined,
      options: hasOptions ? options : undefined,
    };

    if (isEdit && item) {
      updateMutation.mutate({ id: item.id, ...payload });
    } else {
      createMutation.mutate({ sectionId, templateId, sortOrder: 999, ...payload });
    }
  };

  const hasOptions = ["radio", "checkbox", "select"].includes(itemType);
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5" style={{ color: BRAND }} />
            {isEdit ? "Edit Item" : "Add Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Item Type</label>
            <ItemTypePicker value={itemType} onChange={setItemType} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              {itemType === "heading" ? "Heading Text" : itemType === "info" ? "Info Text" : "Question / Label"} *
            </label>
            <Input
              placeholder={itemType === "heading" ? "Section heading" : itemType === "info" ? "Informational text" : "Enter question text"}
              value={label} onChange={e => setLabel(e.target.value)}
            />
          </div>
          {!["heading", "info"].includes(itemType) && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Help Text (optional)</label>
              <Input placeholder="Additional guidance shown below the question" value={helpText} onChange={e => setHelpText(e.target.value)} />
            </div>
          )}
          {itemType === "scale" && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Min Value</label>
                <Input type="number" value={scaleMin} onChange={e => setScaleMin(parseInt(e.target.value) || 1)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Max Value</label>
                <Input type="number" value={scaleMax} onChange={e => setScaleMax(parseInt(e.target.value) || 5)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Min Label (optional)</label>
                <Input placeholder="e.g. Poor" value={scaleMinLabel} onChange={e => setScaleMinLabel(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Max Label (optional)</label>
                <Input placeholder="e.g. Excellent" value={scaleMaxLabel} onChange={e => setScaleMaxLabel(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          )}          {hasOptions && <OptionEditor options={options} onChange={setOptions} />}
          {["richtext", "info"].includes(itemType) && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                {itemType === "info" ? "Info Block Content" : "Rich Text Content"}
              </label>
              <RichTextEditor
                value={richTextContent}
                onChange={setRichTextContent}
                placeholder={itemType === "info" ? "Enter informational content, embed images or videos…" : "Enter rich text content…"}
                minHeight={180}
              />
            </div>
          )}
          {["text", "textarea", "email"].includes(itemType) && (
            <div className="grid grid-cols-1 gap-3 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Placeholder Text (optional)</label>
                <Input
                  placeholder={itemType === "email" ? "e.g. reviewer@hospital.org" : "e.g. Enter your response here…"}
                  value={placeholder}
                  onChange={e => setPlaceholder(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {["text", "email"].includes(itemType) && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Validation Pattern (regex, optional)</label>
                  <Input
                    placeholder={itemType === "email" ? "Leave blank for standard email validation" : "e.g. ^[A-Z]{2}\\d{4}$"}
                    value={validationRegex}
                    onChange={e => setValidationRegex(e.target.value)}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              )}
            </div>
          )}
          {itemType === "email" && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <label className="text-xs font-semibold text-blue-700 block mb-2 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email Routing Rules (JSON)
              </label>
              <p className="text-xs text-blue-600 mb-2">
                Define routing rules as a JSON array. Each rule specifies which email address to route to based on a condition.
              </p>
              <textarea
                className="w-full min-h-[100px] font-mono text-xs border border-blue-200 rounded-lg p-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                placeholder={`[\n  {\n    "label": "Route to reviewer",\n    "conditionItemId": 5,\n    "conditionValue": "yes",\n    "routeTo": "reviewer@hospital.org"\n  }\n]`}
                value={emailRoutingRules}
                onChange={e => setEmailRoutingRules(e.target.value)}
              />
            </div>
          )}
          {!["heading", "info"].includes(itemType) && (
            <div className="flex items-center gap-6 p-3 bg-gray-50 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-sm font-medium text-gray-700">Required field</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Score Weight:</label>
                <Input type="number" min={0} max={10} value={scoreWeight} onChange={e => setScoreWeight(parseInt(e.target.value) || 1)} className="h-8 w-20 text-sm" />
                <span className="text-xs text-gray-400">(0–10)</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending} style={{ background: BRAND }} className="text-white gap-2">
            {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Save Changes" : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Branch Rule Builder ──────────────────────────────────────────────────────

function BranchRuleBuilder({ templateId, items, options, rules, onSaved }: {
  templateId: number;
  items: FormItem[];
  options: FormOption[];
  rules: BranchRule[];
  onSaved: () => void;
}) {
  const [localRules, setLocalRules] = useState(
    rules.map(r => ({ templateId: r.templateId, targetItemId: r.targetItemId, conditionItemId: r.conditionItemId, conditionValue: r.conditionValue, action: r.action }))
  );

  const saveMutation = trpc.formBuilder.saveBranchRules.useMutation({
    onSuccess: () => { toast.success("Branching rules saved"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const questionItems = items.filter(i => !["heading", "info"].includes(i.itemType));

  const addRule = () => {
    if (questionItems.length < 2) { toast.error("Need at least 2 questions to create a branching rule"); return; }
    setLocalRules([...localRules, { templateId, targetItemId: questionItems[1]?.id ?? 0, conditionItemId: questionItems[0]?.id ?? 0, conditionValue: "", action: "show" }]);
  };

  const updateRule = (idx: number, field: string, val: string | number) => {
    setLocalRules(localRules.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const removeRule = (idx: number) => setLocalRules(localRules.filter((_, i) => i !== idx));

  const getItemOptions = (itemId: number) => options.filter(o => {
    const item = items.find(i => i.id === itemId);
    return item && ["radio", "checkbox", "select"].includes(item.itemType) && (o as any).itemId === itemId;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <GitBranch className="w-4 h-4" style={{ color: BRAND }} /> Branching Logic
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Show or hide items based on previous answers</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={addRule}>
          <Plus className="w-3 h-3" /> Add Rule
        </Button>
      </div>

      {localRules.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
          <GitBranch className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No branching rules yet</p>
          <p className="text-xs text-gray-300 mt-1">Add rules to show/hide items based on responses</p>
        </div>
      ) : (
        <div className="space-y-3">
          {localRules.map((rule, idx) => {
            const condItemOpts = getItemOptions(rule.conditionItemId);
            return (
              <div key={idx} className="p-3 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-500 uppercase tracking-wide w-8">IF</span>
                  <Select value={String(rule.conditionItemId)} onValueChange={v => updateRule(idx, "conditionItemId", parseInt(v))}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select question…" /></SelectTrigger>
                    <SelectContent>
                      {questionItems.map(item => (
                        <SelectItem key={item.id} value={String(item.id)} className="text-xs">
                          {item.label.length > 50 ? item.label.slice(0, 50) + "…" : item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="font-semibold text-gray-500">=</span>
                  {condItemOpts.length > 0 ? (
                    <Select value={rule.conditionValue} onValueChange={v => updateRule(idx, "conditionValue", v)}>
                      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select value…" /></SelectTrigger>
                      <SelectContent>
                        {condItemOpts.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="h-7 text-xs flex-1" placeholder="Value…" value={rule.conditionValue} onChange={e => updateRule(idx, "conditionValue", e.target.value)} />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-500 uppercase tracking-wide w-8">THEN</span>
                  <Select value={rule.action} onValueChange={v => updateRule(idx, "action", v as BranchAction)}>
                    <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="show" className="text-xs">Show</SelectItem>
                      <SelectItem value="hide" className="text-xs">Hide</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={String(rule.targetItemId)} onValueChange={v => updateRule(idx, "targetItemId", parseInt(v))}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select item to show/hide…" /></SelectTrigger>
                    <SelectContent>
                      {questionItems.filter(i => i.id !== rule.conditionItemId).map(item => (
                        <SelectItem key={item.id} value={String(item.id)} className="text-xs">
                          {item.label.length > 50 ? item.label.slice(0, 50) + "…" : item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button onClick={() => removeRule(idx)} className="text-gray-300 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button
        onClick={() => saveMutation.mutate({ templateId, rules: localRules })}
        disabled={saveMutation.isPending}
        style={{ background: BRAND }} className="text-white gap-2 w-full" size="sm"
      >
        {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Branching Rules
      </Button>
    </div>
  );
}

// ─── Org Visibility Rule Builder ──────────────────────────────────────────────

function OrgVisibilityBuilder({ templateId, items, sections, rules, onSaved }: {
  templateId: number;
  items: FormItem[];
  sections: FormSection[];
  rules: OrgVisibilityRule[];
  onSaved: () => void;
}) {
  const { data: organizations, isLoading: orgsLoading } = trpc.formBuilder.listOrganizations.useQuery();

  type LocalRule = {
    ruleType: OrgVisRuleType;
    targetId: number;
    action: OrgVisAction;
    orgIds: number[];
    label: string;
  };

  const parseRule = (r: OrgVisibilityRule): LocalRule => ({
    ruleType: r.ruleType,
    targetId: r.targetId,
    action: r.action,
    orgIds: JSON.parse(r.orgIds || "[]"),
    label: r.label ?? "",
  });

  const [localRules, setLocalRules] = useState<LocalRule[]>(rules.map(parseRule));

  const saveMutation = trpc.formBuilder.saveOrgVisibilityRules.useMutation({
    onSuccess: () => { toast.success("Org visibility rules saved"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const addRule = () => {
    setLocalRules([...localRules, {
      ruleType: "item",
      targetId: items[0]?.id ?? 0,
      action: "show_only_for",
      orgIds: [],
      label: "",
    }]);
  };

  const updateRule = (idx: number, field: keyof LocalRule, val: unknown) => {
    setLocalRules(localRules.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const toggleOrg = (idx: number, orgId: number) => {
    const current = localRules[idx].orgIds;
    const next = current.includes(orgId) ? current.filter(id => id !== orgId) : [...current, orgId];
    updateRule(idx, "orgIds", next);
  };

  const removeRule = (idx: number) => setLocalRules(localRules.filter((_, i) => i !== idx));

  const getTargetLabel = (rule: LocalRule) => {
    if (rule.ruleType === "item") {
      const item = items.find(i => i.id === rule.targetId);
      return item ? item.label : `Item #${rule.targetId}`;
    } else {
      const section = sections.find(s => s.id === rule.targetId);
      return section ? section.title : `Section #${rule.targetId}`;
    }
  };

  const targetOptions = (ruleType: OrgVisRuleType) =>
    ruleType === "item"
      ? items.filter(i => !["heading", "info"].includes(i.itemType))
      : sections;

  if (orgsLoading) {
    return <div className="flex items-center gap-2 text-gray-400 py-8 justify-center"><RefreshCw className="w-4 h-4 animate-spin" /> Loading organizations…</div>;
  }

  const noOrgs = !organizations || organizations.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: BRAND }} /> Organization Visibility Rules
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Show or hide specific items/sections for particular accreditation organizations (by OrgID)
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={addRule} disabled={noOrgs || items.length === 0}>
          <Plus className="w-3 h-3" /> Add Rule
        </Button>
      </div>

      {noOrgs && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          No accreditation organizations found. Organizations are created when labs register via DIY Accreditation. Once organizations exist, you can create org-specific visibility rules here.
        </div>
      )}

      {!noOrgs && localRules.length === 0 && (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
          <Building2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No org visibility rules yet</p>
          <p className="text-xs text-gray-300 mt-1">
            All items and sections are visible to all organizations by default
          </p>
        </div>
      )}

      {localRules.length > 0 && (
        <div className="space-y-4">
          {localRules.map((rule, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-3">
              {/* Rule header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rule {idx + 1}</span>
                <button onClick={() => removeRule(idx)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Optional label */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Rule Label (optional, for your reference)</label>
                <Input
                  className="h-7 text-xs"
                  placeholder="e.g. IAC-only question, Hide for non-ICAEL orgs…"
                  value={rule.label}
                  onChange={e => updateRule(idx, "label", e.target.value)}
                />
              </div>

              {/* Target type + target */}
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Apply to</label>
                  <Select value={rule.ruleType} onValueChange={v => {
                    const newType = v as OrgVisRuleType;
                    const firstTarget = targetOptions(newType)[0];
                    updateRule(idx, "ruleType", newType);
                    updateRule(idx, "targetId", firstTarget?.id ?? 0);
                  }}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="item" className="text-xs">Item</SelectItem>
                      <SelectItem value="section" className="text-xs">Section</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    {rule.ruleType === "item" ? "Which item?" : "Which section?"}
                  </label>
                  <Select value={String(rule.targetId)} onValueChange={v => updateRule(idx, "targetId", parseInt(v))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {targetOptions(rule.ruleType).map(t => (
                        <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                          {"label" in t ? (t.label.length > 60 ? t.label.slice(0, 60) + "…" : t.label) : t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Visibility action</label>
                <div className="flex gap-2">
                  {[
                    { value: "show_only_for" as OrgVisAction, label: "Show only for selected orgs", desc: "Hidden for all others" },
                    { value: "hide_for" as OrgVisAction, label: "Hide for selected orgs", desc: "Visible for all others" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateRule(idx, "action", opt.value)}
                      className={`flex-1 p-2.5 rounded-lg border text-left transition-all ${
                        rule.action === opt.value
                          ? "border-[#0891b2] bg-[#0891b2]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className={`text-xs font-semibold ${rule.action === opt.value ? "text-[#0891b2]" : "text-gray-700"}`}>{opt.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Org selector */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">
                  Organizations ({rule.orgIds.length} selected)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-lg border border-gray-200 bg-white">
                  {organizations?.map(org => {
                    const selected = rule.orgIds.includes(org.id);
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => toggleOrg(idx, org.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                          selected
                            ? "border-[#0891b2] bg-[#0891b2] text-white"
                            : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <Building2 className="w-2.5 h-2.5" />
                        {org.name}
                        <span className="opacity-60">#{org.id}</span>
                      </button>
                    );
                  })}
                </div>
                {rule.orgIds.length === 0 && rule.action === "show_only_for" && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" /> No orgs selected — this item will be hidden for everyone.
                  </p>
                )}
                {rule.orgIds.length === 0 && rule.action === "hide_for" && (
                  <p className="text-xs text-gray-400 mt-1">No orgs selected — rule has no effect (item visible to all).</p>
                )}
              </div>

              {/* Summary */}
              <div className="p-2 rounded-lg bg-white border border-gray-100 text-xs text-gray-500">
                <span className="font-medium text-gray-700">Summary: </span>
                {rule.action === "show_only_for" ? (
                  <>
                    <span className="font-medium" style={{ color: BRAND }}>{getTargetLabel(rule)}</span>
                    {" "}is visible <strong>only</strong> for:{" "}
                    {rule.orgIds.length === 0
                      ? <span className="text-amber-600">no one (hidden for all)</span>
                      : rule.orgIds.map(id => organizations?.find(o => o.id === id)?.name ?? `Org #${id}`).join(", ")
                    }
                  </>
                ) : (
                  <>
                    <span className="font-medium" style={{ color: BRAND }}>{getTargetLabel(rule)}</span>
                    {" "}is <strong>hidden</strong> for:{" "}
                    {rule.orgIds.length === 0
                      ? <span className="text-gray-400">no one (visible to all)</span>
                      : rule.orgIds.map(id => organizations?.find(o => o.id === id)?.name ?? `Org #${id}`).join(", ")
                    }
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!noOrgs && (
        <Button
          onClick={() => saveMutation.mutate({ templateId, rules: localRules })}
          disabled={saveMutation.isPending}
          style={{ background: BRAND }} className="text-white gap-2 w-full" size="sm"
        >
          {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Org Visibility Rules
        </Button>
      )}
    </div>
  );
}

// ─── Form Editor ──────────────────────────────────────────────────────────────

function FormEditor({ templateId }: { templateId: number }) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"editor" | "branching" | "org-visibility" | "preview">("editor");
  const [editingItem, setEditingItem] = useState<FormItem | null>(null);
  const [editingItemOptions, setEditingItemOptions] = useState<FormOption[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [addToSectionId, setAddToSectionId] = useState<number | null>(null);
  const [editingSection, setEditingSection] = useState<FormSection | null>(null);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [tempName, setTempName] = useState("");

  const { data: formData, isLoading, refetch } = trpc.formBuilder.getFullTemplate.useQuery({ id: templateId });
  const { data: orgVisRules, refetch: refetchOrgVis } = trpc.formBuilder.getOrgVisibilityRules.useQuery({ templateId });

  const createSectionMutation = trpc.formBuilder.createSection.useMutation({
    onSuccess: () => { toast.success("Section added"); refetch(); setSectionDialogOpen(false); setNewSectionTitle(""); },
    onError: (e) => toast.error(e.message),
  });

  const updateSectionMutation = trpc.formBuilder.updateSection.useMutation({
    onSuccess: () => { toast.success("Section updated"); refetch(); setSectionDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const deleteSectionMutation = trpc.formBuilder.deleteSection.useMutation({
    onSuccess: () => { toast.success("Section deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteItemMutation = trpc.formBuilder.deleteItem.useMutation({
    onSuccess: () => { toast.success("Item removed"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateTemplateMutation = trpc.formBuilder.updateTemplate.useMutation({
    onSuccess: () => { toast.success("Template updated"); refetch(); setEditingTemplateName(false); },
    onError: (e) => toast.error(e.message),
  });

  const reorderSectionsMutation = trpc.formBuilder.reorderSections.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const reorderItemsMutation = trpc.formBuilder.reorderItems.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading form…</div>;
  }

  if (!formData) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Form not found.</p>
        <Button variant="outline" onClick={() => navigate("/admin/form-builder")} className="mt-4">Back to Forms</Button>
      </div>
    );
  }

  const { template, sections, items, options, branchRules } = formData;

  const getItemsForSection = (sectionId: number) =>
    items.filter(i => i.sectionId === sectionId).sort((a, b) => a.sortOrder - b.sortOrder);

  const getOptionsForItem = (itemId: number) =>
    options.filter((o: any) => o.itemId === itemId).sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const toggleSection = (id: number) => {
    setCollapsedSections(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const moveSectionUp = (section: FormSection) => {
    const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(s => s.id === section.id);
    if (idx <= 0) return;
    const prev = sorted[idx - 1];
    reorderSectionsMutation.mutate({ orders: [{ id: section.id, sortOrder: prev.sortOrder }, { id: prev.id, sortOrder: section.sortOrder }] });
  };

  const moveSectionDown = (section: FormSection) => {
    const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(s => s.id === section.id);
    if (idx >= sorted.length - 1) return;
    const next = sorted[idx + 1];
    reorderSectionsMutation.mutate({ orders: [{ id: section.id, sortOrder: next.sortOrder }, { id: next.id, sortOrder: section.sortOrder }] });
  };

  const moveItemUp = (item: FormItem) => {
    const sectionItems = getItemsForSection(item.sectionId);
    const idx = sectionItems.findIndex(i => i.id === item.id);
    if (idx <= 0) return;
    const prev = sectionItems[idx - 1];
    reorderItemsMutation.mutate({ orders: [{ id: item.id, sortOrder: prev.sortOrder, sectionId: item.sectionId }, { id: prev.id, sortOrder: item.sortOrder, sectionId: item.sectionId }] });
  };

  const moveItemDown = (item: FormItem) => {
    const sectionItems = getItemsForSection(item.sectionId);
    const idx = sectionItems.findIndex(i => i.id === item.id);
    if (idx >= sectionItems.length - 1) return;
    const next = sectionItems[idx + 1];
    reorderItemsMutation.mutate({ orders: [{ id: item.id, sortOrder: next.sortOrder, sectionId: item.sectionId }, { id: next.id, sortOrder: item.sortOrder, sectionId: item.sectionId }] });
  };

  const openAddItem = (sectionId: number) => { setEditingItem(null); setEditingItemOptions([]); setAddToSectionId(sectionId); setItemDialogOpen(true); };
  const openEditItem = (item: FormItem) => { setEditingItem(item); setEditingItemOptions(getOptionsForItem(item.id)); setAddToSectionId(item.sectionId); setItemDialogOpen(true); };
  const openEditSection = (section: FormSection) => { setEditingSection(section); setNewSectionTitle(section.title); setSectionDialogOpen(true); };
  const openAddSection = () => { setEditingSection(null); setNewSectionTitle(""); setSectionDialogOpen(true); };

  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  const orgVisRulesCount = orgVisRules?.length ?? 0;
  const branchRulesCount = branchRules.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1 text-gray-500" onClick={() => navigate("/admin/form-builder")}>
            <ChevronLeft className="w-4 h-4" /> Forms
          </Button>
          <div className="w-px h-5 bg-gray-200" />
          {editingTemplateName ? (
            <div className="flex items-center gap-2">
              <Input value={tempName} onChange={e => setTempName(e.target.value)} className="h-8 text-sm font-semibold w-64"
                onKeyDown={e => { if (e.key === "Enter") updateTemplateMutation.mutate({ id: templateId, name: tempName.trim() }); if (e.key === "Escape") setEditingTemplateName(false); }}
                autoFocus />
              <Button size="sm" style={{ background: BRAND }} className="text-white h-8" onClick={() => updateTemplateMutation.mutate({ id: templateId, name: tempName.trim() })}>Save</Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingTemplateName(false)}>Cancel</Button>
            </div>
          ) : (
            <button className="flex items-center gap-2 group" onClick={() => { setTempName(template.name); setEditingTemplateName(true); }}>
              <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>{template.name}</h1>
              <Edit3 className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${template.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {template.isActive ? "Active" : "Inactive"}
          </span>
          <Button size="sm" variant="outline" className="text-xs gap-1"
            onClick={() => updateTemplateMutation.mutate({ id: templateId, isActive: !template.isActive })}>
            {template.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100">
        {[
          { id: "editor" as const, label: "Form Editor", icon: Edit3, badge: null },
          { id: "branching" as const, label: "Branching Logic", icon: GitBranch, badge: branchRulesCount > 0 ? branchRulesCount : null },
          { id: "org-visibility" as const, label: "Org Visibility", icon: Building2, badge: orgVisRulesCount > 0 ? orgVisRulesCount : null },
          { id: "preview" as const, label: "Preview", icon: Eye, badge: null },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab.id ? "border-[#0891b2] text-[#0891b2]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.badge !== null && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-[#0891b2]/10 text-[#0891b2] font-semibold">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Editor Tab */}
      {activeTab === "editor" && (
        <div className="space-y-4">
          {sortedSections.length === 0 && (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
              <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No sections yet</p>
              <p className="text-gray-400 text-sm mt-1">Add a section to start building your form</p>
            </div>
          )}

          {sortedSections.map((section, sIdx) => {
            const sectionItems = getItemsForSection(section.id);
            const isCollapsed = collapsedSections.has(section.id);
            const hasOrgRule = orgVisRules?.some(r => r.ruleType === "section" && r.targetId === section.id);

            return (
              <Card key={section.id} className="border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 p-4 border-b border-gray-50 bg-gray-50/50 rounded-t-xl">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveSectionUp(section)} disabled={sIdx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => moveSectionDown(section)} disabled={sIdx === sortedSections.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"><ChevronDown className="w-3 h-3" /></button>
                  </div>
                  <button onClick={() => toggleSection(section.id)} className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                      <span className="font-semibold text-gray-800 text-sm">{section.title}</span>
                      <span className="text-xs text-gray-400">({sectionItems.length} item{sectionItems.length !== 1 ? "s" : ""})</span>
                      {hasOrgRule && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium flex items-center gap-0.5">
                          <Building2 className="w-2.5 h-2.5" /> org rule
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600" onClick={() => openEditSection(section)}><Edit3 className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                      onClick={() => { if (confirm(`Delete section "${section.title}" and all its items?`)) deleteSectionMutation.mutate({ id: section.id }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {!isCollapsed && (
                  <CardContent className="p-3 space-y-2">
                    {sectionItems.length === 0 && <p className="text-xs text-gray-400 italic text-center py-3">No items in this section</p>}
                    {sectionItems.map((item, iIdx) => {
                      const ItemIcon = ITEM_TYPE_META[item.itemType]?.icon ?? Circle;
                      const itemOpts = getOptionsForItem(item.id);
                      const hasBranchRule = branchRules.some(r => r.targetItemId === item.id || r.conditionItemId === item.id);
                      const hasOrgItemRule = orgVisRules?.some(r => r.ruleType === "item" && r.targetId === item.id);

                      return (
                        <div key={item.id} className="flex items-start gap-2 p-3 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-all group">
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <button onClick={() => moveItemUp(item)} disabled={iIdx === 0} className="text-gray-200 hover:text-gray-400 disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                            <button onClick={() => moveItemDown(item)} disabled={iIdx === sectionItems.length - 1} className="text-gray-200 hover:text-gray-400 disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                          </div>
                          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: BRAND + "12" }}>
                            <ItemIcon className="w-3 h-3" style={{ color: BRAND }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 truncate">{item.label}</span>
                              {item.isRequired && <span className="text-xs text-red-500 font-medium">*</span>}
                              {hasBranchRule && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium flex items-center gap-0.5">
                                  <GitBranch className="w-2.5 h-2.5" /> branched
                                </span>
                              )}
                              {hasOrgItemRule && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium flex items-center gap-0.5">
                                  <Building2 className="w-2.5 h-2.5" /> org rule
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">{ITEM_TYPE_META[item.itemType]?.label}</span>
                              {item.scoreWeight > 0 && (
                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                  <BarChart2 className="w-2.5 h-2.5" /> weight: {item.scoreWeight}
                                </span>
                              )}
                            </div>
                            {item.helpText && <p className="text-xs text-gray-400 mt-0.5 italic">{item.helpText}</p>}
                            {itemOpts.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {itemOpts.map((opt: any) => (
                                  <span key={opt.id} className="text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-100">
                                    {opt.label} {opt.qualityScore > 0 && <span className="text-[#0891b2]">({opt.qualityScore})</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600" onClick={() => openEditItem(item)}><Edit3 className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                              onClick={() => { if (confirm("Remove this item?")) deleteItemMutation.mutate({ id: item.id }); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    <Button size="sm" variant="outline" className="w-full gap-1 text-xs border-dashed text-gray-400 hover:text-gray-600 mt-1" onClick={() => openAddItem(section.id)}>
                      <Plus className="w-3 h-3" /> Add Item to "{section.title}"
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}

          <Button variant="outline" className="w-full gap-2 border-dashed text-gray-500 hover:text-gray-700" onClick={openAddSection}>
            <Plus className="w-4 h-4" /> Add Section
          </Button>
        </div>
      )}

      {/* Branching Tab */}
      {activeTab === "branching" && (
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <BranchRuleBuilder templateId={templateId} items={items} options={options} rules={branchRules} onSaved={refetch} />
          </CardContent>
        </Card>
      )}

      {/* Org Visibility Tab */}
      {activeTab === "org-visibility" && (
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <OrgVisibilityBuilder
              templateId={templateId}
              items={items}
              sections={sections}
              rules={orgVisRules ?? []}
              onSaved={() => { refetch(); refetchOrgVis(); }}
            />
          </CardContent>
        </Card>
      )}

      {/* Preview Tab */}
      {activeTab === "preview" && (
        <FormPreview
          template={template}
          sections={sortedSections}
          items={items}
          options={options}
          branchRules={branchRules}
          orgVisibilityRules={orgVisRules ?? []}
        />
      )}

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingSection ? "Edit Section" : "Add Section"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Section Title *</label>
              <Input placeholder="e.g. Image Quality Assessment" value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newSectionTitle.trim()) {
                    if (editingSection) updateSectionMutation.mutate({ id: editingSection.id, title: newSectionTitle.trim() });
                    else createSectionMutation.mutate({ templateId, title: newSectionTitle.trim(), sortOrder: sections.length });
                  }
                }} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newSectionTitle.trim()) return;
                if (editingSection) updateSectionMutation.mutate({ id: editingSection.id, title: newSectionTitle.trim() });
                else createSectionMutation.mutate({ templateId, title: newSectionTitle.trim(), sortOrder: sections.length });
              }}
              disabled={!newSectionTitle.trim() || createSectionMutation.isPending || updateSectionMutation.isPending}
              style={{ background: BRAND }} className="text-white"
            >
              {editingSection ? "Save" : "Add Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Editor Dialog */}
      {itemDialogOpen && addToSectionId !== null && (
        <ItemEditorDialog
          open={itemDialogOpen}
          onClose={() => { setItemDialogOpen(false); setEditingItem(null); setEditingItemOptions([]); }}
          item={editingItem}
          existingOptions={editingItemOptions}
          sectionId={addToSectionId}
          templateId={templateId}
          onSaved={refetch}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FormBuilderAdmin() {
  const params = useParams<{ id?: string }>();
  const templateId = params.id ? parseInt(params.id) : null;

  return (
    <Layout>
      <div className="container py-8 max-w-5xl">
        {templateId && !isNaN(templateId) ? (
          <FormEditor templateId={templateId} />
        ) : (
          <TemplateList />
        )}
      </div>
    </Layout>
  );
}
