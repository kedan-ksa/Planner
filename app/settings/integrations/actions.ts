"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction, requireUser } from "@/lib/authz";
import { readEnv } from "@/lib/env";
import { getMicrosoftAccessToken, getMicrosoftAccessTokenByProviderAccountId } from "@/services/microsoft-graph/token";
import { MicrosoftGraphClient } from "@/services/microsoft-graph/client";
import { PlannerService } from "@/services/planner/service";
import { syncPlan } from "@/services/planner/sync";
import { discoverPlannerPlans } from "@/services/planner/discovery";

export async function activateMicrosoftConnection() {
  const user = await requireUser();
  const account = await db.account.findFirst({ where: { userId: user.id, provider: "microsoft-entra-id" } });
  if (!account) throw new Error("MICROSOFT_ACCOUNT_NOT_CONNECTED");
  await discoverPlannerPlans(user.organizationId!, readEnv("AZURE_AD_TENANT_ID")!, account.providerAccountId, await getMicrosoftAccessToken(user.id));
  revalidatePath("/settings/integrations");
}

const mappingSchema = z.object({ externalPlanId: z.string().min(1), planTitle: z.string().min(1), initiativeId: z.string().cuid() });
export async function savePlanMapping(formData: FormData) {
  const user = await requireAction("configure");
  const data = mappingSchema.parse(Object.fromEntries(formData));
  const account = await db.account.findFirstOrThrow({ where: { userId: user.id, provider: "microsoft-entra-id" } });
  const connection = await db.plannerConnection.findUniqueOrThrow({ where: { organizationId_microsoftUserId: { organizationId: user.organizationId!, microsoftUserId: account.providerAccountId } } });
  await db.plannerPlanMapping.upsert({ where: { connectionId_externalPlanId: { connectionId: connection.id, externalPlanId: data.externalPlanId } }, create: { connectionId: connection.id, ...data }, update: { planTitle: data.planTitle, initiativeId: data.initiativeId } });
  revalidatePath("/settings/integrations");
}

export async function syncMappedPlan(formData: FormData) {
  const user = await requireAction("configure");
  const planMappingId = z.string().cuid().parse(formData.get("planMappingId"));
  let outcome = "success";
  try {
    const mapping = await db.plannerPlanMapping.findFirstOrThrow({ where: { id: planMappingId, connection: { organizationId: user.organizationId! }, initiativeId: { not: null } } });
    const connection = await db.plannerConnection.findUniqueOrThrow({ where: { id: mapping.connectionId } });
    const token = await getMicrosoftAccessTokenByProviderAccountId(connection.microsoftUserId);
    await syncPlan(mapping.id, new PlannerService(new MicrosoftGraphClient(token)));
    revalidatePath("/settings/integrations");
    revalidatePath("/tasks");
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_SYNC_ERROR";
    outcome = /RECONNECT|TOKEN|ACCOUNT_NOT_CONNECTED/i.test(message) ? "reconnect" : "failed";
  }
  redirect(`/settings/integrations?sync=${outcome}`);
}

const catalogMappingSchema = z.object({ mappingId: z.string().cuid(), initiativeId: z.string().cuid() });
export async function assignCatalogPlan(formData: FormData) {
  const user = await requireAction("configure");
  const data = catalogMappingSchema.parse(Object.fromEntries(formData));
  await db.plannerPlanMapping.updateMany({
    where: { id: data.mappingId, connection: { organizationId: user.organizationId! } },
    data: { initiativeId: data.initiativeId },
  });
  revalidatePath("/settings/integrations");
  redirect("/settings/integrations?mapping=saved");
}
