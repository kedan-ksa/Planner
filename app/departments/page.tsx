import { DepartmentStatus, Role } from "@prisma/client";
import { Building2, Network, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { saveDepartment } from "./actions";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await requirePage("departments");
  const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const allDepartments = await db.department.findMany({ where: { organizationId: user.organizationId! }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const departments = visible === null ? allDepartments : allDepartments.filter((department) => visible.includes(department.id));
  const users = await db.user.findMany({ where: { organizationId: user.organizationId, active: true }, select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" } });
  const userNames = new Map(users.map((item) => [item.id, item.name]));
  const counts = new Map<string, number>();
  for (const member of users) if (member.departmentId) counts.set(member.departmentId, (counts.get(member.departmentId) ?? 0) + 1);
  const canManage = user.role === Role.SUPER_ADMIN;

  return <DashboardShell><div className="p-5 lg:p-8"><div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Network/></span><div><h1 className="text-2xl font-bold">الهيكل الإداري</h1><p className="text-sm text-slate-500">إدارات وأقسام متداخلة، مدير لكل وحدة، ونطاق صلاحيات ينتقل إلى الأقسام التابعة</p></div></div>
    {canManage&&<form action={saveDepartment} className="card mt-6 grid gap-3 p-5 md:grid-cols-3"><input name="name" required placeholder="اسم الإدارة أو القسم" className="rounded-lg border p-3"/><input name="code" required placeholder="الرمز مثل IT" className="rounded-lg border p-3"/><select name="parentId" className="rounded-lg border p-3"><option value="">وحدة رئيسية</option>{allDepartments.map((department)=><option key={department.id} value={department.id}>{department.name}</option>)}</select><select name="managerId" className="rounded-lg border p-3"><option value="">بدون مدير</option>{users.map((member)=><option key={member.id} value={member.id}>{member.name}</option>)}</select><select name="status" defaultValue={DepartmentStatus.ACTIVE} className="rounded-lg border p-3"><option value="ACTIVE">نشطة</option><option value="INACTIVE">غير نشطة</option></select><input name="sortOrder" type="number" min="0" defaultValue="0" className="rounded-lg border p-3"/><button className="rounded-lg bg-teal-700 px-5 py-3 font-bold text-white md:col-span-3">إضافة إلى الهيكل</button></form>}
    <div className="mt-5 space-y-3">{departments.map((department)=>{const depth=(()=>{let level=0;let current=department;while(current.parentId&&level<8){level++;current=allDepartments.find((item)=>item.id===current.parentId)??current;if(current.id===department.id)break;}return level;})();return <article key={department.id} className="card p-5" style={{marginRight:`${Math.min(depth,4)*20}px`}}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Building2 className="text-teal-700"/><div><h2 className="font-bold">{department.name}</h2><p className="text-xs text-slate-400">{department.code} · {department.parentId?"قسم تابع":"إدارة رئيسية"}</p></div></div><div className="flex gap-2 text-sm"><span className="badge bg-blue-50 text-blue-700">{userNames.get(department.managerId??"")??"لم يحدد مدير"}</span><span className="badge bg-slate-100 text-slate-700"><UsersRound size={14}/> {counts.get(department.id)??0}</span></div></div>
      {canManage&&<details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-teal-800">تعديل الوحدة</summary><form action={saveDepartment} className="mt-3 grid gap-2 md:grid-cols-3"><input type="hidden" name="departmentId" value={department.id}/><input name="name" defaultValue={department.name} required className="rounded-lg border p-2"/><input name="code" defaultValue={department.code} required className="rounded-lg border p-2"/><select name="parentId" defaultValue={department.parentId??""} className="rounded-lg border p-2"><option value="">وحدة رئيسية</option>{allDepartments.filter((item)=>item.id!==department.id).map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="managerId" defaultValue={department.managerId??""} className="rounded-lg border p-2"><option value="">بدون مدير</option>{users.map((member)=><option key={member.id} value={member.id}>{member.name}</option>)}</select><select name="status" defaultValue={department.status} className="rounded-lg border p-2"><option value="ACTIVE">نشطة</option><option value="INACTIVE">غير نشطة</option></select><input name="sortOrder" type="number" defaultValue={department.sortOrder} className="rounded-lg border p-2"/><button className="rounded-lg border border-teal-700 p-2 font-bold text-teal-800 md:col-span-3">حفظ التعديل</button></form></details>}
    </article>})}</div>
  </div></DashboardShell>;
}
