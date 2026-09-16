import { Frequency, KpiDirection, KpiType, Role } from "@prisma/client";
import { Gauge } from "lucide-react";
import { recordKpiValueForm, saveKpiForm } from "@/app/actions/strategy-feedback";
import { DashboardShell } from "@/components/dashboard-shell";
import { StrategyForm } from "@/components/strategy-form";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { kpiAchievement, ragStatus } from "@/lib/progress";
import { directionNames, frequencyNames, kpiTypeNames } from "@/lib/strategic-labels";
import { canRecordKpiValue } from "@/lib/kpi-access";

export const dynamic = "force-dynamic";

type Named = { id: string; title?: string; name?: string; departmentId?: string | null };
type KpiEdit = {
  id: string;
  name: string;
  axisId: string | null;
  objectiveId: string | null;
  initiativeId: string | null;
  departmentId: string;
  ownerId: string | null;
  type: KpiType;
  direction: KpiDirection;
  baseline: unknown;
  target: unknown;
  unit: string | null;
  weight: unknown;
  frequency: Frequency;
  dataSource: string | null;
};

function KpiForm({ axes, objectives, initiatives, departments, users, item }: {
  axes: Named[];
  objectives: Named[];
  initiatives: Named[];
  departments: Named[];
  users: Named[];
  item?: KpiEdit;
}) {
  return <StrategyForm action={saveKpiForm} className="grid gap-3 md:grid-cols-2">
    <input type="hidden" name="kpiId" value={item?.id ?? ""}/>
    <input name="name" required minLength={3} maxLength={240} defaultValue={item?.name} placeholder="اسم المؤشر" className="rounded-lg border p-3 md:col-span-2"/>
    <label className="text-sm">الإدارة<select name="departmentId" required defaultValue={item?.departmentId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">اختر الإدارة</option>{departments.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
    <label className="text-sm">مسؤول المؤشر<select name="ownerId" defaultValue={item?.ownerId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">غير مسند</option>{users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    <label className="text-sm">المحور<select name="axisId" defaultValue={item?.axisId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">بدون ربط مباشر</option>{axes.map((value) => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
    <label className="text-sm">الهدف<select name="objectiveId" defaultValue={item?.objectiveId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">بدون هدف</option>{objectives.map((value) => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
    <label className="text-sm">المبادرة<select name="initiativeId" defaultValue={item?.initiativeId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">بدون مبادرة</option>{initiatives.map((value) => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
    <label className="text-sm">النوع<select name="type" defaultValue={item?.type ?? KpiType.PERCENTAGE} className="mt-1 w-full rounded-lg border p-3">{Object.values(KpiType).map((value) => <option key={value} value={value}>{kpiTypeNames[value]}</option>)}</select></label>
    <label className="text-sm">اتجاه القياس<select name="direction" defaultValue={item?.direction ?? KpiDirection.HIGHER_IS_BETTER} className="mt-1 w-full rounded-lg border p-3">{Object.values(KpiDirection).map((value) => <option key={value} value={value}>{directionNames[value]}</option>)}</select></label>
    <label className="text-sm">خط الأساس<input name="baseline" type="number" step="0.0001" defaultValue={item ? (item.baseline === null ? "" : Number(item.baseline)) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">المستهدف<input name="target" type="number" step="0.0001" required defaultValue={item ? Number(item.target) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">الوحدة<input name="unit" maxLength={40} defaultValue={item?.unit ?? ""} placeholder="% أو ر.س" className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">الوزن %<input name="weight" type="number" min="0.01" max="100" step="0.01" required defaultValue={item ? Number(item.weight) : 1} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">الدورية<select name="frequency" defaultValue={item?.frequency ?? Frequency.MONTHLY} className="mt-1 w-full rounded-lg border p-3">{Object.values(Frequency).map((value) => <option key={value} value={value}>{frequencyNames[value]}</option>)}</select></label>
    <label className="text-sm">مصدر البيانات<input name="dataSource" maxLength={500} defaultValue={item?.dataSource ?? ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <button className="rounded-lg bg-teal-700 p-3 font-bold text-white md:col-span-2">{item ? "حفظ إعداد المؤشر" : "إضافة المؤشر"}</button>
  </StrategyForm>;
}

export default async function KpisPage() {
  const user = await requirePage("kpis");
  const scope = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const axes = await db.strategicAxis.findMany({ where: { organizationId: user.organizationId! }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  const departments = await db.department.findMany({ where: { organizationId: user.organizationId!, ...(scope === null ? {} : { id: { in: scope } }) }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const departmentIds = departments.map((item) => item.id);
  const [objectives, initiatives, kpis, periods, users] = await Promise.all([
    db.strategicObjective.findMany({ where: { axisId: { in: axes.map((item) => item.id) } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.initiative.findMany({ where: { departmentId: { in: departmentIds } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.kPI.findMany({ where: { departmentId: { in: departmentIds } }, include: { values: { orderBy: { recordedAt: "desc" }, take: 6 } }, orderBy: { name: "asc" } }),
    db.reportingPeriod.findMany({ orderBy: { startDate: "desc" }, take: 20 }),
    db.user.findMany({ where: { organizationId: user.organizationId!, active: true, departmentId: { in: departmentIds } }, select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" } }),
  ]);
  const departmentNames = new Map(departments.map((item) => [item.id, item.name]));
  const userNames = new Map(users.map((member) => [member.id, member.name]));
  const canConfigure = user.role === Role.SUPER_ADMIN || user.role === Role.DEPARTMENT_MANAGER;

  return <DashboardShell><div className="p-5 lg:p-8">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Gauge/></span><div><h1 className="text-2xl font-bold">مؤشرات الأداء</h1><p className="text-sm text-slate-500">كل قيمة تحفظ تاريخيًا وتعيد حساب إنجاز الهدف والمحور تلقائيًا.</p></div></div>
    {canConfigure && departments.length > 0 && <details className="card mt-6 p-5"><summary className="cursor-pointer font-bold text-teal-800">إضافة مؤشر أداء</summary><div className="mt-4"><KpiForm axes={axes} objectives={objectives} initiatives={initiatives} departments={departments} users={users}/></div></details>}
    <div className="mt-5 space-y-4">{kpis.map((item) => {
      const achievement = item.currentValue === null ? null : kpiAchievement(Number(item.currentValue), Number(item.target), Number(item.baseline ?? 0), item.direction);
      const rag = achievement === null ? "GRAY" : ragStatus(achievement);
      const canUpdate = canRecordKpiValue(user.role, user.id, item.ownerId);
      return <article key={item.id} className="card p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{item.name}</h2><p className="text-sm text-slate-500">{departmentNames.get(item.departmentId)} · {frequencyNames[item.frequency]} · {directionNames[item.direction]} · المسؤول: {item.ownerId ? userNames.get(item.ownerId) ?? "غير معروف" : "غير مسند"}</p></div><span className={`badge ${rag === "GREEN" ? "bg-emerald-50 text-emerald-800" : rag === "AMBER" ? "bg-amber-50 text-amber-800" : rag === "RED" ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-600"}`}>{achievement === null ? "بانتظار التحديث" : `${Math.round(achievement)}% تحقيق`}</span></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><span>الأساس: {item.baseline === null ? "—" : Number(item.baseline)} {item.unit}</span><span>المستهدف: {Number(item.target)} {item.unit}</span><b>الحالي: {item.currentValue === null ? "—" : Number(item.currentValue)} {item.unit}</b></div>
        {canUpdate && <StrategyForm action={recordKpiValueForm} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="kpiId" value={item.id}/><input name="value" type="number" step="0.0001" required defaultValue={item.currentValue === null ? "" : Number(item.currentValue)} aria-label="القيمة الجديدة" placeholder="القيمة الجديدة" className="rounded-lg border p-3"/><select name="periodId" aria-label="فترة القياس" className="rounded-lg border p-3"><option value="">بلا فترة محددة</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select><button className="rounded-lg bg-teal-700 px-5 font-bold text-white">حفظ القيمة</button></StrategyForm>}
        {!canUpdate && user.role === Role.DEPARTMENT_MEMBER && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">يمكنك الاطلاع على المؤشر؛ تحديث القيمة متاح للمسؤول المعيّن فقط.</p>}
        {item.values.length > 0 && <details className="mt-4 rounded-xl bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-bold">سجل آخر القيم ({item.values.length})</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{item.values.map((value) => <div key={value.id} className="rounded-lg bg-white p-3 text-sm"><b>{Number(value.value)} {item.unit}</b><p className="text-xs text-slate-500">تحقيق {Number(value.achievement).toFixed(1)}% · {value.recordedAt.toLocaleDateString("ar-SA")}</p></div>)}</div></details>}
        {canConfigure && <details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-bold">تعديل إعداد المؤشر والإسناد</summary><div className="mt-4"><KpiForm axes={axes} objectives={objectives} initiatives={initiatives} departments={departments} users={users} item={item}/></div></details>}
      </article>;
    })}{kpis.length === 0 && <div className="card p-12 text-center text-slate-500">لا توجد مؤشرات ضمن نطاقك.</div>}</div>
  </div></DashboardShell>;
}
