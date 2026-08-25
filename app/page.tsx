import { Gauge, Lightbulb, Target, TriangleAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [axes, initiatives, kpiCount, updatedKpis, departments] = await Promise.all([
    db.strategicAxis.findMany({ orderBy: { title: "asc" } }),
    db.initiative.findMany({ include: { department: true }, orderBy: { progress: "asc" }, take: 8 }),
    db.kPI.count(),
    db.kPI.count({ where: { currentValue: { not: null } } }),
    db.department.count(),
  ]);
  const overall = axes.length ? Math.round(axes.reduce((sum, axis) => sum + Number(axis.progress), 0) / axes.length) : 0;
  const attention = initiatives.filter((item) => ["NEEDS_ATTENTION", "OVERDUE", "BLOCKED"].includes(item.status)).length;

  return <DashboardShell><div className="p-5 lg:p-8">
    <div><div className="text-sm font-medium text-emerald-700">نظرة الإدارة العليا</div><h1 className="mt-1 text-2xl font-bold lg:text-3xl">أداء شركة كدان</h1><p className="mt-1 text-sm text-slate-500">بيانات الخطة الاستراتيجية المستوردة من الملفات المعتمدة</p></div>
    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="الأداء العام" value={`${overall}%`} detail={`${axes.length} محاور استراتيجية`} icon={Gauge} />
      <StatCard label="إجمالي المبادرات" value={String(initiatives.length)} detail={`${departments} إدارات وأقسام`} icon={Lightbulb} tone="blue" />
      <StatCard label="المؤشرات المحدثة" value={`${updatedKpis} / ${kpiCount}`} detail="تنتظر القيم الفعلية من الإدارات وPlanner" icon={Target} />
      <StatCard label="تحتاج تدخلاً" value={String(attention)} detail="مبادرات متأخرة أو متعثرة" icon={TriangleAlert} tone="red" />
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-3">
      <div className="card p-6 xl:col-span-2"><h2 className="font-bold">أداء المحاور الاستراتيجية</h2><p className="text-sm text-slate-500">النسبة الموزونة المحسوبة من قاعدة البيانات</p><div className="mt-7 space-y-5">{axes.map((axis) => <div key={axis.id}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{axis.title}</span><b>{Number(axis.progress)}%</b></div><div className="h-2.5 rounded-full bg-slate-100"><div className={`h-full rounded-full ${Number(axis.progress) >= 90 ? "bg-emerald-500" : Number(axis.progress) >= 70 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${Number(axis.progress)}%` }} /></div></div>)}</div></div>
      <div className="card p-6"><h2 className="font-bold">جاهزية البيانات</h2><p className="mt-2 text-sm text-slate-500">تم استيراد هيكل الخطة والمستهدفات. تبدأ نسبة الإنجاز بالظهور بعد تحديث القيم الفعلية أو مزامنة Planner.</p><div className="mt-6 text-center"><b className="text-4xl text-emerald-700">{kpiCount}</b><div className="text-sm text-slate-500">مؤشر أداء</div></div></div>
    </section>
    <section className="card mt-5 overflow-hidden"><div className="p-6"><h2 className="font-bold">المبادرات التي تحتاج اهتمامًا</h2><p className="text-sm text-slate-500">مرتبطة بقاعدة البيانات وليست بيانات تجريبية</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right">المبادرة</th><th className="p-3 text-right">الإدارة</th><th className="p-3">الإنجاز</th><th className="p-3">الحالة</th></tr></thead><tbody>{initiatives.length ? initiatives.map((item) => <tr key={item.id} className="border-t"><td className="p-4 font-medium">{item.title}</td><td className="p-4 text-slate-500">{item.department.name}</td><td className="p-4 text-center">{Number(item.progress)}%</td><td className="p-4 text-center">{item.status}</td></tr>) : <tr><td colSpan={4} className="p-10 text-center text-slate-400">لم تُعتمد مبادرات 2026 بعد؛ مسودة 2025 محفوظة للمراجعة.</td></tr>}</tbody></table></div></section>
  </div></DashboardShell>;
}
