import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { can, type Action } from "@/lib/rbac";
import { assertCanView, type NavigationKey } from "@/lib/access-control";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireAction(action: Action) {
  const user = await requireUser();
  if (!user.role || !can(user.role as Role, action)) throw new Error("FORBIDDEN");
  return user;
}

export async function requirePage(key: NavigationKey) {
  const user = await requireUser();
  assertCanView(user.role, key);
  return user;
}
