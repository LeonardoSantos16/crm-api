import { prisma } from "../../src/lib/prisma.ts";

export async function resetDatabase() {
  await prisma.$executeRaw`TRUNCATE TABLE "StageChange", "OpportunityItem", "Opportunity", "Company", "User" RESTART IDENTITY CASCADE`;
}
