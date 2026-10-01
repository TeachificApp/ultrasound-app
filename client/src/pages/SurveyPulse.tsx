import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  BarChart3, CheckCircle2, ChevronRight, ClipboardCheck, DollarSign, Filter,
  HeartHandshake, Info, LineChart, Loader2, LockKeyhole, MapPin, ShieldCheck,
  SlidersHorizontal, Sparkles, Users, X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SURVEY_PULSE_BENEFITS,
  SURVEY_PULSE_CALL_PAY_TYPES,
  SURVEY_PULSE_CREDENTIALS,
  SURVEY_PULSE_EMPLOYMENT_TYPES,
  SURVEY_PULSE_EXPERIENCE_BANDS,
  SURVEY_PULSE_ROLES,
  SURVEY_PULSE_SETTINGS,
  SURVEY_PULSE_SPECIALTIES,
  US_STATES,
} from "@shared/surveyPulse";

type PulseView = "home" | "dashboard" | "submit" | "compare" | "workforce" | "methodology";
type FilterState = {
  state: string;
  specialty: string;
  experienceBand: string;
  employmentSetting: string;
  employmentType: string;
  role: string;
};

const VIEW_DETAILS: Record<PulseView, { label: string; path: string; icon: React.ElementType }> = {
  home: { label: "Survey Pulse", path: "/survey-pulse", icon: Sparkles },
  dashboard: { label: "Salary Dashboard", path: "/survey-pulse/dashboard", icon: BarChart3 },
  submit: { label: "Submit Your Salary", path: "/survey-pulse/submit", icon: ClipboardCheck },
  compare: { label: "Compare My Salary", path: "/survey-pulse/compare", icon: LineChart },
  workforce: { label: "Workforce Insights", path: "/survey-pulse/workforce", icon: Users },
  methodology: { label: "Methodology", path: "/survey-pulse/methodology", icon: Info },
};

const navViews: PulseView[] = ["dashboard", "submit", "compare", "workforce", "methodology"];
const emptyFilters: FilterState = { state: "", specialty: "", experienceBand: "", employmentSetting: "", employmentType: "", role: "" };

function currency(cents: number | null | undefined, compact = false) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(cents / 100);
}

function buildFilters(filters: FilterState) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as any;
}

function SelectField({ label, value, onChange, options, placeholder = "Select an option" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  return <label className="block space-y-1.5">
    <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}

function MetricCard({ label, value, note, accent = "teal" }: { label: string; value: string; note: string; accent?: "teal" | "aqua" | "slate" }) {
  const color = accent === "aqua" ? "from-cyan-500 to-teal-500" : accent === "slate" ? "from-slate-700 to-slate-900" : "from-teal-700 to-teal-500";
  return <article className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${color}`} />
    <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
    <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
  </article>;
}

function Distribution({ title, values }: { title: string; values: Array<{ label: string; count: number; percentage: number }> }) {
  if (!values.length) return <article className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5"><h3 className="text-sm font-bold text-slate-700">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">Breakdowns appear when each category has at least five anonymous responses.</p></article>;
  const max = Math.max(...values.map((value) => value.count));
  return <article className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"><h3 className="text-sm font-bold text-slate-800">{title}</h3><div className="mt-4 space-y-3">{values.slice(0, 7).map((value) => <div key={value.label}><div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{value.label}</span><span className="shrink-0 font-bold text-teal-700">{value.percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-teal-50"><div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-cyan-400" style={{ width: `${Math.max(7, (value.count / max) * 100)}%` }} /></div></div>)}</div></article>;
}

function PrivacyNotice() {
  return <aside className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4"><div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-bold text-teal-950">Built for anonymous participation</p><p className="mt-1 text-xs leading-5 text-teal-900/75">Survey Pulse never asks for a name, email, employer, exact workplace, account ID, or free-text response. Results are shown only in aggregate once at least five people match a view.</p></div></div></aside>;
}

function Dashboard({ initialFilters }: { initialFilters?: FilterState }) {
  const [filters, setFilters] = useState<FilterState>(initialFilters ?? emptyFilters);
  const queryFilters = useMemo(() => buildFilters(filters), [filters]);
  const { data, isLoading } = trpc.surveyPulse.getDashboard.useQuery({ filters: queryFilters }, { staleTime: 20_000 });
  const hasFilters = Object.values(filters).some(Boolean);

  return <section className="space-y-6">
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-teal-700"><Filter className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[0.13em]">Explore a cohort</span></div><h2 className="mt-1 text-xl font-bold text-slate-900">Salary & workforce dashboard</h2><p className="mt-1 text-sm text-slate-600">Filter the anonymous national dataset to compare like-for-like roles.</p></div>{hasFilters && <Button variant="outline" size="sm" onClick={() => setFilters(emptyFilters)}><X className="mr-1.5 h-4 w-4" />Clear filters</Button>}</div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><SelectField label="State" value={filters.state} onChange={(state) => setFilters((current) => ({ ...current, state }))} options={US_STATES} placeholder="All states" /><SelectField label="Specialty" value={filters.specialty} onChange={(specialty) => setFilters((current) => ({ ...current, specialty }))} options={SURVEY_PULSE_SPECIALTIES} placeholder="All specialties" /><SelectField label="Experience" value={filters.experienceBand} onChange={(experienceBand) => setFilters((current) => ({ ...current, experienceBand }))} options={SURVEY_PULSE_EXPERIENCE_BANDS} placeholder="All experience levels" /><SelectField label="Setting" value={filters.employmentSetting} onChange={(employmentSetting) => setFilters((current) => ({ ...current, employmentSetting }))} options={SURVEY_PULSE_SETTINGS} placeholder="All settings" /><SelectField label="Employment type" value={filters.employmentType} onChange={(employmentType) => setFilters((current) => ({ ...current, employmentType }))} options={SURVEY_PULSE_EMPLOYMENT_TYPES} placeholder="All employment types" /><SelectField label="Role" value={filters.role} onChange={(role) => setFilters((current) => ({ ...current, role }))} options={SURVEY_PULSE_ROLES} placeholder="All roles" /></div></div>
    {isLoading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div> : !data?.meetsMinimumSample ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><Users className="mx-auto h-9 w-9 text-amber-600" /><h2 className="mt-3 text-xl font-bold text-amber-950">We’re protecting respondent privacy</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-900/80">This view has {data?.sampleSize ?? 0} anonymous response{data?.sampleSize === 1 ? "" : "s"}. Benchmarks appear once at least {data?.minimumSample ?? 5} people match your selected filters.</p><Link href="/survey-pulse/submit"><Button className="mt-5 bg-teal-700 text-white hover:bg-teal-800">Contribute an anonymous response <ChevronRight className="ml-1.5 h-4 w-4" /></Button></Link></div> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Median annual base" value={currency(data.benchmark?.medianAnnualBaseCents)} note={`${data.sampleSize} anonymous responses`} /><MetricCard label="25th–75th percentile" value={`${currency(data.benchmark?.p25AnnualBaseCents, true)}–${currency(data.benchmark?.p75AnnualBaseCents, true)}`} note="Middle 50% of salaries" accent="aqua" /><MetricCard label="Median hourly rate" value={currency(data.benchmark?.medianHourlyRateCents)} note="For respondents reporting hourly pay" accent="slate" /><MetricCard label="Median weekly hours" value={data.benchmark?.medianWeeklyHours ? `${data.benchmark.medianWeeklyHours} hrs` : "—"} note="Reported work schedule" /></div><div className="grid gap-4 lg:grid-cols-2"><Distribution title="Specialty mix" values={data.distributions.specialties} /><Distribution title="Employment settings" values={data.distributions.employmentSettings} /><Distribution title="Experience profile" values={data.distributions.experienceBands} /><Distribution title="Top reporting states" values={data.distributions.states} /></div></>}</section>;
}

function SalaryForm({ onCompleted }: { onCompleted?: (annualBaseSalary: number, filters: FilterState) => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ state: "", specialty: "", credentials: [] as string[], experienceBand: "", employmentSetting: "", employmentType: "", role: "", annualBaseSalary: "", hourlyRate: "", weeklyHours: "", callResponsibilities: false, callPayType: "", additionalCompensation: "", travelAssignment: false, benefits: [] as string[] });
  const submit = trpc.surveyPulse.submitAnonymous.useMutation({ onSuccess: () => { utils.surveyPulse.getDashboard.invalidate(); toast.success("Your anonymous response has been added. Thank you for strengthening the profession’s data."); onCompleted?.(Number(form.annualBaseSalary), { state: form.state, specialty: form.specialty, experienceBand: form.experienceBand, employmentSetting: form.employmentSetting, employmentType: form.employmentType, role: form.role }); }, onError: (error) => toast.error(error.message || "We could not submit your anonymous response. Please try again.") });
  const toggle = (key: "credentials" | "benefits", value: string) => setForm((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  const valid = !!(form.state && form.specialty && form.experienceBand && form.employmentSetting && form.employmentType && form.role && Number(form.annualBaseSalary) >= 20_000);
  const submitForm = () => submit.mutate({ state: form.state as any, specialty: form.specialty as any, credentials: form.credentials as any, experienceBand: form.experienceBand as any, employmentSetting: form.employmentSetting as any, employmentType: form.employmentType as any, role: form.role as any, annualBaseSalary: Number(form.annualBaseSalary), hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null, weeklyHours: form.weeklyHours ? Number(form.weeklyHours) : null, callResponsibilities: form.callResponsibilities, callPayType: form.callResponsibilities && form.callPayType ? form.callPayType as any : null, additionalCompensation: form.additionalCompensation ? Number(form.additionalCompensation) : null, travelAssignment: form.travelAssignment, benefits: form.benefits as any });
  return <section className="space-y-5"><PrivacyNotice /><div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start gap-3"><div className="rounded-xl bg-teal-100 p-2.5 text-teal-700"><ClipboardCheck className="h-5 w-5" /></div><div><h2 className="text-xl font-bold text-slate-900">Submit your anonymous salary</h2><p className="mt-1 text-sm leading-6 text-slate-600">No account required. Required fields help create meaningful, like-for-like compensation benchmarks.</p></div></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><SelectField label="State *" value={form.state} onChange={(state) => setForm((current) => ({ ...current, state }))} options={US_STATES} /><SelectField label="Primary specialty *" value={form.specialty} onChange={(specialty) => setForm((current) => ({ ...current, specialty }))} options={SURVEY_PULSE_SPECIALTIES} /><SelectField label="Experience *" value={form.experienceBand} onChange={(experienceBand) => setForm((current) => ({ ...current, experienceBand }))} options={SURVEY_PULSE_EXPERIENCE_BANDS} /><SelectField label="Employment setting *" value={form.employmentSetting} onChange={(employmentSetting) => setForm((current) => ({ ...current, employmentSetting }))} options={SURVEY_PULSE_SETTINGS} /><SelectField label="Employment type *" value={form.employmentType} onChange={(employmentType) => setForm((current) => ({ ...current, employmentType }))} options={SURVEY_PULSE_EMPLOYMENT_TYPES} /><SelectField label="Role *" value={form.role} onChange={(role) => setForm((current) => ({ ...current, role }))} options={SURVEY_PULSE_ROLES} /></div><div className="mt-7 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3"><label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Annual base salary *</span><Input type="number" min="20000" max="500000" value={form.annualBaseSalary} onChange={(event) => setForm((current) => ({ ...current, annualBaseSalary: event.target.value }))} placeholder="e.g. 85000" /><span className="block text-[11px] text-slate-500">Before bonuses or overtime</span></label><label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Hourly rate</span><Input type="number" min="10" max="500" step="0.01" value={form.hourlyRate} onChange={(event) => setForm((current) => ({ ...current, hourlyRate: event.target.value }))} placeholder="Optional" /></label><label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Weekly hours</span><Input type="number" min="1" max="100" value={form.weeklyHours} onChange={(event) => setForm((current) => ({ ...current, weeklyHours: event.target.value }))} placeholder="Optional" /></label></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><fieldset><legend className="text-sm font-bold text-slate-800">Credentials held</legend><p className="mt-1 text-xs text-slate-500">Select all that apply.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{SURVEY_PULSE_CREDENTIALS.map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-700 hover:border-teal-200"><input type="checkbox" checked={form.credentials.includes(item)} onChange={() => toggle("credentials", item)} className="accent-teal-600" />{item}</label>)}</div></fieldset><fieldset><legend className="text-sm font-bold text-slate-800">Benefits offered</legend><p className="mt-1 text-xs text-slate-500">Select all that apply.</p><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{SURVEY_PULSE_BENEFITS.map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-700 hover:border-teal-200"><input type="checkbox" checked={form.benefits.includes(item)} onChange={() => toggle("benefits", item)} className="accent-teal-600" />{item}</label>)}</div></fieldset></div><div className="mt-7 grid gap-4 rounded-xl border border-slate-100 p-4 sm:grid-cols-2"><div><label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-800"><input type="checkbox" checked={form.callResponsibilities} onChange={(event) => setForm((current) => ({ ...current, callResponsibilities: event.target.checked, callPayType: event.target.checked ? current.callPayType : "" }))} className="h-4 w-4 accent-teal-600" />I have call responsibilities</label>{form.callResponsibilities && <div className="mt-3"><SelectField label="Call compensation" value={form.callPayType} onChange={(callPayType) => setForm((current) => ({ ...current, callPayType }))} options={SURVEY_PULSE_CALL_PAY_TYPES.filter((value) => value !== "No call responsibilities")} /></div>}</div><div className="space-y-3"><label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-800"><input type="checkbox" checked={form.travelAssignment} onChange={(event) => setForm((current) => ({ ...current, travelAssignment: event.target.checked }))} className="h-4 w-4 accent-teal-600" />This is a travel assignment</label><label className="block space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Annual additional compensation</span><Input type="number" min="0" max="250000" value={form.additionalCompensation} onChange={(event) => setForm((current) => ({ ...current, additionalCompensation: event.target.value }))} placeholder="Bonus, differential, etc. (optional)" /></label></div></div><div className="mt-7 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-xs leading-5 text-slate-500">By submitting, you confirm the information is accurate to the best of your knowledge. Your response is stored without a profile or contact link and appears only in protected aggregates.</p><Button onClick={submitForm} disabled={!valid || submit.isPending} className="shrink-0 bg-teal-700 text-white hover:bg-teal-800">{submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}Submit anonymously</Button></div></div></section>;
}

function Compare() {
  const [salary, setSalary] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const queryFilters = useMemo(() => buildFilters(filters), [filters]);
  const { data, isLoading } = trpc.surveyPulse.getDashboard.useQuery({ filters: queryFilters }, { staleTime: 20_000 });
  const value = Number(salary) * 100;
  const difference = data?.benchmark?.medianAnnualBaseCents != null && value ? value - data.benchmark.medianAnnualBaseCents : null;
  return <section className="space-y-5"><div className="rounded-2xl bg-gradient-to-br from-slate-950 via-teal-950 to-teal-700 p-6 text-white sm:p-8"><div className="flex items-start gap-3"><div className="rounded-xl bg-white/15 p-2.5"><SlidersHorizontal className="h-5 w-5" /></div><div><h2 className="text-2xl font-bold">Compare My Salary</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-teal-50">Enter a salary locally to compare it with the anonymous benchmark. This comparison is never saved or sent anywhere.</p></div></div></div><div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Your annual base salary</span><Input type="number" min="20000" max="500000" value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="e.g. 85000" /></label><SelectField label="State" value={filters.state} onChange={(state) => setFilters((current) => ({ ...current, state }))} options={US_STATES} placeholder="All states" /><SelectField label="Specialty" value={filters.specialty} onChange={(specialty) => setFilters((current) => ({ ...current, specialty }))} options={SURVEY_PULSE_SPECIALTIES} placeholder="All specialties" /><SelectField label="Experience" value={filters.experienceBand} onChange={(experienceBand) => setFilters((current) => ({ ...current, experienceBand }))} options={SURVEY_PULSE_EXPERIENCE_BANDS} placeholder="All experience levels" /><SelectField label="Setting" value={filters.employmentSetting} onChange={(employmentSetting) => setFilters((current) => ({ ...current, employmentSetting }))} options={SURVEY_PULSE_SETTINGS} placeholder="All settings" /><SelectField label="Role" value={filters.role} onChange={(role) => setFilters((current) => ({ ...current, role }))} options={SURVEY_PULSE_ROLES} placeholder="All roles" /></div>{isLoading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-600" /></div> : !data?.meetsMinimumSample ? <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">A comparison will appear once at least five anonymous responses match your selected filters. You can broaden filters or contribute your anonymous salary.</p> : <div className="mt-6 grid gap-4 sm:grid-cols-3"><MetricCard label="Benchmark median" value={currency(data.benchmark?.medianAnnualBaseCents)} note={`${data.sampleSize} anonymous matches`} /><MetricCard label="Your comparison" value={salary ? currency(value) : "Enter your salary"} note="Calculated only in this browser" accent="aqua" /><MetricCard label="Difference from median" value={difference == null ? "—" : `${difference >= 0 ? "+" : ""}${currency(difference)}`} note={difference == null ? "Enter a salary to compare" : difference >= 0 ? "Above the selected median" : "Below the selected median"} accent="slate" /></div>}</div></section>;
}

function WorkforceInsights() {
  const { data, isLoading } = trpc.surveyPulse.getDashboard.useQuery({ filters: {} }, { staleTime: 20_000 });
  if (isLoading) return <div className="flex min-h-60 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div>;
  if (!data?.meetsMinimumSample) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><Users className="mx-auto h-9 w-9 text-amber-600" /><h2 className="mt-3 text-xl font-bold text-amber-950">Workforce insights are on their way</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-900/80">Insights are released only after enough anonymous responses safeguard participant privacy.</p></div>;
  return <section className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="With call responsibility" value={`${data.workforce?.callResponsibilityRate ?? 0}%`} note="Across the anonymous dataset" /><MetricCard label="Travel assignments" value={`${data.workforce?.travelAssignmentRate ?? 0}%`} note="Reported current role type" accent="aqua" /><MetricCard label="National sample" value={String(data.sampleSize)} note="Anonymous participants" accent="slate" /></div><div className="grid gap-4 lg:grid-cols-2"><Distribution title="Benefits coverage" values={data.workforce?.benefitCoverage ?? []} /><Distribution title="Credentials represented" values={data.distributions.credentials} /><Distribution title="Employment type" values={data.distributions.employmentTypes} /><Distribution title="Role profile" values={data.distributions.roles} /></div></section>;
}

function Methodology() {
  return <section className="space-y-5"><div className="rounded-2xl bg-gradient-to-br from-teal-900 to-slate-950 p-7 text-white"><ShieldCheck className="h-8 w-8 text-teal-200" /><h2 className="mt-4 text-2xl font-bold">Privacy is the methodology</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-teal-50">Survey Pulse is a voluntary, anonymous, self-reported compensation and workforce dataset built for sonographers across the United States.</p></div><div className="grid gap-4 md:grid-cols-2"><article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">What we collect</h3><p className="mt-2 text-sm leading-6 text-slate-600">State, specialty, credentials, experience, employment setting and type, role, compensation, workload, call, travel, and benefits.</p></article><article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">What we never collect</h3><p className="mt-2 text-sm leading-6 text-slate-600">Name, account, email, phone, employer, exact workplace, street address, employee ID, IP address, user agent, or open-text details.</p></article><article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">How results are protected</h3><p className="mt-2 text-sm leading-6 text-slate-600">Dashboard statistics and category breakdowns are hidden whenever fewer than five responses match a view. Individual response records are never displayed.</p></article><article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">How to use the data</h3><p className="mt-2 text-sm leading-6 text-slate-600">Use Survey Pulse as one perspective for career conversations—not as a guarantee of compensation, an employment offer, or legal/financial advice.</p></article></div></section>;
}

export function SurveyPulse({ embedded = false }: { embedded?: boolean }) {
  const [location] = useLocation();
  const suffix = location.replace(/^\/survey-pulse\/?/, "").split("/")[0];
  const view: PulseView = (Object.keys(VIEW_DETAILS).includes(suffix) ? suffix : "home") as PulseView;
  const activeView = embedded ? "dashboard" : view;
  const page = activeView === "dashboard" ? <Dashboard /> : activeView === "submit" ? <SalaryForm /> : activeView === "compare" ? <Compare /> : activeView === "workforce" ? <WorkforceInsights /> : activeView === "methodology" ? <Methodology /> : <><section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-teal-950 to-teal-700 p-7 text-white shadow-xl sm:p-11"><div className="max-w-3xl"><div className="inline-flex items-center gap-2 rounded-full border border-teal-200/30 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.13em] text-teal-100"><HeartHandshake className="h-3.5 w-3.5" />A profession-powered benchmark</div><h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Sonographer Survey Pulse</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-teal-50">Real sonographers. Real compensation data. A privacy-first national view of ultrasound workforce and pay trends.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/survey-pulse/submit"><Button size="lg" className="bg-white text-teal-950 hover:bg-teal-50"><LockKeyhole className="mr-2 h-4 w-4" />Submit anonymously</Button></Link><Link href="/survey-pulse/dashboard"><Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"><BarChart3 className="mr-2 h-4 w-4" />Explore salary data</Button></Link></div></div></section><div className="grid gap-4 md:grid-cols-3"><article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><MapPin className="h-6 w-6 text-teal-700" /><h2 className="mt-3 font-bold text-slate-900">Benchmark by context</h2><p className="mt-2 text-sm leading-6 text-slate-600">Explore state, specialty, experience, setting, employment type, and role.</p></article><article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><LockKeyhole className="h-6 w-6 text-teal-700" /><h2 className="mt-3 font-bold text-slate-900">Anonymous by design</h2><p className="mt-2 text-sm leading-6 text-slate-600">No profile or contact information is collected with your compensation response.</p></article><article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><DollarSign className="h-6 w-6 text-teal-700" /><h2 className="mt-3 font-bold text-slate-900">Make the data stronger</h2><p className="mt-2 text-sm leading-6 text-slate-600">Every anonymous contribution improves representation across the profession.</p></article></div><PrivacyNotice /></>;
  if (embedded) return <div className="space-y-5">{page}</div>;
  return <div className="min-h-screen bg-slate-50"><div className="border-b border-teal-900/10 bg-white"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between"><Link href="/survey-pulse" className="flex items-center gap-2 text-slate-900"><div className="rounded-xl bg-teal-700 p-2 text-white"><Sparkles className="h-4 w-4" /></div><span className="font-bold">Sonographer Survey Pulse</span></Link><nav className="flex flex-wrap gap-1">{navViews.map((item) => { const detail = VIEW_DETAILS[item]; const Icon = detail.icon; const isActive = activeView === item; return <Link key={item} href={detail.path} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${isActive ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"}`}><Icon className="h-3.5 w-3.5" />{detail.label}</Link>; })}</nav></div></div><main className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-6 sm:py-10">{page}</main></div>;
}

export default SurveyPulse;
