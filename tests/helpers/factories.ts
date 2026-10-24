import type { Prisma } from "../../src/generated/prisma/client.ts";
import { prisma } from "../../src/lib/prisma.ts";

let sequence = 0;
const next = () => ++sequence;

export function createUser(
  data: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  return prisma.user.create({ data: { name: `User ${next()}`, ...data } });
}

export async function createOpportunity({
  ownerId,
  companyName = `Company ${next()}`,
  ...data
}: { ownerId: number; companyName?: string } & Partial<
  Omit<Prisma.OpportunityUncheckedCreateInput, "ownerId" | "companyId">
>) {
  const company = await prisma.company.upsert({
    where: { name: companyName },
    create: { name: companyName },
    update: {},
  });
  return prisma.opportunity.create({
    data: { ...data, ownerId, companyId: company.id },
  });
}
