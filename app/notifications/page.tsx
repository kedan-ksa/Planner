import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

export const dynamic = "force-dynamic";

const categoryNames: Record<string, string> = {
  REPORTS: "تقارير",
  INITIATIVES: "مبادرات",
  KPI: "مؤشرات",
  RISKS: "مخاطر",
  APPROVALS: "اعتمادات",
  TASKS: "مهام",
  GENERAL: "عام",
};

function entityHref(entityType: string | null, entityId: string | null) {
  if (!entityId) return null;
  if (entityType === "Report") return `/reports/${entityId}`;
  if (entityType === "Risk") return "/risks";
  if (entityType === "KPI") return "/kpis";
  if (entityType === "Initiative") return `/initiatives#${entityId}`;
  if (entityType === "Task") return "/tasks";
  return null;
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ view?: string; category?: string }> }) {
  const filters = await searchParams;
  const user = await requirePage("notifications");
  const view = ["all", "unread", "important"].includes(filters.view ?? "") ? filters.view! : "all";
  const category = filters.category && Object.hasOwn(categoryNames, filters.category) ? filters.category : null;
  const base = { userId: user.id, ...(category ? { category } : {}) };
  const [notifications, unreadCount, importantCount] = await Promise.all([
    db.notification.findMany({
      where: { ...base, ...(view === "unread" ? { readAt: null } : {}), ...(view === "important" ? { important: true } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.count({ where: { userId: user.id, important: true, readAt: null } }),
  ]);

  return <DashboardShell><div className="p-5 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-3 text-amber-700"><Bell/></span><div><h1 className="text-2xl font-bold">مركز التنبيهات</h1><p className="text-sm text-slate-500">تنبيهاتك الشخصية الناتجة من الإسناد والتقارير والمخاطر والتكاملات.</p></div></div>{unreadCount > 0 && <form action={markAllNotificationsRead}><button className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold"><CheckCheck size={17}/>تحديد الكل كمقروء</button></form>}</div>
    <div className="mt-6 flex flex-wrap gap-2"><Link href="/notifications?view=all" className={`rounded-full px-4 py-2 text-sm ${view === "all" ? "bg-teal-700 text-white" : "bg-slate-100"}`}>الكل</Link><Link href="/notifications?view=unread" className={`rounded-full px-4 py-2 text-sm ${view === "unread" ? "bg-teal-700 text-white" : "bg-slate-100"}`}>غير المقروء ({unreadCount})</Link><Link href="/notifications?view=important" className={`rounded-full px-4 py-2 text-sm ${view === "important" ? "bg-teal-700 text-white" : "bg-slate-100"}`}>مهم ({importantCount})</Link>{Object.entries(categoryNames).map(([key, label]) => <Link key={key} href={`/notifications?view=${view}&category=${key}`} className={`rounded-full px-4 py-2 text-sm ${category === key ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-800"}`}>{label}</Link>)}</div>
    <div className="mt-5 space-y-3">{notifications.map((notification) => { const href = entityHref(notification.entityType, notification.entityId); return <article key={notification.id} className={`card border-r-4 p-5 ${notification.readAt ? "border-r-slate-200 opacity-75" : notification.important ? "border-r-red-500" : "border-r-teal-600"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-bold">{notification.title}</h2>{notification.important && <span className="badge bg-red-50 text-red-800">مهم</span>}<span className="badge bg-slate-100">{categoryNames[notification.category] ?? notification.category}</span></div><p className="mt-2 text-sm text-slate-600">{notification.body}</p><p className="mt-2 text-xs text-slate-400">{notification.createdAt.toLocaleString("ar-SA")}</p></div><div className="flex gap-2">{href && <Link href={href} className="rounded-lg border px-3 py-2 text-sm font-bold text-teal-800">فتح العنصر</Link>}{!notification.readAt && <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notification.id}/><button className="rounded-lg bg-slate-100 px-3 py-2 text-sm">تحديد كمقروء</button></form>}</div></div></article>; })}{notifications.length === 0 && <div className="card p-12 text-center text-slate-500">لا توجد تنبيهات في هذا العرض.</div>}</div>
  </div></DashboardShell>;
}
