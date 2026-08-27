import { Role } from "@prisma/client";
import { CheckCircle2, FileText, Plug, RefreshCw } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { getMicrosoftAccessToken } from "@/services/microsoft-graph/token";
import { MicrosoftGraphClient } from "@/services/microsoft-graph/client";
import { PlannerService } from "@/services/planner/service";
import { SharePointService, type SharePointFile } from "@/services/sharepoint/service";
import { activateMicrosoftConnection, assignCatalogPlan, syncMappedPlan } from "./actions";

export const dynamic = "force-dynamic";

export default async function Integrations({ searchParams }: { searchParams: Promise<{ sync?: string; mapping?: string }> }) {
  const result = await searchParams;
  const user = await requirePage("integrations");
  const isAdmin = user.role === Role.SUPER_ADMIN;
  const account = await db.account.findFirst({ where: { userId: user.id, provider: "microsoft-entra-id" } });
  const connection = account ? await db.plannerConnection.findUnique({ where: { organizationId_microsoftUserId: { organizationId: user.organizationId!, microsoftUserId: account.providerAccountId } } }) : null;
  const connections = isAdmin ? await db.plannerConnection.findMany({ where: { organizationId: user.organizationId! }, orderBy: { lastSyncAt: "desc" } }) : connection ? [connection] : [];
  const catalog = connections.length ? await db.plannerPlanMapping.findMany({ where: { connectionId: { in: connections.map((item) => item.id) } }, orderBy: { planTitle: "asc" } }) : [];
  const initiatives = isAdmin ? await db.initiative.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }) : [];
  const ownerAccounts = connections.length ? await db.account.findMany({ where: { provider: "microsoft-entra-id", providerAccountId: { in: connections.map((item) => item.microsoftUserId) } }, select: { providerAccountId: true, userId: true } }) : [];
  const ownerUsers = ownerAccounts.length ? await db.user.findMany({ where: { id: { in: ownerAccounts.map((item) => item.userId) } }, select: { id: true, name: true, email: true } }) : [];
  const userById = new Map(ownerUsers.map((item) => [item.id, item]));
  const ownerByMicrosoftId = new Map(ownerAccounts.map((item) => [item.providerAccountId, userById.get(item.userId)]));
  const connectionById = new Map(connections.map((item) => [item.id, item]));

  let plans: Array<{ id: string; title: string }> = [];
  let files: SharePointFile[] = [];
  let graphStatus = account ? "يتطلب إعادة الموافقة على الصلاحيات" : "سجل الدخول بحساب Microsoft أولًا";
  if (account) {
    try {
      const graph = new MicrosoftGraphClient(await getMicrosoftAccessToken(user.id));
      plans = (await new PlannerService(graph).getMyPlans()).value;
      const sharePoint = new SharePointService(graph);
      const hostname = readEnv("SHAREPOINT_SITE_HOSTNAME");
      const path = readEnv("SHAREPOINT_SITE_PATH");
      files = hostname && path ? (await sharePoint.rootFiles((await sharePoint.resolveSite(hostname, path)).id)).value : (await sharePoint.recentFiles()).value;
      graphStatus = "متصل وجاهز";
    } catch {
      graphStatus = "يلزم تسجيل الخروج والدخول لتجديد تفويض Microsoft 365";
    }
  }

  return <DashboardShell><div className="p-5 lg:p-8"><h1 className="text-2xl font-bold">التكاملات</h1><p className="text-sm text-slate-500">خططك تسجل تلقائيًا، والسوبر أدمن يعتمد الربط الاستراتيجي والمزامنة</p>
    {result.mapping==="saved"&&<div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">تم اعتماد الربط. يمكنك الآن الضغط على «مزامنة بتفويض المالك» للخطة نفسها.</div>}
    {result.sync==="success"&&<div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">اكتملت مزامنة Planner بنجاح، وتم تحديث المهام.</div>}
    {result.sync==="reconnect"&&<div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900">تعذر تجديد تفويض Microsoft. يجب على مالك الخطة تسجيل الخروج من المنصة ثم الدخول مرة أخرى، وبعدها أعد المزامنة.</div>}
    {result.sync==="failed"&&<div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-800">فشلت المزامنة. تم حفظ تفاصيل المحاولة في سجل المزامنة، ولم تُحذف أي بيانات سابقة.</div>}
    <section className="card mt-6 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-4"><span className="rounded-2xl bg-blue-50 p-4 text-blue-700"><Plug/></span><div><h2 className="text-lg font-bold">Microsoft Planner</h2><p className="mt-1 text-sm text-slate-500">المهام والخطط المتاحة لحساب Microsoft الحالي</p><span className={`badge mt-3 ${connection ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{graphStatus}</span></div></div>{account&&<form action={activateMicrosoftConnection}><button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">تحديث خططي من Planner</button></form>}</div><div className="mt-6 grid gap-3 border-t pt-5 sm:grid-cols-3"><div><p className="text-xs text-slate-500">جدول المزامنة</p><b className="text-sm">{connection?.syncSchedule ?? "EVERY_6_HOURS"}</b></div><div><p className="text-xs text-slate-500">آخر مزامنة</p><b className="text-sm">{connection?.lastSyncAt?.toLocaleString("ar-SA") ?? "—"}</b></div><div><p className="text-xs text-slate-500">خططي المتاحة</p><b className="text-sm">{plans.length}</b></div></div></section>
    {!isAdmin&&<section className="card mt-5 p-6"><h2 className="font-bold">خططي في Planner</h2><p className="mt-1 text-sm text-slate-500">لا يمكنك رؤية إلا الخطط التي منحك Microsoft وصولًا إليها. تظهر المهام المسندة لك بعد اعتماد الخطة ومزامنتها.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{plans.map((plan)=><div key={plan.id} className="rounded-xl border p-4"><b>{plan.title}</b><p className="mt-1 text-xs text-slate-400">{plan.id}</p></div>)}{plans.length===0&&<p className="text-sm text-slate-500">لا توجد خطط متاحة لهذا الحساب.</p>}</div></section>}
    {isAdmin&&<section className="card mt-5 p-6"><div className="flex items-center gap-3"><RefreshCw className="text-teal-700"/><div><h2 className="font-bold">دليل خطط Planner المؤسسي</h2><p className="text-sm text-slate-500">الخطوة الأولى: اختر مبادرة واعتمد الربط. الخطوة الثانية: نفّذ المزامنة بتفويض مالك الخطة.</p></div></div><div className="mt-5 space-y-3">{catalog.map((mapping)=>{const source=connectionById.get(mapping.connectionId);const owner=source?ownerByMicrosoftId.get(source.microsoftUserId):undefined;return <div key={mapping.id} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[1fr_220px_1fr_auto]"><div><b>{mapping.planTitle}</b><p className="text-xs text-slate-400">{mapping.externalPlanId}</p></div><div className="text-sm"><p className="text-xs text-slate-500">مصدر التفويض</p><b>{owner?.name??"مستخدم Microsoft"}</b><p className="text-xs text-slate-400">{owner?.email}</p></div><form action={assignCatalogPlan} className="contents"><input type="hidden" name="mappingId" value={mapping.id}/><select name="initiativeId" defaultValue={mapping.initiativeId??""} required className="rounded-lg border p-2"><option value="">اختر المبادرة الاستراتيجية</option>{initiatives.map((initiative)=><option key={initiative.id} value={initiative.id}>{initiative.title}</option>)}</select><button className="rounded-lg bg-teal-700 px-4 py-2 text-white">اعتماد الربط</button></form>{mapping.initiativeId?<form action={syncMappedPlan} className="lg:col-start-4"><input type="hidden" name="planMappingId" value={mapping.id}/><button className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800">مزامنة بتفويض المالك</button></form>:<span className="rounded-lg bg-slate-100 px-4 py-2 text-center text-xs text-slate-500 lg:col-start-4">اعتمد الربط أولًا</span>}</div>})}{catalog.length===0&&<p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">سيظهر الدليل بعد أول تسجيل دخول لمستخدم لديه خطط Planner.</p>}</div></section>}
    <section className="card mt-5 p-6"><div className="flex items-center gap-3"><FileText className="text-blue-700"/><div><h2 className="font-bold">ملفات SharePoint وOneDrive</h2><p className="text-sm text-slate-500">تظهر الملفات التي يسمح Microsoft لهذا المستخدم بقراءتها فقط</p></div></div><div className="mt-5 divide-y">{files.slice(0,20).map((file)=><a key={file.id} href={file.webUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 py-3 text-sm hover:text-blue-700"><span>{file.name}</span><span className="text-xs text-slate-400">{new Date(file.lastModifiedDateTime).toLocaleDateString("ar-SA")}</span></a>)}{files.length===0&&<p className="py-5 text-sm text-slate-500">لا توجد ملفات متاحة للحساب الحالي.</p>}</div></section>
    <div className="mt-5 flex items-center gap-2 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"><CheckCircle2 size={18}/>لا يحتاج السوبر أدمن أن يكون عضوًا في الخطة؛ المزامنة تستخدم تفويض المستخدم الذي اكتشفها.</div>
  </div></DashboardShell>;
}
