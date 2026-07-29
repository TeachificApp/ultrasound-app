/**
 * CertificateTemplatesAdmin.tsx
 * Admin UI for managing certificate templates and viewing issued certificates.
 *
 * Changes:
 * - Signature fields removed (no admin signature required on certificates)
 * - PDF template download + re-upload supported per template
 */
import { useRef, useState } from "react";
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
import { Plus, Edit, Trash2, Award, Star, Download, Eye, Upload, FileText, X, Loader2 } from "lucide-react";

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
  footerText?: string | null;
  organizationName: string;
  layout: "classic" | "modern" | "minimal";
  pdfTemplateUrl?: string | null;
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
  footerText: "www.allaboutultrasound.com  ·  © All About Ultrasound™",
  organizationName: "All About Ultrasound",
  layout: "classic",
  pdfTemplateUrl: null,
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDataUri, setPreviewDataUri] = useState<string | null>(null);
  const previewMut = trpc.lmsAdmin.generateSampleCertificatePdfInline.useMutation({
    onSuccess: (res) => { setPreviewDataUri(res.dataUri); setPreviewLoading(false); },
    onError: (e) => { toast.error(`Preview failed: ${e.message}`); setPreviewLoading(false); },
  });
  const handlePreview = () => {
    setPreviewLoading(true);
    setPreviewDataUri(null);
    previewMut.mutate({
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      textColor: form.textColor,
      fontFamily: form.fontFamily,
      footerText: form.footerText,
      organizationName: form.organizationName,
      layout: form.layout,
      logoUrl: form.logoUrl,
      backgroundImageUrl: form.backgroundImageUrl,
    });
  };
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

      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handlePreview}
          disabled={previewLoading}
          className="text-[#189aa1] border-[#189aa1] hover:bg-teal-50"
        >
          {previewLoading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Generating…</> : <><Eye className="w-4 h-4 mr-1" />Preview with Sample Data</>}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={isSaving || !form.name.trim()}>
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      {/* Inline PDF preview */}
      {previewDataUri && (
        <div className="border rounded-lg overflow-hidden" style={{ height: "60vh" }}>
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
            <p className="text-xs text-muted-foreground">Sample preview — placeholders shown for learner name, course title, and date</p>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setPreviewDataUri(null)}>Close Preview</Button>
          </div>
          <iframe src={previewDataUri} className="w-full h-full border-0" title="Certificate Preview" />
        </div>
      )}
    </div>
  );
}

/** PDF upload panel shown on each template card */
function PdfUploadPanel({ template }: { template: CertTemplate }) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const uploadMut = trpc.lmsAdmin.uploadCertificatePdf.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      toast.success("PDF template uploaded");
    },
    onError: (e) => toast.error(`Upload failed: ${e.message}`),
  });

  const removeMut = trpc.lmsAdmin.updateCertificateTemplate.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      toast.success("PDF template removed — generated PDF will be used");
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const sampleMut = trpc.lmsAdmin.generateSampleCertificatePdf.useMutation({
    onError: (e) => { toast.error(`Download failed: ${e.message}`); setDownloading(false); },
  });

  const handleDownloadSample = async () => {
    setDownloading(true);
    try {
      const result = await sampleMut.mutateAsync({ templateId: template.id });
      if (result.url) {
        // Custom PDF — open directly
        window.open(result.url, "_blank");
      } else if (result.dataUri) {
        // Generated PDF — trigger browser download
        const a = document.createElement("a");
        a.href = result.dataUri;
        a.download = `certificate-template-${template.id}-sample.pdf`;
        a.click();
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("PDF must be under 15 MB");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUri = reader.result as string;
        await uploadMut.mutateAsync({ templateId: template.id, dataUri });
        setUploading(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="border-t pt-3 mt-1 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PDF Template</p>
      {template.pdfTemplateUrl ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleDownloadSample} disabled={downloading}>
            <Download className="w-3 h-3 mr-1" />{downloading ? "Generating…" : "Download PDF"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-3 h-3 mr-1" />{uploading ? "Uploading…" : "Replace PDF"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7 text-destructive hover:text-destructive"
            onClick={() => removeMut.mutate({ id: template.id, pdfTemplateUrl: null })}
            disabled={removeMut.isPending}
          >
            <X className="w-3 h-3 mr-1" />Remove
          </Button>
          <span className="text-xs text-muted-foreground">Custom PDF active</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={handleDownloadSample}
            disabled={downloading}
          >
            <Download className="w-3 h-3 mr-1" />{downloading ? "Generating…" : "Download Sample"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-3 h-3 mr-1" />{uploading ? "Uploading…" : "Upload PDF Template"}
          </Button>
          <span className="text-xs text-muted-foreground">Using generated PDF</span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

/** Standalone PDF actions panel — always visible, works without any saved templates */
function StandalonePdfPanel() {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Generate a sample PDF using the default template (or built-in defaults if none)
  const sampleMut = trpc.lmsAdmin.generateSampleCertificatePdf.useMutation({
    onError: (e) => { toast.error(`Download failed: ${e.message}`); setDownloading(false); },
  });

  // Create a new default template with the uploaded PDF
  const createMut = trpc.lmsAdmin.createCertificateTemplate.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      toast.success("Default template created with your PDF");
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const uploadMut = trpc.lmsAdmin.uploadCertificatePdf.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCertificateTemplates.invalidate();
      toast.success("PDF template uploaded");
    },
    onError: (e) => toast.error(`Upload failed: ${e.message}`),
  });

  const { data: templates = [] } = trpc.lmsAdmin.listCertificateTemplates.useQuery();
  const defaultTemplate = (templates as CertTemplate[]).find((t) => t.isDefault) ?? (templates as CertTemplate[])[0] ?? null;

  const handleDownloadSample = async () => {
    setDownloading(true);
    try {
      const result = await sampleMut.mutateAsync({ templateId: defaultTemplate?.id ?? 0 });
      if (result.url) {
        window.open(result.url, "_blank");
      } else if (result.dataUri) {
        const a = document.createElement("a");
        a.href = result.dataUri;
        a.download = "certificate-template-sample.pdf";
        a.click();
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Only PDF files are accepted"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("PDF must be under 15 MB"); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUri = reader.result as string;
        if (defaultTemplate) {
          await uploadMut.mutateAsync({ templateId: defaultTemplate.id, dataUri });
        } else {
          // No templates yet — create a default one with this PDF
          const created = await createMut.mutateAsync({
            name: "Default",
            description: "Auto-created from uploaded PDF",
            primaryColor: "#189aa1",
            accentColor: "#c9a84c",
            textColor: "#0e1e2e",
            fontFamily: "Helvetica",
            footerText: "www.allaboutultrasound.com  ·  © All About Ultrasound™",
            organizationName: "All About Ultrasound",
            layout: "classic",
            isDefault: true,
            isActive: true,
          } as any);
          if ((created as any)?.id) {
            await uploadMut.mutateAsync({ templateId: (created as any).id, dataUri });
          }
        }
        setUploading(false);
      };
      reader.onerror = () => { toast.error("Failed to read file"); setUploading(false); };
      reader.readAsDataURL(file);
    } catch { setUploading(false); }
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/40 border rounded-lg">
      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">PDF Certificate Template</p>
        <p className="text-xs text-muted-foreground">Download the sample to edit the design, then re-upload your customised PDF.</p>
      </div>
      <div className="flex gap-2 shrink-0 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye className="w-3.5 h-3.5 mr-1" />Preview
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownloadSample} disabled={downloading}>
          <Download className="w-3.5 h-3.5 mr-1" />{downloading ? "Generating…" : "Download Sample"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="w-3.5 h-3.5 mr-1" />{uploading ? "Uploading…" : "Upload PDF"}
        </Button>
      </div>
      {previewOpen && (
        <PdfPreviewModal
          templateId={defaultTemplate?.id}
          templateName={defaultTemplate?.name ?? "Default Template"}
          onClose={() => setPreviewOpen(false)}
        />
      )}
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── PDF Preview Modal ──────────────────────────────────────────────────────
function PdfPreviewModal({ templateId, templateName, onClose }: {
  templateId?: number;
  templateName?: string;
  onClose: () => void;
}) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sampleMut = trpc.lmsAdmin.generateSampleCertificatePdf.useMutation({
    onSuccess: (res) => {
      setDataUri(res.url ?? res.dataUri ?? null);
      setLoading(false);
    },
    onError: (e) => { setError(e.message); setLoading(false); },
  });
  // Trigger on mount
  const triggered = useRef(false);
  if (!triggered.current) {
    triggered.current = true;
    sampleMut.mutate({ templateId: templateId && templateId > 0 ? templateId : undefined });
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#189aa1]" />
            Preview: {templateName ?? "Certificate Template"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30 flex items-center justify-center">
          {loading && <div className="text-muted-foreground text-sm animate-pulse">Generating preview…</div>}
          {error && <div className="text-destructive text-sm px-6">{error}</div>}
          {!loading && !error && dataUri && (
            <iframe src={dataUri} className="w-full h-full border-0" title="Certificate Preview" />
          )}
        </div>
        <div className="px-6 py-3 border-t shrink-0 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Placeholders shown: {"{{LEARNER_NAME}}"}, {"{{COURSE_TITLE}}"}, {"{{ISSUED_DATE}}"}</p>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CertificateTemplatesAdmin() {
  const utils = trpc.useUtils();

  const { data: templates = [], isLoading } = trpc.lmsAdmin.listCertificateTemplates.useQuery();
  const { data: issuedCerts = [], isLoading: certsLoading } = trpc.lmsAdmin.listIssuedCertificates.useQuery({});

  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<CertTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<{ id?: number; name?: string } | null>(null);

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
              <p className="text-sm text-muted-foreground">Design templates used when issuing completion certificates. You can upload a custom PDF to replace the generated design.</p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Template
            </Button>
          </div>

          <StandalonePdfPanel />

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
                      {t.pdfTemplateUrl && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          <FileText className="w-3 h-3 mr-1" />Custom PDF
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.organizationName && <div>Org: {t.organizationName}</div>}
                    </div>
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {!t.isDefault && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setDefaultMut.mutate({ id: t.id, isDefault: true })}>
                          <Star className="w-3 h-3 mr-1" />Set Default
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setPreviewTemplate({ id: t.id, name: t.name })}>
                        <Eye className="w-3 h-3 mr-1" />Preview
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditTemplate(t)}>
                        <Edit className="w-3 h-3 mr-1" />Edit
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {/* PDF download / upload panel */}
                    <PdfUploadPanel template={t} />
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

      {/* ── PDF Preview Modal ─────────────────────────────────────────────── */}
      {previewTemplate !== null && (
        <PdfPreviewModal
          templateId={previewTemplate.id}
          templateName={previewTemplate.name}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

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

