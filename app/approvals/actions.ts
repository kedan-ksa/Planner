"use server";

import { ApprovalActorType, ApprovalStatus, ReportStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction, requireUser } from "@/lib/authz";

const workflowSchema = z.object({ name: z.string().trim().min(3).max(120), departmentId: z.string().cuid(), entityType: z.enum(["REPORT", "INITIATIVE_UPDATE", "KPI_TARGET"]) });
export async function createApprovalWorkflow(formData: FormData) {
  const user = await requireAction("manage");
  const data = workflowSchema.parse(Object.fromEntries(formData));
  await db.department.findFirstOrThrow({ where: { id: data.departmentId, organizationId: user.organizationId! } });
  await db.approvalWorkflow.create({ data: { organizationId: user.organizationId!, ...data } });
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
  await db.approvalWorkflowStep.upsert({
    where: { workflowId_stepOrder: { workflowId: data.workflowId, stepOrder: data.stepOrder } },
    create: { workflowId: data.workflowId, stepOrder: data.stepOrder, name: data.name, actorType: data.actorType, approverRole: data.approverRole || null, approverUserId: data.approverUserId || null },
    update: { name: data.name, actorType: data.actorType, approverRole: data.approverRole || null, approverUserId: data.approverUserId || null },
  });
  revalidatePath("/approvals");
}

const decisionSchema = z.object({ approvalId: z.string().cuid(), decision: z.enum(["approve", "return", "reject"]), comment: z.string().trim().max(2000).optional() });
export async function decideApproval(formData: FormData) {
  const user = await requireUser();
  const data = decisionSchema.parse(Object.fromEntries(formData));
  const approval = await db.approval.findUniqueOrThrow({ where: { id: data.approvalId } });
  if (approval.status !== ApprovalStatus.PENDING) throw new Error("APPROVAL_ALREADY_DECIDED");
  if (user.role !== Role.SUPER_ADMIN && approval.approverId !== user.id) throw new Error("FORBIDDEN");
  const earlierPending = await db.approval.count({ where: { entityType: approval.entityType, entityId: approval.entityId, status: ApprovalStatus.PENDING, stepOrder: { lt: approval.stepOrder } } });
  if (earlierPending) throw new Error("PREVIOUS_APPROVAL_STEP_REQUIRED");
  const status = data.decision === "approve" ? ApprovalStatus.APPROVED : data.decision === "return" ? ApprovalStatus.RETURNED : ApprovalStatus.REJECTED;
  await db.approval.update({ where: { id: approval.id }, data: { status, comment: data.comment || null, decidedAt: new Date(), approverId: approval.approverId ?? user.id } });
  if (approval.reportId) {
    if (status !== ApprovalStatus.APPROVED) {
      await db.report.update({ where: { id: approval.reportId }, data: { status: ReportStatus.RETURNED } });
    } else {
      const remaining = await db.approval.count({ where: { reportId: approval.reportId, status: ApprovalStatus.PENDING, id: { not: approval.id } } });
      if (!remaining) await db.report.update({ where: { id: approval.reportId }, data: { status: ReportStatus.APPROVED, approvedAt: new Date(), completion: 100 } });
    }
  }
  revalidatePath("/approvals");
  revalidatePath("/reports");
}
