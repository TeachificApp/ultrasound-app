/**
 * CertificateTemplatesAdmin.tsx
 * Admin UI for managing certificate templates and viewing issued certificates.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Award, Star, Download, Eye } from "lucide-react";

interface CertTemplate {
  id: number;
  name: string;
  description?: string | null;
  backgroundImageUrl?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  fontFamily: string;
  signatureName?: string | null;
  signatureTitle?: string | null;
  signatureImageUrl?: string | null;
  footerText?: string | null;
  organizationName: string;
  layout: "classic" | "modern" | "minimal";
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date | string;
}

const DEFAULT_TEMPLATE: Omit<CertTemplate, "id" | "createdAt"> = {
  name: "",
  description: "",
  backgroundImageUrl: null,
  logoUrl: null,
  primaryColor: "#189aa1",
  accentColor: "#c9a84c",
  textColor: "#0e1e2e",
  fontFamily: "Helvetica",
  signatureName: "Lara Williams, RVT, RDMS",
  signatureTitle: "Founder, All About Ultrasound™",
  signatureImageUrl: null,
  footerText: "www.allaboutultrasound.com  ·  © All About Ultrasound™",
  organizationName: "All About Ultrasound",
  layout: "classic",
  isDefault: false,
  isActive: true,
};

function TemplateEditor({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: Partial<CertTemplate>;
  onSave: (data: Omit<CertTemplate, "id" | "createdAt">) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<Omit<CertTemplate, "id" | "createdAt">>({
    ...DEFAULT_TEMPLATE,
    ...initial,
  });

  const set = (key: keyof typeof form, value: any) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Template Name *</Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Classic Teal" />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea value={form.description ?? ""} onChange={e => set("description", e.target.value)} rows={2} placeholder="Brief description of this template" />
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Layout & Branding</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Layout Style</Label>
            <Select value={form.layout} onValueChange={v => set("layout", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic (centered, header band)</SelectItem>
                <SelectItem value="modern">Modern (left accent bar)</SelectItem>
                <SelectItem value="minimal">Minimal (clean lines)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Organization Name</Label>
            <Input value={form.organizationName} onChange={e => set("organizationName", e.target.value)} />
          </div>
          <div>
            <Label>Logo URL</Label>
            <Input value={form.logoUrl ?? ""} onChange={e => set("logoUrl", e.target.value || null)} placeholder="https://..." />
          </div>
          <div>
            <Label>Background Image URL</Label>
            <Input value={form.backgroundImageUrl ?? ""} onChange={e => set("backgroundImageUrl", e.target.value || null)} placeholder="https://..." />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Colors & Typography</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Primary Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={form.primaryColor} onChange={e => set("primaryColor", e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
              <Input value={form.primaryColor} onChange={e => set("primaryColor", e.target.value)} className="font-mono text-sm" />
            </div>
          </div>
          <div>
            <Label>Accent Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={form.accentColor} onChange={e => set("accentColor", e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
              <Input value={form.accentColor} onChange={e => set("accentColor", e.target.value)} className="font-mono text-sm" />
            </div>
          </div>
          <div>
            <Label>Text Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={form.textColor} onChange={e => set("textColor", e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
              <Input value={form.textColor} onChange={e => set("textColor", e.target.value)} className="font-mono text-sm" />
            </div>
          </div>
        </div>
        <div>
          <Label>Font Family</Label>
          <Select value={form.fontFamily} onValueChange={v => set("fontFamily", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Helvetica">Helvetica (default)</SelectItem>
              <SelectItem value="Times-Roman">Times Roman</SelectItem>
              <SelectItem value="Courier">Courier</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Signature</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Signature Name</Label>
            <Input value={form.signatureName ?? ""} onChange={e => set("signatureName", e.target.value || null)} placeholder="e.g. Lara Williams, RVT, RDMS" />
          </div>
          <div>
            <Label>Signature Title</Label>
            <Input value={form.signatureTitle ?? ""} onChange={e => set("signatureTitle", e.target.value || null)} placeholder="e.g. Founder, All About Ultrasound™" />
          </div>
          <div className="col-span-2">
            <Label>Signature Image URL (optional)</Label>
            <Input value={form.signatureImageUrl ?? ""} onChange={e => set("signatureImageUrl", e.target.value || null)} placeholder="https://..." />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Footer</p>
        <div>
          <Label>Footer Text</Label>
          <Input value={form.footerText ?? ""} onChange={e => set("footerText", e.target.value || null)} placeholder="www.allaboutultrasound.com  ·  © All About Ultrasound™" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={form.isDefault} onCheckedChange={v => set("isDefault", v)} id="isDefault" />
          <Label htmlFor="isDefault">Set as Default Template</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} id="isActive" />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={isSaving || !form.name.trim()}>
          {isSaving ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </div>
  );
}

export default function CertificateTemplatesAdmin() {
  const utils = trpc.useUtils();

  const { data: templates = [], isLoading } = trpc.lmsAdmin.listCertificateTemplates.useQuery();
  const { data: issuedCerts = [], isLoading: certsLoading } = trpc.lmsAdmin.listIssuedCertificates.useQuery({});

  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<CertTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMut = trpc.lmsAdmin.createCertificateTemplate.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      setShowCreate(false);
      toast.success("Template created");
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const updateMut = trpc.lmsAdmin.updateCertificateTemplate.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      setEditTemplate(null);
      toast.success("Template updated");
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const deleteMut = trpc.lmsAdmin.deleteCertificateTemplate.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      setDeleteId(null);
      toast.success("Template deleted");
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const setDefaultMut = trpc.lmsAdmin.updateCertificateTemplate.useMutation({
    onSuccess: () => utils.lmsAdmin.listCertificateTemplates.invalidate(),
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates"><Award className="w-4 h-4 mr-1" />Templates</TabsTrigger>
          <TabsTrigger value="issued"><Download className="w-4 h-4 mr-1" />Issued Certificates</TabsTrigger>
        </TabsList>

        {/* ── Templates Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Certificate Templates</h3>
              <p className="text-sm text-muted-foreground">Design templates used when issuing completion certificates.</p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Template
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading templates…</div>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No certificate templates yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Create a template to customise the look of issued certificates.</p>
                <Button className="mt-4" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Create First Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {templates.map((t: CertTemplate) => (
                <Card key={t.id} className={`relative ${!t.isActive ? "opacity-60" : ""}`}>
                  {t.isDefault && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-amber-500 text-white text-xs"><Star className="w-3 h-3 mr-1 inline" />Default</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Color swatches */}
                    <div className="flex gap-2 items-center">
                      <div className="w-6 h-6 rounded-full border" style={{ background: t.primaryColor }} title="Primary" />
                      <div className="w-6 h-6 rounded-full border" style={{ background: t.accentColor }} title="Accent" />
                      <div className="w-6 h-6 rounded-full border" style={{ background: t.textColor }} title="Text" />
                      <span className="text-xs text-muted-foreground ml-1 capitalize">{t.layout}</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {t.signatureName && <div>Signature: {t.signatureName}</div>}
                      {t.organizationName && <div>Org: {t.organizationName}</div>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      {!t.isDefault && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setDefaultMut.mutate({ id: t.id, isDefault: true })}>
                          <Star className="w-3 h-3 mr-1" />Set Default
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setEditTemplate(t)}>
                        <Edit className="w-3 h-3 mr-1" />Edit
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Issued Certificates Tab ────────────────────────────────────────── */}
        <TabsContent value="issued" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Issued Certificates</h3>
            <p className="text-sm text-muted-foreground">All certificates that have been generated and emailed to learners.</p>
          </div>
          {certsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading…</div>
          ) : issuedCerts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No certificates issued yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2">Learner</th>
                    <th className="text-left px-4 py-2">Course</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Issued</th>
                    <th className="text-left px-4 py-2">Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {issuedCerts.map((c: any) => (
                    <tr key={c.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2">
                        <div className="font-medium">{c.userName || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{c.userEmail}</div>
                      </td>
                      <td className="px-4 py-2 max-w-[200px] truncate">{c.courseTitle}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs capitalize">{c.courseType}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {c.certificateUrl && (
                          <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="text-xs">
                              <Eye className="w-3 h-3 mr-1" />View PDF
                            </Button>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Certificate Template</DialogTitle>
          </DialogHeader>
          <TemplateEditor
            initial={{}}
            onSave={(data) => createMut.mutate(data as any)}
            onCancel={() => setShowCreate(false)}
            isSaving={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────────────── */}
      {editTemplate && (
        <Dialog open={!!editTemplate} onOpenChange={() => setEditTemplate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Template: {editTemplate.name}</DialogTitle>
            </DialogHeader>
            <TemplateEditor
              initial={editTemplate}
              onSave={(data) => updateMut.mutate({ id: editTemplate.id, ...data } as any)}
              onCancel={() => setEditTemplate(null)}
              isSaving={updateMut.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this certificate template? Any courses using it will revert to the default template.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
