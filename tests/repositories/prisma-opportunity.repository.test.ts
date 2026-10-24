import { beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "../../src/types/user.types.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { PrismaOpportunityRepository } from "../../src/repositories/prisma/prisma-opportunity.repository.ts";
import { resetDatabase } from "../helpers/database.ts";
import { createOpportunity, createUser } from "../helpers/factories.ts";

const opportunities = new PrismaOpportunityRepository(prisma);

async function createTeams() {
  const marcos = await createUser({ name: "Marcos", role: "MANAGER" });
  const otherManager = await createUser({ name: "Paula", role: "MANAGER" });
  const ana = await createUser({ name: "Ana", managerId: marcos.id });
  const bruno = await createUser({ name: "Bruno", managerId: marcos.id });
  const carla = await createUser({ name: "Carla", managerId: otherManager.id });

  return {
    marcos,
    ana,
    anaOpportunity: await createOpportunity({ ownerId: ana.id }),
    brunoOpportunity: await createOpportunity({ ownerId: bruno.id }),
    carlaOpportunity: await createOpportunity({ ownerId: carla.id }),
  };
}

const visibleIds = async (user: CurrentUser) =>
  (await opportunities.findVisibleCards(user, { includeLost: true }))
    .map((opportunity) => opportunity.id)
    .sort((a, b) => a - b);

describe("findVisible", () => {
  beforeEach(resetDatabase);

  it("finds the seller's own opportunity", async () => {
    const { ana, anaOpportunity } = await createTeams();

    expect((await opportunities.findVisible(ana, anaOpportunity.id))?.id).toBe(
      anaOpportunity.id,
    );
  });

  it("hides another seller's opportunity as if it did not exist", async () => {
    const { ana, brunoOpportunity } = await createTeams();

    expect(
      await opportunities.findVisible(ana, brunoOpportunity.id),
    ).toBeNull();
    expect(await opportunities.findVisible(ana, 999_999)).toBeNull();
  });

  it("lets the manager find the team's opportunities only", async () => {
    const { marcos, anaOpportunity, carlaOpportunity } = await createTeams();

    expect(
      (await opportunities.findVisible(marcos, anaOpportunity.id))?.id,
    ).toBe(anaOpportunity.id);
    expect(
      await opportunities.findVisible(marcos, carlaOpportunity.id),
    ).toBeNull();
  });
});

describe("findVisibleCards", () => {
  beforeEach(resetDatabase);

  it("limits the seller to their own opportunities", async () => {
    const { ana, anaOpportunity } = await createTeams();

    expect(await visibleIds(ana)).toEqual([anaOpportunity.id]);
  });

  it("limits the manager to the team's opportunities", async () => {
    const { marcos, anaOpportunity, brunoOpportunity } = await createTeams();

    expect(await visibleIds(marcos)).toEqual([
      anaOpportunity.id,
      brunoOpportunity.id,
    ]);
  });
});
