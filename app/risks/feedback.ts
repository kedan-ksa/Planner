"use server";

import type { StrategyFormState } from "@/app/actions/strategy-feedback";
import { saveRisk } from "./actions";

const messages: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية تعديل هذا الخطر أو أنه خارج نطاق إدارتك.",
};

export async function saveRiskForm(_previous: StrategyFormState, data: FormData): Promise<StrategyFormState> {
  try {
    await saveRisk(data);
    return { ok: true, message: "تم حفظ الخطر وتحديث مصفوفة المخاطر بنجاح." };
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof Error ? error.message : "";
    return { ok: false, message: messages[message] ?? "تعذر حفظ الخطر. تحقق من البيانات والصلاحيات." };
  }
}
