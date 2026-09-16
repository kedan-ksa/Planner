import { Priority, Role, WorkStatus } from "@prisma/client";
import { Lightbulb } from "lucide-react";
import { saveInitiativeForm } from "@/app/actions/strategy-feedback";
import { DashboardShell } from "@/components/dashboard-shell";
import { StrategyForm } from "@/components/strategy-form";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { dateInput, priorityNames, workStatusNames } from "@/lib/strategic-labels";
import { effectiveWorkStatus, overdueDays } from "@/lib/work-status";

export const dynamic = "force-dynamic";

type Named = { id: string; title?: string; name?: string; axisId?: string; departmentId?: string | null };
type InitiativeEdit = {
  id: string;
  axisId: string;
  objectiveId: string;
  departmentId: string;
  ownerId: string | null;
  title: string;
  description: string | null;
  startDate: Date;
  dueDate: Date;
  weight: unknown;
  priority: Priority;
  status: WorkStatus;
};

function InitiativeForm({ axes, objectives, departments, users, item }: {
  axes: Named[];
  objectives: Named[];
  departments: Named[];
  users: Named[];
  item?: InitiativeEdit;
}) {
  return <StrategyForm action={saveInitiativeForm} className="grid gap-3 md:grid-cols-2">
    <input type="hidden" name="initiativeId" value={item?.id ?? ""}/>
    <input name="title" required minLength={3} maxLength={240} defaultValue={item?.title} placeholder="عنوان المبادرة" className="rounded-lg border p-3 md:col-span-2"/>
    <textarea name="description" maxLength={5000} defaultValue={item?.description ?? ""} placeholder="وصف المبادرة" className="rounded-lg border p-3 md:col-span-2"/>
    <label className="text-sm">المحور<select name="axisId" required defaultValue={item?.axisId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">اختر المحور</option>{axes.map((axis) => <option key={axis.id} value={axis.id}>{axis.title}</option>)}</select></label>
    <label className="text-sm">الهدف<select name="objectiveId" required defaultValue={item?.objectiveId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">اختر الهدف</option>{objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.title}</option>)}</select></label>
    <label className="text-sm">الإدارة<select name="departmentId" required defaultValue={item?.departmentId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">اختر الإدارة</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
    <label className="text-sm">مسؤول المبادرة<select name="ownerId" defaultValue={item?.ownerId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">غير مسند</option>{users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    <label className="text-sm">الوزن %<input name="weight" type="number" min="0.01" max="100" step="0.01" required defaultValue={item ? Number(item.weight) : 1} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">البداية<input name="startDate" type="date" required defaultValue={item ? dateInput(item.startDate) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">الموعد النهائي<input name="dueDate" type="date" required defaultValue={item ? dateInput(item.dueDate) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">الأولوية<select name="priority" defaultValue={item?.priority ?? Priority.MEDIUM} className="mt-1 w-full rounded-lg border p-3">{Object.values(Priority).map((value) => <option key={value} value={value}>{priorityNames[value]}</option>)}</select></label>
    <label className="text-sm">الحالة<select name="status" defaultValue={item?.status ?? WorkStatus.NOT_STARTED} className="mt-1 w-full rounded-lg border p-3">{Object.values(WorkStatus).map((value) => <option key={value} value={value}>{workStatusNames[value]}</option>)}</select></label>
    <button className="rounded-lg bg-teal-700 p-3 font-bold text-white md:col-span-2">{item ? "حفظ تعديل المبادرة" : "إضافة المبادرة"}</button>
  </StrategyForm>;
}

export default async function InitiativesPage() {
  const user = await requirePage("initiatives");
  const scope = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const axes = await db.strategicAxis.findMany({ where: { organizationId: user.organizationId! }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  const departments = await db.department.findMany({ where: { organizationId: user.organizationId!, ...(scope === null ? {} : { id: { in: scope } }) }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const departmentIds = departments.map((item) => item.id);
  const [objectives, initiatives, users] = await Promise.all([
    db.strategicObjective.findMany({ where: { axisId: { in: axes.map((axis) => axis.id) } }, select: { id: true, title: true, axisId: true }, orderBy: { title: "asc" } }),
    db.initiative.findMany({ where: { departmentId: { in: departmentIds } }, orderBy: { dueDate: "asc" } }),
    db.user.findMany({ where: { organizationId: user.organizationId!, active: true, departmentId: { in: departmentIds } }, select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" } }),
  ]);
  const axisNames = new Map(axes.map((item) => [item.id, item.title]));
  const objectiveNames = new Map(objectives.map((item) => [item.id, item.title]));
  const departmentNames = new Map(departments.map((item) => [item.id, item.name]));
  const userNames = new Map(users.map((member) => [member.id, member.name]));
  const canManage = user.role === Role.SUPER_ADMIN || user.role === Role.DEPARTMENT_MANAGER;
  const now = new Date();

  return <DashboardShell><div className="p-5 lg:p-8">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Lightbulb/></span><div><h1 className="text-2xl font-bold">المبادرات</h1><p className="text-sm text-slate-500">إدارة المبادرات ضمن النطاق؛ الإنجاز يأتي من متوسط المهام المتزامنة أو المحدثة.</p></div></div>
    {canManage && departments.length > 0 && <details className="card mt-6 p-5"><summary className="cursor-pointer font-bold text-teal-800">إضافة مبادرة</summary><div className="mt-4"><InitiativeForm axes={axes} objectives={objectives} departments={departments} users={users}/></div></details>}
    <div className="mt-5 space-y-4">{initiatives.map((item) => {
      const status = effectiveWorkStatus(item.status, item.dueDate, now);
      return <article id={item.id} key={item.id} className="card scroll-mt-20 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{item.title}</h2><p className="text-sm text-slate-500">{axisNames.get(item.axisId)} ← {objectiveNames.get(item.objectiveId)} · {departmentNames.get(item.departmentId)} · المسؤول: {item.ownerId ? userNames.get(item.ownerId) ?? "غير معروف" : "غير مسند"}</p></div><div className="flex gap-2"><span className="badge bg-slate-100">{priorityNames[item.priority]}</span><span className={`badge ${status === WorkStatus.OVERDUE || status === WorkStatus.BLOCKED ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-700"}`}>{workStatusNames[status]}{status === WorkStatus.OVERDUE ? ` · ${overdueDays(item.status, item.dueDate, now)} يوم` : ""}</span></div></div><p className="mt-3 text-sm text-slate-600">{item.description || "بدون وصف"}</p><div className="mt-4 flex flex-wrap gap-5 text-sm"><span>الموعد: {item.dueDate.toLocaleDateString("ar-SA")}</span><span>الوزن: {Number(item.weight)}%</span><b>الإنجاز: {Number(item.progress)}%</b></div><progress className="mt-3 w-full accent-teal-700" max="100" value={Number(item.progress)}/>{canManage && <details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-bold">تعديل المبادرة والإسناد</summary><div className="mt-4"><InitiativeForm axes={axes} objectives={objectives} departments={departments} users={users} item={item}/></div></details>}</article>;
    })}{initiatives.length === 0 && <div className="card p-12 text-center text-slate-500">لا توجد مبادرات ضمن نطاقك.</div>}</div>
  </div></DashboardShell>;
}
