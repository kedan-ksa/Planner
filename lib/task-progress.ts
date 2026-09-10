import { WorkStatus } from "@prisma/client";

/** Keep the explicit operational status unless it contradicts completion. */
export function taskProgressStatus(progress: number, status: WorkStatus): WorkStatus {
  if (progress === 100) return WorkStatus.COMPLETED;
  if (status === WorkStatus.COMPLETED) return progress === 0 ? WorkStatus.NOT_STARTED : WorkStatus.IN_PROGRESS;
  if (progress > 0 && status === WorkStatus.NOT_STARTED) return WorkStatus.IN_PROGRESS;
  return status;
}
