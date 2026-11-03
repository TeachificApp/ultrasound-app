import { useId } from "react";
import { AlertTriangle, BarChart2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SmtpCampaignReport, SmtpReportCounts } from "@shared/smtpCampaignReport";

export type SmtpCampaignAnalyticsPanelProps = {
  report: SmtpCampaignReport | null | undefined;
  period: SmtpCampaignReport["period"];
  onPeriodChange: (period: SmtpCampaignReport["period"]) => void;
  onRefresh: () => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
};

const REPORT_METRICS: { key: keyof SmtpReportCounts; label: string }[] = [
  { key: "accepted", label: "Accepted" },
  { key: "delivered", label: "Delivered" },
  { key: "failed", label: "Failed" },
  { key: "queued", label: "Queued" },
  { key: "opened", label: "Open events" },
  { key: "clicked", label: "Click events" },
  { key: "unsubscribed", label: "Unsubscribes" },
  { key: "complained", label: "Complaints" },
];

function ReportValue({ value }: { value: number | null | undefined }) {
  return (
    <span title={value == null ? "Unavailable" : undefined}>
      {value == null ? <span aria-label="Unavailable">—</span> : value.toLocaleString()}
    </span>
  );
}

function ReportMetrics({ counts }: { counts: SmtpReportCounts | null | undefined }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {REPORT_METRICS.map(({ key, label }) => (
        <div key={key} className="rounded-lg border border-teal-100 bg-white p-3">
          <dt className="text-xs text-gray-600">{label}</dt>
          <dd className="mt-1 text-xl font-bold text-teal-900 tabular-nums">
            <ReportValue value={counts?.[key]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Read-only provider report; querying and manual refetching are owned by AnalyticsModal. */
export default function SmtpCampaignAnalyticsPanel({
  report,
  period,
  onPeriodChange,
  onRefresh,
  isLoading,
  isFetching,
  isError,
  errorMessage,
}: SmtpCampaignAnalyticsPanelProps) {
  const headingId = useId();
  const periodId = useId();
  const ready = !isError && report?.status === "ready";
  const channel = ready ? report.channel : null;
  const campaign = ready ? report.campaign : null;
  const failed = isError || report?.status === "error";
  const unavailable = !isLoading && !ready;
  const checkedAt = report?.checkedAt != null && Number.isFinite(report.checkedAt)
    ? new Date(report.checkedAt).toLocaleString()
    : null;

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={isFetching}
      className="space-y-4 rounded-xl border border-[#189aa1]/30 bg-gradient-to-br from-teal-50/70 to-cyan-50/40 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-teal-900">
            <BarChart2 className="h-4 w-4 text-[#189aa1]" aria-hidden="true" />
            SMTP.com API analytics
          </h2>
          <p className="mt-1 text-xs text-gray-600">Campaign reporting effective November 3, 2026. Transactional emails remain on SendGrid. Read-only; no emails are sent.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={periodId} className="mb-1 block text-xs font-medium text-gray-600">Reporting period</label>
            <select
              id={periodId}
              value={period}
              onChange={(event) => onPeriodChange(event.target.value as SmtpCampaignReport["period"])}
              className="h-9 rounded-md border border-teal-200 bg-white px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#189aa1]/40"
            >
              <option value="this_day">Today</option>
              <option value="this_week">Current week</option>
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            aria-label={failed ? "Retry SMTP.com report" : "Refresh SMTP.com report"}
            className="h-9 gap-1.5 border-teal-200 bg-white text-teal-800"
          >
            {isFetching
              ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            {isFetching ? "Loading…" : failed ? "Retry" : "Refresh"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div role="status" className="flex items-center gap-2 py-2 text-sm text-teal-800">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Loading SMTP.com report…
        </div>
      ) : unavailable ? (
        <div role={failed ? "alert" : "status"} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Unavailable</p>
            <p className="mt-1 text-xs">
              {isError
                ? errorMessage || "The SMTP.com report could not be loaded. Retry to request it again."
                : report?.notice || "SMTP.com reporting is not configured or no report is available."}
            </p>
          </div>
        </div>
      ) : report?.notice ? (
        <p role="status" className="text-xs text-teal-800">{report.notice}</p>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-900">Channel-wide provider totals</h3>
        <p className="text-xs leading-relaxed text-gray-600">
          All accepted, delivered, failed, queued, open events, click events, unsubscribes and complaints below cover the whole SMTP.com channel for the selected provider reporting period. They are <strong>not campaign-specific</strong> and <strong>not unique-recipient counts</strong>. Repeated opens and clicks may be included.
        </p>
        <ReportMetrics counts={channel?.counts} />
        {!isLoading && ready && !channel && <p className="text-xs text-gray-500">Channel totals are unavailable for this period.</p>}
      </div>

      <div className="space-y-2 border-t border-teal-200/70 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-900">Campaign-matched provider data</h3>
          {campaign && <Badge className={campaign.partial ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}>{campaign.partial ? "Partial report" : "Matched report"}</Badge>}
        </div>
        {campaign ? (
          <>
            <p className="text-xs leading-relaxed text-gray-600">
              Only provider message records matched to this campaign within the available message-reporting window are included; this window is separate from the channel calendar-period totals above. Open and click event totals are not unique recipients. Unique recipients below are app-derived and deduplicated from the matched provider message arrays; they are separate from platform tracking.
            </p>
            {campaign.partial && <p role="status" className="text-xs font-medium text-amber-800">Partial results: these counts may not cover all campaign messages or events.</p>}
            {report?.campaignNotice && <p className="text-xs text-gray-600">{report.campaignNotice}</p>}
            <ReportMetrics counts={campaign.counts} />
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-white/80 p-3">
                <dt className="text-xs text-gray-600">Matched messages</dt>
                <dd className="mt-1 text-lg font-semibold text-teal-900"><ReportValue value={campaign.matchedMessages} /></dd>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <dt className="text-xs text-gray-600">Unique open recipients · app-derived</dt>
                <dd className="mt-1 text-lg font-semibold text-teal-900"><ReportValue value={campaign.uniqueOpenRecipients} /></dd>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <dt className="text-xs text-gray-600">Unique click recipients · app-derived</dt>
                <dd className="mt-1 text-lg font-semibold text-teal-900"><ReportValue value={campaign.uniqueClickRecipients} /></dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-teal-200 bg-white/60 p-3 text-xs text-gray-600">
            <p className="font-semibold text-gray-700">{isLoading ? "Awaiting campaign match" : "Campaign counts unavailable"}</p>
            <p className="mt-1">{!isError && report?.campaignNotice || "No campaign-matched provider data is available. Channel totals are not substituted for campaign counts."}</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-teal-200/70 pt-2 text-[11px] text-gray-500">
        <span>Provider totals and platform tracking are separate sources; no combined totals or rates.</span>
        {checkedAt && <span>Report checked: {checkedAt}</span>}
      </div>
    </section>
  );
}
