"use client";

import { useActionState, type ReactNode } from "react";
import type { StrategyFormState } from "@/app/actions/strategy-feedback";

export function StrategyForm({
  action,
  children,
  className = "",
}: {
  action: (previous: StrategyFormState, data: FormData) => Promise<StrategyFormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, submit, pending] = useActionState(action, { ok: false, message: "" });

  return (
    <form action={submit} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {(pending || state.message) && (
        <p
          role="status"
          aria-live="polite"
          className={`col-span-full rounded-lg p-3 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
          }`}
        >
          {pending ? "جارٍ الحفظ…" : state.message}
        </p>
      )}
    </form>
  );
}
