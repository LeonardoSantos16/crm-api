import { missingValueOrItems } from "../../domain/transitions.ts";
import type { UpdateOpportunityDto } from "../../dtos/opportunity-request.dto.ts";
import { MissingValueOrItemsError } from "../../errors/opportunity-errors.ts";
import type { CurrentUser } from "../../types/user.types.ts";
import type { OpportunityActionRunner } from "./opportunity-action-runner.ts";

export class UpdateOpportunityUseCase {
  private readonly runner: OpportunityActionRunner;

  constructor(runner: OpportunityActionRunner) {
    this.runner = runner;
  }

  execute(
    user: CurrentUser,
    id: number,
    { companyName, items, ...changes }: UpdateOpportunityDto,
    now: Date,
  ) {
    return this.runner.runOnOpen(
      user,
      id,
      now,
      async ({ companies, opportunities }, current) => {
        if (current.stage !== "FIRST_CONTACT") {
          const missing = missingValueOrItems({
            hasEstimatedValue:
              changes.estimatedValue === undefined
                ? current.estimatedValue !== null
                : changes.estimatedValue !== null,
            itemCount: items?.length ?? (await opportunities.countItems(id)),
          });
          if (missing.length > 0) throw new MissingValueOrItemsError(missing);
        }

        const company = companyName
          ? await companies.findOrCreate(companyName)
          : undefined;
        await opportunities.update(id, { ...changes, companyId: company?.id });
        if (items) await opportunities.replaceItems(id, items);
      },
    );
  }
}
