import { describe, expect, it, vi } from "vitest";
import { OpportunityActionRunner } from "../../src/use-cases/opportunities/opportunity-action-runner.ts";
import {
  detailRow,
  mockRepositories,
  opportunityRow,
  seller,
} from "../helpers/mock-repositories.ts";

const now = new Date("2026-10-15T12:00:00-03:00");

describe("OpportunityActionRunner", () => {
  it("throws NOT_FOUND without running the action when the opportunity is not visible", async () => {
    const { opportunities, unitOfWork } = mockRepositories();
    opportunities.findVisible.mockResolvedValue(null);
    const action = vi.fn();

    await expect(
      new OpportunityActionRunner(unitOfWork).run(seller, 7, now, action),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(action).not.toHaveBeenCalled();
  });

  it("throws FINAL_STAGE without running the action on a closed opportunity", async () => {
    const { opportunities, unitOfWork } = mockRepositories();
    opportunities.findVisible.mockResolvedValue(
      opportunityRow({ stage: "CLOSING" }),
    );
    const action = vi.fn();

    await expect(
      new OpportunityActionRunner(unitOfWork).runOnOpen(seller, 7, now, action),
    ).rejects.toMatchObject({ status: 409, code: "FINAL_STAGE" });
    expect(action).not.toHaveBeenCalled();
  });

  it("runs the action and returns the reloaded detail", async () => {
    const { opportunities, unitOfWork } = mockRepositories();
    opportunities.findVisible.mockResolvedValue(opportunityRow());
    opportunities.findDetail.mockResolvedValue(detailRow());
    const action = vi.fn();

    const detail = await new OpportunityActionRunner(unitOfWork).runOnOpen(
      seller,
      7,
      now,
      action,
    );

    expect(action).toHaveBeenCalledOnce();
    expect(detail).toMatchObject({ id: 7, code: "OPP-7" });
  });
});
