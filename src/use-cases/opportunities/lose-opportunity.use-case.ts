import type { LoseOpportunityDto } from "../../dtos/opportunity-request.dto.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import type { OpportunityActionRunner } from "./opportunity-action-runner.ts";

export class LoseOpportunityUseCase {
  private readonly runner: OpportunityActionRunner;

  constructor(runner: OpportunityActionRunner) {
    this.runner = runner;
  }

  execute(
    user: CurrentUser,
    id: number,
    { reason, detail }: LoseOpportunityDto,
    now: Date,
  ) {
    return this.runner.runOnOpen(user, id, now, ({ opportunities }, current) =>
      opportunities.changeStage({
        opportunityId: id,
        fromStage: current.stage,
        toStage: "LOST",
        userId: user.id,
        at: now,
        lossReason: reason,
        lossDetail: detail ?? null,
      }),
    );
  }
}
