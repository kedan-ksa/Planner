"use server";

import { ReportStatus, ReportType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction, requireUser } from "@/lib/authz";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { can } from "@/lib/rbac";
import { canTransitionReport } from "@/lib/report-workflow";
import { createApprovalChain } from "@/lib/approval-workflow";

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
  const existing = await db.report.findFirst({
    where: { periodId: period.id, departmentId: department.id, type: period.type as ReportType, status: { not: ReportStatus.ARCHIVED } },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/reports");
    return;
  }
  await db.report.create({ data: { periodId: period.id, departmentId: department.id, title: `تقرير ${department.name} — ${period.name}`, type: period.type as ReportType, status: ReportStatus.DRAFT, completion: 20, summary: `مسودة آلية تشمل ${initiatives} مبادرات و${kpis} مؤشرات أداء.` } });
  revalidatePath("/reports");
}

const contentSchema = z.object({
  reportId: z.string().cuid(),
  summary: z.string().trim().min(3).max(12000),
  achievements: z.string().trim().min(3).max(12000),
  challenges: z.string().trim().max(12000).optional(),
  recommendations: z.string().trim().max(12000).optional(),
  nextSteps: z.string().trim().min(3).max(12000),
});
export async function updateReportContent(formData: FormData) {
  const user = await requireAction("update");
  const data = contentSchema.parse(Object.fromEntries(formData));
  const report = await db.report.findUniqueOrThrow({ where: { id: data.reportId } });
  const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  if (visible !== null && (!report.departmentId || !visible.includes(report.departmentId))) throw new Error("FORBIDDEN");
  if (report.status === ReportStatus.SUBMITTED || report.status === ReportStatus.APPROVED || report.status === ReportStatus.ARCHIVED) throw new Error("REPORT_LOCKED");
  const completion = [data.summary, data.achievements, data.challenges, data.recommendations, data.nextSteps].filter((value) => value?.trim()).length * 20;
  await db.report.update({ where: { id: report.id }, data: { summary: data.summary, achievements: data.achievements, challenges: data.challenges || null, recommendations: data.recommendations || null, nextSteps: data.nextSteps, completion, templateKey: report.templateKey ?? "department-standard-v1", templateData: { sections: ["summary", "achievements", "challenges", "recommendations", "nextSteps"] } } });
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
  if (["start", "ready"].includes(intent) && !can(user.role, "update")) throw new Error("FORBIDDEN");
  const next = {
    start: ReportStatus.IN_PROGRESS,
    ready: ReportStatus.READY_FOR_REVIEW,
    submit: ReportStatus.SUBMITTED,
    approve: ReportStatus.APPROVED,
    return: ReportStatus.RETURNED,
    archive: ReportStatus.ARCHIVED,
  }[intent];
  if (!canTransitionReport(report.status, intent)) throw new Error("INVALID_REPORT_TRANSITION");
  if (["submit", "archive"].includes(intent) && !manager) throw new Error("FORBIDDEN");
  if (["approve", "return"].includes(intent) && !approver) throw new Error("FORBIDDEN");
  if (intent === "approve") {
    const pending = await db.approval.count({ where: { reportId, status: "PENDING" } });
    if (pending) throw new Error("USE_APPROVAL_CENTER");
  }
  await db.report.update({ where: { id: reportId }, data: { status: next, completion: intent === "approve" ? 100 : report.completion, submittedAt: intent === "submit" ? new Date() : report.submittedAt, approvedAt: intent === "approve" ? new Date() : report.approvedAt } });
  if (intent === "submit" && report.departmentId && user.organizationId) {
    const existingApprovals = await db.approval.count({ where: { reportId } });
    if (!existingApprovals) await createApprovalChain({ organizationId: user.organizationId, departmentId: report.departmentId, entityType: "REPORT", entityId: report.id, reportId: report.id, requestedById: user.id });
  }
  revalidatePath("/reports");
  revalidatePath("/approvals");
}
