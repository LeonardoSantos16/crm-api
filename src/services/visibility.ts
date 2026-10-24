import { ForbiddenError } from "../errors/http-errors.ts";
import { OpportunityNotFoundError } from "../errors/opportunity-errors.ts";
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

export async function findVisibleOpportunity(
  user: CurrentUser,
  id: number,
  db: Prisma.TransactionClient = prisma,
) {
  const opportunity = await db.opportunity.findFirst({
    where: { id, ...visibleOpportunitiesWhere(user) },
  });
  if (!opportunity) throw new OpportunityNotFoundError();
  return opportunity;
}

export async function assertTeamMember(user: CurrentUser, ownerId: number) {
  const member =
    user.role === "MANAGER" &&
    (await prisma.user.findFirst({
      where: { id: ownerId, managerId: user.id },
    }));
  if (!member) {
    throw new ForbiddenError(
      "Only a manager can choose an owner from their team",
    );
  }
}
