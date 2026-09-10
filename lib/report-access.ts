import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import type { Role } from "@prisma/client";

export type ReportActor = { id: string; role: Role; organizationId?: string | null; departmentId?: string | null };
export async function reportDepartmentIds(user: ReportActor) {
  if (!user.organizationId) return [];
  const scope = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const departments = await db.department.findMany({ where: { organizationId: user.organizationId, ...(scope === null ? {} : { id: { in: scope } }) }, select: { id: true } });
  return departments.map((department) => department.id);
}
export async function getScopedReport(user: ReportActor, id: string) {
  const ids = await reportDepartmentIds(user);
  const report = await db.report.findFirst({ where: { id, departmentId: { in: ids } } });
  if (!report) throw new Error("REPORT_NOT_ACCESSIBLE");
  return report;
}

// Assignment grants review access only; editing still uses getScopedReport.
export async function getReportForPreview(user: ReportActor, id: string) {
  const ids = await reportDepartmentIds(user);
  const report = await db.report.findFirst({ where: { id } });
  if (!report?.departmentId || !user.organizationId) throw new Error("REPORT_NOT_ACCESSIBLE");
  const department = await db.department.findFirst({ where: { id: report.departmentId, organizationId: user.organizationId }, select: { id: true } });
  if (!department) throw new Error("REPORT_NOT_ACCESSIBLE");
  if (report.departmentId && ids.includes(report.departmentId)) return report;
  if (user.role === "VIEWER") throw new Error("REPORT_NOT_ACCESSIBLE");
  const assigned = await db.approval.findFirst({ where: { reportId: id, approverId: user.id, entityType: "REPORT", status: "PENDING" }, select: { id: true } });
  if (!assigned || report.status !== "SUBMITTED") throw new Error("REPORT_NOT_ACCESSIBLE");
  return report;
}
