/**
 * CheckoutPageEditor.tsx
 *
 * Full-featured drag-and-drop checkout page editor for the LMS admin panel.
 *
 * Features:
 *  - Template picker: 5 built-in presets + saved custom templates (apply / delete)
 *  - Section list: toggle enabled/disabled, drag-to-reorder
 *  - Per-section config panels:
 *      trust_seals     — preset seal grid + custom seal builder
 *      guarantee       — icon picker, headline, body, badge label
 *      testimonials    — add/edit/remove testimonials with rating
 *      faq             — add/edit/remove Q&A pairs
 *      custom_html     — raw HTML textarea
 *      course_includes — auto or manual item list
 *  - Save as Template: name + description dialog → saves to DB
 *  - Live preview link
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck,
  Lock,
  Award,
  Star,
  Heart,
  Zap,
  CheckCircle2,
  MessageSquare,
  HelpCircle,
  Code2,
  BookOpen,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Save,
  LayoutTemplate,
  X,
  RefreshCw,
  Shield,
  BadgeCheck,
  Stethoscope,
} from "lucide-react";
import {
  CheckoutPageConfig,
  CheckoutSection,
  CheckoutSectionType,
  TrustSeal,
  Testimonial,
  FaqItem,
  TrustSealsSection,
  GuaranteeSection,
  TestimonialsSection,
  FaqSection,
  CustomHtmlSection,
  CourseIncludesSection,
  PresetSealId,
  defaultCheckoutPageConfig,
  parseCheckoutPageConfig,
} from "@/../../shared/checkoutPageConfig";

// ─── Preset seal definitions ──────────────────────────────────────────────────

const PRESET_SEALS: Array<{ id: PresetSealId; label: string; icon: React.ReactNode; description: string }> = [
  { id: "stripe_secure", label: "Secure Payment", icon: <Lock className="h-4 w-4" />, description: "Powered by Stripe" },
  { id: "ssl_encrypted", label: "SSL Encrypted", icon: <ShieldCheck className="h-4 w-4" />, description: "256-bit encryption" },
  { id: "money_back_30", label: "30-Day Money-Back", icon: <RefreshCw className="h-4 w-4" />, description: "Full refund guarantee" },
  { id: "money_back_14", label: "14-Day Money-Back", icon: <RefreshCw className="h-4 w-4" />, description: "Full refund guarantee" },
  { id: "satisfaction_guaranteed", label: "Satisfaction Guaranteed", icon: <Star className="h-4 w-4" />, description: "100% satisfaction" },
  { id: "hipaa_compliant", label: "HIPAA Compliant", icon: <Shield className="h-4 w-4" />, description: "Healthcare privacy" },
  { id: "accredited_cme", label: "Accredited CME", icon: <BadgeCheck className="h-4 w-4" />, description: "Continuing education" },
  { id: "secure_payment", label: "Secure Checkout", icon: <Lock className="h-4 w-4" />, description: "Your data is safe" },
  { id: "privacy_protected", label: "Privacy Protected", icon: <Shield className="h-4 w-4" />, description: "We never share your data" },
];

// ─── Built-in templates ───────────────────────────────────────────────────────

const BUILT_IN_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  emoji: string;
  config: CheckoutPageConfig;
}> = [
  {
    id: "simple",
    name: "Simple & Clean",
    description: "Minimal trust seals and course includes. Best for straightforward one-time purchases.",
    emoji: "✨",
    config: {
      sections: [
        {
          type: "trust_seals",
          enabled: true,
          order: 0,
          layout: "row",
          seals: [
            { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
            { id: "ssl_encrypted", preset: "ssl_encrypted", label: "SSL Encrypted", enabled: true },
          ],
        },
        { type: "course_includes", enabled: true, order: 1, headline: "What's included" },
      ],
    },
  },
  {
    id: "high_trust_medical",
    name: "High-Trust Medical",
    description: "Full trust stack with HIPAA, CME accreditation, money-back guarantee, and FAQ. Ideal for clinical courses.",
    emoji: "🏥",
    config: {
      sections: [
        {
          type: "trust_seals",
          enabled: true,
          order: 0,
          layout: "grid",
          seals: [
            { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
            { id: "ssl_encrypted", preset: "ssl_encrypted", label: "SSL Encrypted", enabled: true },
            { id: "hipaa_compliant", preset: "hipaa_compliant", label: "HIPAA Compliant", enabled: true },
            { id: "accredited_cme", preset: "accredited_cme", label: "Accredited CME", enabled: true },
            { id: "money_back_30", preset: "money_back_30", label: "30-Day Money-Back", enabled: true },
            { id: "satisfaction_guaranteed", preset: "satisfaction_guaranteed", label: "Satisfaction Guaranteed", enabled: true },
          ],
        },
        { type: "course_includes", enabled: true, order: 1, headline: "What's included" },
        {
          type: "guarantee",
          enabled: true,
          order: 2,
          icon: "ShieldCheck",
          headline: "30-Day Money-Back Guarantee",
          body: "If you're not completely satisfied within 30 days of purchase, we'll refund your payment in full — no questions asked.",
          badgeLabel: "30-Day Guarantee",
        },
        {
          type: "faq",
          enabled: true,
          order: 3,
          headline: "Frequently asked questions",
          items: [
            { id: "faq_1", question: "Is this course accredited for CME?", answer: "Yes — this course is accredited for continuing medical education. Your certificate will be issued upon completion.", enabled: true },
            { id: "faq_2", question: "How long do I have access?", answer: "You have lifetime access to all course materials once enrolled.", enabled: true },
            { id: "faq_3", question: "Can I get a refund?", answer: "Yes — we offer a 30-day money-back guarantee. Contact us within 30 days of purchase for a full refund.", enabled: true },
          ],
        },
      ],
    },
  },
  {
    id: "subscription_focus",
    name: "Subscription Focus",
    description: "Highlights recurring value with testimonials and FAQ. Best for membership or subscription products.",
    emoji: "🔄",
    config: {
      sections: [
        {
          type: "trust_seals",
          enabled: true,
          order: 0,
          layout: "row",
          seals: [
            { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
            { id: "ssl_encrypted", preset: "ssl_encrypted", label: "SSL Encrypted", enabled: true },
            { id: "satisfaction_guaranteed", preset: "satisfaction_guaranteed", label: "Cancel Anytime", enabled: true },
          ],
        },
        { type: "course_includes", enabled: true, order: 1, headline: "Everything you get" },
        {
          type: "testimonials",
          enabled: true,
          order: 2,
          headline: "What our members say",
          testimonials: [],
        },
        {
          type: "faq",
          enabled: true,
          order: 3,
          headline: "Frequently asked questions",
          items: [
            { id: "faq_1", question: "Can I cancel anytime?", answer: "Yes — you can cancel your subscription at any time from your account settings. You'll retain access until the end of your current billing period.", enabled: true },
            { id: "faq_2", question: "What happens after I cancel?", answer: "Your access continues until the end of your paid period. After that, you'll lose access to premium content.", enabled: true },
          ],
        },
      ],
    },
  },
  {
    id: "course_bundle",
    name: "Course Bundle",
    description: "Emphasises value with a full seal grid, guarantee, and testimonials. Great for bundles and high-ticket offers.",
    emoji: "📦",
    config: {
      sections: [
        {
          type: "trust_seals",
          enabled: true,
          order: 0,
          layout: "grid",
          seals: [
            { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
            { id: "ssl_encrypted", preset: "ssl_encrypted", label: "SSL Encrypted", enabled: true },
            { id: "money_back_30", preset: "money_back_30", label: "30-Day Money-Back", enabled: true },
            { id: "satisfaction_guaranteed", preset: "satisfaction_guaranteed", label: "Satisfaction Guaranteed", enabled: true },
          ],
        },
        { type: "course_includes", enabled: true, order: 1, headline: "Everything included in this bundle" },
        {
          type: "guarantee",
          enabled: true,
          order: 2,
          icon: "ShieldCheck",
          headline: "30-Day Money-Back Guarantee",
          body: "Not satisfied? Get a full refund within 30 days — no questions asked.",
          badgeLabel: "30-Day Guarantee",
        },
        {
          type: "testimonials",
          enabled: true,
          order: 3,
          headline: "Trusted by healthcare professionals",
          testimonials: [],
        },
      ],
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Just the Stripe payment form — no extra sections. Best for returning customers or internal use.",
    emoji: "⬜",
    config: {
      sections: [
        {
          type: "trust_seals",
          enabled: true,
          order: 0,
          layout: "row",
          seals: [
            { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
          ],
        },
      ],
    },
  },
];

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTION_META: Record<CheckoutSectionType, { label: string; icon: React.ReactNode; description: string }> = {
  trust_seals: { label: "Trust Seals & Badges", icon: <ShieldCheck className="h-4 w-4" />, description: "Security badges and guarantee icons" },
  guarantee: { label: "Money-Back Guarantee", icon: <Award className="h-4 w-4" />, description: "Refund policy with icon and text" },
  testimonials: { label: "Testimonials", icon: <MessageSquare className="h-4 w-4" />, description: "Student reviews and ratings" },
  faq: { label: "FAQ", icon: <HelpCircle className="h-4 w-4" />, description: "Frequently asked questions" },
  custom_html: { label: "Custom HTML", icon: <Code2 className="h-4 w-4" />, description: "Raw HTML block" },
  course_includes: { label: "Course Includes", icon: <BookOpen className="h-4 w-4" />, description: "What's included in the course" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Sub-editors ─────────────────────────────────────────────────────────────

function TrustSealsEditor({
  section,
  onChange,
}: {
  section: TrustSealsSection;
  onChange: (s: TrustSealsSection) => void;
}) {
  const [customLabel, setCustomLabel] = useState("");

  const toggleSeal = (id: string) => {
    onChange({
      ...section,
      seals: section.seals.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    });
  };

  const addPreset = (preset: typeof PRESET_SEALS[0]) => {
    if (section.seals.find((s) => s.id === preset.id)) return;
    onChange({
      ...section,
      seals: [...section.seals, { id: preset.id, preset: preset.id, label: preset.label, enabled: true }],
    });
  };

  const addCustom = () => {
    if (!customLabel.trim()) return;
    const id = `custom_${uid()}`;
    onChange({
      ...section,
      seals: [...section.seals, { id, label: customLabel.trim(), enabled: true }],
    });
    setCustomLabel("");
  };

  const removeSeal = (id: string) => {
    onChange({ ...section, seals: section.seals.filter((s) => s.id !== id) });
  };

  const updateSealLabel = (id: string, label: string) => {
    onChange({ ...section, seals: section.seals.map((s) => (s.id === id ? { ...s, label } : s)) });
  };

  return (
    <div className="space-y-4">
      {/* Layout toggle */}
      <div className="flex items-center gap-3">
        <Label className="text-xs text-gray-500">Layout</Label>
        <div className="flex gap-2">
          {(["row", "grid"] as const).map((l) => (
            <button
              key={l}
              onClick={() => onChange({ ...section, layout: l })}
              className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                section.layout === l
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-teal-400"
              }`}
            >
              {l === "row" ? "Horizontal Row" : "2-Column Grid"}
            </button>
          ))}
        </div>
      </div>

      {/* Preset seal picker */}
      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Add preset seal</Label>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_SEALS.map((p) => {
            const already = !!section.seals.find((s) => s.id === p.id);
            return (
              <button
                key={p.id}
                onClick={() => addPreset(p)}
                disabled={already}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center text-xs transition-colors ${
                  already
                    ? "bg-teal-50 border-teal-200 text-teal-700 cursor-default"
                    : "bg-white border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-gray-600"
                }`}
              >
                {p.icon}
                <span className="font-medium leading-tight">{p.label}</span>
                {already && <span className="text-teal-500 text-[10px]">Added</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom seal */}
      <div>
        <Label className="text-xs text-gray-500 mb-1 block">Add custom seal</Label>
        <div className="flex gap-2">
          <Input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="e.g. ANZSCTS Endorsed"
            className="text-sm h-8"
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
          />
          <Button size="sm" variant="outline" onClick={addCustom} className="h-8 px-3">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Current seals */}
      {section.seals.length > 0 && (
        <div>
          <Label className="text-xs text-gray-500 mb-2 block">Active seals</Label>
          <div className="space-y-2">
            {section.seals.map((seal) => (
              <div key={seal.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
                <Switch
                  checked={seal.enabled}
                  onCheckedChange={() => toggleSeal(seal.id)}
                  className="scale-75"
                />
                <Input
                  value={seal.label}
                  onChange={(e) => updateSealLabel(seal.id, e.target.value)}
                  className="flex-1 h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
                />
                <button onClick={() => removeSeal(seal.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GuaranteeEditor({
  section,
  onChange,
}: {
  section: GuaranteeSection;
  onChange: (s: GuaranteeSection) => void;
}) {
  const ICONS = ["ShieldCheck", "Award", "Star", "Heart", "Zap", "CheckCircle2", "BadgeCheck", "RefreshCw"];
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-gray-500 mb-1 block">Icon</Label>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => onChange({ ...section, icon: ic })}
              className={`p-2 rounded border text-xs transition-colors ${
                section.icon === ic ? "bg-teal-600 text-white border-teal-600" : "bg-white border-gray-200 hover:border-teal-400 text-gray-600"
              }`}
              title={ic}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs text-gray-500 mb-1 block">Headline</Label>
        <Input value={section.headline} onChange={(e) => onChange({ ...section, headline: e.target.value })} className="text-sm h-8" />
      </div>
      <div>
        <Label className="text-xs text-gray-500 mb-1 block">Body text</Label>
        <Textarea value={section.body} onChange={(e) => onChange({ ...section, body: e.target.value })} className="text-sm min-h-[80px] resize-none" />
      </div>
      <div>
        <Label className="text-xs text-gray-500 mb-1 block">Badge label (optional)</Label>
        <Input value={section.badgeLabel ?? ""} onChange={(e) => onChange({ ...section, badgeLabel: e.target.value || undefined })} placeholder="e.g. 30-Day Guarantee" className="text-sm h-8" />
      </div>
    </div>
  );
}

function TestimonialsEditor({
  section,
  onChange,
}: {
  section: TestimonialsSection;
  onChange: (s: TestimonialsSection) => void;
}) {
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setEditing({ id: uid(), name: "", role: "", avatarUrl: "", quote: "", rating: 5, enabled: true });
    setIsNew(true);
  };

  const save = () => {
    if (!editing) return;
    if (isNew) {
      onChange({ ...section, testimonials: [...section.testimonials, editing] });
    } else {
      onChange({ ...section, testimonials: section.testimonials.map((t) => (t.id === editing.id ? editing : t)) });
    }
    setEditing(null);
    setIsNew(false);
  };

  const remove = (id: string) => onChange({ ...section, testimonials: section.testimonials.filter((t) => t.id !== id) });
  const toggle = (id: string) => onChange({ ...section, testimonials: section.testimonials.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)) });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-gray-500 mb-1 block">Section headline</Label>
        <Input value={section.headline ?? ""} onChange={(e) => onChange({ ...section, headline: e.target.value })} placeholder="What our students say" className="text-sm h-8" />
      </div>
      <div className="space-y-2">
        {section.testimonials.map((t) => (
          <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
            <Switch checked={t.enabled} onCheckedChange={() => toggle(t.id)} className="scale-75 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{t.name || "Unnamed"}</p>
              <p className="text-xs text-gray-500 truncate">{t.quote || "No quote"}</p>
            </div>
            <button onClick={() => { setEditing(t); setIsNew(false); }} className="text-gray-400 hover:text-teal-600 transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={openNew} className="w-full h-8 text-xs border-dashed">
        <Plus className="h-3.5 w-3.5 mr-1" /> Add testimonial
      </Button>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add Testimonial" : "Edit Testimonial"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name *</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Role / Title</Label>
                  <Input value={editing.role ?? ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} placeholder="e.g. ICU Nurse" className="h-8 text-sm mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Quote *</Label>
                <Textarea value={editing.quote} onChange={(e) => setEditing({ ...editing, quote: e.target.value })} className="text-sm min-h-[80px] resize-none mt-1" />
              </div>
              <div>
                <Label className="text-xs">Avatar URL (optional)</Label>
                <Input value={editing.avatarUrl ?? ""} onChange={(e) => setEditing({ ...editing, avatarUrl: e.target.value })} placeholder="https://..." className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Rating</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} onClick={() => setEditing({ ...editing, rating: r as 1|2|3|4|5 })} className={`text-lg ${(editing.rating ?? 5) >= r ? "text-yellow-400" : "text-gray-200"}`}>★</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} className="bg-teal-600 hover:bg-teal-700 text-white">
              {isNew ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaqEditor({
  section,
  onChange,
}: {
  section: FaqSection;
  onChange: (s: FaqSection) => void;
}) {
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setEditing({ id: uid(), question: "", answer: "", enabled: true });
    setIsNew(true);
  };

  const save = () => {
    if (!editing) return;
    if (isNew) {
      onChange({ ...section, items: [...section.items, editing] });
    } else {
      onChange({ ...section, items: section.items.map((i) => (i.id === editing.id ? editing : i)) });
    }
    setEditing(null);
    setIsNew(false);
  };

  const remove = (id: string) => onChange({ ...section, items: section.items.filter((i) => i.id !== id) });
  const toggle = (id: string) => onChange({ ...section, items: section.items.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)) });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-gray-500 mb-1 block">Section headline</Label>
        <Input value={section.headline ?? ""} onChange={(e) => onChange({ ...section, headline: e.target.value })} placeholder="Frequently asked questions" className="text-sm h-8" />
      </div>
      <div className="space-y-2">
        {section.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
            <Switch checked={item.enabled} onCheckedChange={() => toggle(item.id)} className="scale-75 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{item.question || "No question"}</p>
              <p className="text-xs text-gray-500 truncate">{item.answer || "No answer"}</p>
            </div>
            <button onClick={() => { setEditing(item); setIsNew(false); }} className="text-gray-400 hover:text-teal-600 transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => remove(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={openNew} className="w-full h-8 text-xs border-dashed">
        <Plus className="h-3.5 w-3.5 mr-1" /> Add FAQ item
      </Button>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add FAQ Item" : "Edit FAQ Item"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Question *</Label>
                <Input value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Answer *</Label>
                <Textarea value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} className="text-sm min-h-[100px] resize-none mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} className="bg-teal-600 hover:bg-teal-700 text-white">
              {isNew ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseIncludesEditor({
  section,
  onChange,
}: {
  section: CourseIncludesSection;
  onChange: (s: CourseIncludesSection) => void;
}) {
  const [newText, setNewText] = useState("");

  const addItem = () => {
    if (!newText.trim()) return;
    const items = section.items ?? [];
    onChange({ ...section, items: [...items, { icon: "CheckCircle2", text: newText.trim() }] });
    setNewText("");
  };

  const removeItem = (idx: number) => {
    const items = (section.items ?? []).filter((_, i) => i !== idx);
    onChange({ ...section, items: items.length ? items : undefined });
  };

  const useAuto = !section.items;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-gray-500 mb-1 block">Section headline</Label>
        <Input value={section.headline ?? ""} onChange={(e) => onChange({ ...section, headline: e.target.value })} placeholder="What's included" className="text-sm h-8" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={useAuto} onCheckedChange={(v) => onChange({ ...section, items: v ? undefined : [] })} />
        <Label className="text-xs text-gray-600">Auto-populate from course data (lessons, sections, certificate)</Label>
      </div>
      {!useAuto && (
        <>
          <div className="space-y-1.5">
            {(section.items ?? []).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded border border-gray-100 bg-gray-50">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
                <span className="flex-1 text-xs text-gray-700">{item.text}</span>
                <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="e.g. 12 video lessons" className="text-sm h-8" onKeyDown={(e) => e.key === "Enter" && addItem()} />
            <Button size="sm" variant="outline" onClick={addItem} className="h-8 px-3">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CustomHtmlEditor({
  section,
  onChange,
}: {
  section: CustomHtmlSection;
  onChange: (s: CustomHtmlSection) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-gray-500">HTML content</Label>
      <Textarea
        value={section.html}
        onChange={(e) => onChange({ ...section, html: e.target.value })}
        placeholder="<div>Your custom HTML here...</div>"
        className="font-mono text-xs min-h-[160px] resize-y"
      />
      <p className="text-xs text-gray-400">Raw HTML is rendered inside the checkout page left panel. Use with care.</p>
    </div>
  );
}

// ─── Section row ──────────────────────────────────────────────────────────────

function SectionRow({
  section,
  index,
  total,
  onToggle,
  onMoveUp,
  onMoveDown,
  onChange,
}: {
  section: CheckoutSection;
  index: number;
  total: number;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChange: (s: CheckoutSection) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = SECTION_META[section.type];

  return (
    <div className={`rounded-xl border transition-colors ${section.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
      <div className="flex items-center gap-2 p-3">
        {/* Drag handle (visual only) */}
        <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0 cursor-grab" />

        {/* Toggle */}
        <Switch checked={section.enabled} onCheckedChange={onToggle} className="scale-75 flex-shrink-0" />

        {/* Icon + label */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-gray-500">{meta.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{meta.label}</p>
            <p className="text-xs text-gray-400 truncate">{meta.description}</p>
          </div>
        </div>

        {/* Reorder */}
        <div className="flex gap-1">
          <button onClick={onMoveUp} disabled={index === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <ChevronDown className="h-3.5 w-3.5 rotate-180 text-gray-500" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>

        {/* Expand */}
        <button onClick={() => setOpen(!open)} className="p-1 rounded hover:bg-gray-100 transition-colors">
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          {section.type === "trust_seals" && (
            <TrustSealsEditor section={section} onChange={(s) => onChange(s)} />
          )}
          {section.type === "guarantee" && (
            <GuaranteeEditor section={section} onChange={(s) => onChange(s)} />
          )}
          {section.type === "testimonials" && (
            <TestimonialsEditor section={section} onChange={(s) => onChange(s)} />
          )}
          {section.type === "faq" && (
            <FaqEditor section={section} onChange={(s) => onChange(s)} />
          )}
          {section.type === "custom_html" && (
            <CustomHtmlEditor section={section} onChange={(s) => onChange(s)} />
          )}
          {section.type === "course_includes" && (
            <CourseIncludesEditor section={section} onChange={(s) => onChange(s)} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export type CheckoutEntityType = "course" | "download" | "physical" | "webinar" | "membership";

interface CheckoutPageEditorProps {
  entityType: CheckoutEntityType;
  entityId: number;
  entitySlug: string;
  /** Optional query param appended to the preview URL, e.g. "type=webinar" */
  previewQuery?: string;
  // Legacy compat — if provided, entityType defaults to "course"
  courseId?: number;
  courseSlug?: string;
}

export default function CheckoutPageEditor({
  entityType = "course",
  entityId,
  entitySlug,
  previewQuery,
  // Legacy props
  courseId,
  courseSlug,
}: CheckoutPageEditorProps) {
  // Support legacy call sites that pass courseId/courseSlug directly
  const resolvedType: CheckoutEntityType = entityType;
  const resolvedId = entityId ?? courseId ?? 0;
  const resolvedSlug = entitySlug ?? courseSlug ?? "";
  const previewUrl = previewQuery
    ? `/checkout/${resolvedSlug}?${previewQuery}`
    : `/checkout/${resolvedSlug}`;

  const utils = trpc.useUtils();

  // ─── Load current config (type-switched) ────────────────────────────────────
  const lmsQuery = trpc.lmsAdmin.getCheckoutPageConfig.useQuery(
    { courseId: resolvedId },
    { enabled: resolvedType === "course" }
  );
  const dlQuery = trpc.downloadsAdmin.getCheckoutPageConfig.useQuery(
    { productId: resolvedId },
    { enabled: resolvedType === "download" }
  );
  const physQuery = trpc.productsAdmin.getCheckoutPageConfig.useQuery(
    { productId: resolvedId },
    { enabled: resolvedType === "physical" }
  );
  const webQuery = trpc.webinarAdmin.getCheckoutPageConfig.useQuery(
    { webinarId: resolvedId },
    { enabled: resolvedType === "webinar" }
  );
  const memQuery = trpc.membership.getCheckoutPageConfig.useQuery(
    { planId: resolvedId },
    { enabled: resolvedType === "membership" }
  );

  const configData = resolvedType === "course" ? lmsQuery.data
    : resolvedType === "download" ? dlQuery.data
    : resolvedType === "physical" ? physQuery.data
    : resolvedType === "webinar" ? webQuery.data
    : memQuery.data;
  const isLoading = resolvedType === "course" ? lmsQuery.isLoading
    : resolvedType === "download" ? dlQuery.isLoading
    : resolvedType === "physical" ? physQuery.isLoading
    : resolvedType === "webinar" ? webQuery.isLoading
    : memQuery.isLoading;

  // ─── Save config (type-switched) ────────────────────────────────────────────
  const saveLms = trpc.lmsAdmin.saveCheckoutPageConfig.useMutation({
    onSuccess: () => { toast.success("Checkout page saved"); utils.lmsAdmin.getCheckoutPageConfig.invalidate({ courseId: resolvedId }); },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });
  const saveDl = trpc.downloadsAdmin.saveCheckoutPageConfig.useMutation({
    onSuccess: () => { toast.success("Checkout page saved"); utils.downloadsAdmin.getCheckoutPageConfig.invalidate({ productId: resolvedId }); },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });
  const savePhys = trpc.productsAdmin.saveCheckoutPageConfig.useMutation({
    onSuccess: () => { toast.success("Checkout page saved"); utils.productsAdmin.getCheckoutPageConfig.invalidate({ productId: resolvedId }); },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });
  const saveWeb = trpc.webinarAdmin.saveCheckoutPageConfig.useMutation({
    onSuccess: () => { toast.success("Checkout page saved"); utils.webinarAdmin.getCheckoutPageConfig.invalidate({ webinarId: resolvedId }); },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });
  const saveMem = trpc.membership.saveCheckoutPageConfig.useMutation({
    onSuccess: () => { toast.success("Checkout page saved"); utils.membership.getCheckoutPageConfig.invalidate({ planId: resolvedId }); },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const saveConfig = {
    isPending: saveLms.isPending || saveDl.isPending || savePhys.isPending || saveWeb.isPending || saveMem.isPending,
    mutate: (args: { config: string }) => {
      if (resolvedType === "course") saveLms.mutate({ courseId: resolvedId, config: args.config });
      else if (resolvedType === "download") saveDl.mutate({ productId: resolvedId, config: args.config });
      else if (resolvedType === "physical") savePhys.mutate({ productId: resolvedId, config: args.config });
      else if (resolvedType === "webinar") saveWeb.mutate({ webinarId: resolvedId, config: args.config });
      else saveMem.mutate({ planId: resolvedId, config: args.config });
    },
  };

  // Load saved templates
  const { data: savedTemplates = [], refetch: refetchTemplates } = trpc.lmsAdmin.listCheckoutTemplates.useQuery();

  const saveTemplate = trpc.lmsAdmin.saveCheckoutTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template saved");
      refetchTemplates();
      setTemplateSaveOpen(false);
      setTemplateName("");
      setTemplateDesc("");
    },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const deleteTemplate = trpc.lmsAdmin.deleteCheckoutTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      refetchTemplates();
    },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });

  // Local config state
  const [config, setConfig] = useState<CheckoutPageConfig | null>(null);
  const [dirty, setDirty] = useState(false);

  // Initialise from loaded data
  if (!isLoading && config === null && configData !== undefined) {
    setConfig(parseCheckoutPageConfig(configData.config));
  }

  // UI state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateToApply, setTemplateToApply] = useState<CheckoutPageConfig | null>(null);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const updateConfig = useCallback((next: CheckoutPageConfig) => {
    setConfig(next);
    setDirty(true);
  }, []);

  const handleSave = () => {
    if (!config) return;
    saveConfig.mutate({ config: JSON.stringify(config) });
    setDirty(false);
  };

  const applyTemplate = (cfg: CheckoutPageConfig) => {
    setTemplateToApply(cfg);
    setConfirmApplyOpen(true);
    setTemplatePickerOpen(false);
  };

  const confirmApply = () => {
    if (templateToApply) {
      updateConfig(templateToApply);
      setConfirmApplyOpen(false);
      setTemplateToApply(null);
    }
  };

  const handleSaveTemplate = () => {
    if (!config || !templateName.trim()) return;
    saveTemplate.mutate({ name: templateName.trim(), description: templateDesc.trim() || undefined, config: JSON.stringify(config) });
  };

  const toggleSection = (idx: number) => {
    if (!config) return;
    const sections = config.sections.map((s, i) => (i === idx ? { ...s, enabled: !s.enabled } : s));
    updateConfig({ ...config, sections });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    if (!config) return;
    const sections = [...config.sections];
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    updateConfig({ ...config, sections: sections.map((s, i) => ({ ...s, order: i })) });
  };

  const updateSection = (idx: number, section: CheckoutSection) => {
    if (!config) return;
    const sections = config.sections.map((s, i) => (i === idx ? section : s));
    updateConfig({ ...config, sections });
  };

  if (isLoading || config === null) {
    return (
      <div className="space-y-3 animate-pulse p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTemplatePickerOpen(true)}
            className="h-8 text-xs gap-1.5"
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Templates
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTemplateSaveOpen(true)}
            className="h-8 text-xs gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Save as Template
          </Button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 text-xs text-gray-600 hover:text-teal-700 hover:border-teal-400 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview
          </a>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saveConfig.isPending}
          className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {saveConfig.isPending ? "Saving…" : dirty ? "Save Changes" : "Saved"}
        </Button>
      </div>

      {/* Section list */}
      <div className="space-y-2">
        {config.sections.map((section, idx) => (
          <SectionRow
            key={`${section.type}-${idx}`}
            section={section}
            index={idx}
            total={config.sections.length}
            onToggle={() => toggleSection(idx)}
            onMoveUp={() => moveSection(idx, -1)}
            onMoveDown={() => moveSection(idx, 1)}
            onChange={(s) => updateSection(idx, s)}
          />
        ))}
      </div>

      {/* Template picker dialog */}
      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-teal-600" />
              Choose a Template
            </DialogTitle>
          </DialogHeader>

          {/* Built-in templates */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Built-in Templates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BUILT_IN_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.config)}
                  className="text-left p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors group"
                >
                  <div className="text-2xl mb-2">{t.emoji}</div>
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-teal-700">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.config.sections.filter((s) => s.enabled).map((s) => (
                      <span key={s.type} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {SECTION_META[s.type].label}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Saved templates */}
          {savedTemplates.length > 0 && (
            <div className="mt-4">
              <Separator className="mb-4" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Saved Templates</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedTemplates.map((t) => (
                  <div key={t.id} className="relative group">
                    <button
                      onClick={() => applyTemplate(parseCheckoutPageConfig(t.config))}
                      className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-colors"
                    >
                      <div className="text-2xl mb-2">📋</div>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-teal-700">{t.name}</p>
                      {t.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.description}</p>}
                      <p className="text-[10px] text-gray-400 mt-2">
                        Saved {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(t.id); }}
                      className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm apply template */}
      <AlertDialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current checkout page configuration with the selected template. Any unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply} className="bg-teal-600 hover:bg-teal-700 text-white">
              Apply Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save as template dialog */}
      <Dialog open={templateSaveOpen} onOpenChange={setTemplateSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Template name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. My High-Trust Layout"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Brief description of when to use this template"
                className="text-sm min-h-[70px] resize-none mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateSaveOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || saveTemplate.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saveTemplate.isPending ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete template confirm */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteConfirmId !== null) deleteTemplate.mutate({ id: deleteConfirmId }); setDeleteConfirmId(null); }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
