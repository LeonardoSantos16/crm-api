import { AppError } from "../errors/app-error.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import type { CurrentUser } from "./users.service.ts";

export const opportunityNotFound = () =>
  new AppError(404, "NOT_FOUND", "Opportunity not found");

export function visibleOpportunitiesWhere(
  user: CurrentUser,
): Prisma.OpportunityWhereInput {
  return user.role === "MANAGER"
    ? { owner: { managerId: user.id } }
    : { ownerId: user.id };
}

export async function findVisibleOpportunity(
  user: CurrentUser,
  id: number,
  db: Prisma.TransactionClient = prisma,
) {
  const opportunity = await db.opportunity.findFirst({
    where: { id, ...visibleOpportunitiesWhere(user) },
  });
  if (!opportunity) throw opportunityNotFound();
  return opportunity;
}

export async function assertTeamMember(user: CurrentUser, ownerId: number) {
  const member =
    user.role === "MANAGER" &&
    (await prisma.user.findFirst({
      where: { id: ownerId, managerId: user.id },
    }));
  if (!member) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only a manager can choose an owner from their team",
    );
  }
}
