"use server";

import {
  recordKpiValue,
  saveInitiative,
  saveKpi,
  saveStrategicAxis,
  saveStrategicObjective,
} from "./strategy";

export type StrategyFormState = { ok: boolean; message: string };

const messages: Record<string, string> = {
  END_DATE_BEFORE_START: "يجب أن يكون تاريخ النهاية بعد تاريخ البداية.",
  FORBIDDEN: "لا تملك صلاحية تنفيذ هذا التغيير.",
  NOT_FOUND: "لم يعد العنصر موجودًا أو أنه خارج نطاق صلاحيتك.",
  OWNER_OUTSIDE_DEPARTMENT: "يجب أن يكون المسؤول المختار عضوًا نشطًا في الإدارة المالكة.",
  KPI_INITIATIVE_DEPARTMENT_MISMATCH: "يجب أن تتبع المبادرة والإدارة المختارتان النطاق الإداري نفسه.",
};

async function execute(
  action: (data: FormData) => Promise<void>,
  data: FormData,
): Promise<StrategyFormState> {
  try {
    await action(data);
    return { ok: true, message: "تم الحفظ وإعادة حساب نسب الإنجاز بنجاح." };
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof Error ? error.message : "";
    return {
      ok: false,
      message: messages[message] ?? "تعذر حفظ التغيير. تحقق من المدخلات والروابط والصلاحيات.",
    };
  }
}

export async function saveStrategicAxisForm(_previous: StrategyFormState, data: FormData) {
  return execute(saveStrategicAxis, data);
}

export async function saveStrategicObjectiveForm(_previous: StrategyFormState, data: FormData) {
  return execute(saveStrategicObjective, data);
}

export async function saveInitiativeForm(_previous: StrategyFormState, data: FormData) {
  return execute(saveInitiative, data);
}

export async function saveKpiForm(_previous: StrategyFormState, data: FormData) {
  return execute(saveKpi, data);
}

export async function recordKpiValueForm(_previous: StrategyFormState, data: FormData) {
  return execute(recordKpiValue, data);
}
