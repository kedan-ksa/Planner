"use server";

import { Prisma, ReportStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction, requireUser } from "@/lib/authz";
import { getScopedReport, reportDepartmentIds } from "@/lib/report-access";
import { allowedReportIntent, canEditReport, reportReadiness } from "@/lib/report-content";
import { createApprovalChain } from "@/lib/approval-workflow";

const id = z.string().min(1).max(128);
const createSchema = z.object({ periodId: id, departmentId: id });
export async function createDepartmentReport(formData: FormData) {
  const user = await requireAction("update");
  const data = createSchema.parse(Object.fromEntries(formData));
  if (!(await reportDepartmentIds(user)).includes(data.departmentId)) throw new Error("FORBIDDEN");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Department" WHERE "id" = ${data.departmentId} FOR UPDATE`;
    const period = await tx.reportingPeriod.findUniqueOrThrow({ where: { id: data.periodId } });
    const department = await tx.department.findUniqueOrThrow({ where: { id: data.departmentId } });
    const existing = await tx.report.findFirst({ where: { periodId: period.id, departmentId: department.id, type: period.type, status: { not: "ARCHIVED" } } });
    if (existing) return;
    await tx.report.create({ data: { periodId: period.id, departmentId: department.id, title: `تقرير ${department.name} — ${period.name}`, type: period.type, completion: 0, templateKey: "department-standard-v1" } });
  }, { timeout: 20000 });
  revalidatePath("/reports");
}

const contentSchema = z.object({
  reportId: id, summary: z.string().trim().max(12000), achievements: z.string().trim().max(12000),
  challenges: z.string().trim().max(12000), recommendations: z.string().trim().max(12000), nextSteps: z.string().trim().max(12000),
});
export async function updateReportContent(formData: FormData) {
  const user = await requireAction("update");
  const { reportId, ...content } = contentSchema.parse(Object.fromEntries(formData));
  await getScopedReport(user, reportId);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Report" WHERE "id" = ${reportId} FOR UPDATE`;
    const report = await tx.report.findUniqueOrThrow({ where: { id: reportId } });
    if (!canEditReport(report.status, user.role)) throw new Error("REPORT_LOCKED");
    await tx.report.update({ where: { id: reportId }, data: { ...content, completion: reportReadiness(content).completion } });
    await tx.auditLog.create({ data: { userId: user.id, action: "REPORT_CONTENT_UPDATED", entityType: "Report", entityId: reportId,
      oldValue: { summary: report.summary, achievements: report.achievements, challenges: report.challenges, recommendations: report.recommendations, nextSteps: report.nextSteps }, newValue: content } });
  }, { timeout: 20000 });
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
}

const transitionSchema = z.object({ reportId: id, intent: z.enum(["start", "ready", "submit", "approve", "return", "archive"]), comment: z.string().trim().max(2000).optional() });
export async function transitionReport(formData: FormData) {
  const user = await requireUser();
  const { reportId, intent, comment } = transitionSchema.parse(Object.fromEntries(formData));
  await getScopedReport(user, reportId);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Report" WHERE "id" = ${reportId} FOR UPDATE`;
    const report = await tx.report.findUniqueOrThrow({ where: { id: reportId } });
    if (!allowedReportIntent(report.status, user.role, intent)) throw new Error("INVALID_REPORT_TRANSITION");
    if ((intent === "ready" || intent === "submit" || intent === "approve") && !reportReadiness(report).ready) throw new Error("REPORT_INCOMPLETE");
    if (intent === "return" && !comment) throw new Error("RETURN_REASON_REQUIRED");
    const templateData = report.templateData && typeof report.templateData === "object" && !Array.isArray(report.templateData) ? report.templateData : {};
    let nextTemplateData: Prisma.InputJsonValue = templateData as Prisma.InputJsonObject;
    if (intent === "approve" || intent === "return") {
      const pending = await tx.approval.count({ where: { reportId, status: "PENDING" } });
      if (pending) throw new Error("USE_APPROVAL_CENTER");
    }
    if (intent === "submit") {
      const chain = await createApprovalChain({ organizationId: user.organizationId!, departmentId: report.departmentId!, entityType: "REPORT", entityId: reportId, reportId, requestedById: user.id }, tx);
      nextTemplateData = { ...templateData, approvalIds: chain.map((item) => item.id) } as Prisma.InputJsonObject;
    }
    const next: ReportStatus = { start: "IN_PROGRESS", ready: "READY_FOR_REVIEW", submit: "SUBMITTED", approve: "APPROVED", return: "RETURNED", archive: "ARCHIVED" }[intent] as ReportStatus;
    await tx.report.update({ where: { id: reportId }, data: { status: next, templateData: nextTemplateData, completion: reportReadiness(report).completion,
      submittedAt: intent === "submit" ? new Date() : report.submittedAt, approvedAt: intent === "approve" ? new Date() : report.approvedAt } });
    await tx.auditLog.create({ data: { userId: user.id, action: "REPORT_STATUS_CHANGED", entityType: "Report", entityId: reportId, oldValue: { status: report.status }, newValue: { status: next, comment: comment ?? null } } });
  }, { timeout: 30000 });
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/approvals");
}
