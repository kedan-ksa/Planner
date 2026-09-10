import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/authz";
import { getReportForPreview } from "@/lib/report-access";
import { reportReadiness, reportSections, reportStatusNames } from "@/lib/report-content";
import { ReportPrintButton } from "@/components/report-print-button";
export const dynamic = "force-dynamic";

export default async function ReportPreview({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("reports");
  const { id } = await params;
  const report = await getReportForPreview(user, id).catch((error: unknown) => {
    if (error instanceof Error && error.message === "REPORT_NOT_ACCESSIBLE") notFound();
    throw error;
  });
  const [organization, department, period, approvals, changes] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId! } }),
    db.department.findUniqueOrThrow({ where: { id: report.departmentId! } }),
    db.reportingPeriod.findUniqueOrThrow({ where: { id: report.periodId } }),
    db.approval.findMany({ where: { reportId: report.id }, orderBy: { stepOrder: "asc" } }),
    db.auditLog.findMany({ where: { entityType: "Report", entityId: report.id, action: "REPORT_STATUS_CHANGED" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const approverIds = approvals.flatMap((item) => item.approverId ? [item.approverId] : []);
  const people = approverIds.length ? await db.user.findMany({ where: { id: { in: approverIds }, organizationId: user.organizationId }, select: { id: true, name: true } }) : [];
  const names = new Map(people.map((person) => [person.id, person.name]));
  const date = (value: Date | null) => value ? value.toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh", calendar: "gregory" }) : "—";
  const readiness = reportReadiness(report);
  const approvalNames = { PENDING: "بانتظار القرار", APPROVED: "معتمد", RETURNED: "مُعاد للتعديل", REJECTED: "مرفوض" };
  return <main dir="rtl" className="report-preview mx-auto max-w-4xl p-5 text-slate-900 sm:p-10">
    <nav className="report-toolbar mb-6 flex items-center justify-between gap-3"><Link href="/reports" className="text-teal-800 underline">العودة للتقارير</Link><ReportPrintButton/></nav>
    <article className="report-paper rounded-2xl border bg-white p-6 sm:p-10">
      <header className="border-b-4 border-teal-700 pb-6"><p className="text-xl font-bold text-teal-800">{organization.name}</p><h1 className="mt-4 text-2xl font-bold">{report.title}</h1>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt>الإدارة</dt><dd className="font-bold">{department.name}</dd></div><div><dt>الفترة</dt><dd className="font-bold">{period.name}</dd></div><div><dt>من / إلى</dt><dd>{date(period.startDate)} — {date(period.endDate)}</dd></div><div><dt>حالة التقرير</dt><dd>{reportStatusNames[report.status]}</dd></div><div><dt>تاريخ إنشاء التقرير</dt><dd>{date(report.createdAt)}</dd></div><div><dt>آخر تعديل</dt><dd>{date(report.updatedAt)}</dd></div><div><dt>تاريخ الاعتماد</dt><dd>{date(report.approvedAt)}</dd></div><div><dt>اكتمال الحقول المطلوبة</dt><dd>{readiness.completion}%</dd></div></dl>
        {report.status !== "APPROVED" && report.status !== "ARCHIVED" && <p className="mt-4 font-bold text-amber-800">نسخة غير معتمدة — {reportStatusNames[report.status]}</p>}
      </header>
      {reportSections.map((section) => <section key={section.key} className="report-section mt-7"><h2 className="mb-3 border-b pb-2 text-lg font-bold text-teal-800">{section.label}</h2><p className="whitespace-pre-wrap break-words leading-8">{report[section.key]?.trim() || "لم يُدوّن محتوى لهذا القسم."}</p></section>)}
      {approvals.length > 0 && <section className="mt-8"><h2 className="mb-3 text-lg font-bold">سجل الموافقات</h2><table className="w-full border-collapse text-sm"><thead><tr>{["الخطوة", "المعتمد", "القرار", "التاريخ", "التعليق"].map((label) => <th key={label} className="border p-2 text-right">{label}</th>)}</tr></thead><tbody>{approvals.map((approval) => <tr key={approval.id}><td className="border p-2">{approval.stepOrder}</td><td className="border p-2">{names.get(approval.approverId ?? "") ?? "غير محدد"}</td><td className="border p-2">{approvalNames[approval.status]}</td><td className="border p-2">{date(approval.decidedAt)}</td><td className="whitespace-pre-wrap border p-2">{approval.comment ?? "—"}</td></tr>)}</tbody></table></section>}
      {changes.map((change) => { const value = change.newValue; const comment = value && typeof value === "object" && !Array.isArray(value) && typeof value.comment === "string" ? value.comment : null; return comment ? <p key={change.id} className="mt-3 whitespace-pre-wrap rounded border p-3 text-sm">ملاحظة المراجعة ({date(change.createdAt)}): {comment}</p> : null; })}
      <footer className="mt-10 border-t pt-4 text-xs text-slate-500">مرجع التقرير: {report.id} · نسخة من المحتوى المحفوظ في المنصة</footer>
    </article>
  </main>;
}
