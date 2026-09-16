import { WorkStatus } from "@prisma/client";
import { FileClock, Gauge, Lightbulb, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { weightedProgress } from "@/lib/progress";
import { workStatusNames } from "@/lib/strategic-labels";
import { effectiveWorkStatus, overdueDays } from "@/lib/work-status";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requirePage("dashboard");
  const departmentScope = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const axes = await db.strategicAxis.findMany({
    where: { organizationId: user.organizationId! },
    orderBy: { title: "asc" },
  });
  const departments = await db.department.findMany({
    where: {
      organizationId: user.organizationId!,
      ...(departmentScope === null ? {} : { id: { in: departmentScope } }),
    },
    select: { id: true, name: true },
  });
  const departmentIds = departments.map((department) => department.id);
  const now = new Date();
  const [initiatives, kpis, pendingReports] = await Promise.all([
    db.initiative.findMany({
      where: {
        axisId: { in: axes.map((axis) => axis.id) },
        departmentId: { in: departmentIds },
      },
      orderBy: [{ dueDate: "asc" }, { title: "asc" }],
      select: { id: true, title: true, axisId: true, departmentId: true, dueDate: true, progress: true, weight: true, status: true },
    }),
    db.kPI.findMany({
      where: { departmentId: { in: departmentIds } },
      select: { currentValue: true },
    }),
    db.report.count({
      where: {
        departmentId: { in: departmentIds },
        status: { in: ["DRAFT", "IN_PROGRESS", "READY_FOR_REVIEW", "RETURNED"] },
      },
    }),
  ]);

  const effectiveInitiatives = initiatives.map((item) => ({
    ...item,
    effectiveStatus: effectiveWorkStatus(item.status, item.dueDate, now),
  }));
  const attentionStatuses = new Set<WorkStatus>([
    WorkStatus.NEEDS_ATTENTION,
    WorkStatus.OVERDUE,
    WorkStatus.BLOCKED,
  ]);
  const attentionItems = effectiveInitiatives.filter((item) => attentionStatuses.has(item.effectiveStatus));
  const completed = effectiveInitiatives.filter((item) => item.effectiveStatus === WorkStatus.COMPLETED).length;
  const globalView = departmentScope === null;
  const overall = globalView
    ? weightedProgress(axes.map((axis) => ({ progress: Number(axis.progress), weight: Number(axis.weight) })))
    : weightedProgress(initiatives.map((item) => ({ progress: Number(item.progress), weight: Number(item.weight) })));
  const axisPerformance = axes.map((axis) => {
    const scopedInitiatives = initiatives.filter((initiative) => initiative.axisId === axis.id);
    return {
      id: axis.id,
      title: axis.title,
      progress: globalView
        ? Number(axis.progress)
        : weightedProgress(scopedInitiatives.map((item) => ({ progress: Number(item.progress), weight: Number(item.weight) }))),
    };
  });
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));

  return <DashboardShell><div className="p-5 lg:p-8">
    <div>
      <div className="text-sm font-medium text-emerald-700">{globalView ? "نظرة الإدارة العليا" : "نظرة نطاقك الإداري"}</div>
      <h1 className="mt-1 text-2xl font-bold lg:text-3xl">أداء شركة كدان</h1>
      <p className="mt-1 text-sm text-slate-500">البيانات مقيدة بالمؤسسة والصلاحية الحالية، ونسب الإنجاز محسوبة من قاعدة البيانات.</p>
    </div>
    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="الأداء العام" value={`${overall}%`} detail={`${axes.length} محاور استراتيجية`} icon={Gauge} />
      <StatCard label="إجمالي المبادرات" value={String(initiatives.length)} detail={`${completed} مكتملة`} icon={Lightbulb} tone="blue" />
      <StatCard label="المؤشرات المحدثة" value={`${kpis.filter((item) => item.currentValue !== null).length} / ${kpis.length}`} detail="ضمن نطاق صلاحيتك" icon={Target} />
      <StatCard label="تحتاج تدخلاً" value={String(attentionItems.length)} detail="متأخرة أو متعثرة" icon={TriangleAlert} tone="red" />
      <StatCard label="تقارير غير مكتملة" value={String(pendingReports)} detail="مسودة أو معادة للتعديل" icon={FileClock} tone="blue" />
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-3">
      <div className="card p-6 xl:col-span-2">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">أداء المحاور الاستراتيجية</h2><p className="text-sm text-slate-500">{globalView ? "الأداء المؤسسي الموزون" : "الأداء الموزون لمبادرات نطاقك"}</p></div><Link href="/strategy" className="text-sm font-bold text-teal-800">استعراض الخطة</Link></div>
        <div className="mt-7 space-y-5">{axisPerformance.map((axis) => <div key={axis.id}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{axis.title}</span><b>{axis.progress}%</b></div><div className="h-2.5 rounded-full bg-slate-100"><div className={`h-full rounded-full ${axis.progress >= 90 ? "bg-emerald-500" : axis.progress >= 70 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${Math.min(100, axis.progress)}%` }} /></div></div>)}</div>
      </div>
      <div className="card p-6"><h2 className="font-bold">جاهزية البيانات</h2><p className="mt-2 text-sm text-slate-500">تتحدث المؤشرات من الإدارات، بينما تتحدث مهام التنفيذ من Planner بعد اعتماد الربط.</p><div className="mt-6 text-center"><b className="text-4xl text-emerald-700">{kpis.length}</b><div className="text-sm text-slate-500">مؤشر أداء في نطاقك</div></div></div>
    </section>
    <section className="card mt-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-6"><div><h2 className="font-bold">المبادرات التي تحتاج اهتمامًا</h2><p className="text-sm text-slate-500">يُحسب التأخير تلقائيًا من الموعد النهائي حتى لو لم تُحدّث الحالة يدويًا.</p></div><Link href="/initiatives" className="text-sm font-bold text-teal-800">كل المبادرات</Link></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right">المبادرة</th><th className="p-3 text-right">الإدارة</th><th className="p-3">الإنجاز</th><th className="p-3">الحالة</th></tr></thead><tbody>{attentionItems.length ? attentionItems.slice(0, 8).map((item) => <tr key={item.id} className="border-t"><td className="p-4 font-medium"><Link href={`/initiatives#${item.id}`}>{item.title}</Link></td><td className="p-4 text-slate-500">{departmentNames.get(item.departmentId) ?? "غير محدد"}</td><td className="p-4 text-center">{Number(item.progress)}%</td><td className="p-4 text-center"><span className="badge bg-red-50 text-red-800">{workStatusNames[item.effectiveStatus]}{item.effectiveStatus === WorkStatus.OVERDUE ? ` · ${overdueDays(item.status, item.dueDate, now)} يوم` : ""}</span></td></tr>) : <tr><td colSpan={4} className="p-10 text-center text-slate-400">لا توجد مبادرات متأخرة أو متعثرة ضمن نطاقك.</td></tr>}</tbody></table></div>
    </section>
  </div></DashboardShell>;
}
