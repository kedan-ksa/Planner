import { Compass, Gauge, Lightbulb, Target } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { workStatusNames } from "@/lib/strategic-labels";
import { canView } from "@/lib/access-control";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const user = await requirePage("strategy");
  const scope = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const axes = await db.strategicAxis.findMany({
    where: { organizationId: user.organizationId! },
    orderBy: { title: "asc" },
  });
  const departmentIds = scope === null
    ? (await db.department.findMany({ where: { organizationId: user.organizationId! }, select: { id: true } })).map((item) => item.id)
    : scope;
  const [allObjectives, initiatives, kpis] = await Promise.all([
    db.strategicObjective.findMany({ where: { axisId: { in: axes.map((item) => item.id) } }, orderBy: { title: "asc" } }),
    db.initiative.findMany({ where: { departmentId: { in: departmentIds }, axisId: { in: axes.map((item) => item.id) } }, select: { id: true, axisId: true, objectiveId: true } }),
    db.kPI.findMany({ where: { departmentId: { in: departmentIds } }, select: { id: true, axisId: true, objectiveId: true, currentValue: true } }),
  ]);
  const objectives = scope === null
    ? allObjectives
    : allObjectives.filter((item) => item.departmentId === null || scope.includes(item.departmentId));

  return <DashboardShell><div className="p-5 lg:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Compass /></span><div><h1 className="text-2xl font-bold">الخطة الاستراتيجية</h1><p className="text-sm text-slate-500">Company ← المحاور ← الأهداف ← المبادرات ← المهام والتحديثات</p></div></div><div className="flex gap-2">{canView(user.role, "axes") && <Link href="/axes" className="rounded-lg border px-4 py-2 text-sm">إدارة المحاور</Link>}<Link href="/initiatives" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white">إدارة المبادرات</Link></div></div>
    <div className="mt-6 space-y-5">{axes.map((axis) => {
      const axisObjectives = objectives.filter((objective) => objective.axisId === axis.id);
      const axisInitiatives = initiatives.filter((initiative) => initiative.axisId === axis.id);
      const axisKpis = kpis.filter((kpi) => kpi.axisId === axis.id);
      return <section key={axis.id} className="card overflow-hidden"><div className="border-b bg-slate-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{axis.title}</h2><p className="mt-1 text-sm text-slate-500">{axis.description || "بدون وصف"}</p></div><span className="badge bg-teal-50 text-teal-800">{Number(axis.progress)}% · {workStatusNames[axis.status]}</span></div><progress className="mt-4 w-full accent-teal-700" max="100" value={Number(axis.progress)} /></div><div className="grid gap-4 p-5 lg:grid-cols-2">{axisObjectives.map((objective) => {
        const objectiveInitiatives = axisInitiatives.filter((initiative) => initiative.objectiveId === objective.id).length;
        const objectiveKpis = axisKpis.filter((kpi) => kpi.objectiveId === objective.id);
        return <article key={objective.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><h3 className="font-bold">{objective.title}</h3><b className="text-teal-800">{Number(objective.progress)}%</b></div><div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-1"><Lightbulb size={14}/>{objectiveInitiatives} مبادرة</span><span className="flex items-center gap-1"><Gauge size={14}/>{objectiveKpis.length} مؤشر</span><span className="flex items-center gap-1"><Target size={14}/>{objectiveKpis.filter((kpi) => kpi.currentValue !== null).length} محدّث</span></div></article>;
      })}{axisObjectives.length === 0 && <p className="p-5 text-center text-sm text-slate-400 lg:col-span-2">لا توجد أهداف ظاهرة ضمن نطاقك في هذا المحور.</p>}</div></section>;
    })}{axes.length === 0 && <div className="card p-12 text-center text-slate-500">لم تُنشأ محاور استراتيجية بعد.</div>}</div>
  </div></DashboardShell>;
}
