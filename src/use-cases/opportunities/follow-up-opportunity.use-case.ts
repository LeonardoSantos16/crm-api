import type { FollowUpOpportunityDto } from "../../dtos/opportunity-request.dto.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import type { OpportunityActionRunner } from "./opportunity-action-runner.ts";

export class FollowUpOpportunityUseCase {
  private readonly runner: OpportunityActionRunner;

  constructor(runner: OpportunityActionRunner) {
    this.runner = runner;
  }

  execute(
    user: CurrentUser,
    id: number,
    { channel, summary, nextDate }: FollowUpOpportunityDto,
    now: Date,
  ) {
    return this.runner.runOnOpen(user, id, now, ({ opportunities }) =>
      opportunities.recordFollowUp({
        opportunityId: id,
        userId: user.id,
        channel: channel ?? null,
        summary: summary ?? null,
        nextDate: nextDate ?? null,
        at: now,
      }),
    );
  }
}
