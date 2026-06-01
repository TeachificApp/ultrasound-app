/**
 * AfterPurchaseWorkflowEditor
 *
 * A reusable multi-action workflow builder for post-purchase automation.
 * Supports 4 action types:
 *   - redirect_url   : redirect the browser to a URL after purchase
 *   - send_email     : send a custom email to the buyer
 *   - order_bump     : redirect to an order-bump / upsell page
 *   - window_message : show an in-window message/modal after purchase
 *
 * The value is a JSON-serialized WorkflowAction[].
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ExternalLink,
  Mail,
  ShoppingBag,
  MessageSquare,
  Plus,
  Trash2,
  ChevronDown,
  GripVertical,
  CheckCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowActionType =
  | "redirect_url"
  | "send_email"
  | "order_bump"
  | "window_message";

export interface RedirectUrlAction {
  type: "redirect_url";
  enabled: boolean;
  url: string;
  delay?: number; // seconds before redirect
  newTab?: boolean;
}

export interface SendEmailAction {
  type: "send_email";
  enabled: boolean;
  subject: string;
  body: string; // plain text or HTML
  fromName?: string;
  replyTo?: string;
}

export interface OrderBumpAction {
  type: "order_bump";
  enabled: boolean;
  orderBumpId: number | null;
  orderBumpTitle?: string; // display label
}

export interface WindowMessageAction {
  type: "window_message";
  enabled: boolean;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  autoClose?: number; // seconds, 0 = manual close
}

export type WorkflowAction =
  | RedirectUrlAction
  | SendEmailAction
  | OrderBumpAction
  | WindowMessageAction;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<WorkflowActionType, string> = {
  redirect_url: "Redirect to URL",
  send_email: "Send Email",
  order_bump: "Redirect to Order Bump",
  window_message: "Show In-Window Message",
};

const ACTION_ICONS: Record<WorkflowActionType, React.ReactNode> = {
  redirect_url: <ExternalLink className="w-4 h-4" />,
  send_email: <Mail className="w-4 h-4" />,
  order_bump: <ShoppingBag className="w-4 h-4" />,
  window_message: <MessageSquare className="w-4 h-4" />,
};

const ACTION_COLORS: Record<WorkflowActionType, string> = {
  redirect_url: "bg-blue-50 border-blue-200",
  send_email: "bg-green-50 border-green-200",
  order_bump: "bg-amber-50 border-amber-200",
  window_message: "bg-purple-50 border-purple-200",
};

const ACTION_ICON_COLORS: Record<WorkflowActionType, string> = {
  redirect_url: "text-blue-600",
  send_email: "text-green-600",
  order_bump: "text-amber-600",
  window_message: "text-purple-600",
};

function defaultAction(type: WorkflowActionType): WorkflowAction {
  switch (type) {
    case "redirect_url":
      return { type, enabled: true, url: "", delay: 0, newTab: false };
    case "send_email":
      return {
        type,
        enabled: true,
        subject: "Thank you for your purchase!",
        body: "Hi {{customer_name}},\n\nThank you for your purchase of {{product_name}}.\n\nYou can access your content here: {{access_url}}\n\nBest,\n{{site_name}}",
      };
    case "order_bump":
      return { type, enabled: true, orderBumpId: null };
    case "window_message":
      return {
        type,
        enabled: true,
        heading: "Thank you for your purchase!",
        body: "Your order has been confirmed. You now have access to {{product_name}}.",
        ctaLabel: "Access Now",
        ctaUrl: "",
        autoClose: 0,
      };
  }
}

// ─── Sub-editors ─────────────────────────────────────────────────────────────

function RedirectUrlEditor({
  action,
  onChange,
}: {
  action: RedirectUrlAction;
  onChange: (a: RedirectUrlAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-gray-700">Redirect URL</Label>
        <Input
          className="mt-1"
          placeholder="https://example.com/thank-you"
          value={action.url}
          onChange={(e) => onChange({ ...action, url: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">
          The buyer will be redirected here after a successful purchase.
        </p>
      </div>
      <div className="flex items-center gap-6">
        <div>
          <Label className="text-xs font-medium text-gray-700">Delay (seconds)</Label>
          <Input
            type="number"
            min={0}
            max={30}
            className="mt-1 w-24"
            value={action.delay ?? 0}
            onChange={(e) => onChange({ ...action, delay: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <Switch
            checked={action.newTab ?? false}
            onCheckedChange={(v) => onChange({ ...action, newTab: v })}
          />
          <Label className="text-xs text-gray-600">Open in new tab</Label>
        </div>
      </div>
    </div>
  );
}

function SendEmailEditor({
  action,
  onChange,
}: {
  action: SendEmailAction;
  onChange: (a: SendEmailAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-gray-700">Subject Line</Label>
        <Input
          className="mt-1"
          placeholder="Thank you for your purchase!"
          value={action.subject}
          onChange={(e) => onChange({ ...action, subject: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs font-medium text-gray-700">Email Body</Label>
        <textarea
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Hi {{customer_name}},&#10;&#10;Thank you for your purchase..."
          value={action.body}
          onChange={(e) => onChange({ ...action, body: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">
          Variables: {"{{customer_name}}"}, {"{{product_name}}"}, {"{{access_url}}"}, {"{{site_name}}"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-gray-700">From Name (optional)</Label>
          <Input
            className="mt-1"
            placeholder="All About Ultrasound"
            value={action.fromName ?? ""}
            onChange={(e) => onChange({ ...action, fromName: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-700">Reply-To (optional)</Label>
          <Input
            className="mt-1"
            placeholder="support@example.com"
            value={action.replyTo ?? ""}
            onChange={(e) => onChange({ ...action, replyTo: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function OrderBumpEditor({
  action,
  onChange,
}: {
  action: OrderBumpAction;
  onChange: (a: OrderBumpAction) => void;
}) {
  const { data: bumps, isLoading } = trpc.orderBumpsAdmin.list.useQuery();

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-gray-700">Select Order Bump</Label>
        {isLoading ? (
          <div className="mt-1 text-xs text-gray-400">Loading order bumps…</div>
        ) : (
          <Select
            value={action.orderBumpId?.toString() ?? ""}
            onValueChange={(v) =>
              onChange({
                ...action,
                orderBumpId: v ? parseInt(v) : null,
                orderBumpTitle: bumps?.find((b: any) => b.id === parseInt(v))?.headline ?? "",
              })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose an order bump…" />
            </SelectTrigger>
            <SelectContent>
              {(bumps ?? []).map((b: any) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {b.headline || `Order Bump #${b.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-gray-400 mt-1">
          After purchase, the buyer will be shown this order bump / upsell offer.
          Manage order bumps in <strong>Platform Admin → Order Bumps</strong>.
        </p>
      </div>
    </div>
  );
}

function WindowMessageEditor({
  action,
  onChange,
}: {
  action: WindowMessageAction;
  onChange: (a: WindowMessageAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-gray-700">Heading</Label>
        <Input
          className="mt-1"
          placeholder="Thank you for your purchase!"
          value={action.heading}
          onChange={(e) => onChange({ ...action, heading: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs font-medium text-gray-700">Message Body</Label>
        <textarea
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Your order has been confirmed…"
          value={action.body}
          onChange={(e) => onChange({ ...action, body: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">
          Variables: {"{{customer_name}}"}, {"{{product_name}}"}, {"{{access_url}}"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-gray-700">CTA Button Label</Label>
          <Input
            className="mt-1"
            placeholder="Access Now"
            value={action.ctaLabel ?? ""}
            onChange={(e) => onChange({ ...action, ctaLabel: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-700">CTA Button URL</Label>
          <Input
            className="mt-1"
            placeholder="https://…"
            value={action.ctaUrl ?? ""}
            onChange={(e) => onChange({ ...action, ctaUrl: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium text-gray-700">Auto-close after (seconds, 0 = manual)</Label>
        <Input
          type="number"
          min={0}
          max={60}
          className="mt-1 w-28"
          value={action.autoClose ?? 0}
          onChange={(e) => onChange({ ...action, autoClose: parseInt(e.target.value) || 0 })}
        />
      </div>
    </div>
  );
}

// ─── Action Card ─────────────────────────────────────────────────────────────

function ActionCard({
  action,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  action: WorkflowAction;
  index: number;
  total: number;
  onChange: (a: WorkflowAction) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={`border ${ACTION_COLORS[action.type]}`}>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-3">
            <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
            <span className={`shrink-0 ${ACTION_ICON_COLORS[action.type]}`}>
              {ACTION_ICONS[action.type]}
            </span>
            <span className="font-medium text-sm text-gray-800 flex-1">
              {ACTION_LABELS[action.type]}
            </span>
            <div className="flex items-center gap-1">
              <Switch
                checked={action.enabled}
                onCheckedChange={(v) => onChange({ ...action, enabled: v } as WorkflowAction)}
              />
              <span className="text-xs text-gray-500 ml-1 mr-2">
                {action.enabled ? "On" : "Off"}
              </span>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={onRemove}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-1 border-t border-gray-100">
              {action.type === "redirect_url" && (
                <RedirectUrlEditor
                  action={action}
                  onChange={(a) => onChange(a)}
                />
              )}
              {action.type === "send_email" && (
                <SendEmailEditor
                  action={action}
                  onChange={(a) => onChange(a)}
                />
              )}
              {action.type === "order_bump" && (
                <OrderBumpEditor
                  action={action}
                  onChange={(a) => onChange(a)}
                />
              )}
              {action.type === "window_message" && (
                <WindowMessageEditor
                  action={action}
                  onChange={(a) => onChange(a)}
                />
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

interface AfterPurchaseWorkflowEditorProps {
  /** JSON string (WorkflowAction[]) or null */
  value: string | null;
  onChange: (json: string) => void;
  /** Whether save is in progress (disables button) */
  saving?: boolean;
  onSave?: () => void;
  dirty?: boolean;
}

export function AfterPurchaseWorkflowEditor({
  value,
  onChange,
  saving,
  onSave,
  dirty,
}: AfterPurchaseWorkflowEditorProps) {
  const [addType, setAddType] = useState<WorkflowActionType>("redirect_url");

  const actions: WorkflowAction[] = React.useMemo(() => {
    if (!value) return [];
    try {
      return JSON.parse(value) as WorkflowAction[];
    } catch {
      return [];
    }
  }, [value]);

  function update(newActions: WorkflowAction[]) {
    onChange(JSON.stringify(newActions));
  }

  function addAction() {
    update([...actions, defaultAction(addType)]);
  }

  function updateAction(index: number, a: WorkflowAction) {
    const next = [...actions];
    next[index] = a;
    update(next);
  }

  function removeAction(index: number) {
    update(actions.filter((_, i) => i !== index));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...actions];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    update(next);
  }

  function moveDown(index: number) {
    if (index === actions.length - 1) return;
    const next = [...actions];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    update(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">After Purchase Workflow</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure one or more actions that run automatically after a successful purchase.
          Actions execute in order.
        </p>
      </div>

      {actions.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <CheckCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No workflow actions configured.</p>
          <p className="text-xs text-gray-400 mt-1">
            Add actions below to automate what happens after purchase.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {actions.map((action, i) => (
          <ActionCard
            key={i}
            action={action}
            index={i}
            total={actions.length}
            onChange={(a) => updateAction(i, a)}
            onRemove={() => removeAction(i)}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
          />
        ))}
      </div>

      {/* Add action */}
      <div className="flex items-center gap-2 pt-1">
        <Select
          value={addType}
          onValueChange={(v) => setAddType(v as WorkflowActionType)}
        >
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ACTION_LABELS) as WorkflowActionType[]).map((t) => (
              <SelectItem key={t} value={t}>
                <span className="flex items-center gap-2">
                  {ACTION_ICONS[t]}
                  {ACTION_LABELS[t]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={addAction} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" />
          Add Action
        </Button>
      </div>

      {onSave && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={onSave}
            disabled={saving || !dirty}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {saving ? "Saving…" : "Save Workflow"}
          </Button>
        </div>
      )}
    </div>
  );
}
