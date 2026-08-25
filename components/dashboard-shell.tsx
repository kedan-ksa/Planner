import Image from "next/image";
import { Bell, Menu, Search } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { Sidebar } from "./sidebar";

const roleNames = { SUPER_ADMIN: "مدير النظام", EXECUTIVE: "الإدارة التنفيذية", DEPARTMENT_MANAGER: "مدير إدارة", DEPARTMENT_MEMBER: "عضو إدارة", VIEWER: "مشاهد" } as const;

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <div><Sidebar role={user.role}/><main className="min-h-screen lg:mr-64"><header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur lg:px-8"><div className="flex items-center gap-3"><button className="lg:hidden" aria-label="فتح القائمة"><Menu/></button><div className="relative hidden sm:block"><Search className="absolute right-3 top-2.5 text-slate-400" size={17}/><input aria-label="البحث الشامل" className="w-72 rounded-xl bg-slate-100 py-2 pr-10 pl-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600" placeholder="ابحث في المنصة..."/></div></div><div className="flex items-center gap-4"><button className="relative rounded-xl border p-2" aria-label="التنبيهات"><Bell size={19}/></button><div className="text-left"><div className="text-sm font-bold">{user.name??user.email}</div><div className="text-xs text-slate-500">{roleNames[user.role]}</div></div>{user.image?<Image src={user.image} alt="" width={36} height={36} className="rounded-full"/>:<div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800">{user.name?.slice(0,1)??"ك"}</div>}</div></header>{children}</main></div>;
}
