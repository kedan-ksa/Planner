import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const connectionString = process.env.DATABASE_URL;
  if (!email || !connectionString) throw new Error("Email and DATABASE_URL are required");

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await db.user.updateMany({
      where: { email },
      data: { role: Role.SUPER_ADMIN, active: true },
    });
    if (result.count !== 1) throw new Error(`User ${email} was not found`);
    console.log(`Promoted ${email} to SUPER_ADMIN`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Promotion failed");
  process.exitCode = 1;
});
