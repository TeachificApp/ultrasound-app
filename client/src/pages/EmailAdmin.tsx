/**
 * EmailAdmin — Platform Email Campaign Composer
 *
 * Features:
 *  - Rich text email composer (TipTap via RichTextEditor)
 *  - Audience filters: interests, roles, subscription type, specific emails
 *  - Live audience preview (recipient count)
 *  - Save / load / delete email templates
 *  - Campaign history with status and recipient count
 *  - 2 pre-loaded branded templates seeded on first load
 */
import { useState, useEffect } from "react";
import {
  Mail, Send, Save, Trash2, ChevronDown, ChevronUp, Users, RefreshCw,
  FileText, Plus, Eye, Check, AlertTriangle, Clock, X, Shield,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Branded HTML email wrapper ───────────────────────────────────────────────
function wrapInBrandedEmail(bodyHtml: string, previewText?: string): string {
  const preview = previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>iHeartEcho™</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f8;font-family:'Open Sans',Arial,sans-serif;">
${preview}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#0e1e2e 0%,#0e4a50 60%,#189aa1 100%);padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-family:Merriweather,Georgia,serif;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">iHeartEcho™</span>
                <div style="font-size:11px;color:#4ad9e0;font-weight:600;margin-top:2px;letter-spacing:0.5px;">ECHOCARDIOGRAPHY CLINICAL COMPANION</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:32px;color:#1a2e3b;font-size:15px;line-height:1.7;">
          ${bodyHtml}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#f4f7f8;padding:20px 32px;border-top:1px solid #e5eaec;">
          <p style="margin:0;font-size:11px;color:#8a9bb0;text-align:center;line-height:1.6;">
            © ${new Date().getFullYear()} iHeartEcho™ · All About Ultrasound<br/>
            You are receiving this email because you have an account on iHeartEcho™.<br/>
            <a href="https://app.iheartecho.com/profile" style="color:#189aa1;text-decoration:none;">Manage your preferences</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Pre-loaded branded templates ────────────────────────────────────────────
const SEED_TEMPLATES = [
  {
    name: "📣 Platform Announcement",
    subject: "Important Update from iHeartEcho™",
    previewText: "A message from the iHeartEcho team",
    htmlBody: `<h2 style="font-family:Merriweather,Georgia,serif;color:#0e1e2e;margin-top:0;">Platform Update</h2>
<p>Dear iHeartEcho™ community,</p>
<p>We have an exciting update to share with you. [Insert announcement here.]</p>
<p>As always, our mission is to support echocardiographers at every stage of their career with the best clinical decision support tools available.</p>
<p>If you have any questions, please don't hesitate to reach out.</p>
<p style="margin-top:28px;">With gratitude,<br/><strong style="color:#189aa1;">The iHeartEcho™ Team</strong></p>
<hr style="border:none;border-top:1px solid #e5eaec;margin:28px 0;" />
<p style="font-size:13px;color:#8a9bb0;">Visit us at <a href="https://app.iheartecho.com" style="color:#189aa1;">app.iheartecho.com</a></p>`,
  },
  {
    name: "🎓 New Course / Resource",
    subject: "New Learning Resource Available on iHeartEcho™",
    previewText: "A new educational resource is now available for you",
    htmlBody: `<h2 style="font-family:Merriweather,Georgia,serif;color:#0e1e2e;margin-top:0;">New Resource Available</h2>
<p>Hi there,</p>
<p>We're thrilled to announce a new learning resource is now available on iHeartEcho™:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr>
    <td style="background:#f0fbfc;border-left:4px solid #189aa1;padding:16px 20px;border-radius:0 8px 8px 0;">
      <strong style="color:#0e1e2e;font-size:16px;">[Resource Title]</strong><br/>
      <span style="color:#4a6375;font-size:13px;">[Brief description of the resource and what learners will gain]</span>
    </td>
  </tr>
</table>
<p>This resource is designed to help you [describe the benefit — e.g., "master advanced TTE techniques", "prepare for your echo boards", etc.].</p>
<p style="margin-top:20px;">
  <a href="https://app.iheartecho.com" style="display:inline-block;background:#189aa1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;">Access Now →</a>
</p>
<p style="margin-top:28px;">Happy learning,<br/><strong style="color:#189aa1;">The iHeartEcho™ Team</strong></p>`,
  },
];

// ─── Audience filter types ────────────────────────────────────────────────────
type InterestKey = "acs" | "adultEcho" | "pediatricEcho" | "fetalEcho" | "pocus";
type SubscriptionType = "all" | "premium" | "free";

const INTEREST_OPTIONS: { key: InterestKey; label: string }[] = [
  { key: "acs", label: "ACS" },
  { key: "adultEcho", label: "Adult Echocardiography" },
  { key: "pediatricEcho", label: "Pediatric Echocardiography" },
  { key: "fetalEcho", label: "Fetal Echocardiography" },
  { key: "pocus", label: "POCUS" },
];

const ROLE_OPTIONS = [
  { value: "premium_user", label: "Premium Users" },
  { value: "diy_user", label: "DIY Accreditation Users" },
  { value: "diy_admin", label: "DIY Lab Admins" },
  { value: "platform_admin", label: "Platform Admins" },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function EmailAdmin() {
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();

  // ── Composer state ──────────────────────────────────────────────────────────
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [wrapInTemplate, setWrapInTemplate] = useState(true);

  // ── Audience filter state ───────────────────────────────────────────────────
  const [selectedInterests, setSelectedInterests] = useState<InterestKey[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>("all");
  const [userStatus, setUserStatus] = useState<"all" | "active" | "pending">("active");
  const [specificEmailsInput, setSpecificEmailsInput] = useState("");
  const [audienceExpanded, setAudienceExpanded] = useState(true);

  // ── Template state ──────────────────────────────────────────────────────────
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // ── Send confirmation ───────────────────────────────────────────────────────
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [scheduledDateTime, setScheduledDateTime] = useState("");

  // ── tRPC queries ────────────────────────────────────────────────────────────
  const { data: templates, refetch: refetchTemplates } = trpc.emailCampaign.listTemplates.useQuery(
    undefined,
    { enabled: !!user }
  );
  const { data: campaigns, refetch: refetchCampaigns } = trpc.emailCampaign.listCampaigns.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Audience preview — debounced
  const audienceFilter = {
    interests: selectedInterests,
    roles: selectedRoles,
    subscriptionType,
    userStatus,
    specificEmails: specificEmailsInput
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@")),
  };
  const { data: audiencePreview, isLoading: audienceLoading } = trpc.emailCampaign.previewAudience.useQuery(
    audienceFilter,
    { enabled: !!user }
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const saveTemplateMutation = trpc.emailCampaign.saveTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template saved");
      setSaveTemplateDialogOpen(false);
      setSaveTemplateName("");
      setEditingTemplateId(null);
      refetchTemplates();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTemplateMutation = trpc.emailCampaign.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      setDeleteConfirmId(null);
      refetchTemplates();
    },
    onError: (e) => toast.error(e.message),
  });

  const scheduleCampaignMutation = trpc.emailCampaign.scheduleCampaign.useMutation({
    onSuccess: (result) => {
      toast.success(`Campaign scheduled for ${new Date(result.scheduledAt).toLocaleString()}`);
      setSendConfirmOpen(false);
      setSendMode("now");
      setScheduledDateTime("");
      refetchCampaigns();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendCampaignMutation = trpc.emailCampaign.sendCampaign.useMutation({
    onSuccess: (result) => {
      toast.success(`Campaign queued for ${result.recipientCount} recipient${result.recipientCount !== 1 ? "s" : ""}. Sending in progress…`);
      setSendConfirmOpen(false);
      refetchCampaigns();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Seed templates on first load ────────────────────────────────────────────
  const seedTemplateMutation = trpc.emailCampaign.saveTemplate.useMutation();
  useEffect(() => {
    if (!user || !templates) return;
    if (templates.length === 0) {
      // Seed the 2 branded templates
      for (const t of SEED_TEMPLATES) {
        seedTemplateMutation.mutate({
          name: t.name,
          subject: t.subject,
          htmlBody: t.htmlBody,
          previewText: t.previewText,
        });
      }
      setTimeout(() => refetchTemplates(), 1500);
    }
  }, [user, templates]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function loadTemplate(t: { name: string; subject: string; htmlBody: string; previewText?: string | null; id: number }) {
    setSubject(t.subject);
    setPreviewText(t.previewText ?? "");
    setBodyHtml(t.htmlBody);
    setEditingTemplateId(t.id);
    toast.success(`Loaded template: ${t.name}`);
  }

  function toggleInterest(key: InterestKey) {
    setSelectedInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function handleSend() {
    if (!subject.trim()) { toast.error("Subject is required"); return; }
    if (!bodyHtml.trim()) { toast.error("Email body is required"); return; }
    setSendConfirmOpen(true);
  }

  function confirmSend() {
    const finalHtml = wrapInTemplate ? wrapInBrandedEmail(bodyHtml, previewText) : bodyHtml;
    if (sendMode === "later" && scheduledDateTime) {
      scheduleCampaignMutation.mutate({
        subject,
        htmlBody: finalHtml,
        previewText: previewText || undefined,
        audienceFilter,
        scheduledAt: new Date(scheduledDateTime),
      });
    } else {
      sendCampaignMutation.mutate({
        subject,
        htmlBody: finalHtml,
        previewText: previewText || undefined,
        audienceFilter,
      });
    }
  }

  // ── Auth guards ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="container py-12 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" />
        </div>
      </Layout>
    );
  }
  if (!isAuthenticated || !user) {
    return (
      <Layout>
        <div className="container py-12 text-center text-gray-500">Please log in to access this page.</div>
      </Layout>
    );
  }
  const isAdmin = user.role === "admin" || (user.appRoles ?? []).includes("platform_admin");
  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Platform admin access required.</p>
        </div>
      </Layout>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#189aa1" }}>
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>
                Email Campaigns
              </h1>
              <p className="text-sm text-gray-500">Compose and send targeted emails to your platform users</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Composer ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Subject + Preview Text */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject Line <span className="text-red-400">*</span></label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Preview Text
                    <span className="text-gray-400 font-normal ml-1">(shown in inbox before opening)</span>
                  </label>
                  <Input
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    placeholder="Short preview shown in email clients..."
                    className="text-sm"
                    maxLength={300}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Rich Text Body */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#189aa1]" />
                    Email Body
                  </CardTitle>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wrapInTemplate}
                      onChange={(e) => setWrapInTemplate(e.target.checked)}
                      className="rounded border-gray-300 text-[#189aa1] focus:ring-[#189aa1]"
                    />
                    <span className="text-xs text-gray-500">Wrap in branded template</span>
                  </label>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  placeholder="Write your email content here..."
                  minHeight={320}
                />
              </CardContent>
            </Card>

            {/* Audience Filters */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <button
                  className="flex items-center justify-between w-full"
                  onClick={() => setAudienceExpanded((v) => !v)}
                >
                  <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#189aa1]" />
                    Audience Filters
                    {audiencePreview && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {audienceLoading ? "..." : `${audiencePreview.count} recipients`}
                      </Badge>
                    )}
                  </CardTitle>
                  {audienceExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
              </CardHeader>
              {audienceExpanded && (
                <CardContent className="px-5 pb-5 space-y-5">
                  {/* Interests */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Filter by Interest
                      <span className="text-gray-400 font-normal ml-1">(empty = all users regardless of interest)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_OPTIONS.map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => toggleInterest(key)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            selectedInterests.includes(key)
                              ? "bg-[#189aa1] text-white border-[#189aa1]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]/50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subscription Type */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Subscription Type</label>
                    <div className="flex gap-2">
                      {(["all", "premium", "free"] as SubscriptionType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSubscriptionType(type)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${
                            subscriptionType === type
                              ? "bg-[#189aa1] text-white border-[#189aa1]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]/50"
                          }`}
                        >
                          {type === "all" ? "All Users" : type === "premium" ? "Premium Only" : "Free Users"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* User Status */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">User Status</label>
                    <div className="flex gap-2">
                      {(["active", "pending", "all"] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => setUserStatus(status)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            userStatus === status
                              ? "bg-[#189aa1] text-white border-[#189aa1]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]/50"
                          }`}
                        >
                          {status === "active" ? "Active Users" : status === "pending" ? "Pending Users" : "All Users (Active + Pending)"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Roles */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Filter by Role
                      <span className="text-gray-400 font-normal ml-1">(empty = all roles)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ROLE_OPTIONS.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => toggleRole(value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            selectedRoles.includes(value)
                              ? "bg-[#0e4a50] text-white border-[#0e4a50]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Specific Emails */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Specific Email Addresses
                      <span className="text-gray-400 font-normal ml-1">(overrides all other filters when provided)</span>
                    </label>
                    <textarea
                      value={specificEmailsInput}
                      onChange={(e) => setSpecificEmailsInput(e.target.value)}
                      placeholder="Enter email addresses separated by commas, semicolons, or new lines..."
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#189aa1] resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Audience preview */}
                  {audiencePreview && (
                    <div className={`flex items-start gap-3 p-3 rounded-lg text-xs ${audiencePreview.count === 0 ? "bg-amber-50 text-amber-700" : "bg-[#f0fbfc] text-[#0e4a50]"}`}>
                      {audiencePreview.count === 0 ? (
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Users className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-semibold">
                          {audienceLoading ? "Calculating..." : `${audiencePreview.count} recipient${audiencePreview.count !== 1 ? "s" : ""} match your filters`}
                        </span>
                        {audiencePreview.sampleEmails.length > 0 && (
                          <div className="mt-1 text-gray-500">
                            Sample: {audiencePreview.sampleEmails.join(", ")}{audiencePreview.count > 5 ? ` and ${audiencePreview.count - 5} more` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSend}
                disabled={sendCampaignMutation.isPending || !subject.trim() || !bodyHtml.trim()}
                className="flex items-center gap-2 text-white"
                style={{ background: "#189aa1" }}
              >
                {sendCampaignMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Campaign
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!subject.trim() && !bodyHtml.trim()) { toast.error("Nothing to save"); return; }
                  setSaveTemplateName(editingTemplateId ? (templates?.find(t => t.id === editingTemplateId)?.name ?? "") : "");
                  setSaveTemplateDialogOpen(true);
                }}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save as Template
              </Button>
            </div>
          </div>

          {/* ── Right: Templates + History ──────────────────────────────────── */}
          <div className="space-y-4">
            {/* Templates */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#189aa1]" />
                  Saved Templates
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {!templates || templates.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No templates saved yet.</p>
                ) : (
                  <div className="space-y-2">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        className={`flex items-start gap-2 p-3 rounded-lg border transition-all ${
                          editingTemplateId === t.id ? "border-[#189aa1] bg-[#189aa1]/5" : "border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{t.name}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{t.subject}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => loadTemplate(t)}
                            className="p-1.5 rounded text-[#189aa1] hover:bg-[#189aa1]/10 transition-all"
                            title="Load template"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(t.id)}
                            className="p-1.5 rounded text-red-400 hover:bg-red-50 transition-all"
                            title="Delete template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Campaign History */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#189aa1]" />
                    Campaign History
                  </CardTitle>
                  <button onClick={() => refetchCampaigns()} className="text-gray-400 hover:text-gray-600">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {!campaigns || campaigns.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No campaigns sent yet.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {campaigns.map((c) => (
                      <div key={c.id} className="p-3 rounded-lg border border-gray-100 space-y-1">
                        <p className="text-xs font-semibold text-gray-800 line-clamp-1">{c.subject}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.status === "sent" ? "bg-green-50 text-green-700" :
                            c.status === "sending" ? "bg-blue-50 text-blue-700" :
                            c.status === "failed" ? "bg-red-50 text-red-700" :
                            c.status === "scheduled" ? "bg-amber-50 text-amber-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {c.status === "sent" && <Check className="w-3 h-3" />}
                            {c.status === "sending" && <RefreshCw className="w-3 h-3 animate-spin" />}
                            {c.status === "failed" && <X className="w-3 h-3" />}
                            {c.status === "scheduled" && <Clock className="w-3 h-3" />}
                            {c.status}
                          </span>
                          <span className="text-xs text-gray-400">{c.recipientCount} recipients</span>
                        </div>
                        {c.status === "scheduled" && c.scheduledAt && (
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-amber-600 font-medium">
                              Scheduled: {new Date(c.scheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        )}
                        {c.sentAt && c.status !== "scheduled" && (
                          <p className="text-xs text-gray-400">
                            {new Date(c.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                        {c.errorMessage && (
                          <p className="text-xs text-red-500">{c.errorMessage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Save Template Dialog ──────────────────────────────────────────────── */}
      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Email Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Template Name</label>
              <Input
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g. Monthly Newsletter, Announcement..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                saveTemplateMutation.mutate({
                  id: editingTemplateId ?? undefined,
                  name: saveTemplateName,
                  subject,
                  htmlBody: bodyHtml,
                  previewText: previewText || undefined,
                })
              }
              disabled={!saveTemplateName.trim() || saveTemplateMutation.isPending}
              className="text-white"
              style={{ background: "#189aa1" }}
            >
              {saveTemplateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Template Confirm ───────────────────────────────────────────── */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 py-2">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId !== null && deleteTemplateMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteTemplateMutation.isPending}
            >
              {deleteTemplateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send Confirmation Dialog ──────────────────────────────────────────── */}
      <Dialog open={sendConfirmOpen} onOpenChange={(open) => { setSendConfirmOpen(open); if (!open) { setSendMode("now"); setScheduledDateTime(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 rounded-lg bg-gray-50 space-y-1">
              <p className="text-xs text-gray-500">Subject</p>
              <p className="text-sm font-semibold text-gray-800">{subject}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#f0fbfc] border border-[#189aa1]/20">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#189aa1]" />
                <span className="text-sm font-semibold text-[#0e4a50]">
                  {audiencePreview?.count ?? "?"} recipient{(audiencePreview?.count ?? 0) !== 1 ? "s" : ""}
                </span>
              </div>
              {audiencePreview?.sampleEmails && audiencePreview.sampleEmails.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Including: {audiencePreview.sampleEmails.slice(0, 3).join(", ")}{(audiencePreview?.count ?? 0) > 3 ? ` and ${(audiencePreview?.count ?? 0) - 3} more` : ""}
                </p>
              )}
            </div>
            {wrapInTemplate && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Check className="w-3 h-3 text-green-500" />
                Email will be wrapped in the iHeartEcho™ branded template
              </p>
            )}
            {/* Send Now vs Send Later toggle */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">When to send</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSendMode("now")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    sendMode === "now" ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]/50"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Now
                </button>
                <button
                  onClick={() => setSendMode("later")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    sendMode === "later" ? "bg-[#0e4a50] text-white border-[#0e4a50]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Schedule for Later
                </button>
              </div>
            </div>
            {sendMode === "later" && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Scheduled Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#189aa1]"
                />
                <p className="text-xs text-gray-400 mt-1">Times are in your local timezone. Minimum 5 minutes from now.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmSend}
              disabled={sendCampaignMutation.isPending || scheduleCampaignMutation.isPending || (sendMode === "later" && !scheduledDateTime)}
              className="text-white"
              style={{ background: sendMode === "later" ? "#0e4a50" : "#189aa1" }}
            >
              {(sendCampaignMutation.isPending || scheduleCampaignMutation.isPending) ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : sendMode === "later" ? (
                <Clock className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sendMode === "later" ? "Schedule Campaign" : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
