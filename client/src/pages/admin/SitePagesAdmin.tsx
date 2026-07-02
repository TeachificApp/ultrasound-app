/**
 * SitePagesAdmin — Weebly-style site page manager for LMS admin.
 * Route: /admin/lms/site-pages
 */
import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { SiteNavItem, SitePageTreeNode } from "@shared/sitePagesConstants";
import { SITE_NAV_MENU_KEYS } from "@shared/sitePagesConstants";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Folder,
  GripVertical,
  Plus,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Default pages that have editable zones instead of (or in addition to) the block editor
const DEFAULT_EDITABLE_PAGES: Record<string, { label: string; zones: Array<{ key: string; label: string; hint: string; multiline?: boolean }> }> = {
  "/": {
    label: "Home",
    zones: [
      { key: "hero_headline", label: "Hero Headline", hint: "Main headline shown in the hero banner" },
      { key: "hero_subtitle", label: "Hero Subtitle", hint: "Supporting text below the headline", multiline: true },
      { key: "cta_headline", label: "CTA Section Headline", hint: "Headline for the bottom call-to-action section" },
      { key: "cta_body", label: "CTA Section Body", hint: "Body text for the call-to-action section", multiline: true },
      { key: "cta_button", label: "CTA Button Label", hint: "Text on the CTA button" },
    ],
  },
  "/education-library": {
    label: "Education Library",
    zones: [
      { key: "hero_headline", label: "Hero Headline", hint: "Main headline on the Education Library page" },
      { key: "hero_subtitle", label: "Hero Subtitle", hint: "Supporting text below the headline", multiline: true },
      { key: "cta_headline", label: "CTA Section Headline", hint: "Headline for the educator CTA section" },
      { key: "cta_body", label: "CTA Section Body", hint: "Body text for the educator CTA section", multiline: true },
      { key: "cta_button", label: "CTA Button Label", hint: "Text on the CTA button" },
    ],
  },
  "/workshops": {
    label: "Workshops",
    zones: [
      { key: "hero_headline", label: "Hero Headline", hint: "Main headline on the Workshops page" },
      { key: "hero_subtitle", label: "Hero Subtitle", hint: "Supporting text below the headline", multiline: true },
    ],
  },
  "/community": {
    label: "Community",
    zones: [
      { key: "hero_headline", label: "Hero Headline", hint: "Main headline on the Community page" },
      { key: "hero_subtitle", label: "Hero Subtitle", hint: "Supporting text below the headline", multiline: true },
    ],
  },
};

function PageZoneEditor({
  domain,
  slug,
  pageDef,
  onClose,
}: {
  domain: string;
  slug: string;
  pageDef: (typeof DEFAULT_EDITABLE_PAGES)[string];
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.sitePages.admin.getPageZones.useQuery({ domain, slug });
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data && !loaded) {
      setValues(data.zones ?? {});
      setLoaded(true);
    }
  }, [data, loaded]);

  const save = trpc.sitePages.admin.savePageZones.useMutation({
    onSuccess: () => { toast.success("Page content saved"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        pageDef.zones.map((zone) => (
          <div key={zone.key} className="space-y-1">
            <Label className="text-sm font-medium">{zone.label}</Label>
            <p className="text-xs text-gray-500">{zone.hint}</p>
            {zone.multiline ? (
              <Textarea
                rows={3}
                value={values[zone.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [zone.key]: e.target.value }))}
                placeholder={`Default: (leave blank to use default)`}
              />
            ) : (
              <Input
                value={values[zone.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [zone.key]: e.target.value }))}
                placeholder="Leave blank to use default"
              />
            )}
          </div>
        ))
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          className="bg-teal-600 hover:bg-teal-700"
          onClick={() => save.mutate({ domain, slug, zones: values })}
          disabled={save.isPending}
        >
          {save.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function useQueryParams() {
  const [loc] = useLocation();
  return useMemo(() => new URLSearchParams(loc.split("?")[1] ?? ""), [loc]);
}

function TreeFolder({
  node,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  node: SitePageTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (node: SitePageTreeNode) => void;
}) {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  if (node.kind === "folder") {
    return (
      <div>
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="w-full flex items-center gap-1 px-2 py-1.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <span className="w-3.5" />
          )}
          <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">{node.label}</span>
          <span className="ml-auto text-xs text-gray-400">{node.children.length}</span>
        </button>
        {isOpen &&
          node.children.map((child) => (
            <TreeFolder
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const isSelected = selectedId === node.id;
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-sm rounded group",
          isSelected ? "bg-teal-100 text-teal-900" : "hover:bg-gray-50 text-gray-700",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <FileText className="w-3.5 h-3.5 shrink-0 text-gray-400" />
        <span className="truncate flex-1">{node.label}</span>
        {node.hiddenFromNav ? (
          <EyeOff className="w-3 h-3 text-gray-300 shrink-0" title="Hidden from nav" />
        ) : (
          <Eye className="w-3 h-3 text-teal-500 shrink-0 opacity-0 group-hover:opacity-100" title="Visible in nav" />
        )}
        {node.status === "draft" && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded shrink-0">draft</span>
        )}
      </button>
      {node.children.length > 0 &&
        node.children.map((child) => (
          <TreeFolder
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

function SortableNavItem({
  item,
  depth,
  onChange,
  onRemove,
  onAddChild,
  expanded,
  onToggleExpand,
}: {
  item: SiteNavItem;
  depth: number;
  onChange: (item: SiteNavItem) => void;
  onRemove: () => void;
  onAddChild?: () => void;
  expanded?: Set<string>;
  onToggleExpand?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const isOpen = expanded?.has(item.id) ?? true;

  return (
    <div ref={setNodeRef} style={style} className="mb-1">
      <div className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
        <button type="button" className="cursor-grab text-gray-400" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4" />
        </button>
        {hasChildren ? (
          <button type="button" onClick={() => onToggleExpand?.(item.id)} className="text-gray-400">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Input
          value={item.label}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
          className="h-8 text-sm flex-1"
          placeholder="Label"
        />
        <Input
          value={item.href ?? ""}
          onChange={(e) => onChange({ ...item, href: e.target.value })}
          className="h-8 text-sm flex-[2]"
          placeholder="/path or https://"
        />
        {onAddChild && (
          <Button type="button" variant="ghost" size="sm" onClick={onAddChild} title="Add submenu">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          ×
        </Button>
      </div>
      {hasChildren && isOpen && (
        <div className="mt-1 space-y-1">
          {children.map((child, idx) => (
            <SortableNavItem
              key={child.id}
              item={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onChange={(updated) =>
                onChange({
                  ...item,
                  children: children.map((c, i) => (i === idx ? updated : c)),
                })
              }
              onRemove={() =>
                onChange({
                  ...item,
                  children: children.filter((_, i) => i !== idx),
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function updateNavItemById(items: SiteNavItem[], id: string, updater: (item: SiteNavItem) => SiteNavItem): SiteNavItem[] {
  return items.map((item) => {
    if (item.id === id) return updater(item);
    if (item.children?.length) {
      return { ...item, children: updateNavItemById(item.children, id, updater) };
    }
    return item;
  });
}

function removeNavItemById(items: SiteNavItem[], id: string): SiteNavItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) =>
      item.children?.length ? { ...item, children: removeNavItemById(item.children, id) } : item,
    );
}

export default function SitePagesAdmin() {
  const params = useQueryParams();
  const [, navigate] = useLocation();
  const initialDomain = params.get("domain") ?? "learn.allaboutultrasound.com";

  const [domain, setDomain] = useState(initialDomain);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["folder:system", "folder:custom", "folder:courses"]),
  );
  const [selectedNode, setSelectedNode] = useState<SitePageTreeNode | null>(null);
  const [zoneEditorSlug, setZoneEditorSlug] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [menuKey, setMenuKey] = useState<(typeof SITE_NAV_MENU_KEYS)[number]>("header");
  const [navItems, setNavItems] = useState<SiteNavItem[]>([]);
  const [navLoaded, setNavLoaded] = useState(false);
  const [navExpanded, setNavExpanded] = useState<Set<string>>(() => new Set());

  const { data: domains } = trpc.sitePages.admin.listDomains.useQuery();
  const { data: tree, refetch: refetchTree } = trpc.sitePages.admin.listPageTree.useQuery({ domain });
  const { data: navData, refetch: refetchNav } = trpc.sitePages.admin.getNavMenu.useQuery(
    { domain, menuKey },
    { enabled: !!domain },
  );

  useEffect(() => {
    if (navData) {
      setNavItems(navData.items);
      setNavLoaded(true);
    }
  }, [navData, menuKey, domain]);

  const createPage = trpc.sitePages.admin.createPage.useMutation({
    onSuccess: (data) => {
      toast.success("Page created");
      setCreateOpen(false);
      setNewTitle("");
      setNewSlug("");
      refetchTree();
      navigate(`/admin/lms/site-pages/${data.id}/edit`);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveNav = trpc.sitePages.admin.saveNavMenu.useMutation({
    onSuccess: () => {
      toast.success("Navigation saved");
      refetchNav();
    },
    onError: (e) => toast.error(e.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const toggleFolder = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectNode = (node: SitePageTreeNode) => {
    setSelectedNode(node);
    if (node.kind === "site" && node.sitePageId) {
      navigate(`/admin/lms/site-pages/${node.sitePageId}/edit`);
      return;
    }
    if (node.editorRoute) {
      navigate(node.editorRoute);
    }
  };

  const handleNavDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setNavItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const addNavItem = () => {
    setNavItems((prev) => [
      ...prev,
      { id: `nav-${Date.now()}`, label: "New link", href: "/" },
    ]);
  };

  const toggleNavFolder = (id: string) => {
    setNavExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/lms?tab=site_pages">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> LMS Admin
            </Button>
          </Link>
          <h1 className="font-semibold">Site Pages</h1>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs text-gray-500">Domain</Label>
          <Select value={domain} onValueChange={(v) => { setDomain(v); setNavLoaded(false); setSelectedNode(null); }}>
            <SelectTrigger className="w-64 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(domains ?? []).map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <Tabs defaultValue="pages" className="flex-1 flex flex-col min-h-0" onValueChange={() => setNavLoaded(false)}>
        <div className="border-b bg-white px-4">
          <TabsList>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="navigation">Navigation</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pages" className="flex-1 flex min-h-0 m-0">
          <aside className="w-72 border-r bg-white flex flex-col shrink-0">
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pages</span>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {(tree ?? []).map((folder) => (
                <TreeFolder
                  key={folder.id}
                  node={folder}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggleFolder}
                  selectedId={selectedNode?.id ?? null}
                  onSelect={handleSelectNode}
                />
              ))}
            </div>
          </aside>

          <main className="flex-1 flex items-center justify-center p-8 text-center text-gray-500">
            {selectedNode ? (
              <div className="max-w-md space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">{selectedNode.label}</h2>
                {selectedNode.previewUrl && (
                  <p className="text-sm text-gray-500">{selectedNode.previewUrl}</p>
                )}
                {selectedNode.editorRoute && (
                  <Button asChild className="bg-teal-600 hover:bg-teal-700">
                    <Link href={selectedNode.editorRoute}>
                      <Pencil className="w-4 h-4 mr-2" /> Open page editor
                    </Link>
                  </Button>
                )}
                {selectedNode.previewUrl && (
                  <Button variant="outline" asChild>
                    <a href={selectedNode.previewUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" /> Preview live
                    </a>
                  </Button>
                )}
                {(() => {
                  // Normalize slug: selectedNode.slug may not have leading slash
                  const rawSlug = selectedNode.slug ?? "";
                  const normalizedSlug = rawSlug.startsWith("/") ? rawSlug : "/" + rawSlug;
                  const pageDef = DEFAULT_EDITABLE_PAGES[normalizedSlug];
                  return pageDef ? (
                    <Button
                      variant="outline"
                      className="border-teal-500 text-teal-700 hover:bg-teal-50"
                      onClick={() => setZoneEditorSlug(normalizedSlug)}
                    >
                      <Pencil className="w-4 h-4 mr-2" /> Edit Page Content
                    </Button>
                  ) : null;
                })()}
              </div>
            ) : (
              <div>
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Select a page from the left menu to edit, or create a new site page.</p>
                <p className="text-xs mt-2 text-gray-400">
                  System pages (Privacy, Terms, 404, Login) are seeded per domain and use the full block editor.
                </p>
              </div>
            )}
          </main>
        </TabsContent>

        <TabsContent value="navigation" className="flex-1 m-0 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center gap-3">
              <Label>Menu</Label>
              <Select
                value={menuKey}
                onValueChange={(v) => {
                  setMenuKey(v as typeof menuKey);
                  setNavLoaded(false);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">Header navigation</SelectItem>
                  <SelectItem value="sidebar">Sidebar navigation</SelectItem>
                  <SelectItem value="profile">Profile navigation</SelectItem>
                  <SelectItem value="footer">Footer navigation</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={addNavItem}>
                <Plus className="w-4 h-4 mr-1" /> Add link
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 ml-auto"
                onClick={() => saveNav.mutate({ domain, menuKey, items: navItems })}
                disabled={saveNav.isPending}
              >
                Save menu
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Drag to reorder. Links can point to site pages ({`/`}slug) or external URLs.
              Pages with &quot;Show in header nav&quot; enabled also appear automatically when no custom menu is saved.
              {menuKey === "sidebar" && domain === "app.allaboutultrasound.com" && (
                <>
                  {" "}
                  Sidebar menus for the App domain are saved here for planning and export; the live clinical
                  tools sidebar on app.allaboutultrasound.com is not replaced.
                </>
              )}
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNavDragEnd}>
              <SortableContext items={navItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {navItems.map((item) => (
                  <SortableNavItem
                    key={item.id}
                    item={item}
                    depth={0}
                    expanded={navExpanded}
                    onToggleExpand={toggleNavFolder}
                    onChange={(updated) =>
                      setNavItems((prev) => updateNavItemById(prev, item.id, () => updated))
                    }
                    onRemove={() => setNavItems((prev) => removeNavItemById(prev, item.id))}
                    onAddChild={() =>
                      setNavItems((prev) =>
                        updateNavItemById(prev, item.id, (current) => ({
                          ...current,
                          children: [
                            ...(current.children ?? []),
                            { id: `nav-${Date.now()}`, label: "Sub link", href: "/" },
                          ],
                        })),
                      )
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </TabsContent>
      </Tabs>

      {/* Zone editor dialog */}
      {zoneEditorSlug && DEFAULT_EDITABLE_PAGES[zoneEditorSlug] && (
        <Dialog open={!!zoneEditorSlug} onOpenChange={(open) => { if (!open) setZoneEditorSlug(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Page Content — {DEFAULT_EDITABLE_PAGES[zoneEditorSlug].label}</DialogTitle>
            </DialogHeader>
            <PageZoneEditor
              domain={domain}
              slug={zoneEditorSlug}
              pageDef={DEFAULT_EDITABLE_PAGES[zoneEditorSlug]}
              onClose={() => setZoneEditorSlug(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New site page</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (!newSlug) {
                    setNewSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, ""),
                    );
                  }
                }}
              />
            </div>
            <div>
              <Label>URL slug</Label>
              <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="about-us" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                createPage.mutate({ domain, title: newTitle, slug: newSlug })
              }
              disabled={!newTitle || !newSlug || createPage.isPending}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Create &amp; edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
