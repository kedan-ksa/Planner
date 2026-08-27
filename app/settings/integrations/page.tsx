import { CheckCircle2, FileText, Plug, RefreshCw } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { getMicrosoftAccessToken } from "@/services/microsoft-graph/token";
import { MicrosoftGraphClient } from "@/services/microsoft-graph/client";
import { PlannerService } from "@/services/planner/service";
import { SharePointService, type SharePointFile } from "@/services/sharepoint/service";
import { activateMicrosoftConnection, savePlanMapping, syncMappedPlan } from "./actions";

export const dynamic = "force-dynamic";

export default async function Integrations() {
  const user = await requirePage("integrations");
  const account = await db.account.findFirst({ where: { userId: user.id, provider: "microsoft-entra-id" } });
  const connection = account ? await db.plannerConnection.findUnique({ where: { organizationId_microsoftUserId: { organizationId: user.organizationId!, microsoftUserId: account.providerAccountId } } }) : null;
  const mappings = connection ? await db.plannerPlanMapping.findMany({ where: { connectionId: connection.id }, orderBy: { planTitle: "asc" } }) : [];
  const initiatives = await db.initiative.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } });
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
      graphStatus = "يلزم تسجيل الخروج والدخول لمنح أذونات Planner وSharePoint";
    }
  }
  const mapped = new Map(mappings.map((mapping) => [mapping.externalPlanId, mapping]));

  return <DashboardShell><div className="p-5 lg:p-8"><h1 className="text-2xl font-bold">التكاملات</h1><p className="text-sm text-slate-500">إدارة اتصال Microsoft 365 ومزامنة بيانات التنفيذ والملفات</p>
    <section className="card mt-6 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-4"><span className="rounded-2xl bg-blue-50 p-4 text-blue-700"><Plug/></span><div><h2 className="text-lg font-bold">Microsoft Planner</h2><p className="mt-1 text-sm text-slate-500">خطط ومجموعات ومهام عبر Microsoft Graph</p><span className={`badge mt-3 ${connection ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{graphStatus}</span></div></div>{!connection && <form action={activateMicrosoftConnection}><button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">تفعيل اتصال Microsoft 365</button></form>}</div><div className="mt-6 grid gap-3 border-t pt-5 sm:grid-cols-3"><div><p className="text-xs text-slate-500">جدول المزامنة</p><b className="text-sm">{connection?.syncSchedule ?? "EVERY_6_HOURS"}</b></div><div><p className="text-xs text-slate-500">آخر مزامنة</p><b className="text-sm">{connection?.lastSyncAt?.toLocaleString("ar-SA") ?? "—"}</b></div><div><p className="text-xs text-slate-500">الخطط المتاحة</p><b className="text-sm">{plans.length}</b></div></div></section>
    <section className="card mt-5 p-6"><div className="flex items-center gap-3"><RefreshCw className="text-teal-700"/><div><h2 className="font-bold">ربط خطط Planner بالمبادرات</h2><p className="text-sm text-slate-500">Plan → Initiative · Bucket → Phase · Task → Task</p></div></div><div className="mt-5 space-y-3">{plans.map((plan) => { const mapping = mapped.get(plan.id); return <div key={plan.id} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[1fr_1fr_auto]"><div><b>{plan.title}</b><p className="text-xs text-slate-500">{plan.id}</p></div><form action={savePlanMapping} className="contents"><input type="hidden" name="externalPlanId" value={plan.id}/><input type="hidden" name="planTitle" value={plan.title}/><select name="initiativeId" defaultValue={mapping?.initiativeId ?? ""} required className="rounded-lg border p-2"><option value="">اختر المبادرة الاستراتيجية</option>{initiatives.map((initiative) => <option key={initiative.id} value={initiative.id}>{initiative.title}</option>)}</select><button className="rounded-lg bg-teal-700 px-4 text-white">حفظ الربط</button></form>{mapping?.initiativeId && <form action={syncMappedPlan} className="lg:col-start-3"><input type="hidden" name="planMappingId" value={mapping.id}/><button className="rounded-lg border px-4 py-2 text-sm">مزامنة الآن</button></form>}</div>; })}{plans.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">لا توجد خطط ظاهرة بعد. قد يلزم منح موافقة Microsoft Graph أو أن يكون الحساب عضوًا في خطة Planner.</p>}</div></section>
    <section className="card mt-5 p-6"><div className="flex items-center gap-3"><FileText className="text-blue-700"/><div><h2 className="font-bold">ملفات SharePoint وOneDrive</h2><p className="text-sm text-slate-500">عرض الملفات المتاحة لحسابك مع احترام صلاحيات Microsoft الأصلية</p></div></div><div className="mt-5 divide-y">{files.slice(0,20).map((file) => <a key={file.id} href={file.webUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 py-3 text-sm hover:text-blue-700"><span>{file.name}</span><span className="text-xs text-slate-400">{new Date(file.lastModifiedDateTime).toLocaleDateString("ar-SA")}</span></a>)}{files.length === 0 && <p className="py-5 text-sm text-slate-500">لم تُجلب ملفات بعد؛ يلزم منح Files.Read.All وSites.Read.All ثم إعادة تسجيل الدخول.</p>}</div></section>
    <div className="mt-5 flex items-center gap-2 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"><CheckCircle2 size={18}/>معرّفات Microsoft الخارجية تمنع التكرار، وتبقى المحاور والأهداف والتقارير داخل المنصة.</div>
  </div></DashboardShell>;
}
