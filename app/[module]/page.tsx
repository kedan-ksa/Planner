import { notFound } from "next/navigation";
import { Download, Plus, Search, SlidersHorizontal } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { db } from "@/lib/db";
import { modules } from "@/lib/module-config";

export const dynamic = "force-dynamic";

async function loadRows(module: string): Promise<string[][]> {
  switch (module) {
    case "axes":
      return (await db.strategicAxis.findMany({ orderBy: { title: "asc" } })).map((item) => [item.title, "—", String(item.startDate.getUTCFullYear()), `${Number(item.weight)}%`, `${Number(item.progress)}%`]);
    case "objectives":
      return (await db.strategicObjective.findMany({ include: { axis: true, department: true }, orderBy: { title: "asc" } })).map((item) => [item.title, item.axis.title, item.department?.name ?? "غير محدد", `${Number(item.progress)}%`, item.status]);
    case "kpis":
      return (await db.kPI.findMany({ orderBy: { name: "asc" } })).map((item) => [item.name, `${Number(item.target)}${item.unit ?? ""}`, item.currentValue === null ? "لم يُحدّث" : `${Number(item.currentValue)}${item.unit ?? ""}`, item.currentValue === null || Number(item.target) === 0 ? "—" : `${Math.round((Number(item.currentValue) / Number(item.target)) * 100)}%`, item.currentValue === null ? "بانتظار التحديث" : "محدّث"]);
    case "departments":
      return (await db.department.findMany({ include: { _count: { select: { initiatives: true } } }, orderBy: { name: "asc" } })).map((item) => [item.name, item.code, "—", String(item._count.initiatives), "—"]);
    case "initiatives":
      return (await db.initiative.findMany({ include: { department: true }, orderBy: { title: "asc" } })).map((item) => [item.title, item.department.name, item.dueDate.toLocaleDateString("ar-SA"), `${Number(item.progress)}%`, item.status]);
    default:
      return [];
  }
}

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const config = modules[module];
  if (!config) notFound();
  const Icon = config.icon;
  const rows = await loadRows(module);

  return <DashboardShell><div className="p-5 lg:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Icon /></span><div><h1 className="text-2xl font-bold">{config.title}</h1><p className="text-sm text-slate-500">{config.description}</p></div></div><button className="flex items-center gap-2 rounded-xl bg-[#178f89] px-4 py-2.5 text-sm font-bold text-white"><Plus size={17} />إضافة جديد</button></div>
    <div className="card mt-6 p-4"><div className="flex flex-wrap gap-3"><label className="flex min-w-64 flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3"><Search size={17} className="text-slate-400" /><input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="بحث ذكي..." /></label><button className="flex items-center gap-2 rounded-xl border px-4 text-sm"><SlidersHorizontal size={17} />الفلاتر</button><button className="flex items-center gap-2 rounded-xl border px-4 text-sm"><Download size={17} />تصدير</button></div></div>
    <div className="card mt-4 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{config.columns.map((column) => <th key={column} className="p-4 text-right">{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, rowIndex) => <tr key={`${module}-${rowIndex}`} className="border-t">{row.map((value, columnIndex) => <td key={`${rowIndex}-${columnIndex}`} className="p-4"><span className={columnIndex === row.length - 1 ? "badge bg-amber-50 text-amber-700" : ""}>{value}</span></td>)}</tr>) : <tr><td colSpan={config.columns.length} className="p-14 text-center text-slate-400">لا توجد بيانات بعد.</td></tr>}</tbody></table></div></div>
  </div></DashboardShell>;
}
