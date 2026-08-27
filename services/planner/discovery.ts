import { db } from "@/lib/db";
import { MicrosoftGraphClient } from "@/services/microsoft-graph/client";
import { PlannerService } from "./service";

export async function discoverPlannerPlans(
  organizationId: string,
  tenantId: string,
  microsoftUserId: string,
  accessToken: string,
) {
  const connection = await db.plannerConnection.upsert({
    where: { organizationId_microsoftUserId: { organizationId, microsoftUserId } },
    create: { organizationId, tenantId, microsoftUserId },
    update: { tenantId },
  });
  const plans = (await new PlannerService(new MicrosoftGraphClient(accessToken)).getMyPlans()).value;
  await Promise.all(plans.map((plan) => db.plannerPlanMapping.upsert({
    where: { connectionId_externalPlanId: { connectionId: connection.id, externalPlanId: plan.id } },
    create: { connectionId: connection.id, externalPlanId: plan.id, planTitle: plan.title },
    update: { planTitle: plan.title },
  })));
  return { connection, plans };
}
