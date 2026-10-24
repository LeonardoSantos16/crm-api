import { describe, expect, it } from "vitest";
import { CreateOpportunityUseCase } from "../../src/use-cases/opportunities/create-opportunity.use-case.ts";
import {
  detailRow,
  manager,
  mockRepositories,
  seller,
} from "../helpers/mock-repositories.ts";

const now = new Date("2026-10-15T12:00:00-03:00");

function setup() {
  const repositories = mockRepositories();
  repositories.companies.findOrCreate.mockResolvedValue({
    id: 3,
    name: "Acme",
  });
  repositories.opportunities.create.mockResolvedValue(7);
  repositories.opportunities.findDetail.mockResolvedValue(detailRow());
  const createOpportunity = new CreateOpportunityUseCase(
    repositories.unitOfWork,
  );
  return { ...repositories, createOpportunity };
}

const input = { companyName: "Acme", contactName: "João" };

describe("CreateOpportunityUseCase", () => {
  it("creates the seller's opportunity owned by the seller", async () => {
    const { opportunities, createOpportunity } = setup();

    await createOpportunity.execute(seller, input, now);

    expect(opportunities.create).toHaveBeenCalledWith({
      contactName: "João",
      companyId: 3,
      ownerId: seller.id,
      createdById: seller.id,
      createdAt: now,
    });
  });

  it("forbids a manager from choosing someone outside the team", async () => {
    const { users, opportunities, createOpportunity } = setup();
    users.isTeamMember.mockResolvedValue(false);

    await expect(
      createOpportunity.execute(manager, { ...input, ownerId: 99 }, now),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(users.isTeamMember).toHaveBeenCalledWith(manager.id, 99);
    expect(opportunities.create).not.toHaveBeenCalled();
  });
});
