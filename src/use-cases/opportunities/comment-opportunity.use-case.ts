import type { CommentOpportunityDto } from "../../dtos/opportunity-request.dto.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import type { OpportunityActionRunner } from "./opportunity-action-runner.ts";

export class CommentOpportunityUseCase {
  private readonly runner: OpportunityActionRunner;

  constructor(runner: OpportunityActionRunner) {
    this.runner = runner;
  }

  execute(
    user: CurrentUser,
    id: number,
    { body }: CommentOpportunityDto,
    now: Date,
  ) {
    return this.runner.run(user, id, now, ({ opportunities }) =>
      opportunities.addComment({
        opportunityId: id,
        userId: user.id,
        body,
        at: now,
      }),
    );
  }
}
