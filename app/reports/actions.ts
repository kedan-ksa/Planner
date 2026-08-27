"use server";

import { ReportStatus, ReportType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction, requireUser } from "@/lib/authz";
import { visibleDepartmentIds } from "@/lib/department-scope";

const createSchema = z.object({ periodId: z.string().cuid(), departmentId: z.string().cuid() });
export async function createDepartmentReport(formData: FormData) {
  const user = await requireAction("update");
  const data = createSchema.parse(Object.fromEntries(formData));
  const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  if (visible !== null && !visible.includes(data.departmentId)) throw new Error("FORBIDDEN");
  const [period, department, initiatives, kpis] = await Promise.all([
    db.reportingPeriod.findUniqueOrThrow({ where: { id: data.periodId } }),
    db.department.findFirstOrThrow({ where: { id: data.departmentId, organizationId: user.organizationId! } }),
    db.initiative.count({ where: { departmentId: data.departmentId } }),
    db.kPI.count({ where: { departmentId: data.departmentId } }),
  ]);
  await db.report.create({ data: { periodId: period.id, departmentId: department.id, title: `تقرير ${department.name} — ${period.name}`, type: period.type as ReportType, status: ReportStatus.DRAFT, completion: 20, summary: `مسودة آلية تشمل ${initiatives} مبادرات و${kpis} مؤشرات أداء.` } });
  revalidatePath("/reports");
}

const transitionSchema = z.object({ reportId: z.string().cuid(), intent: z.enum(["start", "ready", "submit", "approve", "return", "archive"]) });
export async function transitionReport(formData: FormData) {
  const user = await requireUser();
  const { reportId, intent } = transitionSchema.parse(Object.fromEntries(formData));
  const report = await db.report.findUniqueOrThrow({ where: { id: reportId } });
  const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  if (visible !== null && (!report.departmentId || !visible.includes(report.departmentId))) throw new Error("FORBIDDEN");
  const manager = user.role === Role.SUPER_ADMIN || user.role === Role.DEPARTMENT_MANAGER;
  const approver = user.role === Role.SUPER_ADMIN || user.role === Role.EXECUTIVE;
  const next = {
    start: ReportStatus.IN_PROGRESS,
    ready: ReportStatus.READY_FOR_REVIEW,
    submit: ReportStatus.SUBMITTED,
    approve: ReportStatus.APPROVED,
    return: ReportStatus.RETURNED,
    archive: ReportStatus.ARCHIVED,
  }[intent];
  if (["submit", "archive"].includes(intent) && !manager) throw new Error("FORBIDDEN");
  if (["approve", "return"].includes(intent) && !approver) throw new Error("FORBIDDEN");
  await db.report.update({ where: { id: reportId }, data: { status: next, completion: intent === "approve" ? 100 : report.completion, submittedAt: intent === "submit" ? new Date() : report.submittedAt, approvedAt: intent === "approve" ? new Date() : report.approvedAt } });
  revalidatePath("/reports");
}
