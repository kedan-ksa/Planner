"use server";
import { createDepartmentReport, updateReportContent, transitionReport } from "./actions";

const messages: Record<string, string> = {
  REPORT_INCOMPLETE: "أكمل الملخص والإنجازات والخطوات القادمة قبل المراجعة والإرسال.",
  REPORT_LOCKED: "التقرير مقفل للمراجعة. أعد فتح الإعداد أولًا.",
  INVALID_REPORT_TRANSITION: "تغيرت حالة التقرير أو لا تملك صلاحية هذه الخطوة. حدّث الصفحة.",
  REPORT_NOT_ACCESSIBLE: "التقرير غير موجود ضمن نطاق صلاحياتك.",
  USE_APPROVAL_CENTER: "لهذا التقرير سلسلة موافقات. اتخذ القرار من مركز الاعتمادات.",
  EMPTY_APPROVAL_WORKFLOW: "سلسلة الاعتماد لا تحتوي على خطوات. أضف المعتمدين قبل الإرسال.",
  AMBIGUOUS_APPROVAL_WORKFLOW: "توجد أكثر من سلسلة نشطة لهذه الإدارة. يلزم تحديد سلسلة واحدة.",
  AMBIGUOUS_APPROVER_ROLE: "اختر معتمدًا محددًا؛ الدور المحدد لا يعود إلى مستخدم نشط واحد.",
  APPROVER_REQUIRED: "تحقق من المدير أو المعتمد: يجب أن يكون حسابًا نشطًا غير مقدم التقرير.",
  RETURN_REASON_REQUIRED: "أدخل سبب إعادة التقرير للتعديل.",
};
export type ReportFormState = { ok: boolean; message: string };
async function execute(action: (data: FormData) => Promise<void>, data: FormData): Promise<ReportFormState> {
  try { await action(data); return { ok: true, message: "تم الحفظ بنجاح." }; }
  catch (error) {
    // Authentication redirects must retain their Next.js control flow.
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { ok: false, message: error instanceof Error ? messages[error.message] ?? "تعذر حفظ التغيير. تحقق من المدخلات وصلاحيتك ثم أعد المحاولة." : "تعذر حفظ التغيير." };
  }
}
export async function createReportForm(_previous: ReportFormState, data: FormData) { return execute(createDepartmentReport, data); }
export async function saveReportForm(_previous: ReportFormState, data: FormData) { return execute(updateReportContent, data); }
export async function transitionReportForm(_previous: ReportFormState, data: FormData) { return execute(transitionReport, data); }
