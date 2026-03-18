/**
 * MeetingAttendanceChart.tsx
 * Recharts bar chart showing meeting attendance rates over time.
 * Used in the DIY Accreditation Tool Reports tab.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { Users, TrendingUp, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

const BRAND = "#189aa1";
const BRAND_LIGHT = "#4ad9e0";

const MEETING_TYPE_LABELS: Record<string, string> = {
  quality_assurance: "QA",
  peer_review: "Peer Review",
  accreditation: "Accreditation",
  staff_education: "Staff Edu",
  policy_review: "Policy",
  other: "Other",
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <div className="text-xl font-bold" style={{ color }}>{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2 max-w-[200px] truncate">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.fill ?? p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold">{p.value}{p.name === "Attendance %" ? "%" : ""}</span>
        </div>
      ))}
    </div>
  );
};

export default function MeetingAttendanceChart() {
  const { data: stats = [], isLoading } = trpc.meeting.getAttendanceStats.useQuery();

  const summary = useMemo(() => {
    if (stats.length === 0) return null;
    const withData = stats.filter((s) => s.total > 0);
    const avgRate = withData.length > 0
      ? Math.round(withData.reduce((sum, s) => sum + (s.attendanceRate ?? 0), 0) / withData.length)
      : null;
    const totalPresent = stats.reduce((sum, s) => sum + s.present, 0);
    const totalInvited = stats.reduce((sum, s) => sum + s.total, 0);
    const totalAbsent = stats.reduce((sum, s) => sum + s.absent, 0);
    const totalExcused = stats.reduce((sum, s) => sum + s.excused, 0);
    return { avgRate, totalPresent, totalInvited, totalAbsent, totalExcused, meetingCount: stats.length };
  }, [stats]);

  // Chart data — last 12 meetings
  const chartData = useMemo(() => {
    return stats.slice(-12).map((s) => ({
      name: s.title.length > 20 ? s.title.slice(0, 20) + "…" : s.title,
      fullName: s.title,
      date: new Date(s.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      type: MEETING_TYPE_LABELS[s.meetingType] ?? s.meetingType,
      present: s.present,
      absent: s.absent,
      excused: s.excused,
      "Attendance %": s.attendanceRate ?? 0,
    }));
  }, [stats]);

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
        Loading attendance data...
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No attendance data yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Complete meetings and mark attendance in the Quality Meetings tab to see analytics here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5" style={{ color: BRAND }} />
        <h3 className="font-bold text-gray-800">Meeting Attendance Analytics</h3>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={TrendingUp}
            label="Avg Attendance Rate"
            value={summary.avgRate !== null ? `${summary.avgRate}%` : "—"}
            sub={`across ${summary.meetingCount} meetings`}
            color={BRAND}
          />
          <StatCard
            icon={CheckCircle2}
            label="Total Present"
            value={String(summary.totalPresent)}
            sub={`of ${summary.totalInvited} invited`}
            color="#16a34a"
          />
          <StatCard
            icon={XCircle}
            label="Total Absent"
            value={String(summary.totalAbsent)}
            color="#dc2626"
          />
          <StatCard
            icon={AlertCircle}
            label="Total Excused"
            value={String(summary.totalExcused)}
            color="#d97706"
          />
        </div>
      )}

      {/* Attendance rate trend (line chart) */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Attendance Rate Trend (last {chartData.length} meetings)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "80% target", position: "insideTopRight", fontSize: 10, fill: "#16a34a" }} />
            <Line
              type="monotone"
              dataKey="Attendance %"
              stroke={BRAND}
              strokeWidth={2.5}
              dot={{ fill: BRAND, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked bar chart — present / absent / excused */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Attendance Breakdown by Meeting</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="present" name="Present" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="excused" name="Excused" stackId="a" fill="#d97706" />
            <Bar dataKey="absent" name="Absent" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Compliance note */}
      {summary?.avgRate !== null && (
        <div
          className="rounded-lg p-3 text-sm flex items-start gap-2"
          style={{
            background: (summary?.avgRate ?? 0) >= 80 ? "#f0fdf4" : "#fef9c3",
            borderLeft: `4px solid ${(summary?.avgRate ?? 0) >= 80 ? "#16a34a" : "#d97706"}`,
          }}
        >
          {(summary?.avgRate ?? 0) >= 80 ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          )}
          <span style={{ color: (summary?.avgRate ?? 0) >= 80 ? "#15803d" : "#92400e" }}>
            {(summary?.avgRate ?? 0) >= 80
              ? `Average attendance rate of ${summary?.avgRate}% meets the recommended ≥80% threshold for accreditation compliance.`
              : `Average attendance rate of ${summary?.avgRate}% is below the recommended ≥80% threshold. Review attendance records and follow up with absent staff.`}
          </span>
        </div>
      )}
    </div>
  );
}
