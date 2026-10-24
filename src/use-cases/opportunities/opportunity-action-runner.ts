import { isFinalStage } from "../../domain/stages.ts";
import type { OpportunityDetailDto } from "../../dtos/opportunity-response.dto.ts";
import { FinalStageError } from "../../errors/opportunity-errors.ts";
import type { Opportunity } from "../../generated/prisma/client.ts";
import { toOpportunityDetail } from "../../presenters/opportunity.presenter.ts";
import type {
  Repositories,
  UnitOfWork,
} from "../../repositories/unit-of-work.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import { findVisibleOpportunity } from "./opportunity-guards.ts";

export type OpportunityAction = (
  repositories: Repositories,
  current: Opportunity,
) => Promise<void>;

export class OpportunityActionRunner {
  private readonly unitOfWork: UnitOfWork;

  constructor(unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async run(
    user: CurrentUser,
    id: number,
    now: Date,
    action: OpportunityAction,
  ): Promise<OpportunityDetailDto> {
    const opportunity = await this.unitOfWork.run(async (repositories) => {
      const current = await findVisibleOpportunity(
        repositories.opportunities,
        user,
        id,
      );
      await action(repositories, current);
      return repositories.opportunities.findDetail(id);
    });

    return toOpportunityDetail(opportunity, now);
  }

  runOnOpen(
    user: CurrentUser,
    id: number,
    now: Date,
    action: OpportunityAction,
  ): Promise<OpportunityDetailDto> {
    return this.run(user, id, now, async (repositories, current) => {
      if (isFinalStage(current.stage)) throw new FinalStageError();
      await action(repositories, current);
    });
  }
}
