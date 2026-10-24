import { AppError } from "../errors/app-error.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import type { CurrentUser } from "./users.service.ts";

export function visibleOpportunitiesWhere(
  user: CurrentUser,
): Prisma.OpportunityWhereInput {
  return user.role === "MANAGER"
    ? { owner: { managerId: user.id } }
    : { ownerId: user.id };
}

export async function findVisibleOpportunity(user: CurrentUser, id: number) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id, ...visibleOpportunitiesWhere(user) },
  });
  if (!opportunity) {
    throw new AppError(404, "NOT_FOUND", "Opportunity not found");
  }
  return opportunity;
}
