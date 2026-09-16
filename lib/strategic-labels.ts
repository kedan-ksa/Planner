import { Frequency, KpiDirection, KpiType, Priority, WorkStatus } from "@prisma/client";

export const workStatusNames: Record<WorkStatus, string> = {
  NOT_STARTED: "لم تبدأ", IN_PROGRESS: "جاري العمل", ON_TRACK: "على المسار", NEEDS_ATTENTION: "تحتاج انتباه",
  OVERDUE: "متأخرة", BLOCKED: "متعثرة", COMPLETED: "مكتملة", PAUSED: "متوقفة",
};
export const priorityNames: Record<Priority, string> = { LOW: "منخفضة", MEDIUM: "متوسطة", HIGH: "عالية", CRITICAL: "حرجة" };
export const kpiTypeNames: Record<KpiType, string> = { NUMBER: "رقم", PERCENTAGE: "نسبة", CURRENCY: "عملة", COUNT: "عدد", BOOLEAN: "نعم/لا", CUSTOM: "مخصص" };
export const directionNames: Record<KpiDirection, string> = { HIGHER_IS_BETTER: "الأعلى أفضل", LOWER_IS_BETTER: "الأقل أفضل", EXACT_TARGET: "هدف دقيق" };
export const frequencyNames: Record<Frequency, string> = { WEEKLY: "أسبوعي", MONTHLY: "شهري", QUARTERLY: "ربع سنوي", SEMIANNUAL: "نصف سنوي", ANNUAL: "سنوي", CUSTOM: "مخصص" };
export const dateInput = (date: Date) => date.toISOString().slice(0, 10);
