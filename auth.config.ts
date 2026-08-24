import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export default {
  trustHost: true,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID ?? "common"}/v2.0`,
      authorization: {
        params: { scope: process.env.MICROSOFT_GRAPH_SCOPE },
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ auth }) => Boolean(auth?.user),
  },
} satisfies NextAuthConfig;
