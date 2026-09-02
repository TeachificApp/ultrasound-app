import { ArrowLeft, BookOpen, Database } from "lucide-react";
import { QuestionBankWorkspace } from "./admin/LMSAdmin";
import { getAdminUrl } from "@/hooks/useSubdomain";

export default function QuestionBankWorkspacePage() {
  return (
    <main className="min-h-screen bg-slate-50" data-question-bank-page="standalone">
      <header className="border-b border-teal-100 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500 text-white shadow-sm">
              <Database className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Assessment repository</p>
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Question Bank</h1>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Question Bank administration links">
            <a href={getAdminUrl("/platform-admin")} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Platform Admin
            </a>
            <a href={getAdminUrl("/admin/lms")} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100">
              <BookOpen className="h-4 w-4" aria-hidden="true" /> LMS Admin
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <QuestionBankWorkspace standalone />
      </section>
    </main>
  );
}
