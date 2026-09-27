"use server";

import type { StrategyFormState } from "@/app/actions/strategy-feedback";
import { updateUserAccess } from "./actions";

const messages: Record<string, string> = {
  CURRENT_ADMIN_PROTECTED: "لا يمكنك إيقاف حسابك الحالي أو إزالة صلاحية مدير النظام منه.",
  LAST_SUPER_ADMIN: "يجب الاحتفاظ بمدير نظام نشط واحد على الأقل.",
  DEPARTMENT_REQUIRED: "يجب اختيار إدارة لمدير الإدارة أو عضو الإدارة.",
  USER_NOT_FOUND: "لم يعد المستخدم موجودًا ضمن هذه المنشأة.",
  DEPARTMENT_NOT_FOUND: "الإدارة المختارة غير متاحة ضمن هذه المنشأة.",
  MANAGER_NOT_FOUND: "المدير المباشر المختار غير متاح أو حسابه موقوف.",
  HIERARCHY_CYCLE: "لا يمكن اختيار هذا المدير لأنه سينشئ حلقة في التسلسل الإداري.",
  INVALID_PARENT: "المدير المباشر المختار خارج نطاق المنشأة.",
  INVALID_INPUT: "بيانات الصلاحية غير مكتملة أو غير صالحة.",
  FORBIDDEN: "لا تملك صلاحية إدارة المستخدمين.",
};

export async function updateUserAccessForm(
  _previous: StrategyFormState,
  data: FormData,
): Promise<StrategyFormState> {
  try {
    await updateUserAccess(data);
    return { ok: true, message: "تم تحديث صلاحيات المستخدم وتسجيل العملية في سجل التدقيق." };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return {
      ok: false,
      message: messages[code] ?? "تعذر تحديث صلاحيات المستخدم. تحقق من البيانات ثم حاول مرة أخرى.",
    };
  }
}
