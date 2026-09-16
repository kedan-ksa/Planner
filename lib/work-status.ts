import { WorkStatus } from "@prisma/client";

function dateKeyInRiyadh(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dueDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function effectiveWorkStatus(status: WorkStatus, dueDate: Date | null, now = new Date()) {
  if (!dueDate || status === WorkStatus.COMPLETED) return status;
  return dueDateKey(dueDate) < dateKeyInRiyadh(now) ? WorkStatus.OVERDUE : status;
}

export function overdueDays(status: WorkStatus, dueDate: Date | null, now = new Date()) {
  if (effectiveWorkStatus(status, dueDate, now) !== WorkStatus.OVERDUE || !dueDate) return 0;
  const due = Date.parse(`${dueDateKey(dueDate)}T00:00:00.000Z`);
  const today = Date.parse(`${dateKeyInRiyadh(now)}T00:00:00.000Z`);
  return Math.max(1, Math.round((today - due) / 86_400_000));
}
