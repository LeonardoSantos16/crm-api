import { describe, expect, it } from "vitest";
import { MoveOpportunityUseCase } from "../../src/use-cases/opportunities/move-opportunity.use-case.ts";
import { OpportunityActionRunner } from "../../src/use-cases/opportunities/opportunity-action-runner.ts";
import {
  detailRow,
  mockRepositories,
  opportunityRow,
  seller,
} from "../helpers/mock-repositories.ts";

const now = new Date("2026-10-15T12:00:00-03:00");

function setup() {
  const repositories = mockRepositories();
  repositories.opportunities.findVisible.mockResolvedValue(opportunityRow());
  repositories.opportunities.findDetail.mockResolvedValue(detailRow());
  const moveOpportunity = new MoveOpportunityUseCase(
    new OpportunityActionRunner(repositories.unitOfWork),
  );
  return { ...repositories, moveOpportunity };
}

describe("MoveOpportunityUseCase", () => {
  it("rejects a transition the domain does not allow without writing", async () => {
    const { opportunities, moveOpportunity } = setup();

    await expect(
      moveOpportunity.execute(seller, 7, { toStage: "FORECAST" }, now),
    ).rejects.toMatchObject({ status: 409, code: "INVALID_TRANSITION" });
    expect(opportunities.changeStage).not.toHaveBeenCalled();
  });

  it("completes the missing data before changing the stage", async () => {
    const { opportunities, moveOpportunity } = setup();
    const items = [{ description: "Caneca", quantity: 10 }];

    await moveOpportunity.execute(
      seller,
      7,
      {
        toStage: "BUDGET_PRESENTATION",
        complete: { estimatedValue: 1500, items },
      },
      now,
    );

    expect(opportunities.replaceItems).toHaveBeenCalledWith(7, items);
    expect(opportunities.changeStage).toHaveBeenCalledWith({
      opportunityId: 7,
      fromStage: "FIRST_CONTACT",
      toStage: "BUDGET_PRESENTATION",
      userId: seller.id,
      at: now,
      estimatedValue: 1500,
    });
  });
});
