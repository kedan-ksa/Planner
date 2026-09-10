import { ApprovalActorType, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function createApprovalChain(input: {
  organizationId: string; departmentId: string; entityType: string; entityId: string;
  reportId?: string; requestedById: string;
}, client: Prisma.TransactionClient = db) {
  const workflows = await client.approvalWorkflow.findMany({ where: {
    organizationId: input.organizationId, departmentId: input.departmentId, entityType: input.entityType, active: true,
  } });
  if (!workflows.length) return [];
  if (workflows.length !== 1) throw new Error("AMBIGUOUS_APPROVAL_WORKFLOW");
  const steps = await client.approvalWorkflowStep.findMany({ where: { workflowId: workflows[0].id }, orderBy: { stepOrder: "asc" } });
  if (!steps.length) throw new Error("EMPTY_APPROVAL_WORKFLOW");
  const requester = await client.user.findFirstOrThrow({ where: { id: input.requestedById, organizationId: input.organizationId, active: true } });
  const department = await client.department.findFirstOrThrow({ where: { id: input.departmentId, organizationId: input.organizationId } });
  const resolved = [];
  for (const step of steps) {
    let id = step.approverUserId;
    if (step.actorType === ApprovalActorType.DIRECT_MANAGER) id = requester.managerId;
    if (step.actorType === ApprovalActorType.DEPARTMENT_MANAGER) id = department.managerId;
    if (step.actorType === ApprovalActorType.ROLE) {
      if (!step.approverRole) throw new Error("APPROVER_REQUIRED");
      const candidates = await client.user.findMany({ where: { organizationId: input.organizationId, role: step.approverRole, active: true }, select: { id: true } });
      if (candidates.length !== 1) throw new Error("AMBIGUOUS_APPROVER_ROLE");
      id = candidates[0].id;
    }
    if (!id || id === input.requestedById) throw new Error("APPROVER_REQUIRED");
    const approver = await client.user.findFirst({ where: { id, organizationId: input.organizationId, active: true, role: { not: "VIEWER" } }, select: { id: true } });
    if (!approver) throw new Error("APPROVER_REQUIRED");
    resolved.push({ stepOrder: step.stepOrder, approverId: approver.id });
  }
  const previous = await client.approval.findMany({ where: { entityType: input.entityType, entityId: input.entityId } });
  // Preserve earlier decisions. New submissions get distinct approval records.
  if (previous.length) await client.approval.updateMany({ where: { entityType: input.entityType, entityId: input.entityId, status: "PENDING" }, data: { status: "RETURNED", comment: "أُغلقت هذه الخطوة عند إعادة إرسال التقرير", decidedAt: new Date() } });
  const offset = previous.reduce((max, item) => Math.max(max, item.stepOrder), 0);
  const created = [];
  for (const step of resolved) created.push(await client.approval.create({ data: {
    reportId: input.reportId, entityType: input.entityType, entityId: input.entityId,
    requestedById: input.requestedById, status: "PENDING", approverId: step.approverId, stepOrder: offset + step.stepOrder,
  } }));
  return created;
}
