import { ReportStatus, Role } from "@prisma/client";
import { canTransitionReport, type ReportIntent } from "./report-workflow";

export const reportSections = [
  { key: "summary", label: "الملخص التنفيذي", required: true },
  { key: "achievements", label: "الإنجازات", required: true },
  { key: "challenges", label: "التحديات", required: false },
  { key: "recommendations", label: "التوصيات والقرارات المطلوبة", required: false },
  { key: "nextSteps", label: "الخطوات القادمة", required: true },
] as const;
export type ReportContent = Partial<Record<typeof reportSections[number]["key"], string | null>>;
export function reportReadiness(content: ReportContent) {
  const required = reportSections.filter((section) => section.required);
  const missing = required.filter((section) => (content[section.key]?.trim().length ?? 0) < 3);
  return { missing: missing.map((section) => section.label), completion: Math.round(100 * (required.length - missing.length) / required.length), ready: missing.length === 0 };
}
export function canEditReport(status: ReportStatus, role: Role) {
  return (role === Role.SUPER_ADMIN || role === Role.DEPARTMENT_MANAGER || role === Role.DEPARTMENT_MEMBER)
    && (status === "DRAFT" || status === "IN_PROGRESS" || status === "RETURNED");
}
export function allowedReportIntent(status: ReportStatus, role: Role, intent: ReportIntent) {
  if (!canTransitionReport(status, intent)) return false;
  if (intent === "start" || intent === "ready") return role === "SUPER_ADMIN" || role === "DEPARTMENT_MANAGER" || role === "DEPARTMENT_MEMBER";
  if (intent === "submit" || intent === "archive") return role === "SUPER_ADMIN" || role === "DEPARTMENT_MANAGER";
  return role === "SUPER_ADMIN" || role === "EXECUTIVE";
}
export const reportStatusNames: Record<ReportStatus, string> = {
  DRAFT: "مسودة", IN_PROGRESS: "قيد الإعداد", READY_FOR_REVIEW: "جاهز للمراجعة", SUBMITTED: "قيد الاعتماد", RETURNED: "مُعاد للتعديل", APPROVED: "معتمد", ARCHIVED: "مؤرشف",
};
