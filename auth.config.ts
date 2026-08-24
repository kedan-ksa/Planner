import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { readEnv } from "@/lib/env";

export default {
  trustHost: true,
  secret: readEnv("AUTH_SECRET"),
  providers: [
    MicrosoftEntraID({
      clientId: readEnv("AZURE_AD_CLIENT_ID") ?? "",
      clientSecret: readEnv("AZURE_AD_CLIENT_SECRET") ?? "",
      issuer: `https://login.microsoftonline.com/${readEnv("AZURE_AD_TENANT_ID") ?? "common"}/v2.0`,
      authorization: {
        params: { scope: readEnv("MICROSOFT_GRAPH_SCOPE") },
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ auth }) => Boolean(auth?.user),
  },
} satisfies NextAuthConfig;
