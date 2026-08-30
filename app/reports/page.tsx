import { ReportStatus, Role } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { createDepartmentReport, transitionReport, updateReportContent } from "./actions";

export const dynamic = "force-dynamic";
const statusNames: Record<ReportStatus, string> = { DRAFT:"مسودة", IN_PROGRESS:"قيد الإعداد", READY_FOR_REVIEW:"جاهز للمراجعة", SUBMITTED:"مُرسل للإدارة", RETURNED:"مُعاد للتعديل", APPROVED:"معتمد", ARCHIVED:"مؤرشف" };

export default async function ReportsPage() {
  const user = await requirePage("reports");
  const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const departmentWhere = visible === null ? { organizationId: user.organizationId! } : { id: { in: visible } };
  const reportWhere = visible === null ? {} : { departmentId: { in: visible } };
  const [reports, periods, departments] = await Promise.all([
    db.report.findMany({ where: reportWhere, orderBy: { updatedAt: "desc" } }),
    db.reportingPeriod.findMany({ orderBy: { startDate: "desc" } }),
    db.department.findMany({ where: departmentWhere, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  const canCreate = user.role !== Role.VIEWER && user.role !== Role.EXECUTIVE;
  const canApprove = user.role === Role.SUPER_ADMIN || user.role === Role.EXECUTIVE;

  return <DashboardShell><div className="p-5 lg:p-8"><div><h1 className="text-2xl font-bold">التقارير الدورية</h1><p className="text-sm text-slate-500">إنشاء تقرير الإدارة ومراجعته وإرساله واعتماده</p></div>
    {canCreate && <form action={createDepartmentReport} className="card mt-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto]"><select name="periodId" required className="rounded-xl border p-3"><option value="">اختر الفترة</option>{periods.map((period)=><option key={period.id} value={period.id}>{period.name}</option>)}</select><select name="departmentId" required className="rounded-xl border p-3"><option value="">اختر الإدارة</option>{departments.map((department)=><option key={department.id} value={department.id}>{department.name}</option>)}</select><button className="rounded-xl bg-teal-700 px-5 py-3 font-bold text-white">إنشاء مسودة آلية</button></form>}
    <div className="mt-5 space-y-4">{reports.map((report)=>{const reportLocked=report.status===ReportStatus.SUBMITTED||report.status===ReportStatus.APPROVED||report.status===ReportStatus.ARCHIVED;return <article key={report.id} className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{report.title}</h2><p className="text-sm text-slate-500">{report.departmentId ? departmentNames.get(report.departmentId) ?? "إدارة" : "تقرير تنفيذي"}</p></div><span className="badge bg-blue-50 text-blue-700">{statusNames[report.status]}</span></div><p className="mt-4 whitespace-pre-wrap text-sm">{report.summary ?? "بانتظار إعداد الملخص."}</p><div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>اكتمال التقرير</span><b>{report.completion}%</b></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{width:`${report.completion}%`}}/></div></div>{canCreate&&!reportLocked&&<details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer font-bold text-teal-800">تحرير محتوى التقرير</summary><form action={updateReportContent} className="mt-4 grid gap-3"><input type="hidden" name="reportId" value={report.id}/><textarea name="summary" required defaultValue={report.summary??""} placeholder="الملخص التنفيذي" className="min-h-24 rounded-lg border p-3"/><textarea name="achievements" required defaultValue={report.achievements??""} placeholder="أهم الإنجازات" className="min-h-24 rounded-lg border p-3"/><textarea name="challenges" defaultValue={report.challenges??""} placeholder="التحديات" className="min-h-20 rounded-lg border p-3"/><textarea name="recommendations" defaultValue={report.recommendations??""} placeholder="التوصيات والقرارات المطلوبة" className="min-h-20 rounded-lg border p-3"/><textarea name="nextSteps" required defaultValue={report.nextSteps??""} placeholder="الخطوات القادمة" className="min-h-20 rounded-lg border p-3"/><button className="rounded-lg bg-teal-700 p-3 font-bold text-white">حفظ محتوى التقرير</button></form></details>}<div className="mt-4 flex flex-wrap gap-2"><form action={transitionReport}><input type="hidden" name="reportId" value={report.id}/><button name="intent" value="start" className="rounded-lg border px-3 py-2 text-sm">بدء الإعداد</button> <button name="intent" value="ready" className="rounded-lg border px-3 py-2 text-sm">جاهز للمراجعة</button> {(user.role===Role.SUPER_ADMIN||user.role===Role.DEPARTMENT_MANAGER)&&<button name="intent" value="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">إرسال عبر سلسلة الاعتماد</button>} {canApprove&&<><button name="intent" value="approve" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white">اعتماد مباشر عند عدم وجود سلسلة</button> <button name="intent" value="return" className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">إعادة للتعديل</button></>}</form></div></article>})}{reports.length===0&&<div className="card p-12 text-center text-slate-500">لا توجد تقارير في نطاقك بعد. أنشئ أول مسودة من الأعلى.</div>}</div>
  </div></DashboardShell>;
}
