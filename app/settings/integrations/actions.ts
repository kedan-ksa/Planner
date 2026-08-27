"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/authz";
import { readEnv } from "@/lib/env";
import { getMicrosoftAccessToken } from "@/services/microsoft-graph/token";
import { MicrosoftGraphClient } from "@/services/microsoft-graph/client";
import { PlannerService } from "@/services/planner/service";
import { syncPlan } from "@/services/planner/sync";

export async function activateMicrosoftConnection() {
  const user = await requireAction("configure");
  const account = await db.account.findFirst({ where: { userId: user.id, provider: "microsoft-entra-id" } });
  if (!account) throw new Error("MICROSOFT_ACCOUNT_NOT_CONNECTED");
  await getMicrosoftAccessToken(user.id);
  await db.plannerConnection.upsert({
    where: { organizationId_microsoftUserId: { organizationId: user.organizationId!, microsoftUserId: account.providerAccountId } },
    create: { organizationId: user.organizationId!, microsoftUserId: account.providerAccountId, tenantId: readEnv("AZURE_AD_TENANT_ID")! },
    update: { tenantId: readEnv("AZURE_AD_TENANT_ID")! },
  });
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
  const mapping = await db.plannerPlanMapping.findFirstOrThrow({ where: { id: planMappingId, connection: { organizationId: user.organizationId! }, initiativeId: { not: null } } });
  const token = await getMicrosoftAccessToken(user.id);
  await syncPlan(mapping.id, new PlannerService(new MicrosoftGraphClient(token)));
  revalidatePath("/settings/integrations");
  revalidatePath("/tasks");
}
