/**
 * BlockTemplateLibrary.tsx
 * Shared block template system — save any block as a reusable template,
 * browse and insert saved templates from any page editor.
 *
 * Usage:
 *   1. Wrap the editor with <BlockTemplateLibraryProvider>
 *   2. Add <BlockTemplateLibraryDrawer onInsert={addBlock} /> to the editor
 *   3. Add <SaveAsTemplateButton block={block} /> to each block's action bar
 *   4. Add <OpenTemplateLibraryButton /> to the editor toolbar
 */
import { useState, useCallback, createContext, useContext } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bookmark, BookmarkPlus, Search, Trash2, X, LayoutTemplate, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Block } from "@/components/BlockPreview";

// ─── Context ──────────────────────────────────────────────────────────────────

interface LibraryContextValue {
  openLibrary: () => void;
  saveAsTemplate: (block: Block, blockLabel?: string) => void;
}

const LibraryContext = createContext<LibraryContextValue>({
  openLibrary: () => {},
  saveAsTemplate: () => {},
});

export function useBlockTemplateLibrary() {
  return useContext(LibraryContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ProviderProps {
  children: React.ReactNode;
  onInsert: (block: Block) => void;
}

export function BlockTemplateLibraryProvider({ children, onInsert }: ProviderProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogBlock, setSaveDialogBlock] = useState<Block | null>(null);
  const [saveDialogLabel, setSaveDialogLabel] = useState("");

  const openLibrary = useCallback(() => setLibraryOpen(true), []);
  const saveAsTemplate = useCallback((block: Block, blockLabel?: string) => {
    setSaveDialogBlock(block);
    setSaveDialogLabel(blockLabel ?? block.type);
    setSaveDialogOpen(true);
  }, [setSaveDialogBlock, setSaveDialogLabel, setSaveDialogOpen]);

  return (
    <LibraryContext.Provider value={{ openLibrary, saveAsTemplate }}>
      {children}
      <BlockTemplateLibraryDrawer
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onInsert={(block) => { onInsert(block); setLibraryOpen(false); }}
      />
      {saveDialogBlock && (
        <SaveTemplateDialog
          open={saveDialogOpen}
          block={saveDialogBlock}
          defaultName={saveDialogLabel}
          onClose={() => { setSaveDialogOpen(false); setSaveDialogBlock(null); }}
        />
      )}
    </LibraryContext.Provider>
  );
}

// ─── Toolbar Button ────────────────────────────────────────────────────────────

export function OpenTemplateLibraryButton({ className }: { className?: string }) {
  const { openLibrary } = useBlockTemplateLibrary();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={openLibrary}
      className={`gap-1.5 text-xs h-7 border-teal-300 text-teal-700 hover:bg-teal-50 ${className ?? ""}`}
    >
      <LayoutTemplate className="w-3.5 h-3.5" />
      Templates
    </Button>
  );
}

// ─── Save As Template Button (per-block) ──────────────────────────────────────

export function SaveAsTemplateButton({ block, blockLabel, className }: { block: Block; blockLabel?: string; className?: string }) {
  const { saveAsTemplate } = useBlockTemplateLibrary();
  return (
    <button
      title="Save as template"
      onClick={(e) => { e.stopPropagation(); saveAsTemplate(block, blockLabel); }}
      className={`p-1 rounded hover:bg-teal-50 text-gray-400 hover:text-teal-600 transition-colors ${className ?? ""}`}
    >
      <BookmarkPlus className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Save Template Dialog ─────────────────────────────────────────────────────

function SaveTemplateDialog({ open, block, defaultName, onClose }: {
  open: boolean;
  block: Block;
  defaultName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const utils = trpc.useUtils();

  const saveMutation = trpc.blockTemplates.save.useMutation({
    onSuccess: () => {
      toast.success("Template saved!");
      utils.blockTemplates.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(`Failed to save template: ${e.message}`),
  });

  const handleSave = () => {
    if (!name.trim()) { toast.error("Template name is required"); return; }
    saveMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      blockType: block.type,
      blockData: block.data,
      tags: tags.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-teal-700">
            <BookmarkPlus className="w-4 h-4" />
            Save Block as Template
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Template Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Teal Hero Banner"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tags (comma-separated)</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. hero, teal, course"
              className="h-8 text-sm"
            />
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
            Block type: <span className="font-mono text-teal-700">{block.type}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Library Drawer ───────────────────────────────────────────────────────────

function BlockTemplateLibraryDrawer({ open, onClose, onInsert }: {
  open: boolean;
  onClose: () => void;
  onInsert: (block: Block) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");

  const { data: templates, isLoading } = trpc.blockTemplates.list.useQuery(
    { search: search || undefined, blockType: filterType || undefined },
    { enabled: open }
  );

  const utils = trpc.useUtils();
  const deleteMutation = trpc.blockTemplates.delete.useMutation({
    onSuccess: () => { toast.success("Template deleted"); utils.blockTemplates.list.invalidate(); },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });

  // Collect unique block types for filter pills
  const allTypes = Array.from(new Set((templates ?? []).map(t => t.blockType))).sort();

  const handleInsert = (template: typeof templates extends (infer T)[] | undefined ? T : never) => {
    if (!template) return;
    let data: Record<string, any> = {};
    try { data = JSON.parse(template.blockData); } catch { /* ignore */ }
    const block: Block = {
      id: Math.random().toString(36).slice(2, 10),
      type: template.blockType as any,
      data,
    };
    onInsert(block);
    toast.success(`Inserted "${template.name}"`);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <SheetTitle className="flex items-center gap-2 text-teal-700 text-base">
            <LayoutTemplate className="w-4 h-4" />
            Block Template Library
          </SheetTitle>
          <p className="text-xs text-gray-500 mt-0.5">Saved blocks available across all page editors</p>
        </SheetHeader>

        {/* Search + filter */}
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {allTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFilterType("")}
                className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${!filterType ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-500 hover:border-teal-300 hover:text-teal-600"}`}
              >All</button>
              {allTypes.map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(f => f === t ? "" : t)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${filterType === t ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-500 hover:border-teal-300 hover:text-teal-600"}`}
                >{t}</button>
              ))}
            </div>
          )}
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading templates...</div>
          )}
          {!isLoading && (!templates || templates.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bookmark className="w-8 h-8 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No templates yet</p>
              <p className="text-xs text-gray-400 mt-1">Click the <BookmarkPlus className="w-3 h-3 inline" /> icon on any block to save it as a template</p>
            </div>
          )}
          {templates?.map(template => {
            let tags: string[] = [];
            if (template.tags) tags = template.tags.split(",").map(t => t.trim()).filter(Boolean);
            return (
              <div
                key={template.id}
                className="bg-white border border-gray-200 rounded-xl p-3 hover:border-teal-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-gray-800 truncate">{template.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0 font-mono bg-teal-50 text-teal-700 border-teal-200">
                        {template.blockType}
                      </Badge>
                    </div>
                    {template.description && (
                      <p className="text-xs text-gray-500 truncate">{template.description}</p>
                    )}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
                            <Tag className="w-2.5 h-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => deleteMutation.mutate({ id: template.id })}
                      className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={() => handleInsert(template)}
                    >
                      Insert
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
