"use client";

import { useFormStatus } from "react-dom";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-[#26484a] px-4 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "جارٍ التحويل إلى Microsoft…" : "الدخول بواسطة Microsoft"}
    </button>
  );
}
