import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import authConfig from "@/auth.config";

const providers = [...authConfig.providers];

if (process.env.LOCAL_AUTH_ENABLED === "true") {
  providers.push(Credentials({
    credentials: { email: {}, password: {} },
    authorize: async (raw) => {
      const parsed = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse(raw);
      if (!parsed.success) return null;
      const user = await db.user.findUnique({ where: { email: parsed.data.email } });
      if (!user?.passwordHash || !user.active || !(await compare(parsed.data.password, user.passwordHash))) return null;
      return { id: user.id, name: user.name, email: user.email };
    },
  }) as never);
}

function isCorporateEmail(email: string) {
  const domain = readEnv("COMPANY_DOMAIN") ?? "kedan.com.sa";
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

async function provisionMicrosoftUser(user: { id: string; email?: string | null; name?: string | null; image?: string | null }) {
  if (!user.email || !isCorporateEmail(user.email)) return null;
  const organization = await db.organization.upsert({
    where: { code: "KEDAN" }, update: { name: "كدان" }, create: { name: "كدان", code: "KEDAN" },
  });
  const superAdminEmails = (readEnv("SUPER_ADMIN_EMAILS") ?? "ahmad@kedan.com.sa")
    .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const current = await db.user.findUnique({ where: { id: user.id } });
  const role = superAdminEmails.includes(user.email.toLowerCase()) ? Role.SUPER_ADMIN : current?.role ?? Role.DEPARTMENT_MEMBER;
  return db.user.update({
    where: { id: user.id },
    data: {
      name: user.name?.trim() || user.email.split("@")[0], email: user.email.toLowerCase(), image: user.image,
      organizationId: current?.organizationId ?? organization.id, role, active: true,
    },
    select: { id: true, role: true, departmentId: true, organizationId: true },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig, adapter: PrismaAdapter(db), providers, session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    signIn: async ({ user, account }) => account?.provider !== "microsoft-entra-id" || Boolean(user.email && isCorporateEmail(user.email)),
    jwt: async ({ token, user, trigger }) => {
      if (user) {
        const stored = await provisionMicrosoftUser({ id: user.id!, email: user.email, name: user.name, image: user.image });
        token.role = stored?.role; token.departmentId = stored?.departmentId; token.organizationId = stored?.organizationId;
      } else if (trigger === "update" && token.sub) {
        const stored = await db.user.findUnique({ where: { id: token.sub }, select: { role: true, departmentId: true, organizationId: true } });
        token.role = stored?.role; token.departmentId = stored?.departmentId; token.organizationId = stored?.organizationId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub!;
        Object.assign(session.user, { role: token.role, departmentId: token.departmentId, organizationId: token.organizationId });
      }
      return session;
    },
  },
});
