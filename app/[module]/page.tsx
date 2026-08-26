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
    case "objectives": {
      const objectives = await db.strategicObjective.findMany({ orderBy: { title: "asc" } });
      const axes = await db.strategicAxis.findMany({ select: { id: true, title: true } });
      const departments = await db.department.findMany({ select: { id: true, name: true } });
      const axisNames = new Map(axes.map((axis) => [axis.id, axis.title]));
      const departmentNames = new Map(departments.map((department) => [department.id, department.name]));

      return objectives.map((item) => [
        item.title,
        axisNames.get(item.axisId) ?? "غير محدد",
        item.departmentId ? departmentNames.get(item.departmentId) ?? "غير محدد" : "غير محدد",
        `${Number(item.progress)}%`,
        item.status,
      ]);
    }
    case "kpis":
      return (await db.kPI.findMany({ orderBy: { name: "asc" } })).map((item) => [item.name, `${Number(item.target)}${item.unit ?? ""}`, item.currentValue === null ? "لم يُحدّث" : `${Number(item.currentValue)}${item.unit ?? ""}`, item.currentValue === null || Number(item.target) === 0 ? "—" : `${Math.round((Number(item.currentValue) / Number(item.target)) * 100)}%`, item.currentValue === null ? "بانتظار التحديث" : "محدّث"]);
    case "departments": {
      // Keep this as two simple queries. Prisma's nested relation-count query
      // can leave the node-postgres driver waiting indefinitely in a Worker,
      // even when the same database is reached through Hyperdrive.
      const departments = await db.department.findMany({ orderBy: { name: "asc" } });
      const initiatives = await db.initiative.findMany({ select: { departmentId: true } });
      const initiativeCounts = new Map<string, number>();

      for (const initiative of initiatives) {
        initiativeCounts.set(
          initiative.departmentId,
          (initiativeCounts.get(initiative.departmentId) ?? 0) + 1,
        );
      }

      return departments.map((item) => [item.name, item.code, "—", String(initiativeCounts.get(item.id) ?? 0), "—"]);
    }
    case "initiatives": {
      const initiatives = await db.initiative.findMany({
        orderBy: { title: "asc" },
        select: {
          title: true,
          departmentId: true,
          dueDate: true,
          progress: true,
          status: true,
        },
      });
      const departments = await db.department.findMany({ select: { id: true, name: true } });
      const departmentNames = new Map(departments.map((department) => [department.id, department.name]));

      return initiatives.map((item) => [
        item.title,
        departmentNames.get(item.departmentId) ?? "غير محدد",
        item.dueDate.toLocaleDateString("ar-SA"),
        `${Number(item.progress)}%`,
        item.status,
      ]);
    }
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
