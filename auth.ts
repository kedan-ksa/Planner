import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import {
  isAllowedMicrosoftIdentity,
  isCorporateEmail,
  resolveMicrosoftEmail,
  shouldAllowMicrosoftSignIn,
  type MicrosoftIdentityClaims,
} from "@/lib/microsoft-identity";
import authConfig from "@/auth.config";
import { discoverPlannerPlans } from "@/services/planner/discovery";

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

async function provisionMicrosoftUser(user: { id: string; email: string; name?: string | null; image?: string | null }) {
  const companyDomain = readEnv("COMPANY_DOMAIN") ?? "kedan.com.sa";
  if (!isCorporateEmail(user.email, companyDomain)) return null;
  const organization = await db.organization.upsert({
    where: { code: "KEDAN" }, update: { name: "كدان" }, create: { name: "كدان", code: "KEDAN" },
  });
  const superAdminEmails = (readEnv("SUPER_ADMIN_EMAILS") ?? "ahmad@kedan.com.sa")
    .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const current = await db.user.findUnique({ where: { id: user.id } });
  if (current && !current.active) return null;
  const role = superAdminEmails.includes(user.email.toLowerCase()) ? Role.SUPER_ADMIN : current?.role ?? Role.DEPARTMENT_MEMBER;
  return db.user.update({
    where: { id: user.id },
    data: {
      name: user.name?.trim() || user.email.split("@")[0], email: user.email.toLowerCase(), image: user.image,
      organizationId: current?.organizationId ?? organization.id, role,
    },
    select: { id: true, role: true, departmentId: true, organizationId: true },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig, adapter: PrismaAdapter(db), providers, session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    signIn: async ({ user, account, profile }) => {
      if (account?.provider !== "microsoft-entra-id") return true;
      const rawProfile = (profile ?? {}) as MicrosoftIdentityClaims;
      const claims = { ...rawProfile, email: resolveMicrosoftEmail(rawProfile) ?? user.email };
      const identitySettings = {
        companyDomain: readEnv("COMPANY_DOMAIN") ?? "kedan.com.sa",
        tenantId: readEnv("AZURE_AD_TENANT_ID") ?? "",
      };
      if (!user.id || !isAllowedMicrosoftIdentity(claims, identitySettings)) return false;

      // For a first-time OAuth sign-in Auth.js has not created the database user yet.
      // Only inspect an existing linked user here; provisioning happens in `jwt` after creation.
      const current = await db.user.findUnique({ where: { id: user.id }, select: { active: true } });
      return shouldAllowMicrosoftSignIn(claims, identitySettings, current?.active ?? null);
    },
    jwt: async ({ token, user, account, profile, trigger }) => {
      if (user) {
        const rawProfile = (profile ?? {}) as MicrosoftIdentityClaims;
        const microsoftEmail = account?.provider === "microsoft-entra-id"
          ? resolveMicrosoftEmail(rawProfile) ?? user.email
          : null;
        const stored = account?.provider === "microsoft-entra-id" && microsoftEmail
          ? await provisionMicrosoftUser({ id: user.id!, email: microsoftEmail, name: user.name, image: user.image })
          : await db.user.findUnique({ where: { id: user.id! }, select: { id: true, role: true, departmentId: true, organizationId: true, active: true } });
        if (!stored || ("active" in stored && !stored.active)) return null;
        token.role = stored?.role; token.departmentId = stored?.departmentId; token.organizationId = stored?.organizationId;
        if (account?.provider === "microsoft-entra-id" && stored.organizationId && account.access_token && account.providerAccountId) {
          try {
            await discoverPlannerPlans(
              stored.organizationId,
              readEnv("AZURE_AD_TENANT_ID")!,
              account.providerAccountId,
              account.access_token,
            );
          } catch {
            // Planner discovery must never prevent a corporate user from signing in.
          }
        }
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
