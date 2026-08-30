import { ApprovalActorType, ApprovalStatus } from "@prisma/client";
import { db } from "@/lib/db";

export async function createApprovalChain(input: {
  organizationId: string;
  departmentId: string;
  entityType: string;
  entityId: string;
  reportId?: string;
  requestedById: string;
}) {
  const workflow = await db.approvalWorkflow.findFirst({
    where: { organizationId: input.organizationId, departmentId: input.departmentId, entityType: input.entityType, active: true },
  });
  if (!workflow) return [];
  const steps = await db.approvalWorkflowStep.findMany({ where: { workflowId: workflow.id }, orderBy: { stepOrder: "asc" } });
  const requester = await db.user.findUnique({ where: { id: input.requestedById }, select: { managerId: true } });
  const department = await db.department.findUnique({ where: { id: input.departmentId }, select: { managerId: true } });
  const created = [];
  for (const step of steps) {
    let approverId = step.approverUserId;
    if (step.actorType === ApprovalActorType.DIRECT_MANAGER) approverId = requester?.managerId ?? null;
    if (step.actorType === ApprovalActorType.DEPARTMENT_MANAGER) approverId = department?.managerId ?? null;
    if (step.actorType === ApprovalActorType.ROLE && step.approverRole) {
      approverId = (await db.user.findFirst({ where: { organizationId: input.organizationId, role: step.approverRole, active: true }, select: { id: true }, orderBy: { name: "asc" } }))?.id ?? null;
    }
    created.push(await db.approval.create({ data: {
      reportId: input.reportId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: ApprovalStatus.PENDING,
      requestedById: input.requestedById,
      approverId,
      stepOrder: step.stepOrder,
    } }));
  }
  return created;
}
