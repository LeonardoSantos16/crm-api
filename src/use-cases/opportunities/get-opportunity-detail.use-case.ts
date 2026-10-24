import type { OpportunityDetailDto } from "../../dtos/opportunity-response.dto.ts";
import { toOpportunityDetail } from "../../presenters/opportunity.presenter.ts";
import type { OpportunityReader } from "../../repositories/opportunity.repository.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import { findVisibleOpportunity } from "./opportunity-guards.ts";

export class GetOpportunityDetailUseCase {
  private readonly opportunities: OpportunityReader;

  constructor(opportunities: OpportunityReader) {
    this.opportunities = opportunities;
  }

  async execute(
    user: CurrentUser,
    id: number,
    now: Date,
  ): Promise<OpportunityDetailDto> {
    await findVisibleOpportunity(this.opportunities, user, id);
    return toOpportunityDetail(await this.opportunities.findDetail(id), now);
  }
}
