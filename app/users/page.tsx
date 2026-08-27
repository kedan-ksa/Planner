import { Role } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/authz";
import { updateUserAccess } from "./actions";

const roleNames: Record<Role, string> = {
  SUPER_ADMIN: "مدير النظام", EXECUTIVE: "الإدارة التنفيذية", DEPARTMENT_MANAGER: "مدير إدارة",
  DEPARTMENT_MEMBER: "موظف / عضو إدارة", VIEWER: "مشاهدة فقط",
};

export default async function UsersPage() {
  const actor = await requireAction("manage");
  const [users, departments] = await Promise.all([
    db.user.findMany({ where: { organizationId: actor.organizationId }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { organizationId: actor.organizationId! }, orderBy: { name: "asc" } }),
  ]);
  return <DashboardShell><div className="p-5 lg:p-8"><div><h1 className="text-2xl font-bold">المستخدمون والصلاحيات</h1><p className="mt-1 text-sm text-slate-500">يُنشأ المستخدم تلقائيًا عند أول دخول بحساب Microsoft، ثم يحدد مدير النظام إدارته ودوره.</p></div><div className="card mt-6 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4 text-right">المستخدم</th><th className="p-4 text-right">البريد</th><th className="p-4 text-right">الإدارة</th><th className="p-4 text-right">الدور</th><th className="p-4 text-right">الحالة</th><th className="p-4">حفظ</th></tr></thead><tbody>{users.map((user) => <tr className="border-t" key={user.id}><td className="p-4 font-bold">{user.name}</td><td className="p-4 text-slate-500">{user.email}</td><td colSpan={4} className="p-3"><form action={updateUserAccess} className="grid grid-cols-[1fr_1fr_120px_80px] gap-2"><input type="hidden" name="userId" value={user.id}/><select name="departmentId" defaultValue={user.departmentId ?? ""} className="rounded-lg border p-2"><option value="">بدون إدارة</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select name="role" defaultValue={user.role} className="rounded-lg border p-2">{Object.values(Role).map((role) => <option key={role} value={role}>{roleNames[role]}</option>)}</select><select name="active" defaultValue={String(user.active)} className="rounded-lg border p-2"><option value="true">نشط</option><option value="false">موقوف</option></select><button className="rounded-lg bg-emerald-700 px-3 font-bold text-white">حفظ</button></form></td></tr>)}</tbody></table>{users.length === 0 && <div className="p-10 text-center text-slate-500">لم يسجل أي مستخدم من الشركة بعد.</div>}</div></div></DashboardShell>;
}
