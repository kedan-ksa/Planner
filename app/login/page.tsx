import { signIn } from "@/auth";
import { LoginSubmitButton } from "@/components/login-submit-button";

const errorMessages: Record<string, string> = {
  AccessDenied: "تعذر السماح بالدخول. استخدم حساب Microsoft 365 الداخلي المنتهي بـ @kedan.com.sa، أو تواصل مع مدير النظام إذا كان حسابك موقوفًا.",
  OAuthAccountNotLinked: "البريد مرتبط بحساب سابق. تواصل مع مدير النظام لإعادة ربط حساب Microsoft.",
  Configuration: "إعداد تسجيل الدخول غير متاح مؤقتًا. تواصل مع مدير النظام.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#f3f7f6] p-6"><section className="card w-full max-w-md p-8"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#178f89] font-bold text-white">كدان</div><h1 className="mt-5 text-center text-2xl font-bold">منصة الأداء الاستراتيجي</h1><p className="mt-2 text-center text-sm text-slate-500">سجل الدخول باستخدام حساب Microsoft 365 الخاص بك</p>{error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-800">{errorMessages[error] ?? "تعذر إكمال تسجيل الدخول. حاول مرة أخرى أو تواصل مع مدير النظام."}</p>}<form className="mt-7" action={async()=>{"use server";await signIn("microsoft-entra-id",{redirectTo:"/"})}}><LoginSubmitButton /></form><p className="mt-5 text-center text-xs text-slate-400">portal.kedan.com.sa</p></section></main>;
}
