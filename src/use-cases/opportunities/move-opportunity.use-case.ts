import { checkTransition } from "../../domain/transitions.ts";
import type { MoveOpportunityDto } from "../../dtos/opportunity-request.dto.ts";
import {
  InvalidTransitionError,
  MissingValueOrItemsError,
} from "../../errors/opportunity-errors.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import type { OpportunityActionRunner } from "./opportunity-action-runner.ts";

export class MoveOpportunityUseCase {
  private readonly runner: OpportunityActionRunner;

  constructor(runner: OpportunityActionRunner) {
    this.runner = runner;
  }

  execute(
    user: CurrentUser,
    id: number,
    { toStage, complete }: MoveOpportunityDto,
    now: Date,
  ) {
    return this.runner.runOnOpen(
      user,
      id,
      now,
      async ({ opportunities }, current) => {
        const result = checkTransition(
          {
            stage: current.stage,
            hasEstimatedValue:
              complete?.estimatedValue !== undefined ||
              current.estimatedValue !== null,
            itemCount:
              complete?.items?.length ?? (await opportunities.countItems(id)),
          },
          toStage,
        );
        if (!result.allowed) throw new InvalidTransitionError(result.reason);
        if (result.missing) throw new MissingValueOrItemsError(result.missing);

        if (complete?.items) {
          await opportunities.replaceItems(id, complete.items);
        }

        await opportunities.changeStage({
          opportunityId: id,
          fromStage: current.stage,
          toStage,
          userId: user.id,
          at: now,
          estimatedValue: complete?.estimatedValue,
        });
      },
    );
  }
}
