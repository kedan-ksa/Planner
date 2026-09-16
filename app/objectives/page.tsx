import { Role, WorkStatus } from "@prisma/client";
import { Target } from "lucide-react";
import { saveStrategicObjectiveForm } from "@/app/actions/strategy-feedback";
import { DashboardShell } from "@/components/dashboard-shell";
import { StrategyForm } from "@/components/strategy-form";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { dateInput, workStatusNames } from "@/lib/strategic-labels";

export const dynamic = "force-dynamic";

type SelectItem = { id: string; title?: string; name?: string };
type ObjectiveEdit = {
  id: string;
  axisId: string;
  departmentId: string | null;
  ownerUserId: string | null;
  title: string;
  weight: unknown;
  target: unknown;
  startDate: Date;
  endDate: Date;
  status: WorkStatus;
};

function ObjectiveForm({ axes, departments, users, objective }: {
  axes: SelectItem[];
  departments: SelectItem[];
  users: SelectItem[];
  objective?: ObjectiveEdit;
}) {
  return <StrategyForm action={saveStrategicObjectiveForm} className="grid gap-3 md:grid-cols-2">
    <input type="hidden" name="objectiveId" value={objective?.id ?? ""}/>
    <input name="title" required minLength={3} maxLength={240} defaultValue={objective?.title} placeholder="عنوان الهدف" className="rounded-lg border p-3 md:col-span-2"/>
    <label className="text-sm">المحور<select name="axisId" required defaultValue={objective?.axisId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">اختر المحور</option>{axes.map((axis) => <option key={axis.id} value={axis.id}>{axis.title}</option>)}</select></label>
    <label className="text-sm">الإدارة المالكة<select name="departmentId" defaultValue={objective?.departmentId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">غير محددة</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="text-sm">مالك الهدف<select name="ownerUserId" defaultValue={objective?.ownerUserId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">غير مسند</option>{users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    <label className="text-sm">الوزن %<input name="weight" type="number" min="0.01" max="100" step="0.01" required defaultValue={objective ? Number(objective.weight) : 1} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">المستهدف العددي<input name="target" type="number" step="0.01" defaultValue={objective ? (objective.target === null ? "" : Number(objective.target)) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">البداية<input name="startDate" type="date" required defaultValue={objective ? dateInput(objective.startDate) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">النهاية<input name="endDate" type="date" required defaultValue={objective ? dateInput(objective.endDate) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm md:col-span-2">الحالة<select name="status" defaultValue={objective?.status ?? WorkStatus.NOT_STARTED} className="mt-1 w-full rounded-lg border p-3">{Object.values(WorkStatus).map((status) => <option key={status} value={status}>{workStatusNames[status]}</option>)}</select></label>
    <button className="rounded-lg bg-teal-700 p-3 font-bold text-white md:col-span-2">{objective ? "حفظ تعديل الهدف" : "إضافة الهدف"}</button>
  </StrategyForm>;
}

export default async function ObjectivesPage() {
  const user = await requirePage("objectives");
  const scope = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const axes = await db.strategicAxis.findMany({ where: { organizationId: user.organizationId! }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  const [departments, users, allObjectives] = await Promise.all([
    db.department.findMany({ where: { organizationId: user.organizationId! }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { organizationId: user.organizationId!, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.strategicObjective.findMany({ where: { axisId: { in: axes.map((axis) => axis.id) } }, orderBy: { startDate: "desc" } }),
  ]);
  const objectives = scope === null ? allObjectives : allObjectives.filter((item) => item.departmentId === null || scope.includes(item.departmentId));
  const axisNames = new Map(axes.map((item) => [item.id, item.title]));
  const departmentNames = new Map(departments.map((item) => [item.id, item.name]));
  const userNames = new Map(users.map((member) => [member.id, member.name]));
  const canManage = user.role === Role.SUPER_ADMIN;

  return <DashboardShell><div className="p-5 lg:p-8">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Target/></span><div><h1 className="text-2xl font-bold">الأهداف الاستراتيجية</h1><p className="text-sm text-slate-500">مرتبطة بمحور وإدارة ومالك؛ الإنجاز محسوب من المبادرات والمؤشرات.</p></div></div>
    {canManage && <details className="card mt-6 p-5"><summary className="cursor-pointer font-bold text-teal-800">إضافة هدف</summary><div className="mt-4"><ObjectiveForm axes={axes} departments={departments} users={users}/></div></details>}
    <div className="mt-5 space-y-4">{objectives.map((item) => <article key={item.id} className="card p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{item.title}</h2><p className="text-sm text-slate-500">{axisNames.get(item.axisId)} · {departmentNames.get(item.departmentId ?? "") ?? "غير محدد"} · المالك: {item.ownerUserId ? userNames.get(item.ownerUserId) ?? "غير معروف" : "غير مسند"}</p></div><span className="badge bg-blue-50 text-blue-700">{workStatusNames[item.status]}</span></div><div className="mt-4 flex flex-wrap gap-5 text-sm"><span>الوزن {Number(item.weight)}%</span><span>المستهدف {item.target === null ? "—" : Number(item.target)}</span><b>الإنجاز {Number(item.progress)}%</b></div><progress className="mt-3 w-full accent-teal-700" max="100" value={Number(item.progress)}/>{canManage && <details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-bold">تعديل الهدف</summary><div className="mt-4"><ObjectiveForm axes={axes} departments={departments} users={users} objective={item}/></div></details>}</article>)}{objectives.length === 0 && <div className="card p-12 text-center text-slate-500">لا توجد أهداف ضمن نطاقك.</div>}</div>
  </div></DashboardShell>;
}
