export type MicrosoftIdentityClaims = {
  sub?: string | null;
  oid?: string | null;
  tid?: string | null;
  name?: string | null;
  nickname?: string | null;
  email?: string | null;
  preferred_username?: string | null;
  upn?: string | null;
  picture?: string | null;
  acct?: number | null;
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function looksLikeEmail(value: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

export function resolveMicrosoftEmail(profile: MicrosoftIdentityClaims) {
  for (const candidate of [profile.email, profile.preferred_username, profile.upn]) {
    const normalized = normalize(candidate);
    if (looksLikeEmail(normalized)) return normalized;
  }
  return null;
}

export function isCorporateEmail(email: string, companyDomain: string) {
  const normalizedEmail = normalize(email);
  const normalizedDomain = normalize(companyDomain)?.replace(/^@/, "");
  return Boolean(normalizedEmail && normalizedDomain && normalizedEmail.endsWith(`@${normalizedDomain}`));
}

export function isAllowedMicrosoftIdentity(
  profile: MicrosoftIdentityClaims,
  settings: { companyDomain: string; tenantId: string },
) {
  const email = resolveMicrosoftEmail(profile);
  if (!email || !isCorporateEmail(email, settings.companyDomain)) return false;
  if (profile.acct === 1) return false;
  const profileTenant = normalize(profile.tid);
  const configuredTenant = normalize(settings.tenantId);
  return !profileTenant || !configuredTenant || profileTenant === configuredTenant;
}

export function shouldAllowMicrosoftSignIn(
  profile: MicrosoftIdentityClaims,
  settings: { companyDomain: string; tenantId: string },
  existingUserActive: boolean | null,
) {
  return isAllowedMicrosoftIdentity(profile, settings) && existingUserActive !== false;
}

export function mapMicrosoftProfile(profile: MicrosoftIdentityClaims) {
  const email = resolveMicrosoftEmail(profile) ?? "";
  return {
    id: profile.sub ?? profile.oid ?? crypto.randomUUID(),
    name: profile.name?.trim() || profile.nickname?.trim() || email.split("@")[0] || "مستخدم كدان",
    email,
    image: profile.picture ?? null,
  };
}
