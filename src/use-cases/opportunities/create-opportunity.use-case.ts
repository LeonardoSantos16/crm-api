import type { CreateOpportunityDto } from "../../dtos/opportunity-request.dto.ts";
import type { OpportunityDetailDto } from "../../dtos/opportunity-response.dto.ts";
import { ForbiddenError, ValidationError } from "../../errors/http-errors.ts";
import { toOpportunityDetail } from "../../presenters/opportunity.presenter.ts";
import type { UnitOfWork } from "../../repositories/unit-of-work.ts";
import type { UserRepository } from "../../repositories/user.repository.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import { assertTeamMember } from "./opportunity-guards.ts";

async function resolveOwner(
  users: UserRepository,
  user: CurrentUser,
  ownerId: number | undefined,
) {
  if (user.role === "MANAGER") {
    if (ownerId === undefined) {
      throw new ValidationError(
        "Managers must choose an owner from their team",
        [{ path: ["ownerId"], message: "Required for managers" }],
      );
    }
    await assertTeamMember(users, user, ownerId);
    return ownerId;
  }
  if (ownerId === undefined || ownerId === user.id) return user.id;
  throw new ForbiddenError(
    "Sellers can only create opportunities for themselves",
  );
}

export class CreateOpportunityUseCase {
  private readonly unitOfWork: UnitOfWork;

  constructor(unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(
    user: CurrentUser,
    { companyName, ownerId, ...data }: CreateOpportunityDto,
    now: Date,
  ): Promise<OpportunityDetailDto> {
    const opportunity = await this.unitOfWork.run(
      async ({ companies, opportunities, users }) => {
        const owner = await resolveOwner(users, user, ownerId);
        const company = await companies.findOrCreate(companyName);
        const id = await opportunities.create({
          ...data,
          companyId: company.id,
          ownerId: owner,
          createdById: user.id,
          createdAt: now,
        });
        return opportunities.findDetail(id);
      },
    );

    return toOpportunityDetail(opportunity, now);
  }
}
