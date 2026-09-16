import { Role, WorkStatus } from "@prisma/client";
import { Milestone } from "lucide-react";
import { saveStrategicAxisForm } from "@/app/actions/strategy-feedback";
import { DashboardShell } from "@/components/dashboard-shell";
import { StrategyForm } from "@/components/strategy-form";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { dateInput, workStatusNames } from "@/lib/strategic-labels";

export const dynamic = "force-dynamic";

type UserOption = { id: string; name: string };
type AxisEdit = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  weight: unknown;
  startDate: Date;
  endDate: Date;
  status: WorkStatus;
};

function AxisForm({ axis, users }: { axis?: AxisEdit; users: UserOption[] }) {
  return <StrategyForm action={saveStrategicAxisForm} className="grid gap-3 md:grid-cols-2">
    <input type="hidden" name="axisId" value={axis?.id ?? ""}/>
    <input name="title" required minLength={3} maxLength={200} defaultValue={axis?.title} placeholder="عنوان المحور" className="rounded-lg border p-3 md:col-span-2"/>
    <textarea name="description" maxLength={4000} defaultValue={axis?.description ?? ""} placeholder="وصف المحور" className="rounded-lg border p-3 md:col-span-2"/>
    <label className="text-sm">مالك المحور<select name="ownerId" defaultValue={axis?.ownerId ?? ""} className="mt-1 w-full rounded-lg border p-3"><option value="">غير مسند</option>{users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    <label className="text-sm">الوزن %<input name="weight" type="number" min="0.01" max="100" step="0.01" required defaultValue={axis ? Number(axis.weight) : 1} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">الحالة<select name="status" defaultValue={axis?.status ?? WorkStatus.NOT_STARTED} className="mt-1 w-full rounded-lg border p-3">{Object.values(WorkStatus).map((status) => <option key={status} value={status}>{workStatusNames[status]}</option>)}</select></label>
    <label className="text-sm">تاريخ البداية<input name="startDate" type="date" required defaultValue={axis ? dateInput(axis.startDate) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <label className="text-sm">تاريخ النهاية<input name="endDate" type="date" required defaultValue={axis ? dateInput(axis.endDate) : ""} className="mt-1 w-full rounded-lg border p-3"/></label>
    <button className="rounded-lg bg-teal-700 p-3 font-bold text-white md:col-span-2">{axis ? "حفظ تعديل المحور" : "إضافة المحور"}</button>
  </StrategyForm>;
}

export default async function AxesPage() {
  const user = await requirePage("axes");
  const [axes, users] = await Promise.all([
    db.strategicAxis.findMany({ where: { organizationId: user.organizationId! }, orderBy: { startDate: "desc" } }),
    db.user.findMany({ where: { organizationId: user.organizationId!, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const userNames = new Map(users.map((member) => [member.id, member.name]));
  const canManage = user.role === Role.SUPER_ADMIN;

  return <DashboardShell><div className="p-5 lg:p-8">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Milestone/></span><div><h1 className="text-2xl font-bold">المحاور الاستراتيجية</h1><p className="text-sm text-slate-500">التقدم محسوب من الأهداف والمؤشرات المرتبطة، ولا يُدخل يدويًا.</p></div></div>
    {canManage && <details className="card mt-6 p-5"><summary className="cursor-pointer font-bold text-teal-800">إضافة محور استراتيجي</summary><div className="mt-4"><AxisForm users={users}/></div></details>}
    <div className="mt-5 space-y-4">{axes.map((axis) => <article key={axis.id} className="card p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{axis.title}</h2><p className="mt-1 text-sm text-slate-500">{axis.description || "بدون وصف"}</p></div><span className="badge bg-blue-50 text-blue-700">{workStatusNames[axis.status]}</span></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><span>المالك: {axis.ownerId ? userNames.get(axis.ownerId) ?? "غير معروف" : "غير مسند"}</span><span>الوزن: {Number(axis.weight)}%</span><span>{axis.startDate.toLocaleDateString("ar-SA")} — {axis.endDate.toLocaleDateString("ar-SA")}</span><b>الإنجاز المحسوب: {Number(axis.progress)}%</b></div><progress className="mt-3 w-full accent-teal-700" max="100" value={Number(axis.progress)}/>{canManage && <details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-bold">تعديل المحور</summary><div className="mt-4"><AxisForm axis={axis} users={users}/></div></details>}</article>)}{axes.length === 0 && <div className="card p-12 text-center text-slate-500">لا توجد محاور في المؤسسة.</div>}</div>
  </div></DashboardShell>;
}
