"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";

const notificationSchema = z.object({ notificationId: z.string().min(1).max(128) });

export async function markNotificationRead(formData: FormData) {
  const user = await requireUser();
  const data = notificationSchema.parse(Object.fromEntries(formData));
  await db.notification.updateMany({
    where: { id: data.notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/");
}
