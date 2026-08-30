import { Role, WorkStatus } from "@prisma/client";
import { CheckCircle2, Clock3, ListChecks, UserRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { assignTask, updateTaskProgress } from "./actions";

export const dynamic = "force-dynamic";

const statusNames: Record<WorkStatus, string> = {
  NOT_STARTED: "لم تبدأ", IN_PROGRESS: "جاري العمل", ON_TRACK: "على المسار",
  NEEDS_ATTENTION: "تحتاج انتباه", OVERDUE: "متأخرة", BLOCKED: "متعثرة",
  COMPLETED: "مكتملة", PAUSED: "متوقفة",
};

export default async function TasksPage() {
  const user = await requirePage("tasks");
  const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const initiatives = await db.initiative.findMany({
    where: visible === null ? {} : { departmentId: { in: visible } },
    select: { id: true, title: true, departmentId: true },
  });
  const tasks = await db.task.findMany({
    where: { initiativeId: { in: initiatives.map((item) => item.id) } },
    orderBy: [{ updatedAt: "desc" }, { dueDate: "asc" }],
    take: 50,
  });
  const externalIds = tasks.flatMap((task) => task.externalId ? [task.externalId] : []);
  const [externalTasks, account, members, recentUpdates] = await Promise.all([
    externalIds.length ? db.externalEntity.findMany({ where: { provider: "MICROSOFT_PLANNER", entityType: "TASK", externalId: { in: externalIds } } }) : [],
    db.account.findFirst({ where: { userId: user.id, provider: "microsoft-entra-id" }, select: { providerAccountId: true } }),
    db.user.findMany({
      where: { organizationId: user.organizationId, active: true, ...(visible === null ? {} : { departmentId: { in: visible } }) },
      select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" },
    }),
    db.taskUpdate.findMany({ where: { taskId: { in: tasks.map((task) => task.id) } }, orderBy: { createdAt: "desc" }, take: 80 }),
  ]);
  const initiativeById = new Map(initiatives.map((item) => [item.id, item]));
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const payloadByExternalId = new Map(externalTasks.map((item) => [item.externalId, item.payload]));
  const updateAuthorIds = [...new Set(recentUpdates.map((update) => update.updatedById))];
  const updateAuthors = updateAuthorIds.length ? await db.user.findMany({ where: { id: { in: updateAuthorIds } }, select: { id: true, name: true } }) : [];
  const authorNames = new Map(updateAuthors.map((author) => [author.id, author.name]));
  const updatesByTask = new Map<string, typeof recentUpdates>();
  for (const update of recentUpdates) updatesByTask.set(update.taskId, [...(updatesByTask.get(update.taskId) ?? []), update]);

  const visibleTasks = tasks.filter((task) => {
    if (user.role !== Role.DEPARTMENT_MEMBER && user.role !== Role.VIEWER) return true;
    if (task.assigneeId === user.id) return true;
    const payload = task.externalId ? payloadByExternalId.get(task.externalId) : undefined;
    const raw = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
    const assignments = raw.assignments && typeof raw.assignments === "object" && !Array.isArray(raw.assignments) ? Object.keys(raw.assignments as Record<string, unknown>) : [];
    return Boolean(account && assignments.includes(account.providerAccountId));
  });

  return <DashboardShell><div className="p-5 lg:p-8">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><ListChecks/></span><div><h1 className="text-2xl font-bold">المهام والتحديثات</h1><p className="text-sm text-slate-500">كل موظف يحدّث مهامه المسندة، والمدير يتابع مهام إدارته وسجل التغييرات · تعرض أحدث 50 مهمة</p></div></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="card p-4"><p className="text-xs text-slate-500">المهام الظاهرة</p><b className="text-2xl">{visibleTasks.length}</b></div><div className="card p-4"><p className="text-xs text-slate-500">مكتملة</p><b className="text-2xl text-emerald-700">{visibleTasks.filter((task)=>task.status===WorkStatus.COMPLETED).length}</b></div><div className="card p-4"><p className="text-xs text-slate-500">تحتاج متابعة</p><b className="text-2xl text-amber-700">{visibleTasks.filter((task)=>task.status===WorkStatus.OVERDUE||task.status===WorkStatus.BLOCKED||task.status===WorkStatus.NEEDS_ATTENTION).length}</b></div></div>
    <div className="mt-5 space-y-4">{visibleTasks.map((task)=>{const initiative=initiativeById.get(task.initiativeId);const canEdit=user.role===Role.SUPER_ADMIN||user.role===Role.DEPARTMENT_MANAGER||task.assigneeId===user.id||(user.role===Role.DEPARTMENT_MEMBER);const history=updatesByTask.get(task.id)??[];return <article key={task.id} className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{task.title}</h2><p className="mt-1 text-sm text-slate-500">{initiative?.title}</p></div><span className="badge bg-blue-50 text-blue-700">{statusNames[task.status]}</span></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div className="flex items-center gap-2"><UserRound size={16}/>{task.assigneeId?memberNames.get(task.assigneeId)??"مستخدم":"غير مسند داخليًا"}</div><div className="flex items-center gap-2"><Clock3 size={16}/>{task.dueDate?.toLocaleDateString("ar-SA")??"بلا موعد"}</div><div className="flex items-center gap-2"><CheckCircle2 size={16}/>{task.percentComplete}% إنجاز</div></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{width:`${task.percentComplete}%`}}/></div>
      {(user.role===Role.SUPER_ADMIN||user.role===Role.DEPARTMENT_MANAGER)&&<form action={assignTask} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="taskId" value={task.id}/><select name="assigneeId" defaultValue={task.assigneeId??""} className="min-w-64 rounded-lg border p-2 text-sm"><option value="">غير مسند داخليًا</option>{members.filter((member)=>!initiative||member.departmentId===initiative.departmentId).map((member)=><option key={member.id} value={member.id}>{member.name}</option>)}</select><button className="rounded-lg border px-4 py-2 text-sm font-medium">حفظ المسؤول</button></form>}
      {canEdit&&<details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer font-bold text-teal-800">إضافة تحديث على المهمة</summary><form action={updateTaskProgress} className="mt-4 grid gap-3 md:grid-cols-2"><input type="hidden" name="taskId" value={task.id}/><label className="text-sm">نسبة الإنجاز<input name="progress" type="number" min="0" max="100" defaultValue={task.percentComplete} required className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-sm">الحالة<select name="status" defaultValue={task.status} className="mt-1 w-full rounded-lg border p-2">{Object.values(WorkStatus).map((status)=><option key={status} value={status}>{statusNames[status]}</option>)}</select></label><textarea name="note" required minLength={3} placeholder="ما الذي تم إنجازه؟" className="rounded-lg border p-3 md:col-span-2"/><textarea name="challenges" placeholder="التحديات أو العوائق" className="rounded-lg border p-3"/><textarea name="nextSteps" placeholder="الخطوات القادمة" className="rounded-lg border p-3"/><input name="evidenceUrl" type="url" placeholder="رابط الدليل أو الملف (اختياري)" className="rounded-lg border p-3 md:col-span-2"/><button className="rounded-lg bg-teal-700 px-5 py-3 font-bold text-white md:col-span-2">حفظ التحديث</button></form></details>}
      {history.length>0&&<details className="mt-3 rounded-xl bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-bold">سجل التحديثات ({history.length})</summary><div className="mt-3 space-y-3">{history.map((update)=><div key={update.id} className="border-r-2 border-teal-500 pr-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{authorNames.get(update.updatedById)??"مستخدم"}: {update.previousProgress}% ← {update.currentProgress}%</b><span className="text-xs text-slate-400">{update.createdAt.toLocaleString("ar-SA")}</span></div><p className="mt-1 text-slate-600">{update.note}</p>{update.challenges&&<p className="mt-1 text-amber-700">التحدي: {update.challenges}</p>}</div>)}</div></details>}
    </article>})}{visibleTasks.length===0&&<div className="card p-12 text-center text-slate-500">لا توجد مهام مسندة ضمن نطاقك حاليًا.</div>}</div>
  </div></DashboardShell>;
}
