import { Role } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { StrategyForm } from "@/components/strategy-form";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/authz";
import { updateUserAccessForm } from "./feedback";

const roleNames: Record<Role, string> = {
  SUPER_ADMIN: "مدير النظام", EXECUTIVE: "الإدارة التنفيذية", DEPARTMENT_MANAGER: "مدير إدارة",
  DEPARTMENT_MEMBER: "موظف / عضو إدارة", VIEWER: "مشاهدة فقط",
};

const roleDescriptions: Record<Role, string> = {
  SUPER_ADMIN: "إدارة النظام والمستخدمين والتكاملات وجميع البيانات.",
  EXECUTIVE: "عرض شامل واعتماد التقارير دون تعديل الإعدادات التقنية.",
  DEPARTMENT_MANAGER: "إدارة بيانات إدارته والأقسام التابعة وإرسال التقارير.",
  DEPARTMENT_MEMBER: "تحديث المهام والمؤشرات والعناصر المسندة إليه.",
  VIEWER: "عرض البيانات المسموح بها فقط دون تعديل.",
};

export default async function UsersPage() {
  const actor = await requireAction("manage");
  const [users, departments] = await Promise.all([
    db.user.findMany({ where: { organizationId: actor.organizationId }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { organizationId: actor.organizationId! }, orderBy: { name: "asc" } }),
  ]);
  const activeUsers = users.filter((user) => user.active).length;
  const assignedUsers = users.filter((user) => user.departmentId).length;
  const superAdmins = users.filter((user) => user.role === Role.SUPER_ADMIN && user.active).length;

  return (
    <DashboardShell>
      <div className="p-5 lg:p-8">
        <div>
          <h1 className="text-2xl font-bold">المستخدمون والصلاحيات</h1>
          <p className="mt-1 text-sm text-slate-500">
            يُنشأ المستخدم تلقائيًا عند أول دخول بحساب Microsoft، ثم يحدد مدير النظام إدارته ومديره المباشر ودوره.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="card p-4"><p className="text-sm text-slate-500">إجمالي المستخدمين</p><p className="mt-1 text-2xl font-bold">{users.length}</p></div>
          <div className="card p-4"><p className="text-sm text-slate-500">الحسابات النشطة</p><p className="mt-1 text-2xl font-bold text-emerald-700">{activeUsers}</p></div>
          <div className="card p-4"><p className="text-sm text-slate-500">مديرو النظام النشطون</p><p className="mt-1 text-2xl font-bold text-sky-700">{superAdmins}</p></div>
        </div>

        {users.length > 0 && assignedUsers < users.length && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            يوجد {users.length - assignedUsers} مستخدم دون إدارة. يجب تعيين إدارة لأدوار «مدير إدارة» و«عضو إدارة» قبل الحفظ.
          </div>
        )}

        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4 text-right">المستخدم</th>
                <th className="p-4 text-right">البريد</th>
                <th className="p-4 text-right">الإدارة والمدير المباشر والدور والحالة</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-t align-top" key={user.id}>
                  <td className="p-4">
                    <p className="font-bold">{user.name}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {user.active ? "نشط" : "موقوف"}
                    </span>
                    {user.id === actor.id && <p className="mt-2 text-xs text-sky-700">حسابك الحالي</p>}
                  </td>
                  <td className="p-4 text-slate-500" dir="ltr">{user.email}</td>
                  <td className="p-3">
                    <StrategyForm action={updateUserAccessForm} className="grid grid-cols-[1fr_1fr_1fr_120px_90px] gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <label className="grid gap-1 text-xs text-slate-500">
                        الإدارة
                        <select name="departmentId" defaultValue={user.departmentId ?? ""} className="rounded-lg border bg-white p-2 text-sm text-slate-900">
                          <option value="">بدون إدارة</option>
                          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-slate-500">
                        المدير المباشر
                        <select name="managerId" defaultValue={user.managerId ?? ""} className="rounded-lg border bg-white p-2 text-sm text-slate-900">
                          <option value="">بدون مدير مباشر</option>
                          {users.filter((manager) => manager.id !== user.id && manager.active).map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-slate-500">
                        الدور
                        <select name="role" defaultValue={user.role} className="rounded-lg border bg-white p-2 text-sm text-slate-900">
                          {Object.values(Role).map((role) => <option key={role} value={role}>{roleNames[role]}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-slate-500">
                        الحالة
                        <select name="active" defaultValue={String(user.active)} className="rounded-lg border bg-white p-2 text-sm text-slate-900">
                          <option value="true">نشط</option>
                          <option value="false">موقوف</option>
                        </select>
                      </label>
                      <button className="self-end rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white transition hover:bg-emerald-800">حفظ</button>
                    </StrategyForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="p-10 text-center text-slate-500">لم يسجل أي مستخدم من الشركة بعد.</div>}
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-bold">دليل الأدوار</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {Object.values(Role).map((role) => (
              <div key={role} className="card p-4">
                <p className="font-bold">{roleNames[role]}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{roleDescriptions[role]}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
