/**
 * FormEmbedSharePanel.tsx — Embed widget builder in Forms → Share
 */
import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Code2, Copy, CheckCircle2, Eye, Monitor, Tablet, Smartphone,
  Layers, PanelRight, Maximize2,
} from "lucide-react";
import type {
  FormEmbedWidgetSettings,
  FormEmbedDisplayType,
  EmbedTriggerConfig,
} from "@shared/formEmbedWidgetTypes";
import { defaultEmbedWidgetSettings } from "@shared/formEmbedWidgetTypes";

const BRAND = "#0e7490";

type PreviewDevice = "desktop" | "tablet" | "mobile";

function TriggerFields({
  triggers,
  onChange,
}: {
  triggers: EmbedTriggerConfig;
  onChange: (t: EmbedTriggerConfig) => void;
}) {
  const set = (key: keyof EmbedTriggerConfig, val: unknown) => onChange({ ...triggers, [key]: val });
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2"><Switch checked={triggers.openImmediately} onCheckedChange={v => set("openImmediately", v)} /> Open immediately</label>
        <label className="flex items-center gap-2"><Switch checked={triggers.exitIntent} onCheckedChange={v => set("exitIntent", v)} /> Exit intent</label>
        <label className="flex items-center gap-2"><Switch checked={triggers.buttonClick} onCheckedChange={v => set("buttonClick", v)} /> Button click</label>
        <label className="flex items-center gap-2"><Switch checked={triggers.linkClick} onCheckedChange={v => set("linkClick", v)} /> Link click</label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Delay (seconds)</Label><Input type="number" min={0} value={triggers.delaySeconds} onChange={e => set("delaySeconds", parseInt(e.target.value) || 0)} className="mt-1 h-8" /></div>
        <div><Label className="text-xs">Scroll %</Label><Input type="number" min={0} max={100} value={triggers.scrollPercent} onChange={e => set("scrollPercent", parseInt(e.target.value) || 0)} className="mt-1 h-8" /></div>
        <div><Label className="text-xs">Inactivity (sec)</Label><Input type="number" min={0} value={triggers.inactivitySeconds} onChange={e => set("inactivitySeconds", parseInt(e.target.value) || 0)} className="mt-1 h-8" /></div>
        <div>
          <Label className="text-xs">Open frequency</Label>
          <Select value={triggers.openFrequency} onValueChange={v => set("openFrequency", v)}>
            <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="always">Always</SelectItem>
              <SelectItem value="once_per_session">Once per session</SelectItem>
              <SelectItem value="once_per_user">Once per user</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Button selector (CSS)</Label><Input value={triggers.buttonSelector} onChange={e => set("buttonSelector", e.target.value)} placeholder={`[data-tf-form-trigger]`} className="mt-1 h-8 font-mono text-xs" /></div>
      <div><Label className="text-xs">Custom element selector</Label><Input value={triggers.customElementSelector} onChange={e => set("customElementSelector", e.target.value)} className="mt-1 h-8 font-mono text-xs" /></div>
    </div>
  );
}

function EmbedPreview({
  displayType,
  settings,
  embedUrl,
  device,
  simulateOpen,
}: {
  displayType: FormEmbedDisplayType;
  settings: FormEmbedWidgetSettings;
  embedUrl: string;
  device: PreviewDevice;
  simulateOpen: boolean;
}) {
  const width = device === "mobile" ? 375 : device === "tablet" ? 768 : 1024;
  const inline = settings.inline;

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-100 p-4 overflow-hidden" style={{ maxWidth: width, margin: "0 auto" }}>
      <div className="text-[10px] text-gray-400 mb-2 uppercase tracking-wide">{device} preview</div>
      {displayType === "inline" && (
        <div style={{ width: inline.width, maxWidth: inline.maxWidth, margin: "0 auto", padding: inline.containerPadding, borderRadius: inline.borderRadius, overflow: "hidden", background: "#fff" }}>
          <iframe src={embedUrl} title="Preview" style={{ width: "100%", height: 320, border: "none", display: "block" }} />
        </div>
      )}
      {(displayType === "popup" || displayType === "slide_in") && (
        <div className="relative bg-white rounded-lg overflow-hidden" style={{ height: 360 }}>
          {!simulateOpen ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Trigger not simulated — toggle “Show open state” to preview {displayType === "popup" ? "modal" : "panel"}
            </div>
          ) : (
            <>
              <div className="absolute inset-0" style={{ background: settings.popup.overlayColor, opacity: settings.popup.overlayOpacity }} />
              <div
                className="absolute bg-white shadow-xl overflow-hidden"
                style={
                  displayType === "popup"
                    ? { width: "85%", height: "85%", left: "7.5%", top: "7.5%", borderRadius: settings.popup.borderRadius }
                    : {
                        width: settings.slideIn.panelWidth,
                        maxWidth: "90%",
                        height: "100%",
                        right: settings.slideIn.position === "right" ? 0 : undefined,
                        left: settings.slideIn.position === "left" ? 0 : undefined,
                        bottom: settings.slideIn.position === "bottom" ? 0 : undefined,
                        borderRadius: settings.slideIn.borderRadius,
                      }
                }
              >
                <iframe src={embedUrl} title="Preview" style={{ width: "100%", height: "100%", border: "none" }} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function FormEmbedSharePanel({
  formId,
  publicUrl,
  hostDomain,
}: {
  formId: number;
  publicUrl: string | null;
  hostDomain: string;
}) {
  const { data, isLoading, refetch } = trpc.generalForm.getEmbedWidget.useQuery({ templateId: formId });
  const saveWidget = trpc.generalForm.saveEmbedWidget.useMutation({
    onSuccess: () => { toast.success("Embed settings saved"); refetch(); },
    onError: e => toast.error(e.message),
  });

  const [name, setName] = useState("Default Widget");
  const [isEnabled, setIsEnabled] = useState(false);
  const [displayType, setDisplayType] = useState<FormEmbedDisplayType>("inline");
  const [settings, setSettings] = useState<FormEmbedWidgetSettings>(defaultEmbedWidgetSettings());
  const [domainMode, setDomainMode] = useState<"all" | "allowlist">("all");
  const [allowedDomainsText, setAllowedDomainsText] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [simulateOpen, setSimulateOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.widget.name);
    setIsEnabled(data.widget.isEnabled);
    setDisplayType(data.widget.displayType as FormEmbedDisplayType);
    setSettings(data.settings);
    setDomainMode(data.widget.domainMode as "all" | "allowlist");
    setAllowedDomainsText((data.allowedDomains ?? []).join("\n"));
  }, [data]);

  const widgetKey = data?.widget.widgetKey ?? "";
  const baseUrl = `https://${hostDomain}`;
  const embedUrl = publicUrl ? `${publicUrl}/embed?widget=${widgetKey}` : "";

  const scriptEmbed = widgetKey && publicUrl
    ? `<script src="${baseUrl}/embed.js"\n        data-form-id="${formId}"\n        data-widget-id="${widgetKey}"\n        async></script>`
    : null;

  const iframeEmbed = embedUrl
    ? `<iframe src="${embedUrl}"\n        width="100%"\n        height="800"\n        frameborder="0"\n        style="border:none;border-radius:12px;"\n        title="Embedded Form"></iframe>`
    : null;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const save = () => {
    const domains = allowedDomainsText.split("\n").map(d => d.trim()).filter(Boolean);
    saveWidget.mutate({
      templateId: formId,
      name: name.trim() || "Default Widget",
      isEnabled,
      displayType,
      settingsJson: JSON.stringify(settings),
      domainMode,
      allowedDomains: domains,
    });
  };

  const updateSettings = (partial: Partial<FormEmbedWidgetSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  if (isLoading) return <div className="text-sm text-gray-400 py-8">Loading embed settings…</div>;
  if (!publicUrl) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-gray-500">
          Publish the form and set a public slug before configuring embed widgets.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Code2 className="w-4 h-4" /> Embed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
            <div>
              <p className="font-medium text-sm">Enable Embed</p>
              <p className="text-xs text-gray-500">Allow this form to be embedded on external websites via script or iframe.</p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          {isEnabled && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Widget Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Display Type</Label>
                  <Select value={displayType} onValueChange={v => setDisplayType(v as FormEmbedDisplayType)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inline"><span className="flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Inline Embed</span></SelectItem>
                      <SelectItem value="popup"><span className="flex items-center gap-2"><Maximize2 className="w-3.5 h-3.5" /> Popup Modal</span></SelectItem>
                      <SelectItem value="slide_in"><span className="flex items-center gap-2"><PanelRight className="w-3.5 h-3.5" /> Slide-In Panel</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Tabs defaultValue="appearance">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                  <TabsTrigger value="triggers">Triggers</TabsTrigger>
                  <TabsTrigger value="domains">Domains</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="appearance" className="space-y-4 mt-4">
                  {displayType === "inline" && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><Label className="text-xs">Width</Label><Input value={settings.inline.width} onChange={e => updateSettings({ inline: { ...settings.inline, width: e.target.value } })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">Max Width</Label><Input value={settings.inline.maxWidth} onChange={e => updateSettings({ inline: { ...settings.inline, maxWidth: e.target.value } })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">Padding</Label><Input value={settings.inline.containerPadding} onChange={e => updateSettings({ inline: { ...settings.inline, containerPadding: e.target.value } })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">Border Radius</Label><Input value={settings.inline.borderRadius} onChange={e => updateSettings({ inline: { ...settings.inline, borderRadius: e.target.value } })} className="mt-1 h-8" /></div>
                      <label className="flex items-center gap-2 text-sm"><Switch checked={settings.inline.autoHeight} onCheckedChange={v => updateSettings({ inline: { ...settings.inline, autoHeight: v } })} /> Auto height</label>
                      <label className="flex items-center gap-2 text-sm"><Switch checked={settings.inline.responsive} onCheckedChange={v => updateSettings({ inline: { ...settings.inline, responsive: v } })} /> Responsive</label>
                      <label className="flex items-center gap-2 text-sm"><Switch checked={settings.inline.hidePlatformBranding} onCheckedChange={v => updateSettings({ inline: { ...settings.inline, hidePlatformBranding: v } })} /> Hide branding</label>
                    </div>
                  )}
                  {displayType === "popup" && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><Label className="text-xs">Modal Width</Label><Input value={settings.popup.width} onChange={e => updateSettings({ popup: { ...settings.popup, width: e.target.value } })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">Modal Height</Label><Input value={settings.popup.height} onChange={e => updateSettings({ popup: { ...settings.popup, height: e.target.value } })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">Overlay Opacity</Label><Input type="number" step={0.05} min={0} max={1} value={settings.popup.overlayOpacity} onChange={e => updateSettings({ popup: { ...settings.popup, overlayOpacity: parseFloat(e.target.value) || 0.55 } })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">Trigger Button Label</Label><Input value={settings.popup.triggerButtonLabel} onChange={e => updateSettings({ popup: { ...settings.popup, triggerButtonLabel: e.target.value } })} className="mt-1 h-8" /></div>
                      <label className="flex items-center gap-2 text-sm"><Switch checked={settings.popup.showCloseButton} onCheckedChange={v => updateSettings({ popup: { ...settings.popup, showCloseButton: v } })} /> Close button</label>
                      <label className="flex items-center gap-2 text-sm"><Switch checked={settings.popup.clickOutsideToClose} onCheckedChange={v => updateSettings({ popup: { ...settings.popup, clickOutsideToClose: v } })} /> Click outside to close</label>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">On Submit</Label>
                        <Select value={settings.popup.onSubmit} onValueChange={v => updateSettings({ popup: { ...settings.popup, onSubmit: v as any } })}>
                          <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="show_success">Display post-submission content</SelectItem>
                            <SelectItem value="close">Close modal</SelectItem>
                            <SelectItem value="keep_open">Keep modal open</SelectItem>
                            <SelectItem value="redirect">Redirect user</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {displayType === "slide_in" && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Position</Label>
                        <Select value={settings.slideIn.position} onValueChange={v => updateSettings({ slideIn: { ...settings.slideIn, position: v as any } })}>
                          <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="right">Right side</SelectItem>
                            <SelectItem value="left">Left side</SelectItem>
                            <SelectItem value="bottom">Bottom (mobile)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Panel Width</Label><Input value={settings.slideIn.panelWidth} onChange={e => updateSettings({ slideIn: { ...settings.slideIn, panelWidth: e.target.value } })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">Tab Label</Label><Input value={settings.slideIn.floatingTabLabel} onChange={e => updateSettings({ slideIn: { ...settings.slideIn, floatingTabLabel: e.target.value } })} className="mt-1 h-8" /></div>
                      <div><Label className="text-xs">Button Label</Label><Input value={settings.slideIn.floatingButtonLabel} onChange={e => updateSettings({ slideIn: { ...settings.slideIn, floatingButtonLabel: e.target.value } })} className="mt-1 h-8" /></div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="triggers" className="mt-4">
                  {displayType === "inline" ? (
                    <p className="text-sm text-gray-500">Inline embeds render directly in the page — no triggers required.</p>
                  ) : (
                    <TriggerFields
                      triggers={displayType === "popup" ? settings.popup.triggers : settings.slideIn.triggers}
                      onChange={t => {
                        if (displayType === "popup") updateSettings({ popup: { ...settings.popup, triggers: t } });
                        else updateSettings({ slideIn: { ...settings.slideIn, triggers: t } });
                      }}
                    />
                  )}
                </TabsContent>

                <TabsContent value="domains" className="space-y-3 mt-4">
                  <Select value={domainMode} onValueChange={v => setDomainMode(v as "all" | "allowlist")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Allow all domains</SelectItem>
                      <SelectItem value="allowlist">Allow specific domains only</SelectItem>
                    </SelectContent>
                  </Select>
                  {domainMode === "allowlist" && (
                    <div>
                      <Label className="text-xs">Allowed domains (one per line, wildcards supported e.g. *.allaboutultrasound.com)</Label>
                      <Textarea value={allowedDomainsText} onChange={e => setAllowedDomainsText(e.target.value)} rows={5} className="mt-1 font-mono text-xs" placeholder={"allaboutultrasound.com\n*.allaboutultrasound.com\niheartecho.com"} />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="analytics" className="space-y-2 mt-4">
                  {Object.entries(settings.analytics).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-2 text-sm capitalize">
                      <Switch checked={val} onCheckedChange={v => updateSettings({ analytics: { ...settings.analytics, [key]: v } })} />
                      Track {key.replace(/([A-Z])/g, " $1").replace(/^track /i, "")}
                    </label>
                  ))}
                </TabsContent>
              </Tabs>

              <Button onClick={save} disabled={saveWidget.isPending} className="text-white w-full" style={{ background: BRAND }}>
                Save Widget Settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {isEnabled && scriptEmbed && (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Script Embed (recommended)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-gray-500">Loads widget triggers, domain checks, and display type automatically.</p>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => copy(scriptEmbed, "script")}>
                  {copied === "script" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === "script" ? "Copied!" : "Copy"}
                </Button>
              </div>
              <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{scriptEmbed}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Iframe Embed (optional)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(iframeEmbed!, "iframe")}>
                  {copied === "iframe" ? "Copied!" : "Copy"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(embedUrl, "_blank")}><Eye className="w-3.5 h-3.5 mr-1" /> Open</Button>
              </div>
              <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{iframeEmbed}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="w-4 h-4" /> Live Preview</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                {([
                  { id: "desktop" as const, icon: Monitor },
                  { id: "tablet" as const, icon: Tablet },
                  { id: "mobile" as const, icon: Smartphone },
                ]).map(d => (
                  <Button key={d.id} size="sm" variant={previewDevice === d.id ? "default" : "outline"} onClick={() => setPreviewDevice(d.id)} className="gap-1">
                    <d.icon className="w-3.5 h-3.5" /> {d.id}
                  </Button>
                ))}
                {(displayType === "popup" || displayType === "slide_in") && (
                  <label className="flex items-center gap-2 text-xs ml-auto">
                    <Switch checked={simulateOpen} onCheckedChange={setSimulateOpen} /> Show open state
                  </label>
                )}
              </div>
              <EmbedPreview displayType={displayType} settings={settings} embedUrl={embedUrl} device={previewDevice} simulateOpen={simulateOpen} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
