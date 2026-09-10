import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { can, type Action } from "@/lib/rbac";
import { assertCanView, type NavigationKey } from "@/lib/access-control";
import { db } from "@/lib/db";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const current = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, departmentId: true, organizationId: true, active: true } });
  if (!current?.active || !current.organizationId) redirect("/login");
  return { ...session.user, ...current };
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
