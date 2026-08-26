import Link from "next/link";
import type { Role } from "@prisma/client";
import { LayoutDashboard, Target, Milestone, Lightbulb, Gauge, Building2, ListChecks, FileText, ShieldAlert, BadgeCheck, Bell, Plug, Users, Settings, Compass } from "lucide-react";

const links = [
  ["الرئيسية", LayoutDashboard, "/"], ["الخطة الاستراتيجية", Compass, "/strategy"], ["المحاور", Milestone, "/axes"],
  ["الأهداف", Target, "/objectives"], ["المبادرات", Lightbulb, "/initiatives"], ["المؤشرات", Gauge, "/kpis"],
  ["الأقسام", Building2, "/departments"], ["المهام", ListChecks, "/tasks"], ["التقارير", FileText, "/reports"],
  ["المخاطر والتحديات", ShieldAlert, "/risks"], ["الاعتمادات", BadgeCheck, "/approvals"], ["التنبيهات", Bell, "/notifications"],
  ["التكاملات", Plug, "/settings/integrations"], ["المستخدمون", Users, "/users"], ["الإعدادات", Settings, "/settings"],
] as const;

export function Sidebar({ role }: { role: Role }) {
  const visible = links.filter(([, , href]) => role === "SUPER_ADMIN" || !["/users", "/settings", "/settings/integrations"].includes(href));
  return <aside className="fixed inset-y-0 right-0 hidden w-64 flex-col bg-[#123b38] p-5 text-white lg:flex"><div className="flex items-center gap-3 border-b border-white/10 pb-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/20 font-bold text-emerald-300">SP</div><div><div className="font-bold">الأداء الاستراتيجي</div><div className="text-xs text-emerald-100/60">مركز القيادة التنفيذي</div></div></div><nav className="scrollbar mt-5 flex-1 space-y-1 overflow-y-auto">{visible.map(([label, Icon, href], index) => <Link key={href} href={href} prefetch={false} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${index === 0 ? "bg-white/12 text-white" : "text-emerald-50/70 hover:bg-white/8 hover:text-white"}`}><Icon size={18}/>{label}</Link>)}</nav><div className="rounded-xl bg-white/8 p-3 text-xs text-emerald-50/70">Microsoft Planner<br/><span className="text-white">المزامنة حسب إعداد المؤسسة</span></div></aside>;
}
