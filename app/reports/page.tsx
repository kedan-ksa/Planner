import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ReportForm } from "@/components/report-form";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { reportDepartmentIds } from "@/lib/report-access";
import { allowedReportIntent, canEditReport, reportReadiness, reportSections, reportStatusNames } from "@/lib/report-content";
import type { ReportIntent } from "@/lib/report-workflow";
import { createReportForm, saveReportForm, transitionReportForm } from "./feedback";

export const dynamic = "force-dynamic";
const intents: { key: ReportIntent; label: string }[] = [
  { key: "start", label: "فتح الإعداد" }, { key: "ready", label: "جاهز للمراجعة" },
  { key: "submit", label: "إرسال للاعتماد" }, { key: "approve", label: "اعتماد التقرير" }, { key: "archive", label: "أرشفة" },
];

export default async function ReportsPage() {
  const user = await requirePage("reports");
  const ids = await reportDepartmentIds(user);
  const [reports, periods, departments] = await Promise.all([
    db.report.findMany({ where: { departmentId: { in: ids } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.reportingPeriod.findMany({ orderBy: { startDate: "desc" } }),
    db.department.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pending = reports.length ? await db.approval.findMany({ where: { reportId: { in: reports.map((report) => report.id) }, status: "PENDING" }, select: { reportId: true } }) : [];
  const chained = new Set(pending.map((item) => item.reportId));
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  const canCreate = user.role !== "VIEWER" && user.role !== "EXECUTIVE";
  return <DashboardShell><div className="p-5 lg:p-8">
    <h1 className="text-2xl font-bold">التقارير الدورية</h1>
    <p className="mt-2 text-sm text-slate-500">إعداد ومراجعة واعتماد تقارير الإدارة · معاينة كاملة وطباعة بالعربية</p>
    {canCreate && <ReportForm action={createReportForm} className="card mt-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto]">
      <label>الفترة<select name="periodId" required className="mt-1 w-full rounded-xl border p-3"><option value="">اختر الفترة</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label>
      <label>الإدارة<select name="departmentId" required className="mt-1 w-full rounded-xl border p-3"><option value="">اختر الإدارة</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <button className="rounded-xl bg-teal-700 px-5 py-3 font-bold text-white">إنشاء مسودة</button>
    </ReportForm>}
    <div className="mt-5 space-y-4">{reports.map((report) => {
      const readiness = reportReadiness(report);
      const hasChain = chained.has(report.id);
      return <article key={report.id} className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-bold">{report.title}</h2><p className="text-sm text-slate-500">{departmentNames.get(report.departmentId ?? "")}</p></div>
          <span className="badge bg-blue-50 text-blue-700">{reportStatusNames[report.status]}</span>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm">{report.summary || "بانتظار إعداد الملخص."}</p>
        <div className="mt-4"><p className="text-xs">اكتمال الحقول المطلوبة: {readiness.completion}%</p><progress className="mt-2 w-full accent-teal-700" max="100" value={readiness.completion}/></div>
        {!readiness.ready && <p className="mt-2 text-sm text-amber-800">ناقص: {readiness.missing.join("، ")}</p>}
        <Link className="mt-4 inline-block font-bold text-teal-800 underline" href={`/reports/${report.id}`}>معاينة التقرير والطباعة</Link>
        {canEditReport(report.status, user.role) && <details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer font-bold text-teal-800">تحرير محتوى التقرير</summary>
          <ReportForm action={saveReportForm} className="mt-4 grid gap-3">
            <input type="hidden" name="reportId" value={report.id}/>
            {reportSections.map((section) => <label key={section.key} className="text-sm">{section.label} {section.required ? "(مطلوب للإرسال)" : "(اختياري)"}
              <textarea name={section.key} maxLength={12000} defaultValue={report[section.key] ?? ""} className="mt-1 min-h-24 w-full rounded-lg border p-3"/>
            </label>)}
            <button className="rounded-lg bg-teal-700 p-3 font-bold text-white">حفظ المسودة</button>
          </ReportForm>
        </details>}
        <div className="mt-4 flex flex-wrap gap-2">
          {intents.filter((intent) => allowedReportIntent(report.status, user.role, intent.key) && !(intent.key === "approve" && hasChain)).map((intent) =>
            <ReportForm key={intent.key} action={transitionReportForm}>
              <input type="hidden" name="reportId" value={report.id}/><input type="hidden" name="intent" value={intent.key}/>
              <button disabled={!readiness.ready && ["ready", "submit", "approve"].includes(intent.key)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">{intent.label}</button>
            </ReportForm>)}
          {hasChain && <Link href="/approvals" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">متابعة سلسلة الاعتماد</Link>}
        </div>
        {allowedReportIntent(report.status, user.role, "return") && !hasChain && <ReportForm action={transitionReportForm} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="reportId" value={report.id}/><input type="hidden" name="intent" value="return"/>
          <input name="comment" required maxLength={2000} aria-label="سبب الإعادة" placeholder="سبب إعادة التقرير للتعديل" className="min-w-64 flex-1 rounded-lg border p-2"/>
          <button className="rounded-lg bg-amber-100 px-3 py-2 text-amber-900">إعادة للتعديل</button>
        </ReportForm>}
      </article>;
    })}{reports.length === 0 && <div className="card p-12 text-center text-slate-500">لا توجد تقارير في نطاقك بعد.</div>}</div>
  </div></DashboardShell>;
}
