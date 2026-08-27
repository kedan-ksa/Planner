import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

export async function getMicrosoftAccessToken(userId: string) {
  const account = await db.account.findFirst({
    where: { userId, provider: "microsoft-entra-id" },
  });
  if (!account?.access_token) throw new Error("MICROSOFT_ACCOUNT_NOT_CONNECTED");

  const now = Math.floor(Date.now() / 1000);
  if (!account.expires_at || account.expires_at > now + 120) return account.access_token;
  if (!account.refresh_token) throw new Error("MICROSOFT_RECONNECT_REQUIRED");

  const tenantId = readEnv("AZURE_AD_TENANT_ID");
  const clientId = readEnv("AZURE_AD_CLIENT_ID");
  const clientSecret = readEnv("AZURE_AD_CLIENT_SECRET");
  const scope = readEnv("MICROSOFT_GRAPH_SCOPE");
  if (!tenantId || !clientId || !clientSecret || !scope) throw new Error("MICROSOFT_CONFIGURATION_INCOMPLETE");

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      scope,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("MICROSOFT_RECONNECT_REQUIRED");
  const refreshed = await response.json() as TokenResponse;
  await db.account.update({
    where: { id: account.id },
    data: {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? account.refresh_token,
      expires_at: now + refreshed.expires_in,
      scope: refreshed.scope ?? account.scope,
    },
  });
  return refreshed.access_token;
}
