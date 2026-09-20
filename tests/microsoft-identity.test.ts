import { describe, expect, it } from "vitest";
import {
  isAllowedMicrosoftIdentity,
  isCorporateEmail,
  mapMicrosoftProfile,
  resolveMicrosoftEmail,
  shouldAllowMicrosoftSignIn,
} from "../lib/microsoft-identity";

describe("Microsoft Entra identity mapping", () => {
  const settings = { companyDomain: "kedan.com.sa", tenantId: "tenant-1" };

  it("uses preferred_username when Microsoft omits the optional email claim", () => {
    const profile = { sub: "subject", preferred_username: "Employee@Kedan.com.sa", tid: "tenant-1" };
    expect(resolveMicrosoftEmail(profile)).toBe("employee@kedan.com.sa");
    expect(mapMicrosoftProfile(profile)).toMatchObject({ id: "subject", email: "employee@kedan.com.sa", name: "employee" });
    expect(isAllowedMicrosoftIdentity(profile, settings)).toBe(true);
  });

  it("falls back to the UPN and normalizes the company domain", () => {
    expect(resolveMicrosoftEmail({ upn: "USER@KEDAN.COM.SA" })).toBe("user@kedan.com.sa");
    expect(isCorporateEmail("USER@KEDAN.COM.SA", "@kedan.com.sa")).toBe(true);
  });

  it("rejects external domains, guests, and mismatched tenants", () => {
    expect(isAllowedMicrosoftIdentity({ email: "user@example.com", tid: "tenant-1" }, settings)).toBe(false);
    expect(isAllowedMicrosoftIdentity({ email: "user@kedan.com.sa", tid: "tenant-1", acct: 1 }, settings)).toBe(false);
    expect(isAllowedMicrosoftIdentity({ email: "user@kedan.com.sa", tid: "tenant-2" }, settings)).toBe(false);
  });

  it("allows a valid first login before the database user exists and blocks a disabled account", () => {
    const profile = { preferred_username: "new.user@kedan.com.sa", tid: "tenant-1", acct: 0 };
    expect(shouldAllowMicrosoftSignIn(profile, settings, null)).toBe(true);
    expect(shouldAllowMicrosoftSignIn(profile, settings, true)).toBe(true);
    expect(shouldAllowMicrosoftSignIn(profile, settings, false)).toBe(false);
  });
});
