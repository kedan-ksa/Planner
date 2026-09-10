"use client";
export function ReportPrintButton() {
  return <button type="button" onClick={() => window.print()} className="rounded-xl bg-teal-700 px-5 py-3 text-white">طباعة / حفظ PDF</button>;
}
