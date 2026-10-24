import { buildBoard } from "../../domain/board.ts";
import type { ListOpportunitiesDto } from "../../dtos/opportunity-request.dto.ts";
import type { OpportunityBoardDto } from "../../dtos/opportunity-response.dto.ts";
import { toOpportunityCard } from "../../presenters/opportunity.presenter.ts";
import type { OpportunityReader } from "../../repositories/opportunity.repository.ts";
import type { UserRepository } from "../../repositories/user.repository.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import { assertTeamMember } from "./opportunity-guards.ts";

export class ListOpportunitiesUseCase {
  private readonly opportunities: OpportunityReader;
  private readonly users: UserRepository;

  constructor(opportunities: OpportunityReader, users: UserRepository) {
    this.opportunities = opportunities;
    this.users = users;
  }

  async execute(
    user: CurrentUser,
    { ownerId, includeLost = false, ...filter }: ListOpportunitiesDto,
    now: Date,
  ): Promise<OpportunityBoardDto> {
    if (ownerId !== undefined) {
      await assertTeamMember(this.users, user, ownerId);
    }

    const rows = await this.opportunities.findVisibleCards(user, {
      ownerId,
      includeLost,
    });
    const cards = rows.map((row) => toOpportunityCard(row, now));

    return buildBoard(cards, filter, now);
  }
}
