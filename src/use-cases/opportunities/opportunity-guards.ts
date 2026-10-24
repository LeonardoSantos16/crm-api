import { ForbiddenError } from "../../errors/http-errors.ts";
import { OpportunityNotFoundError } from "../../errors/opportunity-errors.ts";
import type { OpportunityReader } from "../../repositories/opportunity.repository.ts";
import type { UserRepository } from "../../repositories/user.repository.ts";
import type { CurrentUser } from "../../types/user.types.ts";

export async function findVisibleOpportunity(
  opportunities: OpportunityReader,
  user: CurrentUser,
  id: number,
) {
  const opportunity = await opportunities.findVisible(user, id);
  if (!opportunity) throw new OpportunityNotFoundError();
  return opportunity;
}

export async function assertTeamMember(
  users: UserRepository,
  user: CurrentUser,
  ownerId: number,
) {
  const member =
    user.role === "MANAGER" && (await users.isTeamMember(user.id, ownerId));
  if (!member) {
    throw new ForbiddenError(
      "Only a manager can choose an owner from their team",
    );
  }
}
