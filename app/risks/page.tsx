import { Role, WorkStatus } from "@prisma/client";
import { ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StrategyForm } from "@/components/strategy-form";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { canManageRisk, riskLevel } from "@/lib/risk-access";
import { dateInput, workStatusNames } from "@/lib/strategic-labels";
import { saveRiskForm } from "./feedback";

export const dynamic = "force-dynamic";

type Named = { id: string; name?: string; title?: string; departmentId?: string | null };
type RiskEdit = {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  initiativeId: string | null;
  ownerId: string | null;
  probability: number;
  impact: number;
  mitigationPlan: string;
  dueDate: Date | null;
  status: WorkStatus;
};

const levelNames = { LOW: "منخفض", MEDIUM: "متوسط", HIGH: "عالٍ", CRITICAL: "حرج" } as const;
const levelClasses = { LOW: "bg-emerald-50 text-emerald-800", MEDIUM: "bg-amber-50 text-amber-800", HIGH: "bg-orange-50 text-orange-800", CRITICAL: "bg-red-100 text-red-900" } as const;

function RiskForm({ departments, initiatives, users, item }: {
  departments: Named[];
  initiatives: Named[];
  users: Named[];
  item?: RiskEdit;
}) {
  return <StrategyForm action={saveRiskForm} className="grid gap-3 md:grid-cols-2">
    <input type="hidden" name="riskId" value={item?.id ?? ""}/>
    <input name="title" required minLength={3} maxLength={240} defaultValue={item?.title} placeholder="عنوان الخطر أو التحدي" className="rounded-lg border p-3 md:col-span-2"/>
    <textarea name="description" required minLength={3} maxLength={5000} defaultValue={item?.description ?? ""} placeholder="وصف الخطر وأسبابه" className="rounded-lg border p-3 md:col-span-2"/>
    <label className="text-sm">الإدارة<select name="departmentId" required defaultValue={item?.departmentId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">اختر الإدارة</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
    <label className="text-sm">المبادرة المرتبطة<select name="initiativeId" defaultValue={item?.initiativeId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">خطر إداري عام</option>{initiatives.map((initiative) => <option key={initiative.id} value={initiative.id}>{initiative.title}</option>)}</select></label>
    <label className="text-sm">مسؤول المعالجة<select name="ownerId" defaultValue={item?.ownerId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">غير مسند</option>{users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    <label className="text-sm">تاريخ الإغلاق المستهدف<input name="dueDate" type="date" defaultValue={item?.dueDate ? dateInput(item.dueDate) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">الاحتمالية (1–5)<input name="probability" type="number" min="1" max="5" required defaultValue={item?.probability ?? 3} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">الأثر (1–5)<input name="impact" type="number" min="1" max="5" required defaultValue={item?.impact ?? 3} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm md:col-span-2">خطة المعالجة<textarea name="mitigationPlan" required minLength={3} maxLength={5000} defaultValue={item?.mitigationPlan ?? ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm md:col-span-2">الحالة<select name="status" defaultValue={item?.status ?? WorkStatus.NEEDS_ATTENTION} className="mt-1 w-full rounded-lg border p-3">{Object.values(WorkStatus).map((status) => <option key={status} value={status}>{workStatusNames[status]}</option>)}</select></label>
    <button className="rounded-lg bg-teal-700 p-3 font-bold text-white md:col-span-2">{item ? "حفظ تعديل الخطر" : "إضافة الخطر"}</button>
  </StrategyForm>;
}

export default async function RisksPage({ searchParams }: { searchParams: Promise<{ department?: string; status?: string }> }) {
  const filters = await searchParams;
  const user = await requirePage("risks");
  const scope = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const departments = await db.department.findMany({ where: { organizationId: user.organizationId!, ...(scope === null ? {} : { id: { in: scope } }) }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const allDepartmentIds = departments.map((item) => item.id);
  const departmentId = filters.department && allDepartmentIds.includes(filters.department) ? filters.department : null;
  const status = Object.values(WorkStatus).includes(filters.status as WorkStatus) ? filters.status as WorkStatus : null;
  const visibleDepartmentIdsForQuery = departmentId ? [departmentId] : allDepartmentIds;
  const [risks, initiatives, allUsers] = await Promise.all([
    db.risk.findMany({ where: { departmentId: { in: visibleDepartmentIdsForQuery }, ...(status ? { status } : {}) }, orderBy: [{ riskScore: "desc" }, { dueDate: "asc" }] }),
    db.initiative.findMany({ where: { departmentId: { in: allDepartmentIds } }, select: { id: true, title: true, departmentId: true }, orderBy: { title: "asc" } }),
    db.user.findMany({ where: { organizationId: user.organizationId!, departmentId: { in: allDepartmentIds }, active: true }, select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" } }),
  ]);
  const users = user.role === Role.DEPARTMENT_MEMBER ? allUsers.filter((member) => member.id === user.id) : allUsers;
  const departmentNames = new Map(departments.map((item) => [item.id, item.name]));
  const initiativeNames = new Map(initiatives.map((item) => [item.id, item.title]));
  const userNames = new Map(allUsers.map((member) => [member.id, member.name]));
  const matrix = new Map<string, number>();
  for (const risk of risks) matrix.set(`${risk.probability}:${risk.impact}`, (matrix.get(`${risk.probability}:${risk.impact}`) ?? 0) + 1);
  const canCreate = user.role === Role.SUPER_ADMIN || user.role === Role.DEPARTMENT_MANAGER || user.role === Role.DEPARTMENT_MEMBER;

  return <DashboardShell><div className="p-5 lg:p-8">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-red-50 p-3 text-red-700"><ShieldAlert/></span><div><h1 className="text-2xl font-bold">المخاطر والتحديات</h1><p className="text-sm text-slate-500">درجة الخطر = الاحتمالية × الأثر، والصلاحية مقيدة بالإدارة والمسؤول المعيّن.</p></div></div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_1.4fr]">
      <section className="card p-5"><h2 className="font-bold">مصفوفة المخاطر</h2><p className="text-xs text-slate-500">المحور الأفقي: الاحتمالية · الرأسي: الأثر</p><div className="mt-4 grid grid-cols-6 gap-1 text-center text-xs"><span></span>{[1,2,3,4,5].map((value) => <b key={`p-${value}`} className="p-2">{value}</b>)}{[5,4,3,2,1].flatMap((impact) => [<b key={`i-${impact}`} className="p-2">{impact}</b>, ...[1,2,3,4,5].map((probability) => { const score = probability * impact; const level = riskLevel(score); return <div key={`${probability}-${impact}`} className={`rounded p-2 ${levelClasses[level]}`} title={`درجة ${score}`}>{matrix.get(`${probability}:${impact}`) ?? 0}</div>; })])}</div></section>
      <section className="card p-5"><h2 className="font-bold">ملخص النطاق</h2><div className="mt-4 grid gap-3 sm:grid-cols-4">{(["CRITICAL","HIGH","MEDIUM","LOW"] as const).map((level) => <div key={level} className={`rounded-xl p-4 ${levelClasses[level]}`}><p className="text-xs">{levelNames[level]}</p><b className="text-2xl">{risks.filter((risk) => riskLevel(risk.riskScore) === level).length}</b></div>)}</div><form method="get" className="mt-5 grid gap-2 sm:grid-cols-3"><select name="department" defaultValue={departmentId ?? ""} className="rounded-lg border p-2"><option value="">كل الإدارات</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select name="status" defaultValue={status ?? ""} className="rounded-lg border p-2"><option value="">كل الحالات</option>{Object.values(WorkStatus).map((value) => <option key={value} value={value}>{workStatusNames[value]}</option>)}</select><button className="rounded-lg border border-teal-700 p-2 font-bold text-teal-800">تطبيق الفلتر</button></form></section>
    </div>
    {canCreate && departments.length > 0 && <details className="card mt-5 p-5"><summary className="cursor-pointer font-bold text-teal-800">إضافة خطر أو تحدٍ</summary><div className="mt-4"><RiskForm departments={departments} initiatives={initiatives} users={users}/></div></details>}
    <div className="mt-5 space-y-4">{risks.map((risk) => { const level = riskLevel(risk.riskScore); const canEdit = canManageRisk(user.role, user.id, risk.ownerId); return <article key={risk.id} className="card p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{risk.title}</h2><p className="text-sm text-slate-500">{departmentNames.get(risk.departmentId)} · {risk.initiativeId ? initiativeNames.get(risk.initiativeId) : "خطر عام"} · المسؤول: {risk.ownerId ? userNames.get(risk.ownerId) ?? "غير معروف" : "غير مسند"}</p></div><div className="flex gap-2"><span className={`badge ${levelClasses[level]}`}>{levelNames[level]} · {risk.riskScore}/25</span><span className="badge bg-slate-100">{workStatusNames[risk.status]}</span></div></div><p className="mt-3 text-sm text-slate-700">{risk.description}</p><div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><b>خطة المعالجة</b><p className="mt-1 text-slate-600">{risk.mitigationPlan}</p></div><div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span>الاحتمالية: {risk.probability}/5</span><span>الأثر: {risk.impact}/5</span><span>الإغلاق المستهدف: {risk.dueDate?.toLocaleDateString("ar-SA") ?? "غير محدد"}</span><span>آخر تحديث: {risk.updatedAt.toLocaleString("ar-SA")}</span></div>{canEdit && <details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-bold">تعديل الخطر وخطة المعالجة</summary><div className="mt-4"><RiskForm departments={departments} initiatives={initiatives} users={users} item={risk}/></div></details>}</article>; })}{risks.length === 0 && <div className="card p-12 text-center text-slate-500">لا توجد مخاطر مسجلة ضمن الفلتر الحالي.</div>}</div>
  </div></DashboardShell>;
}
