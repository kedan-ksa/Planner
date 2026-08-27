import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/authz";
import { MicrosoftGraphClient } from "@/services/microsoft-graph/client";
import { getMicrosoftAccessTokenByProviderAccountId } from "@/services/microsoft-graph/token";
import { PlannerService } from "@/services/planner/service";
import { syncPlan } from "@/services/planner/sync";

const planMappingIdSchema = z.string().cuid();

export async function POST(request: Request) {
  let outcome = "success";
  try {
    const user = await requireAction("configure");
    const formData = await request.formData();
    const planMappingId = planMappingIdSchema.parse(formData.get("planMappingId"));
    const mapping = await db.plannerPlanMapping.findFirstOrThrow({
      where: {
        id: planMappingId,
        connection: { organizationId: user.organizationId! },
        initiativeId: { not: null },
      },
    });
    const connection = await db.plannerConnection.findUniqueOrThrow({ where: { id: mapping.connectionId } });
    const token = await getMicrosoftAccessTokenByProviderAccountId(connection.microsoftUserId);
    await syncPlan(mapping.id, new PlannerService(new MicrosoftGraphClient(token)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_SYNC_ERROR";
    outcome = /RECONNECT|TOKEN|ACCOUNT_NOT_CONNECTED/i.test(message) ? "reconnect" : "failed";
  }

  return NextResponse.redirect(new URL(`/settings/integrations?sync=${outcome}`, request.url), 303);
}
