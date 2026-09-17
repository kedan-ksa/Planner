"use server";

import { ApprovalActorType, ApprovalStatus, ReportStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction, requireUser } from "@/lib/authz";

const workflowSchema = z.object({ name: z.string().trim().min(3).max(120), departmentId: z.string().cuid(), entityType: z.literal("REPORT") });
export async function createApprovalWorkflow(formData: FormData) {
  const user = await requireAction("manage");
  const data = workflowSchema.parse(Object.fromEntries(formData));
  await db.department.findFirstOrThrow({ where: { id: data.departmentId, organizationId: user.organizationId! } });
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Department" WHERE "id" = ${data.departmentId} FOR UPDATE`;
    const existing = await tx.approvalWorkflow.findFirst({ where: { organizationId: user.organizationId!, departmentId: data.departmentId, entityType: data.entityType, active: true } });
    if (existing) throw new Error("APPROVAL_WORKFLOW_ALREADY_EXISTS");
    await tx.approvalWorkflow.create({ data: { organizationId: user.organizationId!, ...data } });
  });
  revalidatePath("/approvals");
}

const stepSchema = z.object({
  workflowId: z.string().cuid(), stepOrder: z.coerce.number().int().min(1).max(20), name: z.string().trim().min(2).max(120),
  actorType: z.nativeEnum(ApprovalActorType), approverRole: z.nativeEnum(Role).or(z.literal("")), approverUserId: z.string().cuid().or(z.literal("")),
});
export async function addApprovalStep(formData: FormData) {
  const user = await requireAction("manage");
  const data = stepSchema.parse(Object.fromEntries(formData));
  await db.approvalWorkflow.findFirstOrThrow({ where: { id: data.workflowId, organizationId: user.organizationId! } });
  if (data.actorType === ApprovalActorType.USER && !data.approverUserId) throw new Error("APPROVER_USER_REQUIRED");
  if (data.actorType === ApprovalActorType.ROLE && !data.approverRole) throw new Error("APPROVER_ROLE_REQUIRED");
  if (data.approverUserId) await db.user.findFirstOrThrow({ where: { id: data.approverUserId, organizationId: user.organizationId, active: true, role: { not: Role.VIEWER } } });
  if (data.actorType === ApprovalActorType.ROLE && data.approverRole === Role.VIEWER) throw new Error("FORBIDDEN");
  await db.approvalWorkflowStep.upsert({
    where: { workflowId_stepOrder: { workflowId: data.workflowId, stepOrder: data.stepOrder } },
    create: { workflowId: data.workflowId, stepOrder: data.stepOrder, name: data.name, actorType: data.actorType, approverRole: data.approverRole || null, approverUserId: data.approverUserId || null },
    update: { name: data.name, actorType: data.actorType, approverRole: data.approverRole || null, approverUserId: data.approverUserId || null },
  });
  revalidatePath("/approvals");
}

const decisionSchema = z.object({ approvalId: z.string().min(1).max(128), decision: z.enum(["approve", "return", "reject"]), comment: z.string().trim().max(2000).optional() });
export async function decideApproval(formData: FormData) {
  const user = await requireUser();
  const data = decisionSchema.parse(Object.fromEntries(formData));
  if (user.role === Role.VIEWER) throw new Error("FORBIDDEN");
  if (data.decision !== "approve" && !data.comment) throw new Error("RETURN_REASON_REQUIRED");
  const selected = await db.approval.findUniqueOrThrow({ where: { id: data.approvalId } });
  const requester = await db.user.findFirst({ where: { id: selected.requestedById, organizationId: user.organizationId }, select: { id: true } });
  if (!requester) throw new Error("FORBIDDEN");
  if (user.role !== Role.SUPER_ADMIN && selected.approverId !== user.id) throw new Error("FORBIDDEN");
  if (selected.requestedById === user.id) throw new Error("SELF_APPROVAL_FORBIDDEN");
  // Only reports have an implemented entity workflow at present.
  if (!selected.reportId || selected.entityType !== "REPORT") throw new Error("UNSUPPORTED_APPROVAL_ENTITY");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Report" WHERE "id" = ${selected.reportId} FOR UPDATE`;
    const report = await tx.report.findUniqueOrThrow({ where: { id: selected.reportId! } });
    const department = report.departmentId ? await tx.department.findFirst({ where: { id: report.departmentId, organizationId: user.organizationId! } }) : null;
    if (!department || report.status !== ReportStatus.SUBMITTED) throw new Error("REPORT_NOT_SUBMITTED");
    const approval = await tx.approval.findUniqueOrThrow({ where: { id: data.approvalId } });
    if (approval.status !== ApprovalStatus.PENDING) throw new Error("APPROVAL_ALREADY_DECIDED");
    const metadata = report.templateData && typeof report.templateData === "object" && !Array.isArray(report.templateData) ? report.templateData : {};
    const ids = Array.isArray(metadata.approvalIds) ? metadata.approvalIds.filter((id): id is string => typeof id === "string") : null;
    if (ids && !ids.includes(approval.id)) throw new Error("STALE_APPROVAL");
    const round = await tx.approval.findMany({ where: { reportId: report.id, ...(ids ? { id: { in: ids } } : {}) }, orderBy: { stepOrder: "asc" } });
    if (round.some((step) => step.stepOrder < approval.stepOrder && step.status !== ApprovalStatus.APPROVED)) throw new Error("PREVIOUS_APPROVAL_STEP_REQUIRED");
    const status = data.decision === "approve" ? ApprovalStatus.APPROVED : data.decision === "return" ? ApprovalStatus.RETURNED : ApprovalStatus.REJECTED;
    await tx.approval.update({ where: { id: approval.id }, data: { status, comment: data.comment || null, decidedAt: new Date(), approverId: user.id } });
    if (status !== ApprovalStatus.APPROVED) {
      await tx.report.update({ where: { id: report.id }, data: { status: ReportStatus.RETURNED } });
      await tx.approval.updateMany({ where: { reportId: report.id, status: ApprovalStatus.PENDING }, data: { status: ApprovalStatus.RETURNED, comment: "أُغلقت الخطوة لإعادة التقرير للتعديل", decidedAt: new Date() } });
      await tx.notification.create({ data: { userId: approval.requestedById, category: "REPORTS", title: "أعيد التقرير للتعديل", body: data.comment!, important: true, entityType: "Report", entityId: report.id } });
    } else if (round.every((step) => step.id === approval.id || step.status === ApprovalStatus.APPROVED)) {
      await tx.report.update({ where: { id: report.id }, data: { status: ReportStatus.APPROVED, approvedAt: new Date() } });
      await tx.notification.create({ data: { userId: approval.requestedById, category: "REPORTS", title: "تم اعتماد التقرير", body: report.title, entityType: "Report", entityId: report.id } });
    } else {
      const next = round.find((step) => step.stepOrder > approval.stepOrder && step.status === ApprovalStatus.PENDING);
      if (next?.approverId) await tx.notification.create({ data: { userId: next.approverId, category: "APPROVALS", title: "تقرير ينتظر اعتمادك", body: report.title, important: true, entityType: "Report", entityId: report.id } });
    }
    await tx.auditLog.create({ data: { userId: user.id, action: "REPORT_APPROVAL_DECIDED", entityType: "Report", entityId: report.id, oldValue: { approvalId: approval.id, status: approval.status }, newValue: { status, comment: data.comment ?? null } } });
  }, { timeout: 20000 });
  revalidatePath("/approvals");
  revalidatePath("/reports");
  revalidatePath(`/reports/${selected.reportId}`);
  revalidatePath("/notifications");
}
