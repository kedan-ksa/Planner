import { ReportStatus } from "@prisma/client";

export type ReportIntent = "start" | "ready" | "submit" | "approve" | "return" | "archive";

const transitions: Record<ReportStatus, readonly ReportIntent[]> = {
  DRAFT: ["start"],
  IN_PROGRESS: ["ready"],
  READY_FOR_REVIEW: ["submit"],
  SUBMITTED: ["approve", "return"],
  RETURNED: ["start"],
  APPROVED: ["archive"],
  ARCHIVED: [],
};

export function canTransitionReport(status: ReportStatus, intent: ReportIntent) {
  return transitions[status].includes(intent);
}
