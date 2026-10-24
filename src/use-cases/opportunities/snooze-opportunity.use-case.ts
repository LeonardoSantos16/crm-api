import type { SnoozeOpportunityDto } from "../../dtos/opportunity-request.dto.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import type { OpportunityActionRunner } from "./opportunity-action-runner.ts";

export class SnoozeOpportunityUseCase {
  private readonly runner: OpportunityActionRunner;

  constructor(runner: OpportunityActionRunner) {
    this.runner = runner;
  }

  execute(
    user: CurrentUser,
    id: number,
    { until, reason }: SnoozeOpportunityDto,
    now: Date,
  ) {
    return this.runner.runOnOpen(user, id, now, ({ opportunities }) =>
      opportunities.recordSnooze({
        opportunityId: id,
        userId: user.id,
        until,
        reason: reason ?? null,
        at: now,
      }),
    );
  }
}
