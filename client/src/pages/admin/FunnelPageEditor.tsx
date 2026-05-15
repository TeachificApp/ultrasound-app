/**
 * FunnelPageEditor.tsx
 * Full-screen drag-and-drop WYSIWYG block editor for funnel pages.
 * Route: /admin/funnels/:funnelId/pages/:pageId/edit
 * Reuses the same block system as the LMS LandingPageBuilder.
 */
import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
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
  arrayMove,
} from "@dnd-kit/sortable";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { type Block, type BlockType, BlockPreview } from "@/components/BlockPreview";
import { uid, BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings, SortableBlock } from "./LandingPageBuilder";
import {
  ArrowLeft, Save, Eye, Plus, Palette, X, FolderOpen, Layers, Settings, GitBranch, Trash2, ChevronDown, ChevronUp, GripVertical,
} from "lucide-react";

// ─── Main Editor ─────────────────────────────────────────────────────────────

export default function FunnelPageEditor() {
  const { funnelId, pageId } = useParams<{ funnelId: string; pageId: string }>();
  const [, navigate] = useLocation();
  const numericPageId = Number(pageId);
  const numericFunnelId = Number(funnelId);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("Layout");

  // Auto-scroll preview canvas to the selected block
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load page data
  const { isLoading, data: pageData } = trpc.funnel.getPageById.useQuery(
    { id: numericPageId },
    { enabled: !isNaN(numericPageId) }
  );

  // Load blocks from page data
  if (pageData && !hasLoaded) {
    setHasLoaded(true);
    if (pageData.page.blocks) {
      try {
        const parsed = JSON.parse(pageData.page.blocks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBlocks(parsed as Block[]);
        } else {
          setBlocks(getDefaultBlocks(pageData.page.pageType, pageData.page.title));
        }
      } catch {
        setBlocks(getDefaultBlocks(pageData.page.pageType, pageData.page.title));
      }
    } else {
      setBlocks(getDefaultBlocks(pageData.page.pageType, pageData.page.title));
    }
  }

  // Save blocks
  const updatePage = trpc.funnel.updatePage.useMutation({
    onSuccess: () => toast.success("Page saved!"),
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePage.mutateAsync({
        id: numericPageId,
        blocks: JSON.stringify(blocks),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks(prev => {
        const oldIndex = prev.findIndex(b => b.id === active.id);
        const newIndex = prev.findIndex(b => b.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const addBlock = useCallback((type: BlockType) => {
    const catalog = BLOCK_CATALOG.find(c => c.type === type);
    if (!catalog) return;
    const newBlock: Block = { id: uid(), type, data: { ...catalog.defaultData } };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedId(newBlock.id);
  }, []);

  const updateBlock = useCallback((id: string, data: Record<string, any>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, data } : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const block = prev.find(b => b.id === id);
      if (!block) return prev;
      const newBlock: Block = { ...block, id: uid(), data: { ...block.data } };
      const idx = prev.findIndex(b => b.id === id);
      return [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
    });
  }, []);

  const selectedBlock = blocks.find(b => b.id === selectedId);
  const catalogByCat = BLOCK_CATALOG.filter(c => c.category === activeCat);

  // Page navigation sidebar
  const allPages = pageData?.allPages ?? [];
  const currentPage = pageData?.page;
  const funnelName = pageData?.funnel?.name ?? "Funnel";

  // Branch rules state
  const [showBranchRules, setShowBranchRules] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const utils = trpc.useUtils();

  const { data: branchRules = [] } = trpc.funnel.listBranchRules.useQuery(
    { pageId: numericPageId },
    { enabled: !isNaN(numericPageId) && showBranchRules }
  );

  const upsertBranchRule = trpc.funnel.upsertBranchRule.useMutation({
    onSuccess: () => {
      toast.success("Rule saved!");
      utils.funnel.listBranchRules.invalidate({ pageId: numericPageId });
      setEditingRule(null);
    },
    onError: (e: any) => toast.error(`Failed: ${e.message}`),
  });

  const deleteBranchRule = trpc.funnel.deleteBranchRule.useMutation({
    onSuccess: () => {
      toast.success("Rule deleted");
      utils.funnel.listBranchRules.invalidate({ pageId: numericPageId });
    },
  });

  const VARIABLES = [
    { value: "product_purchased", label: "Product Purchased" },
    { value: "order_bump_selected", label: "Order Bump Selected" },
    { value: "email_contains", label: "Email Contains" },
    { value: "email_domain", label: "Email Domain" },
    { value: "purchase_price", label: "Purchase Price (cents)" },
    { value: "source_url", label: "Source URL" },
    { value: "utm_source", label: "UTM Source" },
    { value: "utm_medium", label: "UTM Medium" },
    { value: "utm_campaign", label: "UTM Campaign" },
    { value: "date_range", label: "Date Range" },
    { value: "day_of_week", label: "Day of Week (0=Sun)" },
    { value: "hour_of_day", label: "Hour of Day (0-23)" },
    { value: "country", label: "Country (ISO)" },
    { value: "device_type", label: "Device Type" },
    { value: "custom_field", label: "Custom Field" },
  ];

  const OPERATORS = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not Equals" },
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Not Contains" },
    { value: "starts_with", label: "Starts With" },
    { value: "ends_with", label: "Ends With" },
    { value: "greater_than", label: "Greater Than" },
    { value: "less_than", label: "Less Than" },
    { value: "between", label: "Between (use | separator)" },
    { value: "in_list", label: "In List (comma-separated)" },
    { value: "not_in_list", label: "Not In List" },
    { value: "is_set", label: "Is Set" },
    { value: "is_not_set", label: "Is Not Set" },
  ];

  function newCondition() {
    return { variable: "product_purchased", operator: "equals", value: "" };
  }

  function newRule() {
    return {
      id: undefined,
      funnelPageId: numericPageId,
      name: "New Rule",
      priority: branchRules.length,
      matchMode: "all" as const,
      targetPageId: null as number | null,
      targetUrl: null as string | null,
      isActive: true,
      conditions: [newCondition()],
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/funnels/${funnelId}`)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 font-medium transition-colors"
          >
            <ArrowLeft size={16} /> Back to Funnel
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
            {funnelName}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {currentPage?.title ?? "Page Editor"}
          </span>
          {currentPage?.pageType && (
            <span className="text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full capitalize">
              {currentPage.pageType.replace("_", " ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pageData?.funnel?.slug && currentPage?.slug && (
            <a
              href={`/f/${pageData.funnel.slug}/${currentPage.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Eye size={14} /> Preview
            </a>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-1.5 h-8"
          >
            <Save size={14} /> {isSaving ? "Saving…" : "Save Page"}
          </Button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Block Catalog + Page Nav */}
        <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          {/* Page navigation */}
          {allPages.length > 1 && (
            <div className="p-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2 flex items-center gap-1">
                <Layers size={12} /> Funnel Pages
              </p>
              <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                {allPages.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (p.id !== numericPageId) {
                        navigate(`/admin/funnels/${numericFunnelId}/pages/${p.id}/edit`);
                      }
                    }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors truncate ${
                      p.id === numericPageId
                        ? "bg-teal-50 text-teal-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p.title}
                    <span className="text-[10px] text-gray-400 ml-1 capitalize">
                      ({p.pageType.replace("_", " ")})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Page Settings */}
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2 flex items-center gap-1">
              <Settings size={12} /> Page Settings
            </p>
            <div className="space-y-2 px-1">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentPage?.isHidden ?? false}
                  onChange={e => updatePage.mutate({ id: numericPageId, isHidden: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span>Hidden from funnel</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentPage?.isStandaloneLanding ?? false}
                  onChange={e => updatePage.mutate({ id: numericPageId, isStandaloneLanding: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span>Standalone page</span>
              </label>
              {currentPage?.isStandaloneLanding && (
                <p className="text-[10px] text-blue-600 bg-blue-50 rounded px-1.5 py-1">
                  Accessible at /p/{currentPage.slug}
                </p>
              )}
            </div>
          </div>
          {/* Branch Rules Panel */}
          <div className="p-2 border-b border-gray-100">
            <button
              onClick={() => setShowBranchRules(v => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 py-1 hover:text-teal-700 transition-colors"
            >
              <span className="flex items-center gap-1"><GitBranch size={12} /> Branch Rules</span>
              {showBranchRules ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showBranchRules && (
              <div className="mt-2 space-y-2">
                {(branchRules as any[]).length === 0 && (
                  <p className="text-[10px] text-gray-400 px-1">No rules yet. Rules are evaluated in order — first match wins.</p>
                )}
                {(branchRules as any[]).map((rule: any, idx: number) => (
                  <div key={rule.id} className={`rounded-lg border text-[10px] px-2 py-1.5 ${
                    rule.isActive ? "border-teal-200 bg-teal-50" : "border-gray-200 bg-gray-50 opacity-60"
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-gray-700 truncate">{idx + 1}. {rule.name}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditingRule({ ...rule, conditions: rule.conditions ?? [] })} className="text-gray-400 hover:text-teal-600"><Settings size={10} /></button>
                        <button onClick={() => { if (confirm("Delete this rule?")) deleteBranchRule.mutate({ id: rule.id }); }} className="text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
                      </div>
                    </div>
                    <p className="text-gray-400 mt-0.5">
                      {rule.conditions?.length ?? 0} condition{rule.conditions?.length !== 1 ? "s" : ""} ({rule.matchMode})
                      {rule.targetPageId ? ` → page #${rule.targetPageId}` : rule.targetUrl ? ` → ${rule.targetUrl.substring(0, 20)}…` : " → (no target)"}
                    </p>
                  </div>
                ))}
                <button
                  onClick={() => setEditingRule(newRule())}
                  className="w-full flex items-center gap-1 justify-center text-[10px] text-teal-600 hover:text-teal-800 border border-dashed border-teal-300 rounded-lg py-1.5 transition-colors"
                >
                  <Plus size={10} /> Add Rule
                </button>
              </div>
            )}
          </div>

          {/* Branch Rule Editor Modal */}
          {editingRule && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold text-gray-800 text-sm">{editingRule.id ? "Edit" : "New"} Branch Rule</h3>
                  <button onClick={() => setEditingRule(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Rule Name</label>
                    <input
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      value={editingRule.name}
                      onChange={e => setEditingRule((r: any) => ({ ...r, name: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600 block mb-1">Match Mode</label>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={editingRule.matchMode}
                        onChange={e => setEditingRule((r: any) => ({ ...r, matchMode: e.target.value }))}
                      >
                        <option value="all">All conditions must match</option>
                        <option value="any">Any condition matches</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRule.isActive}
                          onChange={e => setEditingRule((r: any) => ({ ...r, isActive: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        Active
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">Conditions</label>
                    <div className="space-y-2">
                      {editingRule.conditions.map((cond: any, ci: number) => (
                        <div key={ci} className="flex gap-1 items-start">
                          <div className="flex-1 grid grid-cols-3 gap-1">
                            <select
                              className="col-span-1 text-xs border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              value={cond.variable}
                              onChange={e => setEditingRule((r: any) => ({ ...r, conditions: r.conditions.map((c: any, i: number) => i === ci ? { ...c, variable: e.target.value } : c) }))}
                            >
                              {VARIABLES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                            </select>
                            <select
                              className="col-span-1 text-xs border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              value={cond.operator}
                              onChange={e => setEditingRule((r: any) => ({ ...r, conditions: r.conditions.map((c: any, i: number) => i === ci ? { ...c, operator: e.target.value } : c) }))}
                            >
                              {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <input
                              className="col-span-1 text-xs border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              placeholder="Value"
                              value={cond.value}
                              onChange={e => setEditingRule((r: any) => ({ ...r, conditions: r.conditions.map((c: any, i: number) => i === ci ? { ...c, value: e.target.value } : c) }))}
                            />
                          </div>
                          <button
                            onClick={() => setEditingRule((r: any) => ({ ...r, conditions: r.conditions.filter((_: any, i: number) => i !== ci) }))}
                            className="text-gray-300 hover:text-red-400 mt-1.5 flex-shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setEditingRule((r: any) => ({ ...r, conditions: [...r.conditions, newCondition()] }))}
                      className="mt-2 text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1"
                    >
                      <Plus size={10} /> Add Condition
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Redirect Target</label>
                    <p className="text-[10px] text-gray-400 mb-2">Set a target page ID (from this funnel) or an external URL. Leave both empty to skip to next page.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Target Page ID</label>
                        <input
                          type="number"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="e.g. 42"
                          value={editingRule.targetPageId ?? ""}
                          onChange={e => setEditingRule((r: any) => ({ ...r, targetPageId: e.target.value ? parseInt(e.target.value) : null }))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Or External URL</label>
                        <input
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="https://..."
                          value={editingRule.targetUrl ?? ""}
                          onChange={e => setEditingRule((r: any) => ({ ...r, targetUrl: e.target.value || null }))}
                        />
                      </div>
                    </div>
                    {allPages.length > 0 && (
                      <div className="mt-2">
                        <label className="text-[10px] text-gray-500 block mb-1">Or pick a page from this funnel:</label>
                        <select
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          value={editingRule.targetPageId ?? ""}
                          onChange={e => setEditingRule((r: any) => ({ ...r, targetPageId: e.target.value ? parseInt(e.target.value) : null, targetUrl: null }))}
                        >
                          <option value="">— select page —</option>
                          {allPages.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.title} ({p.pageType})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 p-4 border-t">
                  <Button variant="outline" onClick={() => setEditingRule(null)} className="text-sm">Cancel</Button>
                  <Button
                    onClick={() => upsertBranchRule.mutate(editingRule)}
                    disabled={upsertBranchRule.isPending}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-sm"
                  >
                    {upsertBranchRule.isPending ? "Saving…" : "Save Rule"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Block catalog */}
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">Add Blocks</p>
            <div className="flex flex-col gap-0.5">
              {CATALOG_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors ${
                    activeCat === cat
                      ? "bg-teal-50 text-teal-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {catalogByCat.map(item => (
              <button
                key={item.type}
                onClick={() => addBlock(item.type)}
                className="w-full flex items-center gap-2 px-2 py-2 text-xs text-gray-700 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-colors text-left"
              >
                <span className="text-gray-400 flex-shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading…</div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <Plus size={24} />
              </div>
              <p className="text-sm">Click a block type on the left to get started</p>
              <p className="text-xs text-gray-300">
                This is a {currentPage?.pageType?.replace("_", " ")} page
              </p>
            </div>
          ) : (
            <div className="bg-white min-h-full shadow-sm mx-auto" style={{ maxWidth: "900px" }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onMoveUp={idx > 0 ? () => setBlocks(prev => arrayMove(prev, idx, idx - 1)) : undefined}
                      onMoveDown={idx < blocks.length - 1 ? () => setBlocks(prev => arrayMove(prev, idx, idx + 1)) : undefined}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex justify-center py-6 border-t border-dashed border-gray-200">
                <button
                  onClick={() => addBlock("text")}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600 transition-colors"
                >
                  <Plus size={16} /> Add a block
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Block Settings */}
        <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
          {selectedBlock ? (
            <>
              <div className="flex items-center justify-between p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {BLOCK_CATALOG.find(c => c.type === selectedBlock.type)?.label ?? "Block"} Settings
                </p>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <div className="p-3">
                <BlockSettings block={selectedBlock} onChange={(data) => updateBlock(selectedBlock.id, data)} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
              <Palette size={24} className="mb-2 opacity-50" />
              <p className="text-sm">Click any block on the canvas to edit its settings</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Default blocks based on page type ────────────────────────────────────────

function getDefaultBlocks(pageType: string, title: string): Block[] {
  switch (pageType) {
    case "landing":
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: title || "Your Offer Headline",
            subheadline: "A compelling subtitle that explains the value of your offer",
            bgType: "gradient", gradientFrom: "#179ca3", gradientTo: "#0e4a50",
            gradientDir: "to bottom right", textColor: "#ffffff", align: "left",
            buttons: [{ text: "Get Started", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled" }],
          },
        },
        {
          id: uid(), type: "bullets",
          data: { headline: "What You Get", items: ["Benefit one", "Benefit two", "Benefit three"], iconColor: "#179ca3", bgColor: "#f8fffe" },
        },
        {
          id: uid(), type: "testimonial",
          data: { quote: "This completely transformed my practice.", author: "Happy Customer", avatarUrl: "", bgColor: "#f0fafa", accentColor: "#179ca3" },
        },
        {
          id: uid(), type: "cta_standalone",
          data: { headline: "Ready to Get Started?", subtext: "", ctaText: "Yes, I Want This!", ctaLink: "", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", align: "center" },
        },
      ];
    case "checkout":
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: "Complete Your Order",
            subheadline: "You're one step away from accessing everything",
            bgType: "color", bgColor: "#0e4a50", textColor: "#ffffff", align: "center",
            buttons: [],
          },
        },
        {
          id: uid(), type: "pricing_cta",
          data: { headline: "Your Investment", subtext: "Secure checkout powered by Stripe", ctaText: "Complete Purchase", ctaColor: "#179ca3", ctaTextColor: "#ffffff", bgColor: "#ffffff", showPrice: true },
        },
      ];
    case "upsell":
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: "Wait! Special One-Time Offer",
            subheadline: "Before you go, we have something special just for you",
            bgType: "color", bgColor: "#f59e0b", textColor: "#ffffff", align: "center",
            buttons: [{ text: "Yes, Add This!", color: "#ffffff", textColor: "#f59e0b", link: "", style: "filled" }],
          },
        },
        {
          id: uid(), type: "bullets",
          data: { headline: "What's Included", items: ["Bonus item one", "Bonus item two", "Bonus item three"], iconColor: "#f59e0b", bgColor: "#fff7ed" },
        },
      ];
    case "thank_you":
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: "Thank You!",
            subheadline: "Your order is confirmed. Check your email for access details.",
            bgType: "color", bgColor: "#179ca3", textColor: "#ffffff", align: "center",
            buttons: [{ text: "Access Your Content", color: "#ffffff", textColor: "#179ca3", link: "/", style: "filled" }],
          },
        },
        {
          id: uid(), type: "text",
          data: { html: "<h2>What Happens Next?</h2><ol><li>Check your email for login credentials</li><li>Access your content immediately</li><li>Start learning right away</li></ol>", align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" },
        },
      ];
    default:
      return [
        {
          id: uid(), type: "hero",
          data: {
            headline: title || "Page Title",
            subheadline: "Add your content below",
            bgType: "color", bgColor: "#179ca3", textColor: "#ffffff", align: "center",
            buttons: [],
          },
        },
      ];
  }
}
